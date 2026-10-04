import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { grantProjectMembership } from "./index";
import { renderedProjectLogo } from "./branding_schema";
import { defaultProjectFeatures } from "./feature_schema";
import { initializeProjectOrder } from "./order_owner";
import { workspaceTimezone, validateTimezone } from "../settings/timezone";
import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation } from "../_generated/server";
import { apiIdSchema } from "../identity/schema";
import type { projectCreateArgs } from "./schema";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { taskStatus } from "../tasks/schema";

const defaultStates = {
  backlog: { name: "Backlog", color: "#60646C", sortOrder: 15000 },
  todo: { name: "Todo", color: "#60646C", sortOrder: 25000 },
  in_progress: { name: "In Progress", color: "#F59E0B", sortOrder: 35000 },
  done: { name: "Done", color: "#46A758", sortOrder: 45000 },
  cancelled: { name: "Cancelled", color: "#9AA4BC", sortOrder: 55000 },
  triage: { name: "Triage", color: "#4E5355", sortOrder: 65000 },
} satisfies Record<Infer<typeof taskStatus>, Pick<Doc<"taskStates">, "name" | "color" | "sortOrder">>;

export async function createProject(ctx: MutationCtx, args: Infer<typeof projectCreateArgs>): Promise<Id<"projects">> {
  const { user } = await requireWorkspace(ctx, args.workspaceId, true);
  renderedProjectLogo(args.logoProps ?? {});
  const metadata = await validateProjectMetadata(ctx, args.workspaceId, {
    ...args,
    description: args.description ?? "",
  });
  const leadId = args.leadId ?? null;
  await validateProjectLead(ctx, args.workspaceId, leadId);
  const projectId = await ctx.db.insert("projects", {
    workspaceId: args.workspaceId,
    ...metadata,
    apiId: await allocateProjectApiId(ctx),
    createdById: user._id,
    updatedById: null,
    updatedAt: Date.now(),
    archivedAt: null,
    leadId,
    defaultAssigneeId: null,
    timezone:
      args.timezone === undefined ? await workspaceTimezone(ctx, args.workspaceId) : validateTimezone(args.timezone),
    metadataRevision: 0,
    features: defaultProjectFeatures,
    network: args.network ?? 2,
    logoProps: args.logoProps ?? {},
    intakeEnabled: false,
    guestViewAllFeatures: false,
    nextSequence: 1,
    archived: false,
    deletedAt: null,
  });
  await ctx.db.insert("projectMembers", {
    workspaceId: args.workspaceId,
    projectId,
    userId: user._id,
    role: "admin",
    active: true,
    revision: 0,
  });
  await Promise.all(
    taskStatus.members.map((state) =>
      ctx.db.insert("taskStates", {
        ...defaultStates[state.value],
        status: state.value,
        description: "",
        isDefault: state.value === "backlog",
        projectId,
        workspaceId: args.workspaceId,
      })
    )
  );
  await initializeProjectOrder(ctx, { workspaceId: args.workspaceId, projectId, userId: user._id });
  if (leadId && leadId !== user._id)
    await grantProjectMembership(ctx, {
      workspaceId: args.workspaceId,
      projectId,
      userId: leadId,
      role: "admin",
    });
  return projectId;
}

async function allocateProjectApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("projects")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Project API identifier already exists.");
  return apiId;
}

// Temporary stored-row rollout: remove after every deployment proves complete
// UUID coverage and the projects schema requires apiId. Never allocate on reads.
export const backfillApiIds = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("projects")
      .paginate({ cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    let changed = 0;
    // Sequential writes make each uniqueness check see previously allocated IDs.
    /* oxlint-disable no-await-in-loop */
    for (const project of page.page) {
      if (project.apiId === undefined) {
        await ctx.db.patch(project._id, { apiId: await allocateProjectApiId(ctx) });
        changed++;
      } else {
        const apiId = apiIdSchema.parse(project.apiId);
        await ctx.db
          .query("projects")
          .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
          .unique();
      }
    }
    /* oxlint-enable no-await-in-loop */
    return { processed: page.page.length, changed, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});
