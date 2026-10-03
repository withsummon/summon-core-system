import { useEffect, useState } from "react";
import { authClient } from "@/components/convex-core/provider";
import { mutationMessage } from "../../commercial/forms";
import { DisconnectAccount } from "./disconnect";

type Accounts = Awaited<ReturnType<typeof authClient.listAccounts<{ throw: true }>>>;
export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void authClient
      .listAccounts({ fetchOptions: { throw: true } })
      .then(setAccounts)
      .catch((failure) => setError(mutationMessage(failure)));
  }, []);
  return (
    <section
      className="min-w-0 space-y-3 rounded-lg border border-subtle-1 p-3"
      aria-label="Connected sign-in accounts"
    >
      <h3 className="font-medium">Connected sign-in accounts</h3>
      {!accounts && !error && <p role="status">Loading accounts…</p>}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      {accounts?.length === 0 && <p>No connected accounts.</p>}
      <ul className="space-y-3">
        {accounts?.map((account) => (
          <li key={account.id} className="min-w-0 border-b border-subtle-1 pb-3 last:border-0 last:pb-0">
            <p className="font-medium break-words">
              {account.providerId === "credential" ? "Password" : account.providerId}
            </p>
            <p className="text-12 text-secondary">Connected {new Date(account.createdAt).toLocaleDateString()}</p>
            <DisconnectAccount account={account} />
          </li>
        ))}
      </ul>
    </section>
  );
}
