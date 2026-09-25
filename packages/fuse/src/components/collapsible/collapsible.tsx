"use client";

import type { ComponentProps, ReactElement } from "react";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { mergeClassName } from "../../styles/merge-class-name";
import { panelHeightTransition } from "../../styles/panel-height";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Client single-disclosure primitive. Visually unstyled passthrough apart from the shared
 * open/close height transition on `Content` (`styles/panel-height.ts`), which consumers can
 * override through `className`; Accordion is the styled sibling.
 */
export function CollapsibleRoot(props: ComponentProps<typeof CollapsiblePrimitive.Root>): ReactElement {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

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

export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Panel>): ReactElement {
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
