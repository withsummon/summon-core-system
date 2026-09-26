import { paginationOptsValidator } from "convex/server";
import { pageBudget } from "../commercial/validation";
import { v, ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { status } from "../tasks/schema";
import { requireTask } from "../tasks/properties";
import { requireProject } from "../identity/access";
import { changeTaskStatus } from "../tasks/status";
import { requireConversation } from "./access";
export const propose = mutation({
  args: { conversationId: v.id("assistantConversations"), taskId: v.id("tasks"), nextStatus: status },
  handler: async (ctx, args) => {
    const { conversation, user } = await requireConversation(ctx, args.conversationId, true);
    const task = await requireTask(ctx, args.taskId);
    await requireProject(ctx, task.projectId, true);
    if (
      task.workspaceId !== conversation.workspaceId ||
      (conversation.context.projectId && conversation.context.projectId !== task.projectId)
    )
      throw new ConvexError("Task is outside the conversation context.");
    return ctx.db.insert("assistantActions", {
      ...args,
      workspaceId: conversation.workspaceId,
      requesterId: user._id,
      operation: "set_task_status",
      taskTitle: task.title,
      previousStatus: task.status,
      expectedUpdatedAt: task.updatedAt,
      status: "pending",
      confirmedAt: null,
    });
  },
});
export const get = query({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    await requireConversation(ctx, action.conversationId);
    const task = await requireTask(ctx, action.taskId);
    await requireProject(ctx, task.projectId);
    return action;
  },
});
export const confirm = mutation({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    const { conversation } = await requireConversation(ctx, action.conversationId, true);
    const task = await requireTask(ctx, action.taskId);
    await requireProject(ctx, task.projectId, true);
    if (
      task.workspaceId !== conversation.workspaceId ||
      (conversation.context.projectId && conversation.context.projectId !== task.projectId)
    )
      throw new ConvexError("Task is outside the conversation context.");
    if (action.status === "completed") return;
    if (action.status !== "pending") throw new ConvexError("Action is no longer pending.");
    if (task.updatedAt !== action.expectedUpdatedAt)
      throw new ConvexError("Task changed. Request a new preview before confirming.");
    await changeTaskStatus(ctx, { taskId: task._id, status: action.nextStatus });
    await ctx.db.patch(actionId, { status: "completed", confirmedAt: Date.now() });
  },
});
export const cancel = mutation({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    await requireConversation(ctx, action.conversationId, true);
    if (action.status === "pending") await ctx.db.patch(actionId, { status: "cancelled" });
  },
});

export const list = query({
  args: { conversationId: v.id("assistantConversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireConversation(ctx, args.conversationId);
    const result = await ctx.db
      .query("assistantActions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    await Promise.all(
      result.page.map(async (action) => {
        const task = await requireTask(ctx, action.taskId);
        await requireProject(ctx, task.projectId);
      })
    );
    return result;
  },
});
