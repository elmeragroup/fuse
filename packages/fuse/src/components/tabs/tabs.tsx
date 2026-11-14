"use client";

import type { ComponentProps, ReactElement } from "react";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { VariantProps } from "tailwind-variants";

import { controlMd } from "../../styles/control-size-md";
import { tabsTriggerShellClass } from "../../styles/inner-corner/tabs";
import { mergeClassName } from "../../styles/merge-class-name";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { tabsListVariants } from "./tabs-variants";

type TabsListPrimitiveProps = ComponentProps<typeof TabsPrimitive.List>;

/**
 * Tabs that switch between panels, built on Base UI's tabs. Root writes `data-orientation` into
 * the server HTML, so the `data-horizontal:flex-col` layout applies on first paint.
 */
export function TabsRoot({
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
 * The strip of tabs. The default list publishes `--inner-corner` for its triggers, its corner
 * less its 4px padding. The `line` list publishes none.
 */
export function TabsList({
  className,
  variant = "default",
  activateOnFocus = true,
  ...props
}: Omit<TabsListPrimitiveProps, "activateOnFocus"> & {
  /**
   * Whether a tab opens its panel when it gets focus. Unset, it does, so the arrow keys move focus
   * and switch panels in one step. Pass `false` to switch only on Enter, Space or a click.
   */
  activateOnFocus?: TabsListPrimitiveProps["activateOnFocus"];
  /**
   * The list style. `default` sits the tabs on a muted track and fills the active one. `line`
   * draws no track and marks the active tab with a line.
   */
  variant?: VariantProps<typeof tabsListVariants>["variant"];
}): ReactElement {
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

/**
 * One tab. An inactive tab reads `--muted-foreground`, the text role held to 4.5:1 on `muted` and
 * on every surface a line list sits on. Hover and the active tab read the foreground.
 */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Tab>): ReactElement {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={mergeClassName(
        className,
        controlMd.gap(),
        controlMd.inset(),
        controlMd.iconEdge(),
        controlMd.type(),
        "font-medium ease-out group-data-[variant=default]/tabs-list:data-active:shadow-sm relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center border border-transparent whitespace-nowrap text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-150 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start enabled-hover:text-foreground group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        tabsTriggerShellClass,
        selfFocusRingClass,
        nativeStateFaceClass,
        dataStateFaceClass,
        "bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-card data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:text-card-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100"
      )}
      {...props}
    />
  );
}

/** The panel a tab shows. */
export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Panel>): ReactElement {
  // Base UI keeps a closing panel shown until its exit transition ends, a painted frame even
  // with none, so both panels would stack and the content below would jump. Tabs have no exit
  // transition: the closing panel hides on the render that closes it.
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={mergeClassName(className, "text-sm flex-1 data-ending-style:hidden", selfFocusRingClass)}
      {...props}
    />
  );
}

TabsRoot.displayName = "Tabs.Root";
TabsList.displayName = "Tabs.List";
TabsTrigger.displayName = "Tabs.Trigger";
TabsContent.displayName = "Tabs.Content";
