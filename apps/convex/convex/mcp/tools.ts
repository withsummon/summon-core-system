import { ConvexError } from "convex/values";
const read: Record<string, readonly string[]> = {
  project: ["retrieve", "list"],
  workitem: ["count", "retrieve", "list", "search"],
  cycle: ["retrieve", "list"],
  module: ["retrieve", "list"],
  state: ["retrieve", "list"],
  label: ["retrieve", "list"],
  member: ["me", "list_workspace", "list_project", "list_roles", "retrieve_role"],
};
const write: Record<string, readonly string[]> = {
  project: ["create"],
  workitem: ["create", "update"],
  workitem_comment: ["create"],
};
const sensitive = new Set([
  "api_key",
  "authorization",
  "password",
  "pat",
  "secret",
  "token",
  "access_token",
  "refresh_token",
]);
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectSecrets(value: unknown, depth = 0): void {
  if (depth > 12) throw new ConvexError("Tool arguments are too deeply nested.");
  if (Array.isArray(value)) {
    value.forEach((item) => rejectSecrets(item, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (sensitive.has(key.toLowerCase())) throw new ConvexError("Credentials must not be included in tool arguments.");
    rejectSecrets(item, depth + 1);
  }
}
export function validateTool(
  tool: string,
  argumentsJson: string,
  scope: { remoteWorkspaceSlug: string; remoteProjectId: string | null }
) {
  if (argumentsJson.length > 32000) throw new ConvexError("Tool arguments exceed the size limit.");
  let args: unknown;
  try {
    args = JSON.parse(argumentsJson);
  } catch {
    throw new ConvexError("Tool arguments must be JSON.");
  }
  if (!isObject(args) || typeof args.action !== "string") throw new ConvexError("Tool arguments require an action.");
  rejectSecrets(args);
  const isWrite = write[tool]?.includes(args.action) ?? false;
  if (!isWrite && !read[tool]?.includes(args.action)) throw new ConvexError("Tool or action is not allowlisted.");
  if (args.workspace_slug !== undefined && args.workspace_slug !== scope.remoteWorkspaceSlug)
    throw new ConvexError("Tool workspace does not match the credential.");
  if (
    scope.remoteProjectId &&
    (args.project_id !== scope.remoteProjectId || (tool === "project" && args.action !== "retrieve"))
  )
    throw new ConvexError("Tool project does not match the credential.");
  if (scope.remoteProjectId && tool === "member" && args.action !== "list_project")
    throw new ConvexError("This member action is outside the credential project scope.");
  args.workspace_slug = scope.remoteWorkspaceSlug;
  return { argumentsJson: JSON.stringify(args), write: isWrite };
}
export function redact(value: unknown, secret: string): unknown {
  if (typeof value === "string") return value.split(secret).join("[redacted]");
  if (Array.isArray(value)) return value.map((item) => redact(item, secret));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitive.has(key.toLowerCase()) ? "[redacted]" : redact(item, secret),
    ])
  );
}
