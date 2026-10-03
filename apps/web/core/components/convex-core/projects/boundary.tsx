import { Component } from "react";
import type { ReactNode } from "react";
import { Button } from "@plane/propel/button";
export class ProjectBoundary extends Component<{ children: ReactNode; onRecover: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This project is unavailable</h2>
        <p className="text-14 text-secondary">Check your project access or look for it in archived projects.</p>
        <Button variant="secondary" onClick={this.props.onRecover}>
          View archived projects
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
