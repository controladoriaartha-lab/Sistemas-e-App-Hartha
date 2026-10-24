// supabase/functions/signup/index.ts
// Cria a conta ja confirmada, sem enviar e-mail (evita o limite de envio do
// plano gratuito). O cadastro e SOMENTE POR CONVITE: exige um codigo de uso
// unico (tabela signup_invites; gere com `select public.create_invite(7, 'nota')`).
// Deploy: supabase functions deploy signup --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Limite simples por IP (memoria da instancia): 8 cadastros por hora.
const tentativas = new Map<string, number[]>();
function limitado(ip: string) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) ?? []).filter((t) => agora - t < 3_600_000);
  lista.push(agora);
  tentativas.set(ip, lista);
  return lista.length > 8;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo nao permitido" }, 405);

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
    if (limitado(ip)) return json({ error: "muitas tentativas, tente em instantes", code: "rate_limited" }, 429);

    const { email, password, invite } = await req.json();
    const mail = String(email ?? "").trim().toLowerCase();
    const senha = String(password ?? "");
    const convite = String(invite ?? "").trim();
    if (!/^inv_[0-9a-f]{36}$/.test(convite)) {
      return json({ error: "o cadastro e so por convite", code: "invite_required" }, 403);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) || mail.length > 254) {
      return json({ error: "e-mail invalido", code: "invalid_email" }, 400);
    }
    if (senha.length < 6 || senha.length > 72) {
      return json({ error: "a senha precisa ter de 6 a 72 caracteres", code: "weak_password" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // consome o convite de forma atomica (uso unico, com validade)
    const hash = await sha256(convite);
    const { data: usado, error: eInv } = await admin
      .from("signup_invites")
      .update({ used_at: new Date().toISOString(), used_by_email: mail })
      .eq("code_hash", hash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (eInv) throw eInv;
    if (!usado) return json({ error: "convite invalido, usado ou expirado", code: "invite_invalid" }, 403);

    const { error } = await admin.auth.admin.createUser({ email: mail, password: senha, email_confirm: true });
    if (error) {
      // devolve o convite para poder tentar de novo
      await admin.from("signup_invites").update({ used_at: null, used_by_email: null }).eq("id", usado.id);
      const jaExiste = /already|registered|exists/i.test(error.message);
      return json({ error: error.message, code: jaExiste ? "email_exists" : "create_failed" }, jaExiste ? 409 : 400);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message, code: "server_error" }, 500);
  }
});
