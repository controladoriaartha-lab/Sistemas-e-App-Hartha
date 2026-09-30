/**
 * Passkey/WebAuthn helpers shared between the login screen (sign in) and the
 * Painel (register a passkey on this device). Requires Passkeys to be turned
 * on for the Supabase project (Authentication > Passkeys) — until then every
 * call fails with the `passkey_disabled` error code.
 */

/**
 * Whether this device offers a platform authenticator (fingerprint, Face
 * unlock, tela de bloqueio) that WebAuthn/passkeys can use. False (not an
 * error) on browsers without WebAuthn at all.
 */
export async function hasBiometricUnlock(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * `error` from `signInWithPasskey`/`registerPasskey` is either a WebAuthnError
 * (ceremony ran on-device — code like "ERROR_CEREMONY_ABORTED") or an
 * AuthError from the server (code like "webauthn_credential_not_found"; see
 * https://supabase.com/docs/guides/auth/passkeys#error-codes). Returns "" for
 * a plain user cancel, which isn't worth showing as an error.
 */
export function friendlyPasskeyError(error: { code?: string | null; message?: string }): string {
  const code = error.code ?? "";
  if (code === "ERROR_CEREMONY_ABORTED") return "";
  if (code.startsWith("ERROR_AUTHENTICATOR") || code.startsWith("ERROR_AUTO_REGISTER")) {
    return "Este aparelho não conseguiu confirmar a biometria. Tente de novo.";
  }
  if (code === "passkey_disabled") {
    return "A entrada por biometria ainda não foi ativada nesta conta.";
  }
  if (code === "webauthn_credential_not_found") {
    return "Nenhuma biometria cadastrada neste aparelho ainda. Entre com e-mail e senha e cadastre no Painel.";
  }
  if (code === "webauthn_credential_exists") {
    return "Este aparelho já está cadastrado.";
  }
  if (code === "webauthn_challenge_expired" || code === "webauthn_challenge_not_found") {
    return "Demorou demais para confirmar. Toque no botão de novo.";
  }
  if (code === "too_many_passkeys") {
    return "Este aparelho já tem o máximo de biometrias cadastradas para a conta.";
  }
  return error.message || "Não foi possível concluir a biometria.";
}
