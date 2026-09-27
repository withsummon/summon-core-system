import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { getPasswordStrength } from "@plane/utils";

/** Existing account-creation UX; sign-in must not reject an existing weaker password. */
export function newPasswordError(password: string, confirmation: string): "mismatch" | "strength" | null {
  if (password !== confirmation) return "mismatch";
  return getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID ? null : "strength";
}
