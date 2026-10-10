/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "../utils/classname";

type TabsVariant = "contained" | "underline";

type TabsContextType = {
  variant?: TabsVariant;
};

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

type TabsCompound = React.ForwardRefExoticComponent<
  React.ComponentProps<typeof TabsPrimitive.Root> & {
    variant?: TabsVariant;
  } & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Root>>
> & {
  List: React.ForwardRefExoticComponent<
    React.ComponentProps<typeof TabsPrimitive.List> & {
      background?: TabsVariant;
    } & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.List>>
  >;
  Trigger: React.ForwardRefExoticComponent<
    React.ComponentProps<typeof TabsPrimitive.Tab> & {
      size?: "sm" | "md" | "lg";
      variant?: TabsVariant;
    } & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Tab>>
  >;
  Content: React.ForwardRefExoticComponent<
    React.ComponentProps<typeof TabsPrimitive.Panel> & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Panel>>
  >;
  Indicator: React.ForwardRefExoticComponent<
    React.ComponentProps<typeof TabsPrimitive.Indicator> & React.RefAttributes<HTMLSpanElement>
  >;
};

const TabsRoot = React.forwardRef(function TabsRoot(
  {
    className,
    variant = "contained",
    ...props
  }: React.ComponentProps<typeof TabsPrimitive.Root> & { variant?: TabsVariant },
  ref: React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.Root>>
) {
  const contextValue = React.useMemo(() => ({ variant }), [variant]);
  return (
    <TabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex h-full w-full flex-col", className)}
        {...props}
        ref={ref}
      />
    </TabsContext.Provider>
  );
});

const useTabsVariant = () => React.useContext(TabsContext)?.variant ?? "contained";

/*
 * The selected marker is Base UI's measured indicator, rendered by the list itself so every
 * tab list slides: a raised thumb for "contained", a 2px accent rule for "underline".
 */
const TabsIndicator = React.forwardRef(function TabsIndicator(
  { className, ...props }: React.ComponentProps<typeof TabsPrimitive.Indicator>,
  ref: React.ForwardedRef<HTMLSpanElement>
) {
  const variant = useTabsVariant();
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      renderBeforeHydration
      className={cn(
        "pointer-events-none absolute left-0 translate-x-(--active-tab-left) transition-[translate,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        variant === "underline"
          ? "bottom-[-1px] z-10 h-0.5 w-(--active-tab-width) rounded-full bg-accent-primary"
          : "top-(--active-tab-top) -z-10 h-(--active-tab-height) w-(--active-tab-width) rounded-md border border-subtle bg-layer-2 shadow-tactile",
        className
      )}
      {...props}
      ref={ref}
    />
  );
});

const TabsList = React.forwardRef(function TabsList(
  {
    className,
    background = "contained",
    children,
    ...props
  }: React.ComponentProps<typeof TabsPrimitive.List> & {
    background?: TabsVariant;
  },
  ref: React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.List>>
) {
  const variant = useTabsVariant();
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative isolate flex w-full items-center overflow-auto text-13",
        variant === "underline"
          ? "gap-5 border-b border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "justify-between gap-1.5 rounded-lg p-0.5",
        {
          "bg-layer-1 ring ring-subtle ring-inset": variant === "contained" && background === "contained",
        },
        className
      )}
      {...props}
      ref={ref}
    >
      {children}
      <TabsIndicator />
    </TabsPrimitive.List>
  );
});

const TabsTrigger = React.forwardRef(function TabsTrigger(
  {
    className,
    size = "md",
    ...props
  }: React.ComponentProps<typeof TabsPrimitive.Tab> & { size?: "sm" | "md" | "lg"; variant?: TabsVariant },
  ref: React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.Tab>>
) {
  const variant = useTabsVariant();
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "group/select flex min-w-fit cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong motion-reduce:transition-none",
        "text-tertiary hover:text-primary data-[active]:text-primary",
        "disabled:cursor-not-allowed disabled:text-placeholder",
        variant === "underline"
          ? "h-10 shrink-0 px-0.5 data-[active]:[&_svg]:text-accent-primary"
          : "w-full rounded-md border border-transparent p-1",
        {
          "text-11": size === "sm",
          "text-13": size === "md",
          "text-14": size === "lg",
        },
        className
      )}
      {...props}
      ref={ref}
    />
  );
});

const TabsContent = React.forwardRef(function TabsContent(
  { className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>,
  ref: React.ForwardedRef<React.ElementRef<typeof TabsPrimitive.Panel>>
) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("relative outline-none", className)}
      {...props}
      ref={ref}
    />
  );
});

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
  Indicator: TabsIndicator,
}) satisfies TabsCompound;

export { TabsList, TabsTrigger, TabsContent, TabsIndicator };
