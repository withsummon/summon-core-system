import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
export function TaskSubscription({ taskId }: { taskId: Id<"tasks"> }) {
  const access = useQuery(api.notifications.index.subscriptionAccess, { taskId });
  const subscribed = access?.subscribed;
  const subscribe = useMutation(api.notifications.index.subscribe);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (access && !access.canSubscribe && !access.canUnsubscribe) return null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        loading={pending}
        disabled={!access || (subscribed ? !access.canUnsubscribe : !access.canSubscribe)}
        aria-pressed={subscribed ?? false}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await subscribe({ taskId, subscribed: !subscribed });
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        {subscribed ? "Unsubscribe" : "Subscribe to updates"}
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
