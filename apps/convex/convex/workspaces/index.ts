import { grantProjectMembership, revokeProjectMembership } from "../projects/index";
import { recordWorkspaceCreation } from "../identity/onboarding";
import { selectWorkspaceForUser } from "../identity/preferences";
import { defaultSettings, validateSettings } from "../settings/values";
import { requireWorkspaceCreation } from "../identity/instance/configuration";
import { workspaceLogo } from "../settings/logo_owner";
import { workspaceName, workspaceSlug } from "../settings/metadata";
import { requireUnrestrictedAccount } from "../identity/deactivation/access";
import {
  MAX_MEMBER_DIRECTORY_MEMBERS,
  memberDirectoryOrder,
  profileIdentity,
  sortMemberDirectory,
} from "../identity/profile_owner";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { v, ConvexError, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import { apiIdSchema } from "../identity/schema";
import schema, { role } from "../schema";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { pageBudget } from "../commercial/validation";
import { projectReader } from "../savedViews/scope";
import { viewCapabilities } from "../savedViews/access";
import { canAccessDocument } from "../documents/access";
import { taskIsActive, taskRoleCanRead } from "../tasks/access";
import { requireProjectForUser } from "../identity/access";
import type { MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireUser, requireWorkspace, requireAnotherWorkspaceAdmin } from "../identity/access";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const workspaces = await Promise.all(
      memberships
        .filter((m) => m.active)
        .map(async (membership) => {
          const workspace = await ctx.db.get(membership.workspaceId);
          return workspace && workspace.deletedAt == null
            ? Object.assign(workspace, {
                membershipRole: membership.role,
                logo: await workspaceLogo(ctx, workspace._id),
              })
            : null;
        })
    );
    return workspaces.filter((w) => w !== null);
  },
});

// CmdK preserves substring/sequence search over current joined, readable entities.
// A cursor belongs to one selected entity and one current workspace/project scope.
export const searchEntities = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.string()),
    entity: v.union(
      v.literal("project"),
      v.literal("task"),
      v.literal("cycle"),
      v.literal("module"),
      v.literal("view"),
      v.literal("document")
    ),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const { entity } = args;
    const projectId = args.projectId === undefined ? null : ctx.db.normalizeId("projects", args.projectId);
    if (args.projectId !== undefined) {
      if (!projectId) throw new ConvexError("Project not found.");
      const scoped = await requireProjectForUser(ctx, projectId, access.user);
      if (scoped.workspace._id !== args.workspaceId) throw new ConvexError("Project not found.");
    }
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const term = args.search.toLowerCase();
    const budget = pageBudget(args.paginationOpts);
    switch (entity) {
      case "project":
        return stream(ctx.db, schema)
          .query("projects")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .order("desc")
          .map(async (project) => {
            if (!(await read(project._id))) return null;
            if (!project.name.toLowerCase().includes(term) && !project.identifier.toLowerCase().includes(term))
              return null;
            return { entity, id: project._id, name: project.name, projectIdentifier: project.identifier };
          })
          .paginate(budget);
      case "task": {
        const sequences = new Set((args.search.match(/\b\d+\b/g) ?? []).map(Number));
        const rows = projectId
          ? stream(ctx.db, schema)
              .query("tasks")
              .withIndex("by_project", (q) => q.eq("projectId", projectId))
          : stream(ctx.db, schema)
              .query("tasks")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId));
        return rows
          .order("desc")
          .map(async (task) => {
            if (task.workspaceId !== args.workspaceId || !taskIsActive(task)) return null;
            const readable = await read(task.projectId);
            if (
              !readable ||
              !taskRoleCanRead(
                task,
                access.user._id,
                access.member.role,
                readable.member.role,
                !!readable.project.guestViewAllFeatures
              )
            )
              return null;
            if (
              !task.title.toLowerCase().includes(term) &&
              !readable.project.identifier.toLowerCase().includes(term) &&
              !sequences.has(task.sequence)
            )
              return null;
            return {
              entity,
              id: task._id,
              name: task.title,
              sequence: task.sequence,
              projectId: task.projectId,
              projectIdentifier: readable.project.identifier,
            };
          })
          .paginate(budget);
      }
      case "cycle": {
        const rows = projectId
          ? stream(ctx.db, schema)
              .query("cycles")
              .withIndex("by_project", (q) => q.eq("projectId", projectId).eq("deleted", false))
          : stream(ctx.db, schema)
              .query("cycles")
              .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false));
        return rows
          .order("desc")
          .map(async (cycle) => {
            if (cycle.workspaceId !== args.workspaceId) return null;
            const readable = await read(cycle.projectId);
            if (!readable || !cycle.name.toLowerCase().includes(term)) return null;
            return {
              entity,
              id: cycle._id,
              name: cycle.name,
              projectId: cycle.projectId,
              projectIdentifier: readable.project.identifier,
            };
          })
          .paginate(budget);
      }
      case "module": {
        const rows = projectId
          ? stream(ctx.db, schema)
              .query("modules")
              .withIndex("by_project", (q) => q.eq("projectId", projectId).eq("deleted", false))
          : stream(ctx.db, schema)
              .query("modules")
              .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false));
        return rows
          .order("desc")
          .map(async (module) => {
            if (module.workspaceId !== args.workspaceId) return null;
            const readable = await read(module.projectId);
            if (!readable || !module.name.toLowerCase().includes(term)) return null;
            return {
              entity,
              id: module._id,
              name: module.name,
              projectId: module.projectId,
              projectIdentifier: readable.project.identifier,
            };
          })
          .paginate(budget);
      }
      case "view": {
        const rows = projectId
          ? stream(ctx.db, schema)
              .query("savedViews")
              .withIndex("by_project_deleted", (q) => q.eq("projectId", projectId).eq("deletedAt", null))
          : stream(ctx.db, schema)
              .query("savedViews")
              .withIndex("by_workspace_deleted", (q) => q.eq("workspaceId", args.workspaceId).eq("deletedAt", null));
        return rows
          .order("desc")
          .map(async (view) => {
            if (view.workspaceId !== args.workspaceId || view.projectId === null) return null;
            const readable = await read(view.projectId);
            if (
              !readable ||
              !viewCapabilities(
                view,
                access.user._id,
                readable.member.role === "admin",
                access.member.role === "guest" || readable.member.role === "guest",
                !!readable.project.guestViewAllFeatures
              ).canRead
            )
              return null;
            if (!view.name.toLowerCase().includes(term)) return null;
            return {
              entity,
              id: view._id,
              name: view.name,
              projectId: view.projectId,
              projectIdentifier: readable.project.identifier,
            };
          })
          .paginate(budget);
      }
      case "document":
        return stream(ctx.db, schema)
          .query("documents")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
          .order("desc")
          .map(async (document) => {
            const linked = projectId ? document.projectIds.filter((id) => id === projectId) : document.projectIds;
            const readable = (
              await Promise.all(
                linked.map(async (linkedId) => {
                  const project = await read(linkedId);
                  return project && (await canAccessDocument(ctx, document, access.user._id, false, linkedId))
                    ? project
                    : null;
                })
              )
            ).find((project) => project !== null);
            if (!readable || !document.name.toLowerCase().includes(term)) return null;
            return {
              entity,
              id: document._id,
              name: document.name,
              projectId: readable.project._id,
              projectIdentifier: readable.project.identifier,
            };
          })
          .paginate(budget);
    }
  },
});

