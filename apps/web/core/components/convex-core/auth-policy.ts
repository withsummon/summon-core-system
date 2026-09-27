import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";

export type Flow =
  | "signIn"
  | "signUp"
  | "reset"
  | "reset-verification"
  | "email-verification"
  | "magic"
  | "magic-verification";
type Availability = FunctionReturnType<typeof api.identity.mail.availability.get>;

export function authFlowEnabled(flow: Flow, policy: Availability): boolean {
  switch (flow) {
    case "signIn":
    case "signUp":
      return policy.passwordSignIn;
    case "reset":
    case "reset-verification":
      return policy.passwordSignIn && policy.passwordReset;
    case "email-verification":
      return policy.passwordSignIn && policy.emailVerification;
    case "magic":
    case "magic-verification":
      return policy.magicCode;
  }
}
