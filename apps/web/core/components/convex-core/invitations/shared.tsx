import { Component, type ReactNode } from "react";
import { Button } from "@plane/propel/button";
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
}: {
  status: "LoadingFirstPage" | "LoadingMore" | "CanLoadMore" | "Exhausted";
  loadMore: (count: number) => void;
}) {
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
export function ShareToken({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  return (
    <div className="min-w-0 space-y-2 rounded-md border border-subtle-1 bg-layer-2 p-3">
      <p className="font-medium">Save this invitation token</p>
      <p className="text-12 text-secondary">
        Shown only here. Share it privately with the invited person, who can paste it in Account details → Invitations.
        No email was sent. It expires in seven days.
      </p>
      <code className="block break-all select-all" aria-label="Invitation token">
        {token}
      </code>
      <Button variant="secondary" onClick={onDismiss}>
        I saved the token
      </Button>
    </div>
  );
}
