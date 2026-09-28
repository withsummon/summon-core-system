import { mailConfiguration } from "../identity/mail/config";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import { role } from "../schema";
import { requireUser, requireWorkspace, requireProject } from "../identity/access";
import { grantWorkspaceMembership } from "../workspaces/index";
import { grantProjectMembership } from "../projects/index";
import { selectWorkspaceForUser } from "../identity/preferences";
import { pageBudget } from "../commercial/validation";
import { issuerAccess, canIssueInvitation, normalizedEmail, publicInvitation, INVITATION_LIFETIME_MS } from "./access";
import { recipient } from "./delivery";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Infer } from "convex/values";

export const createFields = {
  workspaceId: v.id("workspaces"),
  projectId: v.union(v.id("projects"), v.null()),
  emails: v.array(v.object({ email: v.string(), role })),
};
const maxCreateInvitations = 20;
const responseFields = {
  invitationId: v.id("invitations"),
  expectedRevision: v.number(),
  accepted: v.boolean(),
};
const responseInput = v.object(responseFields);

function requirePending(row: Doc<"invitations">) {
  if (row.status !== "pending") throw new ConvexError("Invitation has already been answered or revoked.");
}
async function managed(ctx: MutationCtx, id: Doc<"invitations">["_id"], revision: number) {
  const user = await requireUser(ctx);
  const row = await ctx.db.get(id);
  if (!row) throw new ConvexError("Invitation not found.");
  await issuerAccess(ctx, row.workspaceId, row.projectId, user._id, row.role);
  if (!Number.isSafeInteger(revision) || row.revision !== revision)
    throw new ConvexError("Invitation changed. Reload before continuing.");
  requirePending(row);
  return { row, user };
}
export const create = mutation({
  args: createFields,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.emails.length < 1 || args.emails.length > maxCreateInvitations)
      throw new ConvexError(`Invite between one and ${maxCreateInvitations} people at once.`);
    const emails = args.emails.map((entry) => ({ email: normalizedEmail(entry.email), role: entry.role }));
    if (new Set(emails.map((entry) => entry.email)).size !== emails.length)
      throw new ConvexError("Invite each email address once.");
    await Promise.all(
      emails.map(async (entry) => {
        await issuerAccess(ctx, args.workspaceId, args.projectId, user._id, entry.role);
        const existing = await ctx.db
          .query("invitations")
          .withIndex("by_scope_email", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("projectId", args.projectId)
              .eq("email", entry.email)
              .eq("status", "pending")
          )
          .first();
        if (existing)
          throw new ConvexError(`A pending invitation exists for ${entry.email}. Resend or revoke it first.`);
        const users = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", entry.email))
          .take(2);
        if (users.length > 1) throw new ConvexError("Email identity is ambiguous.");
        if (!users.length) return;
        const projectId = args.projectId;
        const member = projectId
          ? await ctx.db
              .query("projectMembers")
              .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", users[0]._id))
              .unique()
          : await ctx.db
              .query("workspaceMembers")
              .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", users[0]._id))
              .unique();
        if (member?.active) throw new ConvexError(`${entry.email} is already a member.`);
      })
    );
    const expiresAt = Date.now() + INVITATION_LIFETIME_MS;
    return Promise.all(
      emails.map(async (entry) => ({
        invitationId: await ctx.db.insert("invitations", {
          workspaceId: args.workspaceId,
          projectId: args.projectId,
          email: entry.email,
          role: entry.role,
          inviterId: user._id,
          expiresAt,
          revision: 0,
          status: "pending",
          respondedAt: null,
          respondedBy: null,
        }),
        revision: 0,
      }))
    );
  },
});
export const prepareResend = internalMutation({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { row, user } = await managed(ctx, args.invitationId, args.expectedRevision);
    const revision = row.revision + 1;
    await ctx.db.patch(row._id, {
      expiresAt: Date.now() + INVITATION_LIFETIME_MS,
      revision,
      inviterId: user._id,
    });
    return { invitationId: row._id, revision };
  },
});
export const updateRole = mutation({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number(), role },
  handler: async (ctx, args) => {
    const { row, user } = await managed(ctx, args.invitationId, args.expectedRevision);
    await issuerAccess(ctx, row.workspaceId, row.projectId, user._id, args.role);
    await ctx.db.patch(row._id, { role: args.role, revision: row.revision + 1, inviterId: user._id });
  },
});
export const revoke = mutation({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { row, user } = await managed(ctx, args.invitationId, args.expectedRevision);
    await ctx.db.patch(row._id, {
      status: "revoked",
      respondedAt: Date.now(),
      respondedBy: user._id,
      revision: row.revision + 1,
    });
  },
});
async function acceptMembership(ctx: MutationCtx, row: Doc<"invitations">, user: Doc<"users">) {
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", row.workspaceId).eq("userId", user._id))
    .unique();
  if (!existing?.active) {
    const workspaceRole = row.projectId && row.role === "admin" ? "member" : row.role;
    // An inactive guest is never silently upgraded by a project invitation.
    if (row.projectId && existing?.role === "guest" && workspaceRole !== "guest")
      throw new ConvexError("A workspace administrator must change guest access first.");
    await grantWorkspaceMembership(ctx, { workspaceId: row.workspaceId, userId: user._id, role: workspaceRole });
  }
  if (row.projectId) await acceptProjectMembership(ctx, row, user, row.projectId);
}
async function respondToInvitation(ctx: MutationCtx, args: Infer<typeof responseInput>) {
  const { user, email } = await recipient(ctx);
  const row = await ctx.db.get(args.invitationId);
  if (!row || row.email !== email) throw new ConvexError("Invitation is unavailable.");
  if (!Number.isSafeInteger(args.expectedRevision) || row.revision !== args.expectedRevision)
    throw new ConvexError("Invitation changed. Review it again.");
  requirePending(row);
  if (row.expiresAt <= Date.now()) throw new ConvexError("Invitation has expired.");
  await issuerAccess(ctx, row.workspaceId, row.projectId, row.inviterId, row.role);
  const workspace = await ctx.db.get(row.workspaceId);
  if (!workspace || workspace.deletedAt != null) throw new ConvexError("Workspace is unavailable.");
  if (args.accepted) await acceptMembership(ctx, row, user);
  await ctx.db.patch(row._id, {
    status: args.accepted ? "accepted" : "declined",
    respondedAt: Date.now(),
    respondedBy: user._id,
    revision: row.revision + 1,
  });
  return { accepted: args.accepted, workspaceId: row.workspaceId, projectId: row.projectId, slug: workspace.slug };
}
export const respondIncoming = mutation({
  args: responseFields,
  handler: async (ctx, args) => {
    const result = await respondToInvitation(ctx, args);
    if (result.accepted) await selectWorkspaceForUser(ctx, result.workspaceId);
    return result;
  },
});
const maxAcceptInvitations = 20;
export const acceptIncoming = mutation({
  args: { invitations: v.array(v.object({ invitationId: v.id("invitations"), expectedRevision: v.number() })) },
  handler: async (ctx, args) => {
    if (
      args.invitations.length < 1 ||
      args.invitations.length > maxAcceptInvitations ||
      new Set(args.invitations.map((row) => row.invitationId)).size !== args.invitations.length
    )
      throw new ConvexError("Select between one and twenty distinct invitations.");
    const results = [];
    for (const invitation of args.invitations) {
      // Ordered grants share this atomic transaction and its membership invariants.
      // eslint-disable-next-line no-await-in-loop
      results.push(await respondToInvitation(ctx, { ...invitation, accepted: true }));
    }
    await selectWorkspaceForUser(ctx, results[0].workspaceId);
    return results;
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await issuerAccess(ctx, args.workspaceId, args.projectId, user._id, "guest");
    const result = await ctx.db
      .query("invitations")
      .withIndex("by_scope", (q) => q.eq("workspaceId", args.workspaceId).eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return { ...result, page: result.page.map(publicInvitation) };
  },
});
export const pending = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await issuerAccess(ctx, args.workspaceId, args.projectId, user._id, "guest");
    const directoryLimit = 1000;
    const rows = await ctx.db
      .query("invitations")
      .withIndex("by_scope_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("projectId", args.projectId).eq("status", "pending")
      )
      .order("desc")
      .take(directoryLimit + 1);
    if (rows.length > directoryLimit)
      throw new ConvexError(`Pending invitations exceed the ${directoryLimit}-invitation directory limit.`);
    const search = args.search?.trim().toLowerCase() ?? "";
    return rows.filter((row) => row.email.includes(search)).map(publicInvitation);
  },
});
export const incoming = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { email } = await recipient(ctx);
    const result = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email).eq("status", "pending"))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page
        .filter((row) => row.expiresAt > Date.now())
        .map(async (row) => {
          if (!(await canIssueInvitation(ctx, row.workspaceId, row.projectId, row.inviterId, row.role))) return null;
          const workspace = await ctx.db.get(row.workspaceId);
          if (!workspace || workspace.deletedAt != null) return null;
          const project = row.projectId ? await ctx.db.get(row.projectId) : null;
          if (row.projectId && (!project || project.deletedAt != null)) return null;
          return Object.assign(publicInvitation(row), {
            workspaceName: workspace?.name ?? null,
            projectName: project?.name ?? null,
          });
        })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const availability = query({
  args: {},
  handler: () => ({
    emailDelivery: mailConfiguration(process.env) !== null,
    manualSharing: true,
    expiresAfterDays: 7,
    maxCreateInvitations,
    maxAcceptInvitations,
  }),
});

async function acceptProjectMembership(
  ctx: MutationCtx,
  row: Doc<"invitations">,
  user: Doc<"users">,
  projectId: NonNullable<Doc<"invitations">["projectId"]>
) {
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", user._id))
    .unique();
  if (!member?.active)
    await grantProjectMembership(ctx, {
      workspaceId: row.workspaceId,
      projectId,
      userId: user._id,
      role: row.role,
    });
}

export const access = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.union(v.id("projects"), v.null()) },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    const roles: Doc<"invitations">["role"][] = [];
    if (args.projectId) {
      const project = await requireProject(ctx, args.projectId);
      if (project.project.workspaceId !== args.workspaceId) throw new ConvexError("Project is outside this workspace.");
      if (member.role !== "guest" && project.projectMember.role === "admin") roles.push("guest", "member", "admin");
    } else if (member.role === "admin") roles.push("guest", "member", "admin");
    else if (member.role === "member") roles.push("guest", "member");
    return { roles };
  },
});
export const recipientAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { email: user.email ?? null, canRespond: !!user.email && user.emailVerificationTime !== undefined };
  },
});
