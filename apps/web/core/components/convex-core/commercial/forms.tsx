import { useState } from "react";
import { ConvexError } from "convex/values";
import { Button } from "@plane/propel/button";

export const selectClass = "rounded-md border border-subtle-1 bg-layer-2 px-3 py-2 text-sm";
export const cardClass = "rounded-2xl border border-subtle-1 bg-surface-1 p-4";
export function field(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error(`Missing form field: ${name}`);
  return value;
}
export function mutationMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "The change could not be saved. Check your connection and access, then try again.";
}

export function DeleteRecord({ onDelete, label }: { onDelete: () => Promise<void>; label: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">Delete {label}?</p>
          <Button
            variant="secondary"
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await onDelete();
                setConfirm(false);
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm delete
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          Delete {label}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
