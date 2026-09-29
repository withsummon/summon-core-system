import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { numericTaskEstimate } from "../tasks/progress_totals";
import { cycleDay } from "./dates";
/** Sparse daily completions preserve long cycles without allocating an unbounded date range.
 * Remaining on a cycle day = total minus completed buckets through that day; future days are null.
 * This describes current membership, not historical scope or estimate changes. */
export async function curve(ctx: QueryCtx, cycle: Doc<"cycles">, tasks: Doc<"tasks">[], now: number) {
  const buckets = new Map<string, { day: string; count: number; points: number; unquantified: number }>();
  let points = 0,
    unquantified = 0;
  for (const task of tasks) {
    // oxlint-disable-next-line no-await-in-loop
    const estimate = await numericTaskEstimate(ctx, task);
    points += estimate ?? 0;
    const unknown = estimate === null && task.estimatePointId !== null ? 1 : 0;
    unquantified += unknown;
    if (task.completedAt === null) continue;
    const day = cycleDay(cycle.timezone, task.completedAt);
    const bucket = buckets.get(day) ?? { day, count: 0, points: 0, unquantified: 0 };
    bucket.count++;
    bucket.points += estimate ?? 0;
    bucket.unquantified += unknown;
    buckets.set(day, bucket);
  }
  return {
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    timezone: cycle.timezone,
    asOfDay: cycleDay(cycle.timezone, now),
    count: tasks.length,
    points,
    unquantified,
    // Web consumers use ES2022; sort a fresh array without mutating caller state.
    // oxlint-disable-next-line unicorn/no-array-sort
    completed: [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}
