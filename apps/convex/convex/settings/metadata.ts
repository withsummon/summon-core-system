import { ConvexError } from "convex/values";
// Registered legacy workspace serializer reserves these route segments.
const reservedSlugs = new Set([
  "404",
  "accounts",
  "api",
  "create-workspace",
  "god-mode",
  "installations",
  "invitations",
  "onboarding",
  "profile",
  "spaces",
  "workspace-invitations",
  "password",
  "flags",
  "monitor",
  "monitoring",
  "ingest",
  "plane-pro",
  "plane-ultimate",
  "enterprise",
  "plane-enterprise",
  "disco",
  "silo",
  "chat",
  "calendar",
  "drive",
  "channels",
  "upgrade",
  "billing",
  "sign-in",
  "sign-up",
  "signin",
  "signup",
  "config",
  "live",
  "admin",
  "m",
  "import",
  "importers",
  "integrations",
  "integration",
  "configuration",
  "initiatives",
  "initiative",
  "workflow",
  "workflows",
  "epics",
  "epic",
  "story",
  "mobile",
  "dashboard",
  "desktop",
  "onload",
  "real-time",
  "one",
  "pages",
  "business",
  "pro",
  "settings",
  "license",
  "licenses",
  "instances",
  "instance",
]);
// Equivalent bounded legacy contains_url pattern; names are at most 80 characters.
const urlPattern = new RegExp(
  "(?:https?://[^\\s]+|www\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,6}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))",
  "i"
);
export function workspaceName(value: string) {
  const name = value.trim();
  if (!name || name.length > 80 || !/[\p{L}\p{N}]/u.test(name))
    throw new ConvexError("Workspace name must contain a letter or number and be at most 80 characters.");
  if (urlPattern.test(name)) throw new ConvexError("Workspace name must not contain URLs.");
  return name;
}
export function workspaceSlug(value: string) {
  if (!value || value.length > 48 || !/^[a-zA-Z0-9_-]+$/.test(value) || reservedSlugs.has(value))
    throw new ConvexError(
      "Workspace slug must be an available nonreserved name of up to 48 letters, numbers, hyphens or underscores."
    );
  return value;
}
