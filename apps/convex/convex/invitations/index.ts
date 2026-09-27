import { mailConfiguration } from "../identity/mail/config";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import { role } from "../schema";
import { requireUser, requireWorkspace, requireProject } from "../identity/access";
import { grantWorkspaceMembership } from "../workspaces/index";
import { grantProjectMembership } from "../projects/index";
import { pageBudget } from "../commercial/validation";
import {
  issuerAccess,
  canIssueInvitation,
  recipient,
  normalizedEmail,
  publicInvitation,
  INVITATION_LIFETIME_MS,
} from "./access";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
function pending(row: Doc<"invitations">) {
  if (row.status !== "pending") throw new ConvexError("Invitation has already been answered or revoked.");
}
async function managed(ctx: MutationCtx, id: Doc<"invitations">["_id"], revision: number) {
  const user = await requireUser(ctx);
  const row = await ctx.db.get(id);
  if (!row) throw new ConvexError("Invitation not found.");
  await issuerAccess(ctx, row.workspaceId, row.projectId, user._id, row.role);
  if (!Number.isSafeInteger(revision) || row.revision !== revision)
    throw new ConvexError("Invitation changed. Reload before continuing.");
  pending(row);
  return { row, user };
}
export const issue = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    email: v.string(),
    role,
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await issuerAccess(ctx, args.workspaceId, args.projectId, user._id, args.role);
    const email = normalizedEmail(args.email);
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_scope_email", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("projectId", args.projectId).eq("email", email).eq("status", "pending")
      )
      .unique();
    if (existing) throw new ConvexError("A pending invitation exists. Rotate or revoke it first.");
    return ctx.db.insert("invitations", {
      ...args,
      email,
      inviterId: user._id,
      expiresAt: Date.now() + INVITATION_LIFETIME_MS,
      revision: 0,
      status: "pending",
      respondedAt: null,
      respondedBy: null,
    });
  },
});
export const rotate = internalMutation({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const { row, user } = await managed(ctx, args.invitationId, args.expectedRevision);
    await ctx.db.patch(row._id, {
      tokenHash: args.tokenHash,
      expiresAt: Date.now() + INVITATION_LIFETIME_MS,
      revision: row.revision + 1,
      inviterId: user._id,
    });
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
async function respondToInvitation(
  ctx: MutationCtx,
  args: { invitationId: Doc<"invitations">["_id"]; accepted: boolean; tokenHash?: string; expectedRevision?: number }
) {
  const { user, email } = await recipient(ctx);
  const row = await ctx.db.get(args.invitationId);
  if (!row || row.email !== email || (args.tokenHash !== undefined && row.tokenHash !== args.tokenHash))
    throw new ConvexError("Invitation is unavailable.");
  if (
    args.expectedRevision !== undefined &&
    (!Number.isSafeInteger(args.expectedRevision) || row.revision !== args.expectedRevision)
  )
    throw new ConvexError("Invitation changed. Review it again.");
  pending(row);
  if (row.expiresAt <= Date.now()) throw new ConvexError("Invitation has expired.");
  await issuerAccess(ctx, row.workspaceId, row.projectId, row.inviterId, row.role);
  if (args.accepted) await acceptMembership(ctx, row, user);
  await ctx.db.patch(row._id, {
    status: args.accepted ? "accepted" : "declined",
    respondedAt: Date.now(),
    respondedBy: user._id,
    revision: row.revision + 1,
  });
  return { accepted: args.accepted, workspaceId: row.workspaceId, projectId: row.projectId };
}
export const respond = internalMutation({
  args: { invitationId: v.id("invitations"), tokenHash: v.string(), accepted: v.boolean() },
  handler: respondToInvitation,
});
export const respondIncoming = mutation({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number(), accepted: v.boolean() },
  handler: respondToInvitation,
});
export const acceptIncoming = mutation({
  args: { invitations: v.array(v.object({ invitationId: v.id("invitations"), expectedRevision: v.number() })) },
  handler: async (ctx, args) => {
    if (
      args.invitations.length < 1 ||
      args.invitations.length > 20 ||
      new Set(args.invitations.map((row) => row.invitationId)).size !== args.invitations.length
    )
      throw new ConvexError("Select between one and twenty distinct invitations.");
    const results = [];
    for (const invitation of args.invitations) {
      // Ordered grants share this atomic transaction and its membership invariants.
      // eslint-disable-next-line no-await-in-loop
      results.push(await respondToInvitation(ctx, { ...invitation, accepted: true }));
    }
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
  handler: () => ({ emailDelivery: mailConfiguration(process.env) !== null, manualSharing: true, expiresAfterDays: 7 }),
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
