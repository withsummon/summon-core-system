/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPlacement } from "../utils/placement";

export type TMenuProps = {
  customButtonClassName?: string;
  customButtonTabIndex?: number;
  buttonClassName?: string;
  className?: string;
  customButton?: React.ReactNode;
  /** Compose an interactive trigger directly; customButton is noninteractive content. */
  render?: React.ReactElement;
  disabled?: boolean;
  input?: boolean;
  label?: string | React.ReactNode;
  maxHeight?: "sm" | "rg" | "md" | "lg" | "xl" | "2xl";
  noChevron?: boolean;
  chevronClassName?: string;
  onOpen?: () => void;
  optionsClassName?: string;
  placement?: TPlacement;
  tabIndex?: number;
  useCaptureForOutsideClick?: boolean;
  children: React.ReactNode;
  ellipsis?: boolean;
  noBorder?: boolean;
  verticalEllipsis?: boolean;
  menuButtonOnClick?: (..._args: unknown[]) => void;
  menuItemsClassName?: string;
  onMenuClose?: () => void;
  closeOnSelect?: boolean;
  portalElement?: HTMLElement | null;
  openOnHover?: boolean;
  ariaLabel?: string;
  handleOpenChange?: (open: boolean) => void;
};

export type TSubMenuProps = {
  children: React.ReactNode;
  trigger: React.ReactNode;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  placement?: TPlacement;
};

export type TMenuItemProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};
