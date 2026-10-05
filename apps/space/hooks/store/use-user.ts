import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@summon/convex/api";

export function useUser() {
  const auth = useConvexAuth();
  const status = useQuery(api.identity.session.status, auth.isAuthenticated ? {} : "skip");
  const profile = useQuery(api.identity.profile.get, status?.valid ? {} : "skip");
  return {
    profile,
    isAuthenticated: status?.valid === true,
    isInitializing:
      auth.isLoading ||
      (auth.isAuthenticated && status === undefined) ||
      (status?.valid === true && profile === undefined),
  };
}
