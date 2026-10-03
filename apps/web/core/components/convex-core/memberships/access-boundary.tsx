import { Component, type ReactNode } from "react";
import { Button } from "@plane/propel/button";
// Scope queries may reject before a membership-list subscription removes their subtree.
export class MembershipAccessBoundary extends Component<
  { children: ReactNode; onRecover: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="min-w-0 space-y-3">
        <p className="text-14">This membership is no longer available. Return to your workspaces to continue.</p>
        <Button variant="secondary" onClick={this.props.onRecover}>
          Return to workspaces
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
