/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Adapted from AI Elements Tool + Confirmation (https://elements.ai-sdk.dev/components/tool) onto propel primitives.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@plane/utils";

/**
 * A proposed or finished write into Summon. Header names what will change and its state;
 * the body holds the editable preview; the footer holds the decision.
 */
export function Tool(props: { className?: string; children: ReactNode; "aria-label"?: string }) {
  return (
    <section
      aria-label={props["aria-label"]}
      className={cn(
        "w-full overflow-hidden rounded-xl border border-subtle bg-surface-1 pb-3.5 shadow-xs",
        props.className
      )}
    >
      {props.children}
    </section>
  );
}

export function ToolHeader(props: { icon: LucideIcon; title: ReactNode; description?: ReactNode; status?: ReactNode }) {
  const { icon: Icon } = props;
  return (
    <header className="flex items-start gap-3 px-3.5 pt-3">
      <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-lg bg-layer-2 text-secondary">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-13 font-semibold text-primary">{props.title}</h3>
        {props.description ? <p className="mt-0.5 text-12 text-secondary">{props.description}</p> : null}
      </div>
      {props.status ? <div className="flex-none">{props.status}</div> : null}
    </header>
  );
}

export function ToolContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-3.5 pt-3", className)}>{children}</div>;
}

export function ToolFooter({ children }: { children: ReactNode }) {
  return <footer className="flex flex-wrap items-center gap-2 px-3.5 pt-3">{children}</footer>;
}
