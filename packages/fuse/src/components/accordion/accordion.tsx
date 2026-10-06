"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import type { AccordionRoot as AccordionRootType } from "@base-ui/react/accordion";
import type { VariantProps } from "tailwind-variants";

import { CaretDown } from "../../icons/generated/caret-down";
import { accordionVariants } from "./accordion-variants";

type AccordionVariantProps = Omit<VariantProps<typeof accordionVariants>, "hasIndicator">;

type WithSlotClassName<T> = Omit<T, "className"> & {
  /** Extra classes, merged into the part's recipe slot via the recipe `className` argument. */
  className?: string;
};

const AccordionContext = createContext<AccordionVariantProps | null>(null);

function useAccordion(): AccordionVariantProps {
  const context = useContext(AccordionContext);
  if (context === null) {
    throw new Error("useAccordion must be used within Accordion.Root");
  }
  return context;
}

/**
 * Client accordion over `@base-ui/react/accordion`. Root owns
 * open-item state; `variant` / `radius` publish through module-private context so
 * parts style themselves.
 */
export function AccordionRoot<Value = unknown>({
  className,
  variant = "default",
  radius = "none",
  ...props
}: WithSlotClassName<AccordionRootType.Props<Value>> & AccordionVariantProps): ReactElement {
  const { base } = accordionVariants({ variant, radius });
  const variants = useMemo((): AccordionVariantProps => ({ variant, radius }), [variant, radius]);

  return (
    <AccordionContext.Provider value={variants}>
      <AccordionPrimitive.Root data-slot="accordion" className={base({ className })} {...props} />
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  className,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Item>>): ReactElement {
  const variants = useAccordion();
  const { item } = accordionVariants(variants);

  return <AccordionPrimitive.Item data-slot="accordion-item" className={item({ className })} {...props} />;
}

export function AccordionHeader({
  className,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Header>>): ReactElement {
  const variants = useAccordion();
  const { header } = accordionVariants(variants);

  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className={header({ className })} {...props} />
  );
}

/**
 * The item's toggle button. `indicator` follows the children: it defaults to a caret that
 * rotates while the item is open, `null` renders none, and any other node renders as given.
 * The variant places any indicator, default or custom, in the same position. The rotation
 * belongs to the default caret only; a custom indicator, or a leading icon passed as a child,
 * styles its open state from the trigger's `data-panel-open` (`in-data-[panel-open]:rotate-90`).
 * With no indicator the children pack at the start.
 */
export function AccordionTrigger({
  className,
  children,
  indicator,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Trigger>> & {
  /** Node after the children. Defaults to a rotating caret; `null` renders none. */
  indicator?: ReactNode;
}): ReactElement {
  const variants = useAccordion();
  const slots = accordionVariants({ ...variants, hasIndicator: indicator !== null });

  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={slots.trigger({ className })}
      {...props}>
      {children}
      {indicator === undefined ? (
        <CaretDown aria-hidden="true" className={slots.icon()} />
      ) : indicator === null ? null : (
        <span data-slot="accordion-indicator" className={slots.indicator()}>
          {indicator}
        </span>
      )}
    </AccordionPrimitive.Trigger>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Panel>>): ReactElement {
  const variants = useAccordion();
  const { content, contentInner } = accordionVariants(variants);

  return (
    <AccordionPrimitive.Panel data-slot="accordion-content" className={content()} {...props}>
      <div className={contentInner({ className })}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

AccordionRoot.displayName = "Accordion.Root";
AccordionItem.displayName = "Accordion.Item";
AccordionHeader.displayName = "Accordion.Header";
AccordionTrigger.displayName = "Accordion.Trigger";
AccordionContent.displayName = "Accordion.Content";