export const workspaceCreateInput = v.object({
  name: v.string(),
  slug: v.string(),
  organizationSize: v.optional(v.string()),
});
export async function createWorkspace(ctx: MutationCtx, user: Doc<"users">, args: Infer<typeof workspaceCreateInput>) {
  const name = workspaceName(args.name);
  const slug = workspaceSlug(args.slug);
  if (
    await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
  )
    throw new ConvexError("This workspace slug is already taken.");
  const settings = validateSettings({ ...defaultSettings, organizationSize: args.organizationSize ?? null });
  const workspaceId = await ctx.db.insert("workspaces", {
    name,
    slug,
    apiId: await allocateWorkspaceApiId(ctx),
    ownerId: user._id,
    metadataRevision: 0,
    deletedAt: null,
  });
  if (args.organizationSize !== undefined) await ctx.db.insert("workspaceSettings", { workspaceId, ...settings });
  await ctx.db.insert("workspaceMembers", { workspaceId, userId: user._id, role: "admin", active: true });
  return { workspaceId, organizationSize: settings.organizationSize };
}
export const create = mutation({
  args: { ...workspaceCreateInput.fields, onboardingRevision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireWorkspaceCreation(ctx);
    const { workspaceId, organizationSize } = await createWorkspace(ctx, user, args);
    if (args.onboardingRevision !== undefined)
      await recordWorkspaceCreation(ctx, workspaceId, args.onboardingRevision, organizationSize);
    else await selectWorkspaceForUser(ctx, workspaceId);
    return workspaceId;
  },
});

async function allocateWorkspaceApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("workspaces")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Workspace API identifier already exists.");
  return apiId;
}

