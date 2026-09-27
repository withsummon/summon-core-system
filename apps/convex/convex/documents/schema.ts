import { defineTable } from "convex/server";
import { v } from "convex/values";

// Page view/logo/editor JSON are extension-owned objects, not flattened DTOs.
export const jsonObject = v.record(v.string(), v.any());
export const documentFields = {
  name: v.string(),
  access: v.union(v.literal("public"), v.literal("private")),
  isGlobal: v.boolean(),
  projectIds: v.array(v.id("projects")),
  color: v.string(),
  viewProps: jsonObject,
  logoProps: jsonObject,
  sortOrder: v.number(),
  category: v.string(),
  tags: v.array(v.string()),
  clientId: v.union(v.id("clients"), v.null()),
  opportunityId: v.union(v.id("opportunities"), v.null()),
  externalId: v.union(v.string(), v.null()),
  externalSource: v.union(v.string(), v.null()),
};
export const snapshotFields = {
  descriptionBinary: v.bytes(),
  descriptionHtml: v.string(),
  descriptionJson: jsonObject,
};
export const documentTables = {
  documentLabels: defineTable({ documentId: v.id("documents"), labelId: v.id("taskLabels") })
    .index("by_document", ["documentId"])
    .index("by_document_label", ["documentId", "labelId"])
    .index("by_label", ["labelId"]),
  // One edge per child is enforced transactionally by the unique indexed lookup.
  // Existing document rows need no hierarchy field or backfill.
  documentParents: defineTable({ documentId: v.id("documents"), parentId: v.id("documents") })
    .index("by_document", ["documentId"])
    .index("by_parent", ["parentId"]),
  documents: defineTable({
    ...documentFields,
    workspaceId: v.id("workspaces"),
    ownedBy: v.id("users"),
    revision: v.number(),
    isLocked: v.boolean(),
    archived: v.boolean(),
    deleted: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_workspace", ["workspaceId", "deleted"]),
  documentRevisions: defineTable({
    ...snapshotFields,
    documentId: v.id("documents"),
    revision: v.number(),
    createdBy: v.id("users"),
  }).index("by_document_revision", ["documentId", "revision"]),
};
