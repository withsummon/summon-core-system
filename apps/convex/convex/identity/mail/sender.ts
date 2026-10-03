import { mailConfiguration } from "./config";
export async function sendAccountEmail(to: string, subject: string, text: string, idempotencyKey?: string) {
  const config = mailConfiguration(process.env);
  if (!config) throw new Error("Account email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: config.from, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error("Account email could not be sent.");
}
