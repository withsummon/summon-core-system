import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { convexToZod } from "convex-helpers/server/zod4";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { canAccessDocument } from "../documents/access";
import { projectReader } from "../savedViews/scope";
import { taskCanRead } from "../tasks/access";
import { requireOpportunity } from "./opportunities";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { clientFields, clientStatus } from "./schema";
import { workspaceMember } from "./member_directory";
import { defaultSettings } from "../settings/values";
import type { Doc, Id } from "../_generated/dataModel";
import { pageBudget, parseClient, requireClient, validateOwner } from "./validation";

const inputSchema = convexToZod(v.object(clientFields));
const newClient = inputSchema.parse({
  name: "",
  companyName: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  headOffice: "",
  relationshipStartedAt: null,
  notes: "",
  status: "lead",
  ownerId: null,
  externalSource: null,
  externalId: null,
});

export const list = query({
  args: { workspaceId: v.id("workspaces"), search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const search = args.search?.trim().toLocaleLowerCase() ?? "";
    return stream(ctx.db, schema)
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .filterWith(
        async (client) =>
          !search ||
          [client.name, client.companyName, client.industry].some((value) => value.toLocaleLowerCase().includes(search))
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const counts = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .map(async (client) => ({ total: 1, active: Number(client.status === "active") }))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), clientId: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    const id = args.clientId === null ? null : ctx.db.normalizeId("clients", args.clientId);
    if (args.clientId !== null && !id) throw new ConvexError("Client not found in this workspace.");
    const record = id ? await requireClient(ctx, args.workspaceId, id) : null;
    const settings = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    return {
      record,
      input: record ? inputSchema.parse(record) : newClient,
      owner: record?.ownerId ? await workspaceMember(ctx, args.workspaceId, record.ownerId) : null,
      canWrite: member.role !== "guest",
      currency: (settings ?? defaultSettings).currency,
      statuses: clientStatus.members.map((entry) => entry.value),
    };
  },
});

