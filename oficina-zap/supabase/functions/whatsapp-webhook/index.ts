// OficinaZap · webhook da WhatsApp Cloud API (Supabase Edge Function, Deno)
// Esqueleto da Fase 1: verificação, assinatura, idempotência e roteamento por oficina.
// A interpretação (LLM), agenda e financeiro entram nas Fases 2 e 3.
import { createClient } from "npm:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN")!;
const APP_SECRET = Deno.env.get("WA_APP_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function assinaturaValida(corpo: string, cabecalho: string | null) {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  const esperado = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = cabecalho.slice(7);
  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Handshake de verificação da Meta
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === VERIFY_TOKEN;
    return ok
      ? new Response(url.searchParams.get("hub.challenge"), { status: 200 })
      : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const corpo = await req.text();
  if (!(await assinaturaValida(corpo, req.headers.get("x-hub-signature-256")))) {
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(corpo);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const valor = change.value ?? {};
      const phoneNumberId: string | undefined = valor.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Qual oficina é dona deste número?
      const { data: oficina } = await supabase
        .from("oficinas").select("id").eq("wa_phone_number_id", phoneNumberId).maybeSingle();
      if (!oficina) continue;

      for (const msg of valor.messages ?? []) {
        // Idempotência: a Meta reenvia webhooks; o mesmo wa_message_id nunca é processado duas vezes.
        const { error } = await supabase.from("mensagens_whatsapp").insert({
          wa_message_id: msg.id, oficina_id: oficina.id, telefone: msg.from,
          direcao: "entrada", tipo: msg.type,
        });
        if (error) continue; // duplicada

        // TODO Fase 2/3: carregar `conversas`, checar `contatos_autorizados` (dono × cliente),
        // consentimento LGPD, rotear por intenção (agendar | financeiro | relatório) e responder.
      }
    }
  }
  return new Response("ok", { status: 200 }); // responder 200 rápido evita reentregas
});
