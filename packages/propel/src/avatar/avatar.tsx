/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Tooltip } from "../tooltip";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "../utils/classname";
import { getBorderRadius, getSizeInfo, isAValidNumber } from "./helper";
import type { TAvatarSize } from "./helper";

type Props = {
  name?: string; //The name of the avatar which will be displayed on the tooltip
  fallbackBackgroundColor?: string; //The background color if the avatar image fails to load
  fallbackText?: string;
  fallbackTextColor?: string; //The text color if the avatar image fails to load
  showTooltip?: boolean;
  size?: TAvatarSize; //The size of the avatars
  shape?: "circle" | "square";
  src?: string; //The source of the avatar image
  className?: string;
};

export function Avatar(props: Props) {
  const {
    name,
    showTooltip = true,
    fallbackBackgroundColor,
    fallbackText,
    fallbackTextColor,
    size = "md",
    shape = "circle",
    src,
    className = "",
  } = props;

  // get size details based on the size prop
  const sizeInfo = getSizeInfo(size);

  const fallbackLetter = name?.[0]?.toUpperCase() ?? fallbackText ?? "?";
  const avatar = (
    <div
      className={cn("grid place-items-center overflow-hidden", getBorderRadius(shape), {
        [sizeInfo.avatarSize]: !isAValidNumber(size),
      })}
      style={isAValidNumber(size) ? { width: size, height: size } : undefined}
    >
      <AvatarPrimitive.Root className={cn("h-full w-full", getBorderRadius(shape), className)}>
        <AvatarPrimitive.Image
          src={src}
          alt={name ?? ""}
          className={cn(
            "h-full w-full object-cover outline-1 -outline-offset-1 outline-black/8 outline-solid dark:outline-white/8",
            getBorderRadius(shape)
          )}
        />
        <AvatarPrimitive.Fallback
          className={cn(sizeInfo.fontSize, "grid h-full w-full place-items-center", getBorderRadius(shape), className)}
          style={{
            backgroundColor: fallbackBackgroundColor ?? "var(--background-color-accent-primary)",
            color: fallbackTextColor ?? "var(--text-color-on-color)",
          }}
        >
          {fallbackLetter}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    </div>
  );
  return showTooltip && name ? <Tooltip tooltipContent={name}>{avatar}</Tooltip> : avatar;
}
