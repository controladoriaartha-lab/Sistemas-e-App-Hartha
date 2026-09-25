import { useSyncExternalStore } from "react";
import { currentUserId, deleteIds, fetchRemote, upsertMany } from "@/lib/cloud";
import type { Workout } from "@/lib/types";

/**
 * Nuvem = fonte da verdade; o localStorage vira so cache/fila. Toda mudanca
 * feita no app marca uma pendencia (persistida) e tenta enviar; se falhar
 * (sem internet), a pendencia fica guardada e e reenviada depois, ANTES de
 * qualquer leitura da nuvem — assim nada digitado offline e sobrescrito.
 */

const KEY = "forja-sync-v1";

type Pending = { dirty: boolean; replace: boolean; deletes: string[]; migrated: string[] };

function load(): Pending {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") {
      return {
        dirty: !!raw.dirty,
        replace: !!raw.replace,
        deletes: Array.isArray(raw.deletes) ? raw.deletes : [],
        migrated: Array.isArray(raw.migrated) ? raw.migrated : [],
      };
    }
  } catch {
    // ignora
  }
  return { dirty: false, replace: false, deletes: [], migrated: [] };
}

function save(p: Pending) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // sem espaco: a fila em memoria continua valendo nesta sessao
  }
}

let pending: Pending | null = null;
const get = (): Pending => (pending ??= load());
let version = 0;

export type SyncIO = { getLocal: () => Workout[]; setLocal: (list: Workout[]) => void };
let io: SyncIO | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function registerSyncIO(next: SyncIO) {
  io = next;
}

export function markDirty() {
  get().dirty = true;
  save(get());
  version += 1;
  requestSync();
}

export function markDelete(id: string) {
  const p = get();
  if (!p.deletes.includes(id)) p.deletes.push(id);
  save(p);
  version += 1;
  requestSync();
}

export function markReplace() {
  const p = get();
  p.dirty = true;
  p.replace = true;
  p.deletes = [];
  save(p);
  version += 1;
  requestSync();
}

export function requestSync(delay = 300) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

// ---- status ------------------------------------------------------------

export type SyncStatus = { firstDone: boolean; state: "idle" | "syncing" | "ok" | "error"; error: string };
let status: SyncStatus = { firstDone: false, state: "idle", error: "" };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
const serverStatus: SyncStatus = { firstDone: false, state: "idle", error: "" };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => serverStatus,
  );
}

export function resetSyncForLogout() {
  setStatus({ firstDone: false, state: "idle", error: "" });
}

// ---- sincronizacao -----------------------------------------------------

let running = false;

export async function syncNow() {
  const uid = currentUserId();
  if (!uid || !io) return;
  if (running) {
    requestSync(500);
    return;
  }
  running = true;
  setStatus({ state: "syncing" });
  try {
    const p = get();

    // Migracao unica: envia os treinos reais que ja estavam neste aparelho.
    if (!p.migrated.includes(uid)) {
      const real = io.getLocal().filter((w) => !w.id.startsWith("seed-"));
      if (real.length) await upsertMany(uid, real, true);
      p.migrated.push(uid);
      save(p);
    }

    // Reenvia o que ficou pendente (offline ou falha anterior).
    if (p.deletes.length) {
      await deleteIds(p.deletes);
      p.deletes = [];
      save(p);
    }
    if (p.dirty || p.replace) {
      const local = io.getLocal();
      await upsertMany(uid, local);
      if (p.replace) {
        const keep = new Set(local.map((w) => w.id));
        const remoteIds = (await fetchRemote()).map((w) => w.id).filter((id) => !keep.has(id));
        if (remoteIds.length) await deleteIds(remoteIds);
      }
      p.dirty = false;
      p.replace = false;
      save(p);
    }

    const startVersion = version;
    const remote = await fetchRemote();
    if (startVersion === version) io.setLocal(remote);
    setStatus({ state: "ok", firstDone: true, error: "" });
  } catch (err) {
    console.error("[forja] sincronizacao falhou:", err);
    setStatus({ state: "error", error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => requestSync(0));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestSync(0);
  });
}
