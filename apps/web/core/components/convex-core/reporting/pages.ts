export type ReportPage<T> = { contribution: T; coverage: "page"; isDone: boolean; continueCursor: string };
/** A traversal publishes only after the final page. Cancellation never yields partial totals. */
export async function readReportPages<T>(
  read: (cursor: string | null) => Promise<ReportPage<T>>,
  signal: AbortSignal,
  progress: () => void
): Promise<T[]> {
  const contributions: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    signal.throwIfAborted();
    // Each request depends on the previous cursor; these cannot run concurrently.
    // eslint-disable-next-line no-await-in-loop
    const result = await read(cursor);
    signal.throwIfAborted();
    contributions.push(result.contribution);
    progress();
    if (result.isDone) return contributions;
    cursor = result.continueCursor;
  }
}
export function sumAmounts(values: string[]) {
  const total = values.reduce((sum, value) => sum + BigInt(value.replace(".", "")), 0n);
  const digits = (total < 0n ? -total : total).toString().padStart(3, "0");
  return `${total < 0n ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
