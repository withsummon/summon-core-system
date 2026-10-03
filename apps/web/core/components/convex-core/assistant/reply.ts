/** Replies are rendered from the canonical message subscription, not a parallel SSE cache. */
export async function requestAssistantReply({
  siteUrl,
  token,
  conversationId,
  content,
  attachmentIds,
  signal,
  onAccepted,
}: {
  siteUrl: string;
  token: string;
  conversationId: string;
  content: string;
  attachmentIds: string[];
  signal: AbortSignal;
  onAccepted: () => void;
}) {
  const response = await fetch(new URL("/assistant/reply", siteUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    credentials: "omit",
    cache: "no-store",
    body: JSON.stringify({ conversationId, content, attachmentIds, requestId: crypto.randomUUID() }),
    signal,
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 1000) || "The message could not be accepted.");
  if (!response.body) throw new Error("The reply stream was unavailable. Check the conversation before sending again.");
  onAccepted();
  const reader = response.body.getReader();
  try {
    // Streams must be consumed in order; parallel reads cannot preserve backpressure.
    // oxlint-disable-next-line no-await-in-loop
    while (!(await reader.read()).done) {
      signal.throwIfAborted();
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
