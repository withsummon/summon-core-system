import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
export function ConnectedAccounts() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.identity.accounts.index.list,
    {},
    { initialNumItems: 20 }
  );
  return (
    <section
      className="min-w-0 space-y-3 rounded-lg border border-subtle-1 p-3"
      aria-label="Connected sign-in accounts"
    >
      <h3 className="font-medium">Connected sign-in accounts</h3>
      {status === "LoadingFirstPage" && <p role="status">Loading accounts…</p>}
      {!results.length && status === "Exhausted" && <p>No connected accounts.</p>}
      <ul className="space-y-3">
        {results.map((account) => (
          <li key={account.id} className="min-w-0 border-b border-subtle-1 pb-3 last:border-0 last:pb-0">
            <p className="font-medium break-words">{account.name}</p>
            <p className="text-12 text-secondary">
              {account.configuredForSignIn ? "Sign-in method configured" : "Sign-in method unavailable"}
            </p>
            <p className="text-12 text-secondary">Connected {new Date(account.connectedAt).toLocaleDateString()}</p>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <Button type="button" variant="secondary" onClick={() => loadMore(20)}>
          Load more accounts
        </Button>
      )}
      {status === "LoadingMore" && <p role="status">Loading more accounts…</p>}
    </section>
  );
}
