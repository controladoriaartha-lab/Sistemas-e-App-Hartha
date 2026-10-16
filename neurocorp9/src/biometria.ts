// Bloqueio por digital / Face ID / PIN do aparelho via WebAuthn (autenticador de plataforma).
// E um bloqueio local de conveniencia: a sessao continua sendo a do Supabase.

const CHAVE = "neurocorp9.bio.v1";

type Registro = Record<string, string>; // userId -> credentialId (base64url)

function ler(): Registro {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Registro;
  } catch {
    return {};
  }
}

function gravar(r: Registro) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    /* armazenamento indisponivel */
  }
}

const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const deB64 = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

const aleatorio = () => crypto.getRandomValues(new Uint8Array(32));

export async function biometriaDisponivel(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function biometriaAtiva(userId: string): boolean {
  return Boolean(ler()[userId]);
}

export function desativarBiometria(userId: string) {
  const r = ler();
  delete r[userId];
  gravar(r);
}

/** Cadastra a digital do aparelho. Lanca erro se a pessoa cancelar. */
export async function ativarBiometria(userId: string, email: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "NEUROCORP9" },
      user: { id: new TextEncoder().encode(userId), name: email, displayName: email },
      challenge: aleatorio(),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelado");
  const r = ler();
  r[userId] = b64(cred.rawId);
  gravar(r);
}

/** Pede a digital. Retorna true se a pessoa foi reconhecida. */
export async function verificarBiometria(userId: string): Promise<boolean> {
  const id = ler()[userId];
  if (!id) return true;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: aleatorio(),
        allowCredentials: [{ type: "public-key", id: deB64(id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return Boolean(res);
  } catch {
    return false;
  }
}
