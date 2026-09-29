import { defineTable } from "convex/server";
import { v } from "convex/values";

export const clientStatus = v.union(v.literal("lead"), v.literal("active"), v.literal("inactive"));
export const opportunityStage = v.union(
  v.literal("lead"),
  v.literal("qualified"),
  v.literal("proposal"),
  v.literal("negotiation"),
  v.literal("won"),
  v.literal("lost")
);
export const deliveryStatus = v.union(
  v.literal("not_assessed"),
  v.literal("planning"),
  v.literal("active"),
  v.literal("on_hold"),
  v.literal("completed")
);
export const projectHealth = v.union(
  v.literal("not_assessed"),
  v.literal("on_track"),
  v.literal("at_risk"),
  v.literal("off_track")
);
const nullableString = v.union(v.string(), v.null());
export const clientFields = {
  name: v.string(),
  companyName: v.string(),
  industry: v.string(),
  email: v.string(),
  phone: v.string(),
  website: v.string(),
  headOffice: v.string(),
  relationshipStartedAt: nullableString,
  notes: v.string(),
  status: clientStatus,
  ownerId: v.union(v.id("users"), v.null()),
  externalSource: nullableString,
  externalId: nullableString,
};
export const contactFields = {
  name: v.string(),
  title: v.string(),
  email: v.string(),
  phone: v.string(),
  isPrimary: v.boolean(),
};
export const opportunityFields = {
  title: v.string(),
  product: v.string(),
  source: v.string(),
  description: v.string(),
  stage: opportunityStage,
  value: nullableString,
  probability: v.number(),
  expectedCloseDate: nullableString,
  clientId: v.union(v.id("clients"), v.null()),
  ownerId: v.union(v.id("users"), v.null()),
};
export const profileFields = {
  clientId: v.union(v.id("clients"), v.null()),
  deliveryStatus,
  phase: v.string(),
  health: projectHealth,
  startDate: nullableString,
  targetDate: nullableString,
  budget: nullableString,
};
const metadata = {
  workspaceId: v.id("workspaces"),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
  updatedAt: v.number(),
  deleted: v.boolean(),
};
export const commercialTables = {
  clients: defineTable({ ...metadata, ...clientFields }).index("by_workspace_name", ["workspaceId", "deleted", "name"]),
  clientContacts: defineTable({ ...metadata, clientId: v.id("clients"), ...contactFields })
    .index("by_client", ["clientId", "deleted", "name"])
    .index("by_client_primary", ["clientId", "deleted", "isPrimary"])
    .index("by_client_email", ["clientId", "deleted", "email"]),
  opportunities: defineTable({ ...metadata, ...opportunityFields })
    .index("by_workspace_title", ["workspaceId", "deleted", "title"])
    .index("by_workspace", ["workspaceId", "deleted"])
    .index("by_client", ["clientId", "deleted"]),
  projectProfiles: defineTable({
    ...metadata,
    projectId: v.id("projects"),
    sourceOpportunityId: v.union(v.id("opportunities"), v.null()),
    ...profileFields,
  })
    .index("by_project", ["projectId"])
    .index("by_opportunity", ["sourceOpportunityId"])
    .index("by_client", ["clientId"]),
};
