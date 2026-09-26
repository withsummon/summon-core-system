/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Collapsible as BaseCollapsible } from "@base-ui-components/react/collapsible";
import clsx from "clsx";

// Types
type RootProps = {
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
};

type TriggerProps = {
  children: React.ReactNode;
  className?: string;
  buttonRef?: React.RefObject<HTMLButtonElement>;
};

type ContentProps = {
  children: React.ReactNode;
  className?: string;
};

// Base UI owns controlled/uncontrolled state and the data-panel-open attribute.
function Root({ children, className, isOpen, onToggle, defaultOpen }: RootProps) {
  return (
    <BaseCollapsible.Root className={className} open={isOpen} defaultOpen={defaultOpen} onOpenChange={onToggle}>
      {children}
    </BaseCollapsible.Root>
  );
}

function Trigger({ children, className, buttonRef }: TriggerProps) {
  return (
    <BaseCollapsible.Trigger
      ref={buttonRef}
      className={clsx(
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
        className
      )}
    >
      {children}
    </BaseCollapsible.Trigger>
  );
}

function Content({ children, className }: ContentProps) {
  return (
    <BaseCollapsible.Panel
      className={clsx(
        "flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden text-13 transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none",
        className
      )}
    >
      {children}
    </BaseCollapsible.Panel>
  );
}

// Compound Component
export const Collapsible = {
  CollapsibleRoot: Root,
  CollapsibleTrigger: Trigger,
  CollapsibleContent: Content,
};
