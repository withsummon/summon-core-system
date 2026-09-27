import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
export function RecordVisit({ workspaceId, target }: FunctionArgs<typeof api.navigation.recent.record>) {
  const record = useMutation(api.navigation.recent.record);
  const { key } = useLocation();
  const attempted = useRef("");
  const [failed, setFailed] = useState(false);
  const identity = `${key}:${workspaceId}:${target.type}:${target.id}`;
  useEffect(() => {
    if (attempted.current === identity) return;
    attempted.current = identity;
    setFailed(false);
    void record({ workspaceId, target }).catch(() => {
      if (attempted.current === identity) setFailed(true);
    });
  }, [identity, record, workspaceId, target]);
  return failed ? (
    <p role="status" className="text-12 text-secondary">
      This visit could not be added to Recent.
    </p>
  ) : null;
}
