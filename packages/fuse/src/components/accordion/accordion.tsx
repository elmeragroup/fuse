"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement } from "react";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import type { AccordionRoot as AccordionRootType } from "@base-ui/react/accordion";
import type { VariantProps } from "tailwind-variants";

import { CaretDown } from "../../icons/generated/caret-down";
import { accordionVariants } from "./accordion-variants";

type AccordionVariantProps = VariantProps<typeof accordionVariants>;

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

export function AccordionTrigger({
  className,
  children,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Trigger>>): ReactElement {
  const variants = useAccordion();
  const { trigger, icon } = accordionVariants(variants);

  return (
    <AccordionPrimitive.Trigger data-slot="accordion-trigger" className={trigger({ className })} {...props}>
      {children}
      <CaretDown aria-hidden="true" className={icon()} />
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
