/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Collapsible as Primitive } from "@plane/propel/collapsible";

export type TCollapsibleProps = {
  title: string | React.ReactNode;
  children: React.ReactNode;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  className?: string;
  buttonClassName?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
};

export function Collapsible({
  title,
  children,
  buttonRef,
  className,
  buttonClassName,
  isOpen,
  onToggle,
  defaultOpen,
}: TCollapsibleProps) {
  return (
    <Primitive.CollapsibleRoot className={className} isOpen={isOpen} onToggle={onToggle} defaultOpen={defaultOpen}>
      <Primitive.CollapsibleTrigger buttonRef={buttonRef} className={buttonClassName}>
        {title}
      </Primitive.CollapsibleTrigger>
      <Primitive.CollapsibleContent>{children}</Primitive.CollapsibleContent>
    </Primitive.CollapsibleRoot>
  );
}
