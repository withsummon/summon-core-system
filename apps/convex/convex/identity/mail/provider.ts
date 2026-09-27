import { Email } from "@convex-dev/auth/providers/Email";
import { mailConfiguration } from "./config";
export function verificationEmail(purpose: "reset" | "verify" | "magic") {
  const minutes = purpose === "magic" ? 10 : 15;
  const label = purpose === "reset" ? "password reset" : purpose === "verify" ? "email verification" : "sign-in";
  return Email({
    id: `summon-${purpose}`,
    maxAge: minutes * 60,
    async sendVerificationRequest({ identifier, token }) {
      const config = mailConfiguration(process.env);
      if (!config) throw new Error("Account email delivery is not configured.");
      // Convex Auth owns random token generation, hashing, expiry and single-use consumption.
      // Send the code rather than a caller-controlled redirect URL.
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [identifier],
          subject:
            purpose === "reset"
              ? "Reset your Summon password"
              : purpose === "verify"
                ? "Verify your Summon email"
                : "Your Summon sign-in code",
          text: `Your Summon ${label} code is:\n\n${token}\n\nThis code expires in ${minutes} minutes. If you did not request it, ignore this message.`,
        }),
      });
      if (!response.ok) throw new Error("Account email could not be sent.");
    },
  });
}
