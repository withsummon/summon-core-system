import { useId, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../../commercial/forms";
export function DisconnectAccount({ accountId, name }: { accountId: Id<"authAccounts">; name: string }) {
  const options = useQuery(api.identity.accounts.unlink.options);
  const [open, setOpen] = useState(false);
  if (!options) return <p role="status">Checking sign-in methods…</p>;
  const canDisconnect = options.accounts.find((row) => row.id === accountId)?.canDisconnect;
  if (!canDisconnect)
    return (
      <p className="text-12 text-secondary">
        Keep this account connected until another verified sign-in method is configured.
      </p>
    );
  return open ? (
    <DisconnectForm
      accountId={accountId}
      name={name}
      requiresPassword={options.requiresPassword}
      onCancel={() => setOpen(false)}
    />
  ) : (
    <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
      Disconnect {name}
    </Button>
  );
}
function DisconnectForm({
  accountId,
  name,
  requiresPassword,
  onCancel,
}: {
  accountId: Id<"authAccounts">;
  name: string;
  requiresPassword: boolean;
  onCancel: () => void;
}) {
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const disconnect = useAction(api.identity.accounts.unlink.disconnect);
  const { signOut } = useAuthActions();
  return (
    <form
      className="min-w-0 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await disconnect({ targetId: accountId, password: requiresPassword ? password : undefined });
          setPassword("");
          await signOut();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="break-words">
        Disconnect {name}? You will be signed out on every device. Sign in again using a remaining connected method.
      </p>
      {requiresPassword ? (
        <SummonField label="Current password" htmlFor={passwordId}>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full min-w-0"
          />
        </SummonField>
      ) : (
        <p className="text-12 text-secondary">A sign-in completed within the last five minutes is required.</p>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Disconnect and sign out
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
