"use client";

import type { ComponentProps, ReactElement } from "react";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { VariantProps } from "tailwind-variants";

import { mergeClassName } from "../../styles/merge-class-name";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { tabsListVariants } from "./tabs-variants";

/**
 * Client tabbed panel switcher over `@base-ui/react/tabs`. Root
 * stamps `data-orientation` pre-hydration so the `data-horizontal:flex-col`
 * layout applies on first paint.
 */
function TabsRoot({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>): ReactElement {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={mergeClassName(className, "group/tabs flex gap-2 data-horizontal:flex-col")}
      {...props}
    />
  );
}

/**
 * Tab strip. `activateOnFocus` defaults to `true` (the pinned Base UI default is
 * `false`): arrow keys move focus and activate in one step, with
 * `activateOnFocus={false}` as the manual-activation opt-out.
 */
function TabsList({
  className,
  variant = "default",
  activateOnFocus = true,
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>): ReactElement {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      activateOnFocus={activateOnFocus}
      className={mergeClassName(className, tabsListVariants({ variant }))}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Tab>): ReactElement {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={mergeClassName(
        className,
        "font-medium ease-out group-data-[variant=default]/tabs-list:data-active:shadow-sm relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-(--control-gap-md) rounded-md border border-transparent px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)] whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] duration-150 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start enabled-hover:text-foreground has-data-[icon=inline-end]:pr-(--control-px-icon-md) has-data-[icon=inline-start]:pl-(--control-px-icon-md) group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        selfFocusRingClass,
        nativeStateFaceClass,
        dataStateFaceClass,
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100"
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Panel>): ReactElement {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={mergeClassName(className, "text-sm flex-1", selfFocusRingClass)}
      {...props}
    />
  );
}

TabsRoot.displayName = "Tabs.Root";
TabsList.displayName = "Tabs.List";
TabsTrigger.displayName = "Tabs.Trigger";
TabsContent.displayName = "Tabs.Content";

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
};
