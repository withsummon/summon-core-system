import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireClient } from "../commercial/validation";
import { requireDocument } from "../documents/access";
import { requireMeeting } from "../meetings/access";
import { contextFields, citation } from "./schema";
const context = v.object(contextFields);
export async function authorizedContext(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  selection: Infer<typeof context>
) {
  const entries: { text: string; citation: Infer<typeof citation> }[] = [];
  if (selection.documentIds.length > 20 || new Set(selection.documentIds).size !== selection.documentIds.length)
    throw new ConvexError("Choose up to 20 distinct documents.");
  if (selection.projectId) {
    const { project } = await requireProject(ctx, selection.projectId);
    if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
    entries.push({
      text: `[Project]\n${project.identifier}: ${project.name}`,
      citation: { kind: "project", id: project._id, label: project.name },
    });
  }
  if (selection.clientId) {
    const client = await requireClient(ctx, workspaceId, selection.clientId);
    entries.push({
      text: `[Client]\n${client.name}\n${client.companyName}\n${client.industry}\n${client.notes}`,
      citation: { kind: "client", id: client._id, label: client.name },
    });
  }
  if (selection.meetingId) {
    const { meeting } = await requireMeeting(ctx, workspaceId, selection.meetingId);
    entries.push({
      text: `[Meeting]\n${meeting.title}\nAgenda: ${meeting.agenda}\nNotes: ${meeting.notes}`,
      citation: { kind: "meeting", id: meeting._id, label: meeting.title },
    });
  }
  const documents = await Promise.all(
    selection.documentIds.map(async (documentId) => {
      const { document } = await requireDocument(ctx, documentId);
      if (document.workspaceId !== workspaceId || document.archived)
        throw new ConvexError("Document not available in this workspace.");
      const snapshot = await ctx.db
        .query("documentRevisions")
        .withIndex("by_document_revision", (q) => q.eq("documentId", documentId).eq("revision", document.revision))
        .unique();
      return {
        text: `[Document]\n${document.name}\n${JSON.stringify(snapshot?.descriptionJson ?? {})}`,
        citation: { kind: "document" as const, id: document._id, label: document.name },
      };
    })
  );
  entries.push(...documents);
  let text = "";
  const citations: Infer<typeof citation>[] = [];
  let truncated = false;
  for (const entry of entries) {
    const remaining = 30000 - text.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const addition = `${text ? "\n\n" : ""}${entry.text}`;
    text += addition.slice(0, remaining);
    citations.push(entry.citation);
    if (addition.length > remaining) truncated = true;
  }
  return { text, citations, truncated };
}
