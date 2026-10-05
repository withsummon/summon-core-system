import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";

export function useIssueDetails(anchor: string, taskId: string | undefined) {
  return useQuery(api.publicSharing.index.getTask, taskId ? { anchor, taskId } : "skip");
}
