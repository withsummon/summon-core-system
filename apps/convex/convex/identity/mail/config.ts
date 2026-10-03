export function mailConfiguration(env: Record<string, string | undefined>) {
  const apiKey = env.AUTH_RESEND_KEY;
  const from = env.EMAIL_FROM;
  const site = env.SITE_URL;
  if (!apiKey || !from || !site) return null;
  if (from.length > 320 || /[\r\n]/.test(from)) return null;
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  return { apiKey, from, siteUrl: url.origin };
}
