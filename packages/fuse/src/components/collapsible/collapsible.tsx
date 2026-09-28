"use client";

import type { ComponentProps, ReactElement } from "react";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { handoff } from "../../internal/part-handoff";
import { panelHeightTransition } from "../../styles/panel-height";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Client single-disclosure primitive. Visually unstyled passthrough apart from the shared
 * open/close height transition on `Content` (`styles/panel-height.ts`), which consumers can
 * override through `className`; Accordion is the styled sibling.
 */
export function CollapsibleRoot(props: ComponentProps<typeof CollapsiblePrimitive.Root>): ReactElement {
  return <CollapsiblePrimitive.Root {...handoff(props, { defaults: { "data-slot": "collapsible" } })} />;
}

export function CollapsibleTrigger(props: ComponentProps<typeof CollapsiblePrimitive.Trigger>): ReactElement {
  return (
    <CollapsiblePrimitive.Trigger
      {...handoff(props, { defaults: { "data-slot": "collapsible-trigger" }, classes: [selfFocusRingClass] })}
    />
  );
}

export function CollapsibleContent(props: ComponentProps<typeof CollapsiblePrimitive.Panel>): ReactElement {
  return (
    <CollapsiblePrimitive.Panel
      {...handoff(props, {
        defaults: { "data-slot": "collapsible-content" },
        classes: [panelHeightTransition, "h-(--collapsible-panel-height)"],
      })}
    />
  );
}

CollapsibleRoot.displayName = "Collapsible.Root";
CollapsibleTrigger.displayName = "Collapsible.Trigger";
CollapsibleContent.displayName = "Collapsible.Content";
