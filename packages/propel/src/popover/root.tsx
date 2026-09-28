/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef, memo, useMemo } from "react";
import { cn } from "../utils/classname";
import { Popover as BasePopover } from "@base-ui-components/react/popover";
import type { TPlacement, TSide, TAlign } from "../utils/placement";
import { convertPlacementToSideAndAlign } from "../utils/placement";

export interface PopoverContentProps extends React.ComponentProps<typeof BasePopover.Popup> {
  placement?: TPlacement;
  align?: TAlign;
  sideOffset?: BasePopover.Positioner.Props["sideOffset"];
  side?: TSide;
  collisionPadding?: BasePopover.Positioner.Props["collisionPadding"];
  containerRef?: React.RefObject<HTMLElement>;
  positionerClassName?: string;
  renderInPortal?: boolean;
}

// PopoverContent component
const PopoverContent = memo(function PopoverContent({
  children,
  className,
  placement,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  containerRef,
  collisionPadding,
  positionerClassName,
  renderInPortal = true,
  ...props
}: PopoverContentProps) {
  // side and align calculations
  const { finalSide, finalAlign } = useMemo(() => {
    if (placement) {
      const converted = convertPlacementToSideAndAlign(placement);
      return { finalSide: converted.side, finalAlign: converted.align };
    }
    return { finalSide: side, finalAlign: align };
  }, [placement, side, align]);

  const popup = (
    <PopoverPositioner
      collisionPadding={collisionPadding}
      side={finalSide}
      sideOffset={sideOffset}
      align={finalAlign}
      className={positionerClassName}
    >
      <BasePopover.Popup
        data-slot="popover-content"
        className={cn(
          "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        {children}
      </BasePopover.Popup>
    </PopoverPositioner>
  );

  return renderInPortal ? <PopoverPortal container={containerRef?.current}>{popup}</PopoverPortal> : popup;
});

// wrapper components
const PopoverTrigger = forwardRef<HTMLButtonElement, React.ComponentProps<typeof BasePopover.Trigger>>(
  function PopoverTrigger(props, ref) {
    return <BasePopover.Trigger data-slot="popover-trigger" {...props} ref={ref} />;
  }
);

const PopoverPortal = memo(function PopoverPortal(props: React.ComponentProps<typeof BasePopover.Portal>) {
  return <BasePopover.Portal data-slot="popover-portal" {...props} />;
});

const PopoverPositioner = memo(function PopoverPositioner(props: React.ComponentProps<typeof BasePopover.Positioner>) {
  return <BasePopover.Positioner data-slot="popover-positioner" {...props} />;
});

// compound components
const Popover = Object.assign(
  memo(function Popover(props: React.ComponentProps<typeof BasePopover.Root>) {
    return <BasePopover.Root data-slot="popover" {...props} />;
  }),
  {
    Button: PopoverTrigger,
    Panel: PopoverContent,
  }
);

// display names
PopoverContent.displayName = "PopoverContent";
Popover.displayName = "Popover";
PopoverPortal.displayName = "PopoverPortal";
PopoverTrigger.displayName = "PopoverTrigger";
PopoverPositioner.displayName = "PopoverPositioner";

export { Popover };
