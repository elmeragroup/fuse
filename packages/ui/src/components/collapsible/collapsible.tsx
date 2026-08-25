"use client";

import type { ComponentProps, ReactElement } from "react";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

/**
 * Client single-disclosure primitive (collapsible.md §2/§7). Visually unstyled
 * passthrough over base-ui Collapsible; Accordion is the styled sibling.
 */
function CollapsibleRoot(props: ComponentProps<typeof CollapsiblePrimitive.Root>): ReactElement {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Trigger>): ReactElement {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(selfFocusRing, className)}
      {...props}
    />
  );
}

function CollapsibleContent(props: ComponentProps<typeof CollapsiblePrimitive.Panel>): ReactElement {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />;
}

CollapsibleRoot.displayName = "Collapsible.Root";
CollapsibleTrigger.displayName = "Collapsible.Trigger";
CollapsibleContent.displayName = "Collapsible.Content";

export const Collapsible = {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
};
