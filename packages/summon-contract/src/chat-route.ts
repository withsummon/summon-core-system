/** The chat route, importable without `effect` (the web app's bundle stays free of it). */
export const chatPath = (workspaceSlug: string, conversationId: string) =>
  `/ai/workspaces/${encodeURIComponent(workspaceSlug)}/assistant/conversations/${encodeURIComponent(conversationId)}/chat`;
