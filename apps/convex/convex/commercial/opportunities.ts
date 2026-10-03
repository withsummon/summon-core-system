import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { convexToZod } from "convex-helpers/server/zod4";
import type { z } from "zod/v4";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { opportunityFields, opportunityStage } from "./schema";
import {
  money,
  pageBudget,
  parseOpportunity,
  probability,
  requireClient,
  validateClient,
  validateOwner,
} from "./validation";
import { workspaceMember } from "./member_directory";
import { defaultSettings } from "../settings/values";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";

const inputSchema = convexToZod(v.object(opportunityFields));
const newOpportunity = {
  title: "",
  product: "",
  source: "",
  description: "",
  stage: "lead",
  value: null,
  probability: 0,
  expectedCloseDate: null,
  clientId: null,
  ownerId: null,
} satisfies z.infer<typeof inputSchema>;

export async function requireOpportunity(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  opportunityId: Id<"opportunities">
) {
  const opportunity = await ctx.db.get(opportunityId);
  if (!opportunity || opportunity.deleted || opportunity.workspaceId !== workspaceId)
    throw new ConvexError("Opportunity not found in this workspace.");
  return opportunity;
}
function searchedOpportunities(ctx: QueryCtx, workspaceId: Id<"workspaces">, rawSearch: string) {
  const search = rawSearch.trim().toLocaleLowerCase();
  return stream(ctx.db, schema)
    .query("opportunities")
    .withIndex("by_workspace_updated", (q) => q.eq("workspaceId", workspaceId).eq("deleted", false))
    .order("desc")
    .map(async (opportunity) => {
      const client = opportunity.clientId ? await ctx.db.get(opportunity.clientId) : null;
      const clientName =
        client && !client.deleted && client.workspaceId === workspaceId ? client.companyName || client.name : "";
      if (
        search &&
        ![opportunity.title, opportunity.product, clientName].some((value) =>
          value.toLocaleLowerCase().includes(search)
        )
      )
        return null;
      return { opportunity, clientName };
    });
}
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.string(),
    stage: v.union(opportunityStage, v.null()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return searchedOpportunities(ctx, args.workspaceId, args.search)
      .filterWith(async ({ opportunity }) => args.stage === null || opportunity.stage === args.stage)
      .map(async ({ opportunity, clientName }) =>
        Object.assign({}, opportunity, {
          value: money(opportunity.value),
          clientName,
          owner: opportunity.ownerId ? await workspaceMember(ctx, args.workspaceId, opportunity.ownerId) : null,
        })
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const counts = query({
  args: { workspaceId: v.id("workspaces"), search: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return searchedOpportunities(ctx, args.workspaceId, args.search)
      .map(async ({ opportunity }) => ({ stage: opportunity.stage, count: 1 as const }))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
    opportunityId: v.union(v.string(), v.null()),
    clientId: v.union(v.string(), v.null()),
    createStage: v.optional(opportunityStage),
  },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    let record: Doc<"opportunities"> | null = null;
    let client: Doc<"clients"> | null = null;
    let input: z.infer<typeof inputSchema>;
    if (args.opportunityId === null) {
      if (args.clientId !== null) {
        const clientId = ctx.db.normalizeId("clients", args.clientId);
        if (!clientId) throw new ConvexError("Client not found in this workspace.");
        client = await requireClient(ctx, args.workspaceId, clientId);
      }
      input = { ...newOpportunity, clientId: client?._id ?? null, stage: args.createStage ?? newOpportunity.stage };
    } else {
      if (args.clientId !== null || args.createStage !== undefined)
        throw new ConvexError("Creation defaults cannot change an existing opportunity.");
      const id = ctx.db.normalizeId("opportunities", args.opportunityId);
      if (!id) throw new ConvexError("Opportunity not found in this workspace.");
      record = await requireOpportunity(ctx, args.workspaceId, id);
      if (record.clientId) {
        client = await ctx.db.get(record.clientId);
        if (!client || client.workspaceId !== args.workspaceId)
          throw new ConvexError("Client not found in this workspace.");
      }
      input = parseOpportunity(inputSchema.parse(record));
    }
    const settings = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    return {
      record,
      input,
      client,
      owner: record?.ownerId ? await workspaceMember(ctx, args.workspaceId, record.ownerId) : null,
      canWrite: member.role !== "guest",
      currency: (settings ?? defaultSettings).currency,
      stages: opportunityStage.members.map((entry) => entry.value),
    };
  },
});
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    target: v.union(v.null(), v.object({ id: v.id("opportunities"), expectedUpdatedAt: v.number() })),
    data: v.object(opportunityFields),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const existing = args.target ? await requireOpportunity(ctx, args.workspaceId, args.target.id) : null;
    if (args.target && args.target.expectedUpdatedAt !== existing?.updatedAt)
      throw new ConvexError("This opportunity changed. Reopen its latest settings before saving.");
    const data = parseOpportunity(args.data);
    await validateOwner(ctx, args.workspaceId, data.ownerId);
    if (existing && existing.clientId === data.clientId && data.clientId) {
      const client = await ctx.db.get(data.clientId);
      if (!client || client.workspaceId !== args.workspaceId)
        throw new ConvexError("Client not found in this workspace.");
    } else await validateClient(ctx, args.workspaceId, data.clientId);
    if (existing && existing.clientId !== data.clientId) {
      const profile = await ctx.db
        .query("projectProfiles")
        .withIndex("by_opportunity", (q) => q.eq("sourceOpportunityId", existing._id))
        .unique();
      if (profile) throw new ConvexError("Client cannot change after delivery has started.");
    }
    const duplicate = await ctx.db
      .query("opportunities")
      .withIndex("by_workspace_title", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("title", data.title)
      )
      .unique();
    if (duplicate && duplicate._id !== existing?._id)
      throw new ConvexError("An opportunity with this title already exists.");
    const updatedAt = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
    const updated = { ...data, updatedBy: user._id, updatedAt };
    if (existing) {
      await ctx.db.patch(existing._id, updated);
      return { id: existing._id, updatedAt, input: data };
    }
    const id = await ctx.db.insert("opportunities", {
      ...updated,
      workspaceId: args.workspaceId,
      createdBy: user._id,
      deleted: false,
    });
    return { id, updatedAt, input: data };
  },
});
export const transition = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    opportunityId: v.id("opportunities"),
    expectedUpdatedAt: v.number(),
    stage: opportunityStage,
    probability: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const opportunity = await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    if (args.expectedUpdatedAt !== opportunity.updatedAt)
      throw new ConvexError("This opportunity changed. Reopen its latest settings before saving.");
    const data = {
      stage: args.stage,
      probability: args.probability === undefined ? opportunity.probability : probability(args.probability),
      updatedAt: Math.max(Date.now(), opportunity.updatedAt + 1),
    };
    await ctx.db.patch(opportunity._id, {
      ...data,
      updatedBy: user._id,
    });
    return data;
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), opportunityId: v.id("opportunities") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    await ctx.db.patch(args.opportunityId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
