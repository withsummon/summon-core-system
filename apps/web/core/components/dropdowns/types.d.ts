import type { TPlacement as Placement } from "@plane/propel/utils";

export type TButtonVariants =
  | "border-with-text"
  | "border-without-text"
  | "background-with-text"
  | "background-without-text"
  | "transparent-with-text"
  | "transparent-without-text";

export type TDropdownProps = {
  buttonClassName?: string;
  buttonContainerClassName?: string;
  buttonVariant: TButtonVariants;
  className?: string;
  disabled?: boolean;
  hideIcon?: boolean;
  placeholder?: string;
  placement?: Placement;
  showTooltip?: boolean;
  tabIndex?: number;
};
