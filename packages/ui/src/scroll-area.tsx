/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ScrollArea as Primitive } from "@plane/propel/scrollarea";

type TScrollAreaProps = {
  type?: "auto" | "always" | "scroll" | "hover";
  className?: string;
  scrollHideDelay?: number;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
};

export function ScrollArea({
  type = "always",
  className,
  scrollHideDelay = 600,
  size = "md",
  children,
}: TScrollAreaProps) {
  return (
    <Primitive
      orientation="both"
      scrollType={type === "auto" ? "always" : type}
      rootClassName={className}
      scrollHideDelay={scrollHideDelay}
      size={size}
    >
      {children}
    </Primitive>
  );
}