// The two commercial screens share these canonical relationships. Each cohort
// is authorized before pagination; no workspace record grants project access.
export const related = query({
  args: {
    workspaceId: v.id("workspaces"),
    scope: v.union(v.object({ clientId: v.id("clients") }), v.object({ opportunityId: v.id("opportunities") })),
    kind: v.union(
      v.literal("contacts"),
      v.literal("contactCounts"),
      v.literal("opportunities"),
      v.literal("opportunityCounts"),
      v.literal("projects"),
      v.literal("projectCounts"),
      v.literal("documents"),
      v.literal("notes"),
      v.literal("allDocuments"),
      v.literal("meetings"),
      v.literal("meetingCounts"),
      v.literal("activity"),
      v.literal("workItems")
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const scope = args.scope;
    const subject =
      "clientId" in scope
        ? await requireClient(ctx, args.workspaceId, scope.clientId)
        : await requireOpportunity(ctx, args.workspaceId, scope.opportunityId);
    const clientId = "clientId" in scope ? scope.clientId : "clientId" in subject ? subject.clientId : null;
    const readProject = projectReader(ctx, args.workspaceId, user._id);
    const matchesProfile = (profile: Doc<"projectProfiles">) =>
      !profile.deleted &&
      profile.workspaceId === args.workspaceId &&
      ("clientId" in scope ? profile.clientId === scope.clientId : profile.sourceOpportunityId === scope.opportunityId);
    const linkedProject = async (projectId: Id<"projects">) => {
      const access = await readProject(projectId);
      if (!access) return null;
      const profile = await ctx.db
        .query("projectProfiles")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .unique();
      return profile && matchesProfile(profile) ? access.project : null;
    };
    const meetings = stream(ctx.db, schema)
      .query("meetings")
      .withIndex("by_workspace_start", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .filterWith(async (meeting) => Boolean(meeting.projectId && (await linkedProject(meeting.projectId))));
    const pagination = pageBudget(args.paginationOpts);
    switch (args.kind) {
      case "contacts":
      case "contactCounts":
        if (!clientId) return { page: [], isDone: true, continueCursor: "" };
        return stream(ctx.db, schema)
          .query("clientContacts")
          .withIndex("by_client", (q) => q.eq("clientId", clientId).eq("deleted", false))
          .map(async (contact) =>
            args.kind === "contactCounts"
              ? { kind: "count" as const, total: 1, active: 0 }
              : { kind: "contact" as const, contact }
          )
          .paginate(pagination);
      case "opportunities":
      case "opportunityCounts":
        if (!("clientId" in scope)) throw new ConvexError("Choose a client to view its opportunities.");
        return stream(ctx.db, schema)
          .query("opportunities")
          .withIndex("by_client", (q) => q.eq("clientId", scope.clientId).eq("deleted", false))
          .order("desc")
          .map(async (opportunity) =>
            args.kind === "opportunityCounts"
              ? {
                  kind: "count" as const,
                  total: 1,
                  active: Number(opportunity.stage !== "won" && opportunity.stage !== "lost"),
                }
              : {
                  kind: "opportunity" as const,
                  opportunity,
                  owner: opportunity.ownerId ? await workspaceMember(ctx, args.workspaceId, opportunity.ownerId) : null,
                }
          )
          .paginate(pagination);
      case "projects":
      case "projectCounts": {
        return stream(ctx.db, schema)
          .query("projects")
          .withIndex("by_workspace_name", (q) => q.eq("workspaceId", args.workspaceId))
          .map(async (project) => {
            const linked = await linkedProject(project._id);
            if (!linked) return null;
            return args.kind === "projectCounts"
              ? { kind: "count" as const, total: 1, active: 1 }
              : { kind: "project" as const, project: linked };
          })
          .paginate(pagination);
      }
      case "documents":
      case "notes":
      case "allDocuments":
        return stream(ctx.db, schema)
          .query("documents")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
          .order("desc")
          .filterWith(
            async (document) =>
              ("clientId" in scope
                ? document.clientId === scope.clientId
                : document.opportunityId === scope.opportunityId) &&
              (args.kind === "allDocuments" || (document.category === "document") === (args.kind === "documents")) &&
              (await canAccessDocument(ctx, document, user._id))
          )
          .map(async (document) => {
            const accesses = await Promise.all(document.projectIds.map(readProject));
            return {
              kind: "document" as const,
              document,
              project: accesses.find((access) => access !== null)?.project ?? null,
            };
          })
          .paginate(pagination);
      case "meetings":
        return meetings.map(async (meeting) => ({ kind: "meeting" as const, meeting })).paginate(pagination);
      case "meetingCounts":
        return meetings.map(async () => ({ kind: "count" as const, total: 1, active: 0 })).paginate(pagination);
      case "workItems":
        return stream(ctx.db, schema)
          .query("meetingTasks")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .order("desc")
          .map(async (link) => {
            const meeting = await ctx.db.get(link.meetingId);
            if (!meeting || meeting.deleted || !meeting.projectId || !(await linkedProject(meeting.projectId)))
              return null;
            const task = await ctx.db.get(link.taskId);
            if (!task || !(await taskCanRead(ctx, task, user._id))) return null;
            const project = await linkedProject(task.projectId);
            return project ? { kind: "workItem" as const, link, task, project } : null;
          })
          .paginate(pagination);
      case "activity":
        return stream(ctx.db, schema)
          .query("taskEvents")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .order("desc")
          .map(async (event) => {
            const project = await linkedProject(event.projectId);
            if (!project) return null;
            const task = await ctx.db.get(event.taskId);
            return task && (await taskCanRead(ctx, task, user._id))
              ? { kind: "activity" as const, event, task, project }
              : null;
          })
          .paginate(pagination);
    }
  },
});
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    target: v.union(v.null(), v.object({ id: v.id("clients"), expectedUpdatedAt: v.number() })),
    data: v.object(clientFields),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const existing = args.target ? await requireClient(ctx, args.workspaceId, args.target.id) : null;
    if (args.target && args.target.expectedUpdatedAt !== existing?.updatedAt)
      throw new ConvexError("This client changed. Reopen its latest settings before saving.");
    const data = parseClient(args.data);
    await validateOwner(ctx, args.workspaceId, data.ownerId);
    const duplicate = await ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("name", data.name)
      )
      .unique();
    if (duplicate && duplicate._id !== existing?._id) throw new ConvexError("A client with this name already exists.");
    const updatedAt = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
    const updated = { ...data, updatedBy: user._id, updatedAt };
    if (existing) {
      await ctx.db.patch(existing._id, updated);
      return { id: existing._id, updatedAt, input: data };
    }
    const id = await ctx.db.insert("clients", {
      ...updated,
      workspaceId: args.workspaceId,
      createdBy: user._id,
      deleted: false,
    });
    return { id, updatedAt, input: data };
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireClient(ctx, args.workspaceId, args.clientId);
    await ctx.db.patch(args.clientId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
