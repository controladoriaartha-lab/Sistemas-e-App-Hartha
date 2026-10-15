// supabase/functions/signup/index.ts
// Cria a conta ja confirmada, sem enviar e-mail (evita o limite de envio do
// plano gratuito). Deploy: supabase functions deploy signup --no-verify-jwt
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo nao permitido" }, 405);

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
    if (limitado(ip)) return json({ error: "muitas tentativas, tente em instantes", code: "rate_limited" }, 429);

    const { email, password } = await req.json();
    const mail = String(email ?? "").trim().toLowerCase();
    const senha = String(password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) || mail.length > 254) {
      return json({ error: "e-mail invalido", code: "invalid_email" }, 400);
    }
    if (senha.length < 6 || senha.length > 72) {
      return json({ error: "a senha precisa ter de 6 a 72 caracteres", code: "weak_password" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { error } = await admin.auth.admin.createUser({ email: mail, password: senha, email_confirm: true });
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      return json({ error: error.message, code: jaExiste ? "email_exists" : "create_failed" }, jaExiste ? 409 : 400);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message, code: "server_error" }, 500);
  }
});
