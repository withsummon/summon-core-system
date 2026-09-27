import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../../commercial/forms";
export function AccountPassword() {
  const capabilities = useQuery(api.identity.password.index.capabilities, {});
  const [editing, setEditing] = useState(false);
  if (!capabilities) return <p role="status">Loading password settings…</p>;
  if (!capabilities.canChange && !capabilities.canSet)
    return <p className="text-14 text-secondary">Verify your email before setting a password.</p>;
  if (editing) return <PasswordForm canChange={capabilities.canChange} onClose={() => setEditing(false)} />;
  return (
    <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
      {capabilities.canChange ? "Change password" : "Set password"}
    </Button>
  );
}
function PasswordForm({ canChange, onClose }: { canChange: boolean; onClose: () => void }) {
  const [changing] = useState(canChange);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const change = useAction(api.identity.password.index.change),
    set = useAction(api.identity.password.index.set);
  if (saved)
    return (
      <div className="min-w-0 space-y-3">
        <p role="status">Password saved. Other sessions have been signed out.</p>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  return (
    <form
      className="min-w-0 space-y-3 rounded-lg border border-subtle-1 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const newPassword = String(data.get("newPassword") ?? "");
        if (newPassword !== data.get("confirmation")) {
          setError("The new passwords do not match.");
          return;
        }
        setPending(true);
        setError("");
        try {
          if (changing) await change({ oldPassword: String(data.get("oldPassword") ?? ""), newPassword });
          else await set({ newPassword });
          setSaved(true);
        } catch (reason) {
          setError(mutationMessage(reason));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-medium">{changing ? "Change password" : "Set password"}</h3>
      <p className="text-12 text-secondary">Other sessions will be signed out. This session stays signed in.</p>
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        {changing && (
          <SummonField label="Current password">
            <Input name="oldPassword" type="password" autoComplete="current-password" maxLength={1024} required />
          </SummonField>
        )}
        <SummonField label="New password">
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={1024}
            required
          />
        </SummonField>
        <SummonField label="Confirm new password">
          <Input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={1024}
            required
          />
        </SummonField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Save password
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
