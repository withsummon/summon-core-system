import { z } from "zod/v4";

export const mailSender = "notifications@withsummon.com";
export const resendApiKey = z
  .string()
  .trim()
  .min(1)
  .max(8192)
  .regex(/^[^\r\n]+$/, "Enter a valid Resend API key.");
export function currentOrigin(env: Record<string, string | undefined>) {
  const site = env.SITE_URL;
  if (!site || !URL.canParse(site)) return null;
  const url = new URL(site);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
}
// Operator configuration is consumed before bootstrap and by explicit adoption
// or the retained Convex Auth rollback provider, never an initialized fallback.
export function mailConfiguration(env: Record<string, string | undefined>) {
  const key = resendApiKey.safeParse(env.AUTH_RESEND_KEY);
  const siteUrl = currentOrigin(env);
  return key.success && siteUrl ? { apiKey: key.data, from: mailSender, siteUrl } : null;
}
