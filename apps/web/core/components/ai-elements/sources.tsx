/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Adapted from AI Elements (https://elements.ai-sdk.dev/components/sources) onto the propel Collapsible.
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "@plane/propel/collapsible";

/** "N sources" disclosure under an answer; the list stays one click away rather than crowding the prose. */
export function Sources(props: { count: number; preview?: ReactNode; children: ReactNode }) {
  return (
    <Collapsible.CollapsibleRoot className="w-full">
      <Collapsible.CollapsibleTrigger className="group/trigger -ml-2 inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-12 font-medium text-secondary hover:bg-layer-transparent-hover hover:text-primary">
        {props.preview}
        <span>
          {props.count} {props.count === 1 ? "source" : "sources"}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 transition-transform group-data-[panel-open]/trigger:rotate-180 motion-reduce:transition-none"
        />
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">{props.children}</ul>
      </Collapsible.CollapsibleContent>
    </Collapsible.CollapsibleRoot>
  );
}

export function Source(props: { href: string; icon: ReactNode; label: string; kind: string }) {
  return (
    <li className="min-w-0">
      <Link
        href={props.href}
        className="flex min-w-0 items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-2.5 py-2 text-12 transition-colors hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
      >
        <span className="flex-none text-secondary">{props.icon}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-primary">{props.label}</span>
        <span className="flex-none text-tertiary capitalize">{props.kind}</span>
      </Link>
    </li>
  );
}
