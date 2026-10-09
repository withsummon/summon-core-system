import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

export const publicationSettings = v.object({
  commentsEnabled: v.boolean(),
  reactionsEnabled: v.boolean(),
  votesEnabled: v.boolean(),
  viewProps: v.union(
    v.object({ list: v.literal(true), kanban: v.boolean() }),
    v.object({ list: v.literal(false), kanban: v.literal(true) })
  ),
});
export const defaultPublicationSettings = {
  commentsEnabled: false,
  reactionsEnabled: false,
  votesEnabled: false,
  viewProps: { list: true, kanban: true },
} satisfies Infer<typeof publicationSettings>;

export const publicationTables = {
  projectPublications: defineTable({
    projectId: v.id("projects"),
    anchor: v.string(),
    settings: publicationSettings,
    revision: v.number(),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index("by_project", ["projectId"])
    .index("by_anchor", ["anchor"]),
};
