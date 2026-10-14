/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef, memo, useMemo } from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { BOTTOM_SHEET_CLASSNAME, SHEET_TRANSITION_CLASSNAME } from "../drawer/drawer";
import { cn } from "../utils/classname";
import { EDialogWidth } from "./constants";

// Types
export type DialogPosition = "center" | "top";

export interface DialogProps extends React.ComponentProps<typeof BaseDialog.Root> {
  children: React.ReactNode;
}

export interface DialogPanelProps extends React.ComponentProps<typeof BaseDialog.Popup> {
  width?: EDialogWidth;
  position?: DialogPosition;
  children: React.ReactNode;
}

export interface DialogTitleProps extends React.ComponentProps<typeof BaseDialog.Title> {
  children: React.ReactNode;
}

// Constants
const OVERLAY_CLASSNAME = cn(
  "fixed inset-0 z-90 bg-backdrop data-[ending-style]:animate-dialog-backdrop-out data-[open]:animate-dialog-backdrop-in motion-reduce:animate-none"
);
/*
 * A phone gets the drawer's bottom sheet: same surface, same spring in and ease out. From `md` up (where the
 * tab bar gives way to the sidebar) it is the centered card.
 */
const BASE_CLASSNAME = cn(
  "relative z-100 overflow-y-auto border-subtle bg-surface-1 text-left shadow-overlay-200",
  BOTTOM_SHEET_CLASSNAME,
  SHEET_TRANSITION_CLASSNAME,
  "motion-reduce:transition-none max-md:data-[ending-style]:translate-y-full max-md:data-[starting-style]:translate-y-full",
  "motion-reduce:animate-none md:max-h-[calc(100dvh-4rem)] md:w-[calc(100%-2rem)] md:rounded-xl md:border md:pb-0 md:data-[ending-style]:animate-dialog-out md:data-[open]:animate-dialog-in"
);

// Utility functions
const getPositionClassNames = (position: DialogPosition) =>
  cn("fixed inset-x-0 bottom-0 isolate z-100 md:inset-x-auto md:bottom-auto", {
    "md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2": position === "center",
    "md:top-8 md:left-1/2 md:-translate-x-1/2": position === "top",
  });

const DialogPortal = memo(function DialogPortal({
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Portal>) {
  return (
    <BaseDialog.Portal data-slot="dialog-portal" {...props}>
      {children}
    </BaseDialog.Portal>
  );
});
DialogPortal.displayName = "DialogPortal";

const DialogOverlay = memo(function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return <BaseDialog.Backdrop data-slot="dialog-overlay" className={cn(OVERLAY_CLASSNAME, className)} {...props} />;
});
DialogOverlay.displayName = "DialogOverlay";

const DialogComponent = memo(function DialogComponent({ children, ...props }: DialogProps) {
  return (
    <BaseDialog.Root data-slot="dialog" {...props}>
      {children}
    </BaseDialog.Root>
  );
});
DialogComponent.displayName = "Dialog";

const DialogTrigger = memo(function DialogTrigger({
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Trigger>) {
  return (
    <BaseDialog.Trigger data-slot="dialog-trigger" {...props}>
      {children}
    </BaseDialog.Trigger>
  );
});
DialogTrigger.displayName = "DialogTrigger";

const DialogPanel = forwardRef(function DialogPanel(
  { className, width = EDialogWidth.XXL, children, position = "center", ...props }: DialogPanelProps,
  ref: React.ForwardedRef<React.ElementRef<typeof BaseDialog.Popup>>
) {
  const positionClassNames = useMemo(() => getPositionClassNames(position), [position]);
  return (
    <DialogPortal>
      {/* Base UI skips the backdrop for nested dialogs, which leaves a dialog opened inside a drawer with nothing
          outside it to click; forcing it keeps click-outside dismissal and the dimmed context. */}
      <DialogOverlay forceRender />
      <BaseDialog.Popup
        ref={ref}
        data-slot="dialog-content"
        className={cn(BASE_CLASSNAME, positionClassNames, width, className)}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        {children}
      </BaseDialog.Popup>
    </DialogPortal>
  );
});
DialogPanel.displayName = "DialogPanel";

const DialogTitle = memo(function DialogTitle({ className, children, ...props }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      data-slot="dialog-title"
      className={cn("text-16 leading-none font-semibold text-balance", className)}
      {...props}
    >
      {children}
    </BaseDialog.Title>
  );
});

DialogTitle.displayName = "DialogTitle";

// Create the compound Dialog component with proper typing
const Dialog = Object.assign(DialogComponent, {
  Panel: DialogPanel,
  Title: DialogTitle,
}) as typeof DialogComponent & {
  Panel: typeof DialogPanel;
  Title: typeof DialogTitle;
};

export { Dialog, DialogTitle, DialogPanel };
