import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
type Link = FunctionReturnType<typeof api.tasks.links.get>;
export function linkEditDraft(link: Link): FunctionArgs<typeof api.tasks.links.update> {
  return { taskId: link.taskId, linkId: link._id, expectedUpdatedAt: link.updatedAt, title: link.title, url: link.url };
}
