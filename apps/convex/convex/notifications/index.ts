import { taskChange, taskEventKind } from "../tasks/schema";
import { addSubscribers } from "./subscriptions";
import { paginationOptsValidator, type FunctionReturnType } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { taskIsActive } from "../tasks/access";
import { discussionCanRead } from "../tasks/discussion_access";
import { accountRestricted } from "../identity/deactivation/access";
import { publicProfileIdentity } from "../identity/profile_owner";
import { runtimeMail } from "../identity/instance/email";
import { sendAccountEmail } from "../identity/mail/sender";
import { requireProject, requireWorkspace, requireUser } from "../identity/access";
import { requireDiscussion } from "../tasks/discussion_access";
import { selectedTask, validateSelection } from "./selection";
import { defaultEmailPreferenceSettings, emailPreferenceSettings, selectionFields } from "./schema";
export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const stored = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return {
      revision: stored?.revision ?? 0,
      settings: stored?.settings ?? defaultEmailPreferenceSettings,
    };
  },
});
export const savePreferences = mutation({
  args: { expectedRevision: v.number(), settings: emailPreferenceSettings },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const stored = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== (stored?.revision ?? 0))
      throw new ConvexError("Your notification settings changed. Try again with the latest settings.");
    const changes = { settings: args.settings, revision: args.expectedRevision + 1 };
    if (stored) await ctx.db.patch(stored._id, changes);
    else await ctx.db.insert("notificationPreferences", { userId: user._id, ...changes });
  },
});
export const subscribe = mutation({
  args: { taskId: v.id("tasks"), subscribed: v.boolean() },
  handler: async (ctx, args) => {
    const task = await requireDiscussion(ctx, args.taskId, args.subscribed ? "active" : "read");
    const { user } = await requireProject(ctx, task.projectId);
    if (args.subscribed) await addSubscribers(ctx, task._id, [user._id]);
    else {
      const existing = await ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});
export const subscription = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireDiscussion(ctx, args.taskId, "read");
    const { user } = await requireProject(ctx, task.projectId);
    return !!(await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
      .unique());
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    ...selectionFields,
    unreadOnly: v.boolean(),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    validateSelection(args);
    if (
      !Number.isSafeInteger(args.now) ||
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Invalid notification page.");
    return stream(ctx.db, schema)
      .query("notifications")
      .withIndex("by_receiver_workspace", (q) => q.eq("receiverId", user._id).eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (row) => {
        if (args.unreadOnly && row.readAt !== null) return null;
        const task = await selectedTask(ctx, row, user._id, member.role, args);
        if (!task) return null;
        const project = await ctx.db.get(task.projectId);
        if (!project) return null;
        const actor = await ctx.db.get(row.actorId);
        return Object.assign({}, row, {
          actorName: actor?.name ?? null,
          taskReference: `${project.identifier}-${task.sequence}`,
          isMention: row.isMention ?? false,
          taskTitle: task.title,
          destination: task.status === "triage" ? ("intake" as const) : ("task" as const),
          event: await ctx.db.get(row.eventId),
        });
      })
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
  },
});
export const update = mutation({
  args: {
    notificationId: v.id("notifications"),
    change: v.union(
      v.object({ kind: v.literal("read"), value: v.boolean() }),
      v.object({ kind: v.literal("archive"), value: v.boolean() }),
      v.object({ kind: v.literal("snooze"), until: v.union(v.number(), v.null()) })
    ),
  },
  handler: async (ctx, { notificationId, change }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(notificationId);
    if (!row || row.receiverId !== user._id) throw new ConvexError("Notification not found.");
    const task = await requireDiscussion(ctx, row.taskId, "read");
    await requireProject(ctx, task.projectId);
    if (change.kind === "read") await ctx.db.patch(row._id, { readAt: change.value ? Date.now() : null });
    else if (change.kind === "archive") await ctx.db.patch(row._id, { archivedAt: change.value ? Date.now() : null });
    else {
      if (
        change.until !== null &&
        (!Number.isSafeInteger(change.until) ||
          change.until <= Date.now() ||
          change.until > Date.now() + 365 * 86400000)
      )
        throw new ConvexError("Choose a future snooze time within one year.");
      await ctx.db.patch(row._id, { snoozedUntil: change.until });
    }
  },
});

export const subscriptionAccess = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireDiscussion(ctx, args.taskId, "read");
    const { user } = await requireProject(ctx, task.projectId);
    const membership = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
      .unique();
    return {
      subscribed: membership !== null,
      canSubscribe: task.archivedAt == null,
      canUnsubscribe: membership !== null,
    };
  },
});

