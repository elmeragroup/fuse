"use client";

import type { ComponentProps, ReactElement } from "react";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { mergeClassName } from "../../styles/merge-class-name";
import { panelHeightTransition } from "../../styles/panel-height";
import { selfFocusRingClass } from "../../styles/utils";

type CollapsiblePanelProps = ComponentProps<typeof CollapsiblePrimitive.Panel>;

/**
 * One section that opens and closes, built on Base UI's collapsible. It adds no styles except the
 * shared height transition on `Content` (`styles/panel-height.ts`). Accordion is the styled
 * version.
 */
export function CollapsibleRoot(props: ComponentProps<typeof CollapsiblePrimitive.Root>): ReactElement {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/** The button that opens and closes the section. */
export function CollapsibleTrigger({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Trigger>): ReactElement {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

/** The panel that shows while the section is open. */
export function CollapsibleContent({
  className,
  ...props
}: Omit<CollapsiblePanelProps, "className"> & {
  /**
   * Classes for the panel, or a function of its state that returns them. The panel clips what
   * reaches past its settled box, such as a popover, an absolutely positioned child or a focus
   * ring at the edge. To turn off both the clipping and the height transition, set `className` to
   * `h-auto data-starting-style:h-auto data-ending-style:h-auto overflow-visible transition-none`.
   */
  className?: CollapsiblePanelProps["className"];
}): ReactElement {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={mergeClassName(className, panelHeightTransition, "h-(--collapsible-panel-height)")}
      {...props}
    />
  );
}

CollapsibleRoot.displayName = "Collapsible.Root";
CollapsibleTrigger.displayName = "Collapsible.Trigger";
CollapsibleContent.displayName = "Collapsible.Content";
