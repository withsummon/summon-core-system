import { mailConfiguration } from "./mail/config";
/** Operator env policy; defaults match inherited runtime providers, not DB seed overrides. */
export function signInPolicy(env: Record<string, string | undefined>) {
  const mail = mailConfiguration(env) !== null;
  const password = (env.ENABLE_EMAIL_PASSWORD ?? "1") === "1";
  const magicEnabled = (env.ENABLE_MAGIC_LINK_LOGIN ?? "1") === "1";
  return {
    password,
    magic: magicEnabled && mail,
    passwordReset: password && mail,
    emailVerification: password && mail,
  };
}
