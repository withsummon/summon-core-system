/**
 * The chat route in `HttpRouter` path syntax; {@link chatPath} fills it. Kept out of `./chat` so the
 * web app can import it without `effect`.
 */
export const CHAT_ROUTE = "/ai/workspaces/:slug/assistant/conversations/:conversationId/chat";

export const chatPath = (workspaceSlug: string, conversationId: string) =>
  CHAT_ROUTE.replace(":slug", () => encodeURIComponent(workspaceSlug)).replace(":conversationId", () =>
    encodeURIComponent(conversationId)
  );
