import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";

export function useStates() {
  const { anchor } = useParams();
  return useQuery(api.publicSharing.index.catalog, anchor ? { anchor } : "skip")?.states;
}
