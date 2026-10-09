import type { QueryCtx } from "../_generated/server";
import { authenticationDecision } from "./instance/authentication";
import { currentMailReadiness } from "./instance/email";
import { mailConfiguration } from "./mail/config";
/** Operator env policy; defaults match inherited runtime providers, not DB seed overrides. */
export function signInPolicy(env: Record<string, string | undefined>) {
  const mail = mailConfiguration(env) !== null;
  const password = (env.ENABLE_EMAIL_PASSWORD ?? "1") === "1";
  const magicEnabled = (env.ENABLE_MAGIC_LINK_LOGIN ?? "1") === "1";
  return signInAvailability(password, magicEnabled, mail);
}
export function signInAvailability(password: boolean, magicEnabled: boolean, mail: boolean) {
  return {
    password,
    magic: magicEnabled && mail,
    passwordReset: password && mail,
    emailVerification: password && mail,
  };
}

export async function currentSignInPolicy(ctx: QueryCtx, subject?: Parameters<typeof authenticationDecision>[1]) {
  const { authentication, administratorPassword } = await authenticationDecision(ctx, subject);
  return {
    ...signInAvailability(
      authentication.passwordEnabled || administratorPassword,
      authentication.magicEnabled,
      (await currentMailReadiness(ctx)).configured
    ),
    signupEnabled: authentication.signupEnabled,
    providers: authentication.providers,
  };
}