export const members = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.optional(v.string()),
    roles: v.optional(v.array(v.union(role, v.literal("suspended")))),
    orderBy: v.optional(memberDirectoryOrder),
  },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId, true);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_MEMBER_DIRECTORY_MEMBERS + 1);
    if (memberships.length > MAX_MEMBER_DIRECTORY_MEMBERS)
      throw new ConvexError(
        `Workspace directory exceeds the ${MAX_MEMBER_DIRECTORY_MEMBERS}-membership limit. No partial directory was returned.`
      );
    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const [identity, authLink] = await Promise.all([
          profileIdentity(ctx, membership.userId),
          ctx.db
            .query("betterAuthLinks")
            .withIndex("by_user", (q) => q.eq("userId", membership.userId))
            .unique(),
        ]);
        if (!identity) throw new ConvexError("Workspace membership references an unavailable account.");
        return Object.assign(identity, {
          membershipId: membership._id,
          role: membership.role,
          active: membership.active,
          joinedAt: membership._creationTime,
          loginMethod: authLink?.lastLoginMedium ?? null,
        });
      })
    );
    const search = (args.search ?? "").trim().toLocaleLowerCase();
    const roles = args.roles ?? [];
    const filtered = rows.filter(
      (row) =>
        (!roles.length || roles.includes(row.active ? row.role : "suspended")) &&
        `${row.fullName} ${row.displayName ?? ""} ${row.email ?? ""}`.toLocaleLowerCase().includes(search)
    );
    const ordered = sortMemberDirectory(filtered, args.orderBy);
    const directory = await Promise.all(
      ordered.map(async (row) =>
        Object.assign(row, {
          avatar: row.active
            ? await personalImageDescriptor(ctx, await userAppearance(ctx, row.userId), "avatar", args.workspaceId)
            : null,
        })
      )
    );
    return { members: directory, totalCount: rows.length, roles: role.members.map((entry) => entry.value) };
  },
});

export const changeMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMembers"),
    expectedRole: role,
    role,
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.workspaceId !== args.workspaceId)
      throw new ConvexError("Workspace membership not found.");
    if (membership.userId === access.user._id) throw new ConvexError("You cannot update your own role.");
    if (!membership.active || membership.role !== args.expectedRole)
      throw new ConvexError("This membership changed. Refresh the directory before updating its role.");
    return grantWorkspaceMembership(ctx, {
      workspaceId: args.workspaceId,
      userId: membership.userId,
      role: args.role,
    });
  },
});

export const revokeMember = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    if (access.user._id === args.userId) throw new ConvexError("You cannot remove yourself. Use leave workspace.");
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", args.userId))
      .unique();
    if (!existing?.active) return;
    await revokeWorkspaceMembership(ctx, existing);
  },
});

export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    await revokeWorkspaceMembership(ctx, member);
  },
});
async function revokeWorkspaceMembership(ctx: MutationCtx, member: Doc<"workspaceMembers">) {
  if (member.role === "admin") await requireAnotherWorkspaceAdmin(ctx, member.workspaceId);
  await restrictProjectMemberships(ctx, member.workspaceId, member.userId, "revoke");
  await ctx.db.patch(member._id, { active: false });
}
export const MAX_ATOMIC_PROJECT_MEMBERSHIPS = 100;

async function restrictProjectMemberships(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  restriction: "revoke" | "guest"
) {
  const activeMemberships = await ctx.db
    .query("projectMembers")
    .withIndex("by_workspace_user_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId).eq("active", true)
    )
    .take(MAX_ATOMIC_PROJECT_MEMBERSHIPS + 1);
  if (activeMemberships.length > MAX_ATOMIC_PROJECT_MEMBERSHIPS)
    throw new ConvexError(
      `Membership change exceeds the atomic budget of ${MAX_ATOMIC_PROJECT_MEMBERSHIPS} active projects. No access changed.`
    );
  for (const member of activeMemberships) {
    // The project membership owner preserves administrator and stale-write invariants.
    // oxlint-disable-next-line no-await-in-loop
    if (restriction === "revoke") await revokeProjectMembership(ctx, member);
    // oxlint-disable-next-line no-await-in-loop
    else await grantProjectMembership(ctx, { workspaceId, projectId: member.projectId, userId, role: "guest" });
  }
}

export async function grantWorkspaceMembership(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces">; userId: Id<"users">; role: Infer<typeof role> }
) {
  await requireUnrestrictedAccount(ctx, args.userId);
  if (!(await ctx.db.get(args.userId))) throw new ConvexError("User not found.");
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", args.userId))
    .unique();
  if (existing?.active && existing.role === "admin" && args.role !== "admin") {
    await requireAnotherWorkspaceAdmin(ctx, args.workspaceId);
  }
  if (existing) {
    if (existing.active && args.role === "guest")
      await restrictProjectMemberships(ctx, args.workspaceId, args.userId, "guest");
    await ctx.db.patch(existing._id, { role: args.role, active: true });
    return existing._id;
  }
  return ctx.db.insert("workspaceMembers", { ...args, active: true });
}
