import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProjectForUser, requireWorkspaceForUser } from "../identity/access";
import { requireClient } from "../commercial/validation";
import { requireDocumentForUser } from "../documents/access";
import { requireMeetingForUser } from "../meetings/access";
import { contextFields, citation } from "./schema";
import { requireUser } from "../identity/session";
const context = v.object(contextFields);
export async function authorizedContext(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  selection: Infer<typeof context>,
  extraEntries: { text: string; citation: Infer<typeof citation> }[] = []
) {
  return authorizedContextForUser(ctx, workspaceId, selection, await requireUser(ctx), extraEntries);
}
export async function authorizedContextForUser(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  selection: Infer<typeof context>,
  user: Doc<"users">,
  extraEntries: { text: string; citation: Infer<typeof citation> }[] = []
) {
  const entries: { text: string; citation: Infer<typeof citation> }[] = [];
  if (selection.documentIds.length > 20 || new Set(selection.documentIds).size !== selection.documentIds.length)
    throw new ConvexError("Choose up to 20 distinct documents.");
  if (selection.workspace) {
    const { workspace } = await requireWorkspaceForUser(ctx, workspaceId, user);
    entries.push({
      text: `[Workspace]\n${workspace.name}`,
      citation: { kind: "workspace", id: workspace._id, label: workspace.name },
    });
  }
  if (selection.projectId) {
    const { project } = await requireProjectForUser(ctx, selection.projectId, user);
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
    const { meeting } = await requireMeetingForUser(ctx, workspaceId, selection.meetingId, user);
    const transcript = await ctx.db
      .query("meetingTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
      .unique();
    if (transcript) await requireDocumentForUser(ctx, transcript.documentId, user);
    entries.push({
      text: `[Meeting]\n${meeting.title}\nAgenda: ${meeting.agenda}\nNotes: ${meeting.notes}\nTranscript: ${transcript?.source ?? ""}`,
      citation: { kind: "meeting", id: meeting._id, label: meeting.title },
    });
  }
  const documents = await Promise.all(
    selection.documentIds.map(async (documentId) => {
      const { document } = await requireDocumentForUser(ctx, documentId, user);
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
  entries.push(...documents, ...extraEntries);
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
