import type { Infer } from "convex/values";
import { v } from "convex/values";
import { snapshotFields } from "../../documents/schema";
import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { api } from "../../_generated/api";
import { saveDocumentSnapshot } from "../../documents/index";
const snapshotValidator = v.object(snapshotFields);
export async function writeCanonicalDocument(
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  existing: Doc<"documents"> | null,
  name: string,
  viewProps: Record<string, unknown>,
  snapshot: Infer<typeof snapshotValidator>
): Promise<Id<"documents">> {
  if (!meeting.projectId) throw new Error("Canonical meeting document requires a project");
  let documentId: Id<"documents">;
  if (existing) {
    documentId = existing._id;
    await ctx.runMutation(api.documents.index.update, {
      documentId,
      expectedUpdatedAt: existing.updatedAt,
      name,
      viewProps: { ...existing.viewProps, ...viewProps },
      access: existing.access,
      isGlobal: existing.isGlobal,
      projectIds: existing.projectIds,
      color: existing.color,
      logoProps: existing.logoProps,
      sortOrder: existing.sortOrder,
      category: existing.category,
      tags: existing.tags,
      clientId: existing.clientId,
      opportunityId: existing.opportunityId,
      externalId: existing.externalId,
      externalSource: existing.externalSource,
    });
  } else
    documentId = await ctx.runMutation(api.documents.index.create, {
      workspaceId: meeting.workspaceId,
      name,
      viewProps: { full_width: false, ...viewProps },
      access: "private",
      isGlobal: false,
      projectIds: [meeting.projectId],
      color: "",
      logoProps: {},
      sortOrder: 65535,
      category: "meeting",
      tags: [],
      clientId: null,
      opportunityId: null,
      externalId: null,
      externalSource: null,
    });
  await saveDocumentSnapshot(ctx, {
    documentId,
    expectedRevision: existing?.revision ?? 0,
    descriptionBinary: snapshot.descriptionBinary,
    descriptionHtml: snapshot.descriptionHtml,
    descriptionJson: snapshot.descriptionJson,
  });
  return documentId;
}
