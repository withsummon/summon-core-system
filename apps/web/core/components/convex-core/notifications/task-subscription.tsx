import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "@plane/i18n";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
export function TaskSubscription({ taskId }: { taskId: Id<"tasks"> }) {
  const { t } = useTranslation();
  const access = useQuery(api.notifications.index.subscriptionAccess, { taskId });
  const subscribed = access?.subscribed;
  const subscribe = useMutation(api.notifications.index.subscribe);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = t(subscribed ? "common.actions.unsubscribe" : "common.actions.subscribe");
  if (access && !access.canSubscribe && !access.canUnsubscribe) return null;
  return (
    <div className="space-y-1">
      <Button
        prependIcon={subscribed ? <BellOff /> : <Bell />}
        variant="secondary"
        size="lg"
        loading={pending}
        disabled={!access || (subscribed ? !access.canUnsubscribe : !access.canSubscribe)}
        aria-pressed={subscribed ?? false}
        aria-label={label}
        aria-busy={pending}
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
        <span className="hidden sm:block">{pending ? t("common.loading") : label}</span>
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
