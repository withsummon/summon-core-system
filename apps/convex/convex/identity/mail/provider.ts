import { Email } from "@convex-dev/auth/providers/Email";
import { sendAccountEmail } from "./sender";
export function verificationEmail(purpose: "reset" | "verify" | "magic") {
  const minutes = purpose === "magic" ? 10 : 15;
  const label = purpose === "reset" ? "password reset" : purpose === "verify" ? "email verification" : "sign-in";
  return Email({
    id: `summon-${purpose}`,
    maxAge: minutes * 60,
    async sendVerificationRequest({ identifier, token }) {
      // Convex Auth owns token generation, expiry and single-use consumption.
      await sendAccountEmail(
        identifier,
        purpose === "reset"
          ? "Reset your Summon password"
          : purpose === "verify"
            ? "Verify your Summon email"
            : "Your Summon sign-in code",
        `Your Summon ${label} code is:\n\n${token}\n\nThis code expires in ${minutes} minutes. If you did not request it, ignore this message.`
      );
    },
  });
}
