import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
export function memberLabel(
  member: FunctionReturnType<typeof api.commercial.directory.members>["page"][number] | null
) {
  return member ? member.name || member.email || `Member …${member.id.slice(-6)}` : "Unavailable member";
}
