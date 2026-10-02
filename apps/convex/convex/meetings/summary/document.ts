import type { Infer } from "convex/values";
import { v } from "convex/values";
import { snapshotFields } from "../../documents/schema";
import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { createDocument, updateDocumentMetadata, saveDocumentSnapshotForUser } from "../../documents/index";
const snapshotValidator = v.object(snapshotFields);
export async function writeCanonicalDocument(
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  existing: Doc<"documents"> | null,
  name: string,
  viewProps: Record<string, unknown>,
  snapshot: Infer<typeof snapshotValidator>,
  user: Doc<"users">
): Promise<Id<"documents">> {
  if (!meeting.projectId) throw new Error("Canonical meeting document requires a project");
  let documentId: Id<"documents">;
  if (existing) {
    documentId = existing._id;
    await updateDocumentMetadata(
      ctx,
      {
        documentId,
        expectedUpdatedAt: existing.updatedAt,
        viewProps: { ...existing.viewProps, ...viewProps },
      },
      user
    );
  } else
    documentId = await createDocument(
      ctx,
      {
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
      },
      user
    );
  await saveDocumentSnapshotForUser(
    ctx,
    {
      documentId,
      expectedRevision: existing?.revision ?? 0,
      name,
      descriptionBinary: snapshot.descriptionBinary,
      descriptionHtml: snapshot.descriptionHtml,
      descriptionJson: snapshot.descriptionJson,
    },
    user
  );
  return documentId;
}
