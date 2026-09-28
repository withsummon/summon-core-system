import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { authClient } from "@/components/convex-core/provider";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { mutationMessage } from "../../commercial/forms";

type Account = Awaited<ReturnType<typeof authClient.listAccounts<{ throw: true }>>>[number];
export function DisconnectAccount({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const passwordId = useId();
  const capabilities = useQuery(api.identity.password.index.capabilities, open ? {} : "skip");
  const disconnect = useMutation(api.identity.accounts.unlink.disconnect);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const name = account.providerId === "credential" ? "password" : account.providerId;
  return open ? (
    <div className="min-w-0 space-y-3">
      <p className="break-words">Disconnect {name}? This signs out all sessions.</p>
      <p className="text-12 text-secondary">
        A recent sign-in is required. Keep another enabled sign-in method to sign in again.
      </p>
      {capabilities ? (
        capabilities.requiresPassword && (
          <div className="space-y-1">
            <label htmlFor={passwordId} className="text-13 font-medium">
              Current password
            </label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              disabled={pending}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )
      ) : (
        <p role="status">Checking account security…</p>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          loading={pending}
          disabled={!capabilities || (capabilities.requiresPassword && !password)}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const denial = await disconnect({
                providerId: account.providerId,
                accountId: account.accountId,
                password: capabilities?.requiresPassword ? password : undefined,
              });
              setPassword("");
              if (denial) {
                setError(denial.message);
                return;
              }
              await authClient.signOut();
            } catch (failure) {
              setError(mutationMessage(failure));
              setPassword("");
            } finally {
              setPending(false);
            }
          }}
        >
          Disconnect
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setPassword("");
            setError("");
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
      Disconnect {name}
    </Button>
  );
}
