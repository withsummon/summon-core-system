import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { profileIdentity } from "../identity/profile_owner";
import { accountRestricted } from "../identity/deactivation/access";
import { readTaskCycle } from "../cycles/tasks";
import { readTaskModules } from "../modules/tasks";
import { taskCanRead } from "../tasks/access";
import { exportProjectReader, requireExportForUser } from "./access";

// This is the export representation, matching the inherited IssueExportSerializer's fields.
// Unpublished native drafts have a separate private owner and are never project-wide export records.
export async function exportRecord(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  access: Awaited<ReturnType<typeof requireExportForUser>>,
  readProject: ReturnType<typeof exportProjectReader>
) {
  const project = await readProject(task.projectId);
  if (!project || task.workspaceId !== project.workspaceId || task.deletedAt !== null) return null;
  const sourceProjectIds = new Set([project._id]);
  const referencedTask = async (id: Id<"tasks">) => {
    const referenced = await ctx.db.get(id);
    if (!referenced || !(await taskCanRead(ctx, referenced, access.user._id))) return "";
    const scope = await readProject(referenced.projectId);
    if (!scope) return "";
    sourceProjectIds.add(scope._id);
    return `${scope.identifier}-${referenced.sequence}`;
  };
  const [
    state,
    creator,
    parent,
    cycle,
    modules,
    subscriptions,
    links,
    comments,
    outgoing,
    incoming,
    children,
    assets,
    estimate,
  ] = await Promise.all([
    task.stateId ? ctx.db.get(task.stateId) : null,
    profileIdentity(ctx, task.createdBy),
    ctx.db
      .query("taskParents")
      .withIndex("by_child", (q) => q.eq("childId", task._id))
      .unique(),
    readTaskCycle(ctx, task),
    readTaskModules(ctx, task),
    ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id))
      .collect(),
    ctx.db
      .query("taskLinks")
      .withIndex("by_task_deleted", (q) => q.eq("taskId", task._id).eq("deletedAt", null))
      .collect(),
    ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect(),
    ctx.db
      .query("taskRelations")
      .withIndex("by_from", (q) => q.eq("fromId", task._id))
      .collect(),
    ctx.db
      .query("taskRelations")
      .withIndex("by_to", (q) => q.eq("toId", task._id))
      .collect(),
    ctx.db
      .query("taskParents")
      .withIndex("by_parent", (q) => q.eq("parentId", task._id))
      .collect(),
    ctx.db
      .query("assets")
      .withIndex("by_task_status", (q) => q.eq("taskId", task._id).eq("status", "ready"))
      .collect(),
    task.estimatePointId ? ctx.db.get(task.estimatePointId) : null,
  ]);
  const [assignees, subscribers, labels, discussion, relations, subIssues, parentIdentifier] = await Promise.all([
    Promise.all(
      task.assigneeIds.map(async (id) =>
        (await accountRestricted(ctx, id)) ? null : (await profileIdentity(ctx, id))?.fullName
      )
    ),
    Promise.all(subscriptions.map(async ({ userId }) => (await profileIdentity(ctx, userId))?.fullName)),
    Promise.all(task.labelIds.map((id) => ctx.db.get(id))),
    Promise.all(
      comments
        .filter((comment) => comment.deletedAt == null)
        .map(async (comment) => ({
          comment: comment.text,
          created_by: (await profileIdentity(ctx, comment.authorId))?.fullName ?? "",
          created_at: new Date(comment._creationTime).toISOString().slice(0, 19).replace("T", " "),
        }))
    ),
    Promise.all([
      // Django stores blocked_by on blocked -> blocker; native stores blocks on blocker -> blocked.
      ...outgoing.map(async (relation) => ({
        type: relation.kind === "blocks" ? "blocked_by" : relation.kind,
        issue: await referencedTask(relation.toId),
        direction: relation.kind === "blocks" ? "incoming" : "outgoing",
      })),
      ...incoming.map(async (relation) => ({
        type: relation.kind === "blocks" ? "blocked_by" : relation.kind,
        issue: await referencedTask(relation.fromId),
        direction: relation.kind === "blocks" ? "outgoing" : "incoming",
      })),
    ]),
    Promise.all(
      children.map(async ({ childId }) => {
        return (await referencedTask(childId)) !== "";
      })
    ),
    parent ? referencedTask(parent.parentId) : "",
  ]);
  return {
    sourceProjectIds: [...sourceProjectIds],
    record: {
      project_name: project.name,
      project_identifier: project.identifier,
      parent: parentIdentifier,
      identifier: `${project.identifier}-${task.sequence}`,
      sequence_id: task.sequence,
      name: task.title,
      state_name: state?.projectId === project._id ? state.name : "",
      priority: task.priority,
      assignees: assignees.filter((name) => name !== null && name !== undefined),
      subscribers: subscribers.filter((name) => name !== undefined),
      created_by_name: creator?.fullName ?? "",
      start_date: task.startDate,
      target_date: task.targetDate,
      completed_at: task.completedAt === null ? null : new Date(task.completedAt).toISOString(),
      created_at: new Date(task._creationTime).toISOString(),
      updated_at: new Date(task.updatedAt).toISOString(),
      archived_at: task.archivedAt === null ? null : new Date(task.archivedAt).toISOString(),
      estimate: estimate?.projectId === project._id ? estimate.value : "",
      labels: labels.flatMap((label) =>
        label !== null && label.projectId === project._id && !label.retiring ? [label.name] : []
      ),
      cycles: cycle.cycle && !cycle.cycle.deleted ? [cycle.cycle.name] : [],
      modules: modules.filter(({ module }) => !module.deleted).map(({ module }) => module.name),
      links: links.map((link) => ({ url: link.url, title: link.title ?? link.url })),
      relations: relations.filter(({ issue }) => issue !== ""),
      comments: discussion,
      sub_issues_count: subIssues.filter(Boolean).length,
      link_count: links.length,
      attachment_count: assets.length,
      is_draft: false,
    },
  };
}
