import { z } from "zod/v4";
import type { mailConfiguration } from "./config";

const acceptance = z.object({ id: z.string().min(1) });
export async function sendAccountEmail(
  config: NonNullable<ReturnType<typeof mailConfiguration>>,
  to: string,
  subject: string,
  text: string,
  idempotencyKey?: string
) {
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
  const receipt = acceptance.safeParse(await response.json());
  if (!receipt.success) throw new Error("Account email acceptance could not be confirmed.");
  return receipt.data.id;
}
