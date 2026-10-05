import { ConvexError, getDocumentSize } from "convex/values";
import { curve } from "./completion_curve";
import { progressTotals } from "../tasks/progress_totals";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export function requireTransferDocumentSize(value: Parameters<typeof getDocumentSize>[0]) {
  if (getDocumentSize(value) > 1_048_576) throw new ConvexError("Transfer record exceeds the native document limit.");
}
function capturedTotals(
  row: Pick<Doc<"cycleTransferBuckets">, "count" | "numericEstimates" | "unquantifiedEstimates">
) {
  return { count: row.count, numericEstimates: row.numericEstimates, unquantifiedEstimates: row.unquantifiedEstimates };
}
async function addBucket(
  ctx: MutationCtx,
  job: Doc<"cycleTransfers">,
  kind: Doc<"cycleTransferBuckets">["kind"],
  row: Pick<Doc<"cycleTransferBuckets">, "id" | "name" | "count" | "numericEstimates" | "unquantifiedEstimates">
) {
  const existing = await ctx.db
    .query("cycleTransferBuckets")
    .withIndex("by_transfer_kind_id", (q) => q.eq("transferId", job._id).eq("kind", kind).eq("id", row.id))
    .unique();
  const totals = {
    count: (existing?.count ?? 0) + row.count,
    numericEstimates: (existing?.numericEstimates ?? 0) + row.numericEstimates,
    unquantifiedEstimates: (existing?.unquantifiedEstimates ?? 0) + row.unquantifiedEstimates,
  };
  const value = { transferId: job._id, kind, id: row.id, name: existing?.name ?? row.name, ...totals };
  requireTransferDocumentSize(value);
  if (existing) await ctx.db.patch(existing._id, totals);
  else await ctx.db.insert("cycleTransferBuckets", value);
}
export async function snapshot(
  ctx: MutationCtx,
  tasks: Doc<"tasks">[],
  cycle: Doc<"cycles">,
  job: Doc<"cycleTransfers">
) {
  const progress = await progressTotals(ctx, tasks);
  const kinds = ["statuses", "assignees", "labels"] as const;
  // Five capture tasks, each with at most 100 assignees and 100 labels, bound these native bucket writes.
  await Promise.all(
    kinds.flatMap((kind) =>
      progress[kind].map((row) =>
        addBucket(ctx, job, kind, {
          id: row.id,
          name: row.name,
          ...capturedTotals(row),
        })
      )
    )
  );
  const completion = await curve(ctx, cycle, tasks, job.snapshot.captureStartedAt);
  await Promise.all(
    completion.completed.map((row) =>
      addBucket(ctx, job, "completion", {
        id: row.day,
        name: row.day,
        count: row.count,
        numericEstimates: row.points,
        unquantifiedEstimates: row.unquantified,
      })
    )
  );
  return {
    ...job.snapshot,
    count: job.snapshot.count + progress.count,
    numericEstimates: job.snapshot.numericEstimates + progress.numericEstimates,
    unquantifiedEstimates: job.snapshot.unquantifiedEstimates + progress.unquantifiedEstimates,
  };
}
