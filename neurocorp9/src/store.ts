import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Atividade, Classificacao } from "./types";

const KEY = "jari.atividades.v1";

function lerLocal(): Atividade[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Atividade[]) : [];
  } catch {
    return [];
  }
}

function novoId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useSessao() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(!supabase);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setPronto(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { sessao, pronto, nuvem: Boolean(supabase), recuperando, fimRecuperacao: () => setRecuperando(false) };
}

// userId definido => dados na nuvem (activities_log + realtime); senao localStorage.
export function useAtividades(userId: string | null) {
  const [lista, setLista] = useState<Atividade[]>(() => (userId ? [] : lerLocal()));
  const [erro, setErro] = useState<string | null>(null);

  // modo local: carrega ao deslogar e persiste a cada mudanca
  useEffect(() => {
    if (!userId) setLista(lerLocal());
  }, [userId]);
  useEffect(() => {
    if (userId) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lista));
    } catch {
      /* armazenamento indisponivel: segue so em memoria */
    }
  }, [lista, userId]);

  // modo nuvem: carga inicial + realtime
  useEffect(() => {
    if (!userId || !supabase) return;
    const sb = supabase;
    let vivo = true;
    sb.from("activities_log")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setErro(error.message);
        else setLista((data ?? []) as Atividade[]);
      });
    const canal = sb
      .channel(`activities:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities_log", filter: `user_id=eq.${userId}` },
        (p) => {
          if (p.eventType === "DELETE") {
            const id = (p.old as { id?: string }).id;
            setLista((l) => l.filter((a) => a.id !== id));
          } else {
            const novo = p.new as Atividade;
            setLista((l) => (l.some((a) => a.id === novo.id) ? l.map((a) => (a.id === novo.id ? novo : a)) : [...l, novo]));
          }
        },
      )
      .subscribe();
    return () => {
      vivo = false;
      sb.removeChannel(canal);
    };
  }, [userId]);

  const adicionar = useCallback(
    async (itens: Classificacao[], quando: Date = new Date()) => {
      const novos = itens.map<Atividade>((c, i) => ({
        ...c,
        id: novoId(),
        created_at: new Date(quando.getTime() + i * 1000).toISOString(),
      }));
      setLista((l) => [...l, ...novos]);
      if (userId && supabase) {
        const { error } = await supabase.from("activities_log").insert(novos.map((n) => ({ ...n, user_id: userId })));
        if (error) {
          setErro(error.message);
          const ids = new Set(novos.map((n) => n.id));
          setLista((l) => l.filter((a) => !ids.has(a.id)));
        }
      }
    },
    [userId],
  );

  const remover = useCallback(
    async (id: string) => {
      setLista((l) => l.filter((a) => a.id !== id));
      if (userId && supabase) {
        const { error } = await supabase.from("activities_log").delete().eq("id", id);
        if (error) setErro(error.message);
      }
    },
    [userId],
  );

  const atualizar = useCallback(
    async (id: string, parcial: Partial<Atividade>) => {
      let final: Atividade | undefined;
      setLista((l) =>
        l.map((a) => {
          if (a.id !== id) return a;
          const n = { ...a, ...parcial };
          n.score = Math.round((n.duracao_min * n.intensidade) / 2);
          final = n;
          return n;
        }),
      );
      if (userId && supabase && final) {
        const { error } = await supabase
          .from("activities_log")
          .update({ intensidade: final.intensidade, duracao_min: final.duracao_min, score: final.score })
          .eq("id", id);
        if (error) setErro(error.message);
      }
    },
    [userId],
  );

  const limpar = useCallback(async () => {
    setLista([]);
    if (userId && supabase) {
      const { error } = await supabase.from("activities_log").delete().eq("user_id", userId);
      if (error) setErro(error.message);
    }
  }, [userId]);

  return { lista, adicionar, remover, atualizar, limpar, erro };
}
