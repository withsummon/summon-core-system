import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";

export function useIssue(
  anchor: string,
  stateId: NonNullable<FunctionArgs<typeof api.publicSharing.index.list>["stateId"]> | null,
  filters: FunctionArgs<typeof api.publicSharing.index.list>["filters"]
) {
  return usePaginatedQuery(api.publicSharing.index.list, { anchor, stateId, filters }, { initialNumItems: 50 });
}
