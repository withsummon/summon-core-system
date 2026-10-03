export function providerConfig(env: Record<string, string | undefined>) {
  const provider = env.LLM_PROVIDER ?? "openai";
  if (provider !== "openai" && provider !== "openai_compatible") throw new Error("Unsupported assistant provider.");
  const key = env.LLM_API_KEY;
  if (!key) throw new Error("Assistant provider is not configured.");
  const model = env.LLM_MODEL || env.GPT_ENGINE || "gpt-4o-mini";
  const base = provider === "openai" ? "https://api.openai.com/v1" : env.LLM_BASE_URL;
  if (!base) throw new Error("Assistant provider URL is not configured.");
  const url = new URL(base.replace(/\/$/, "") + "/chat/completions");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid assistant provider URL.");
  const timeout = Number(env.LLM_REQUEST_TIMEOUT_SECONDS ?? "60");
  if (!Number.isInteger(timeout) || timeout < 5 || timeout > 120)
    throw new Error("Invalid assistant provider timeout.");
  return { provider, key, model, url: url.toString(), timeout };
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseDelta(data: string) {
  const value: unknown = JSON.parse(data);
  if (!object(value) || !Array.isArray(value.choices)) throw new Error("Invalid provider event.");
  if (value.choices.length === 0) return { content: "", finished: false };
  const choice: unknown = value.choices[0];
  if (!object(choice) || !object(choice.delta)) throw new Error("Invalid provider delta.");
  if (choice.delta.tool_calls) throw new Error("Provider tool execution is not enabled.");
  const content = choice.delta.content;
  if (content !== undefined && content !== null && typeof content !== "string")
    throw new Error("Invalid provider content.");
  if (choice.finish_reason != null && choice.finish_reason !== "stop")
    throw new Error("Provider did not complete the reply.");
  return { content: typeof content === "string" ? content : "", finished: choice.finish_reason === "stop" };
}
export async function* streamProvider(
  config: ReturnType<typeof providerConfig>,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  signal: AbortSignal
) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error("Assistant provider request failed.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    finished = false,
    done = false;
  try {
    while (!done) {
      // Stream reads are ordered and cannot run concurrently.
      // oxlint-disable-next-line no-await-in-loop
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      if (buffer.length > 1_048_576) throw new Error("Provider event exceeded its size limit.");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }
        const delta = parseDelta(data);
        finished ||= delta.finished;
        if (delta.content) yield delta.content;
      }
    }
    if (!done || !finished) throw new Error("Provider stream ended before completion.");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
