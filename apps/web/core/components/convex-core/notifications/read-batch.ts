import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
type Page = FunctionReturnType<typeof api.notifications.bulk.page>;
export async function readNotificationBatch(
  page: () => Promise<Page>,
  signal: AbortSignal,
  onPage: (changed: number) => void
) {
  while (!signal.aborted) {
    // The server advances one persisted cursor per mutation; parallel calls would consume the same batch.
    // oxlint-disable-next-line no-await-in-loop
    const result = await page();
    if (signal.aborted) return;
    onPage(result.changed);
    if (result.isDone) return;
  }
}
