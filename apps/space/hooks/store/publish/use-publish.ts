import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";

export function usePublish(anchor: string) {
  return useQuery(api.publicSharing.index.settings, { anchor });
}
