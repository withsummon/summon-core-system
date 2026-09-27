import { Email } from "@convex-dev/auth/providers/Email";
import { mailConfiguration } from "./config";
export function verificationEmail(purpose: "reset" | "verify") {
  return Email({
    id: `summon-${purpose}`,
    maxAge: 15 * 60,
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
          subject: purpose === "reset" ? "Reset your Summon password" : "Verify your Summon email",
          text: `Your Summon ${purpose === "reset" ? "password reset" : "email verification"} code is:\n\n${token}\n\nThis code expires in 15 minutes. If you did not request it, ignore this message.`,
        }),
      });
      if (!response.ok) throw new Error("Account email could not be sent.");
    },
  });
}