export const summary = query({
  args: { workspaceId: v.id("workspaces"), now: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.now) ||
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Invalid notification page.");
    const result = await stream(ctx.db, schema)
      .query("notifications")
      .withIndex("by_receiver_workspace", (q) => q.eq("receiverId", user._id).eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (row) =>
        (await selectedTask(ctx, row, user._id, member.role, { view: "inbox", now: args.now }))
          ? { unread: row.readAt === null }
          : null
      )
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    return { ...result, page: [{ total: result.page.length, unread: result.page.filter((row) => row.unread).length }] };
  },
});

// Claim and schedule are one transaction. A later cron never replays a claimed batch.
export const dispatchEmail = internalMutation({
  args: { cutoff: v.union(v.number(), v.null()) },
  handler: async (ctx, args): Promise<number> => {
    const cutoff = args.cutoff ?? Date.now();
    const batches = await ctx.db
      .query("notificationEmailBatches")
      .withIndex("by_processed", (q) => q.eq("processedAt", null).lt("_creationTime", cutoff))
      .take(20);
    await Promise.all(
      batches.map(async (batch) => {
        const processedAt = Date.now();
        await ctx.db.patch(batch._id, { processedAt });
        await ctx.scheduler.runAfter(0, internal.notifications.index.deliverEmail, {
          batchId: batch._id,
          processedAt,
        });
      })
    );
    if (batches.length === 20) await ctx.scheduler.runAfter(0, internal.notifications.index.dispatchEmail, { cutoff });
    return batches.length;
  },
});
export const emailPage = internalQuery({
  args: {
    batchId: v.id("notificationEmailBatches"),
    processedAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      page: v.array(
        v.object({
          actorId: v.id("users"),
          kind: taskEventKind,
          changes: v.array(taskChange),
          mention: v.boolean(),
          commentBefore: v.union(v.string(), v.null()),
          commentAfter: v.union(v.string(), v.null()),
          actorName: v.union(v.string(), v.null()),
        })
      ),
      isDone: v.boolean(),
      continueCursor: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processedAt !== args.processedAt || batch.providerId !== null || batch.failure !== null)
      return null;
    const result = await ctx.db
      .query("notificationEmailLogs")
      .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
      .paginate({
        ...args.paginationOpts,
        numItems: 10,
        maximumRowsRead: 10,
        maximumBytesRead: 1_048_576,
      });
    const page = await Promise.all(
      result.page.map(async (row) => {
        const delivery = await ctx.db.get(row.deliveryId);
        const event = delivery ? await ctx.db.get(delivery.eventId) : null;
        if (!delivery || !event) throw new ConvexError("Email contribution lost its source.");
        return {
          actorId: event.actorId,
          kind: event.kind,
          changes: (event.changes ?? []).filter((change) => row.fields.includes(change.field)),
          mention: row.mention,
          commentBefore: row.comment ? delivery.commentBefore : null,
          commentAfter: row.comment ? delivery.commentAfter : null,
          actorName: (await publicProfileIdentity(ctx, event.actorId))?.name ?? null,
        };
      })
    );
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
// This is the final current-app authority/configuration read before one provider attempt.
export const emailConfiguration = internalQuery({
  args: { batchId: v.id("notificationEmailBatches"), processedAt: v.number() },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processedAt !== args.processedAt || batch.providerId !== null || batch.failure !== null)
      return null;
    const task = await ctx.db.get(batch.taskId);
    if (
      !task ||
      !taskIsActive(task) ||
      !(await discussionCanRead(ctx, task, batch.receiverId)) ||
      (await accountRestricted(ctx, batch.receiverId))
    )
      return null;
    const receiver = await ctx.db.get(batch.receiverId);
    if (!receiver?.email) return null;
    const configuration = await runtimeMail(ctx);
    if (!configuration) return null;
    const project = await ctx.db.get(task.projectId);
    const workspace = await ctx.db.get(task.workspaceId);
    if (!project || !workspace) return null;
    const subject = `${project.identifier}-${task.sequence} ${task.title}`.replace(/[\p{Cc}]/gu, "");
    const projectUrl = `${configuration.siteUrl}/${encodeURIComponent(workspace.slug)}/projects/${project._id}/issues`;
    return {
      configuration,
      to: receiver.email,
      subject,
      taskUrl: `${projectUrl}/${task._id}`,
      projectUrl,
      preferencesUrl: `${configuration.siteUrl}/settings/profile/notifications`,
    };
  },
});
export const recordEmailResult = internalMutation({
  args: {
    batchId: v.id("notificationEmailBatches"),
    processedAt: v.number(),
    providerId: schema.tables.notificationEmailBatches.validator.fields.providerId,
    failure: schema.tables.notificationEmailBatches.validator.fields.failure,
  },
  handler: async (ctx, args): Promise<void> => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processedAt !== args.processedAt) throw new ConvexError("Email batch ownership changed.");
    if (batch.providerId !== null || batch.failure !== null) {
      if (batch.providerId !== args.providerId || batch.failure !== args.failure)
        throw new ConvexError("Email result already belongs to another outcome.");
      return;
    }
    await ctx.db.patch(batch._id, {
      providerId: args.providerId,
      failure: args.failure,
      acceptedAt: args.providerId === null ? null : Date.now(),
    });
  },
});
// Canonical audit variants own the values; this is the actual text representation boundary.
function emailChange(change: NonNullable<Doc<"taskEvents">["changes"]>[number]) {
  if ("added" in change)
    return {
      label: change.field,
      before: change.removed.map((item) => item.name ?? "Unnamed"),
      after: change.added.map((item) => item.name ?? "Unnamed"),
    };
  switch (change.field) {
    case "state":
      return {
        label: "State",
        before: [change.before.name ?? change.before.status],
        after: [change.after.name ?? change.after.status],
      };
    case "estimate":
      return {
        label: "Estimate",
        before: [change.before?.value ?? "None"],
        after: [change.after?.value ?? "None"],
      };
    default:
      return {
        label: change.field,
        before: [String(change.before ?? "None")],
        after: [String(change.after ?? "None")],
      };
  }
}
export const deliverEmail = internalAction({
  args: { batchId: v.id("notificationEmailBatches"), processedAt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const names = new Map<Id<"users">, string>();
    const actors = new Map<Id<"users">, Map<string, Set<string>>>();
    let cursor: string | null = null,
      bytes = 0;
    while (true) {
      // Each page requires the previous response’s continuation cursor.
      // oxlint-disable-next-line no-await-in-loop
      const result: FunctionReturnType<typeof internal.notifications.index.emailPage> = await ctx.runQuery(
        internal.notifications.index.emailPage,
        {
          ...args,
          paginationOpts: { cursor, numItems: 10 },
        }
      );
      if (!result) return;
      for (const row of result.page) {
        names.set(row.actorId, row.actorName ?? "A team member");
        const fields = actors.get(row.actorId) ?? new Map<string, Set<string>>();
        actors.set(row.actorId, fields);
        const lines = row.changes.flatMap((change) => {
          const values = emailChange(change);
          return [
            { label: values.label + " before", values: values.before },
            { label: values.label + " after", values: values.after },
          ];
        });
        // Comments are immutable event snapshots; later edits/removal do not rewrite them.
        if (row.commentBefore !== null)
          lines.push({
            label: row.mention ? "Mention before" : "Comment before",
            values: [row.commentBefore],
          });
        if (row.commentAfter !== null)
          lines.push({ label: row.mention ? "Mention" : "Comment", values: [row.commentAfter] });
        if (row.kind === "created") lines.push({ label: "Created", values: ["Task created"] });
        for (const { label, values } of lines) {
          const entries = fields.get(label) ?? new Set<string>();
          fields.set(label, entries);
          for (const value of values) {
            const size = entries.size;
            entries.add(value);
            bytes += (entries.size - size) * (new TextEncoder().encode(value).byteLength + label.length + 3);
          }
        }
      }
      if (bytes > 1_048_576 || result.isDone) break;
      cursor = result.continueCursor;
    }
    if (bytes > 1_048_576) {
      await ctx.runMutation(internal.notifications.index.recordEmailResult, {
        ...args,
        providerId: null,
        failure: "too_large",
      });
      return;
    }
    const prepared = await ctx.runQuery(internal.notifications.index.emailConfiguration, args);
    if (!prepared) {
      await ctx.runMutation(internal.notifications.index.recordEmailResult, {
        ...args,
        providerId: null,
        failure: "unavailable",
      });
      return;
    }
    const text = [
      prepared.subject,
      ...[...actors].map(
        ([actorId, fields]) =>
          `\n${names.get(actorId)}\n` +
          [...fields].map(([field, values]) => field + ": " + [...values].join("; ")).join("\n")
      ),
      `\nTask: ${prepared.taskUrl}\nProject: ${prepared.projectUrl}\nEmail preferences: ${prepared.preferencesUrl}`,
    ].join("\n");
    if (new TextEncoder().encode(text).byteLength > 1_048_576) {
      await ctx.runMutation(internal.notifications.index.recordEmailResult, {
        ...args,
        providerId: null,
        failure: "too_large",
      });
      return;
    }
    let providerId: string;
    try {
      providerId = await sendAccountEmail(
        prepared.configuration,
        prepared.to,
        prepared.subject,
        text,
        `notification-${args.batchId}`
      );
    } catch {
      await ctx.runMutation(internal.notifications.index.recordEmailResult, {
        ...args,
        providerId: null,
        failure: "unconfirmed",
      });
      return;
    }
    await ctx.runMutation(internal.notifications.index.recordEmailResult, {
      ...args,
      providerId,
      failure: null,
    });
  },
});
