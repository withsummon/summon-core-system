/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// FIXME: fix this!!!
import type { ICustomSearchSelectOption } from "@plane/types";
import type { SelectPrimitive } from "@plane/propel/select";

type Placement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "right"
  | "right-start"
  | "right-end";

export interface IDropdownProps {
  customButtonClassName?: string;
  customButtonTabIndex?: number;
  buttonClassName?: string;
  className?: string;
  customButton?: React.ReactNode;
  render?: React.ReactElement;
  disabled?: boolean;
  input?: boolean;
  label?: string | React.ReactNode;
  maxHeight?: "sm" | "rg" | "md" | "lg" | "xl" | "2xl";
  noChevron?: boolean;
  chevronClassName?: string;
  onOpen?: () => void;
  optionsClassName?: string;
  placement?: Placement;
  tabIndex?: number;
  useCaptureForOutsideClick?: boolean;
  defaultOpen?: boolean;
}

export interface IPortalProps {
  children: React.ReactNode;
  container?: HTMLElement | null;
  asChild?: boolean;
}

export interface ICustomMenuDropdownProps extends IDropdownProps {
  children: React.ReactNode;
  ellipsis?: boolean;
  noBorder?: boolean;
  verticalEllipsis?: boolean;
  menuButtonOnClick?: (...args: any) => void;
  menuItemsClassName?: string;
  onMenuClose?: () => void;
  closeOnSelect?: boolean;
  portalElement?: HTMLElement | null;
  openOnHover?: boolean;
  ariaLabel?: string;
}

export interface ICustomSelectProps<Value> extends IDropdownProps {
  children: React.ReactNode;
  ariaLabel?: string;
  value: SelectPrimitive.Root.Props<Value>["value"];
  onChange: SelectPrimitive.Root.Props<Value>["onValueChange"];
}

interface CustomSearchSelectProps {
  ariaLabel?: string;
  footerOption?: React.ReactNode;
  onChange: any;
  onClose?: () => void;
  noResultsMessage?: string;
  options?: ICustomSearchSelectOption[];
}

interface SingleValueProps {
  multiple?: false;
  value: any;
}

interface MultipleValuesProps {
  multiple?: true;
  value: any[] | null;
}

export type ICustomSearchSelectProps = IDropdownProps &
  CustomSearchSelectProps &
  (SingleValueProps | MultipleValuesProps);

export interface ICustomMenuItemProps {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: (args?: any) => void;
  className?: string;
}

export interface ICustomSelectItemProps<Value> {
  children: React.ReactNode;
  value: Value;
  className?: string;
}

// Submenu interfaces
export interface ICustomSubMenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  placement?: Placement;
}

export interface ICustomSubMenuTriggerProps {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface ICustomSubMenuContentProps {
  children: React.ReactNode;
  className?: string;
  placement?: Placement;
  sideOffset?: number;
  alignOffset?: number;
}
