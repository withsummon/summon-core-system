import { Component, type ReactNode } from "react";
import { Button } from "@plane/propel/button";
import type { usePaginatedQuery } from "convex/react";
export class InvitationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="space-y-2 text-14">
        <p>Invitations are unavailable. Check your current access or email verification.</p>
        <Button variant="secondary" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function InvitationPages({
  status,
  loadMore,
}: Pick<ReturnType<typeof usePaginatedQuery>, "status" | "loadMore">) {
  return (
    <>
      {(status === "LoadingFirstPage" || status === "LoadingMore") && <p role="status">Loading invitations…</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(20)}>
          Load more invitations
        </Button>
      )}
    </>
  );
}
