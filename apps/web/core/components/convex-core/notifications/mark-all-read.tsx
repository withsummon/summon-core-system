import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { readNotificationBatch } from "./read-batch";
export function MarkAllRead({
  selection,
  onPending,
}: {
  selection: FunctionArgs<typeof api.notifications.bulk.begin>;
  onPending: (pending: boolean) => void;
}) {
  const begin = useMutation(api.notifications.bulk.begin),
    page = useMutation(api.notifications.bulk.page),
    cancel = useMutation(api.notifications.bulk.cancel);
  const controller = useRef<AbortController | null>(null),
    batch = useRef<Id<"notificationReadBatches"> | null>(null),
    mounted = useRef(true);
  const [pending, setPending] = useState(false),
    [changed, setChanged] = useState(0),
    [scope, setScope] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const run = async () => {
    const current = new AbortController();
    controller.current = current;
    batch.current = null;
    setScope(
      `${selection.view}${selection.mentionsOnly ? " · mentions" : ""} · ${selection.categories?.length ? selection.categories.join(" or ") : "all relationships"}`
    );
    setPending(true);
    onPending(true);
    setChanged(0);
    setError("");
    setStatus("Marking matching notifications read…");
    try {
      const batchId = await begin(selection);
      if (current.signal.aborted) return;
      batch.current = batchId;
      await readNotificationBatch(
        () => page({ batchId }),
        current.signal,
        (count) => setChanged((value) => value + count)
      );
      if (!current.signal.aborted) setStatus("Finished marking matching notifications read.");
    } catch (failure) {
      if (!current.signal.aborted) {
        setError(mutationMessage(failure));
        setStatus("Stopped before completion.");
      }
    } finally {
      if (!current.signal.aborted) {
        setPending(false);
        onPending(false);
      }
    }
  };
  const stop = async () => {
    controller.current?.abort();
    setStatus("Stopping. The current batch may finish.");
    try {
      if (batch.current) await cancel({ batchId: batch.current });
    } catch (failure) {
      if (mounted.current) setError(mutationMessage(failure));
    } finally {
      if (mounted.current) {
        setPending(false);
        onPending(false);
        setStatus("Stopped. Notifications already marked read stay read.");
      }
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => void run()}>
          Mark matching notifications read
        </Button>
        {pending && (
          <Button variant="secondary" onClick={() => void stop()}>
            Stop
          </Button>
        )}
      </div>
      {status && (
        <p role="status" className="text-12 text-secondary">
          {scope}: {status} {changed} marked read during completed pages.
        </p>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
