import { z } from "zod/v4";

const providerEvent = z.object({
  choices: z.array(
    z.object({
      delta: z.object({ content: z.string().nullish(), tool_calls: z.null().optional() }),
      finish_reason: z.literal("stop").nullish(),
    })
  ),
});

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
export function parseDelta(data: string) {
  const choice = providerEvent.parse(JSON.parse(data)).choices[0];
  return { content: choice?.delta.content ?? "", finished: choice?.finish_reason === "stop" };
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
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const fields = event.split(/\r?\n/).filter((line) => line.startsWith("data:"));
        if (!fields.length) continue;
        const data = fields
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n")
          .trim();
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
