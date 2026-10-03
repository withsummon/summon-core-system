import { query } from "../_generated/server";
import { pageArgs, pageBudget, scopeAccess, inRange, pageResult } from "./scope";
import type { QueryCtx } from "../_generated/server";
import type { ReportScope } from "./scope";

async function clientScope(ctx: QueryCtx, scope: ReportScope) {
  if (!scope.projectId) return { id: scope.clientId, excluded: false };
  const profile = await ctx.db
    .query("projectProfiles")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId!))
    .unique();
  const id = profile && !profile.deleted ? profile.clientId : null;
  return { id, excluded: !id || Boolean(scope.clientId && scope.clientId !== id) };
}
// Stored commercial values are canonical Decimal(18,2) strings. BigInt cents
// preserve exact sums beyond Number's safe integer range; output stays decimal.
function cents(value: string | null) {
  if (value === null) return 0n;
  return BigInt(value.replace(".", ""));
}
function decimal(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString().padStart(3, "0");
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
export const opportunities = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    await scopeAccess(ctx, scope);
    const client = await clientScope(ctx, scope);
    const result = await ctx.db
      .query("opportunities")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", scope.workspaceId).eq("deleted", false))
      .paginate(pageBudget(paginationOpts));
    const stages: Record<string, { count: number; value: string }> = {};
    let count = 0;
    let pipeline = 0n;
    for (const opportunity of result.page) {
      if (
        client.excluded ||
        (client.id && opportunity.clientId !== client.id) ||
        !inRange(opportunity._creationTime, scope)
      )
        continue;
      count++;
      const previous = stages[opportunity.stage] ?? { count: 0, value: "0.00" };
      stages[opportunity.stage] = {
        count: previous.count + 1,
        value: decimal(cents(previous.value) + cents(opportunity.value)),
      };
      if (opportunity.stage !== "won" && opportunity.stage !== "lost") pipeline += cents(opportunity.value);
    }
    return pageResult(result, { count, pipelineValue: decimal(pipeline), stages });
  },
});
export const clients = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    await scopeAccess(ctx, scope);
    const client = await clientScope(ctx, scope);
    const result = await ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspaceId", scope.workspaceId).eq("deleted", false))
      .paginate(pageBudget(paginationOpts));
    const count = result.page.filter(
      (item) => !client.excluded && (!client.id || item._id === client.id) && inRange(item._creationTime, scope)
    ).length;
    return pageResult(result, { count });
  },
});
