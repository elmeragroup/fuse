"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import type { AccordionRoot as AccordionRootType } from "@base-ui/react/accordion";
import type { VariantProps } from "tailwind-variants";

import { CaretDown } from "../../icons/generated/caret-down";
import { accordionVariants } from "./accordion-variants";

type AccordionRecipeProps = VariantProps<typeof accordionVariants>;

type AccordionVariantProps = {
  /**
   * The item style. `default` fills each item with the brand's soft tint, `card` draws each item
   * as a bordered card, and `infodropdown` draws plain rows over one bottom border, with the caret
   * at the right edge. A `card` item's edge takes the theme's `--card-border`, which branded themes
   * make transparent; add `border-border` to an item's `className` to keep a visible edge.
   */
  variant?: AccordionRecipeProps["variant"];
  /**
   * The item corner. `none` keeps the variant's own corner, and `lg` and `xl` round each item to
   * that radius.
   */
  radius?: AccordionRecipeProps["radius"];
};

type WithSlotClassName<T> = Omit<T, "className"> & {
  /** Classes the part adds to its recipe slot. */
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
 * Stacked sections that open and close, built on Base UI's accordion. Root holds the open items
 * and passes `variant` and `radius` to its parts.
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

/**
 * One section, holding a header and its content. A rounded item, under a Root `radius` other
 * than `none`, publishes `--inner-corner`, its corner less its border and padding, and a `card`
 * item's panel rounds with it.
 */
export function AccordionItem({
  className,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Item>>): ReactElement {
  const variants = useAccordion();
  const { item } = accordionVariants(variants);

  return <AccordionPrimitive.Item data-slot="accordion-item" className={item({ className })} {...props} />;
}

/** The heading that holds an item's trigger. */
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

/** The button that opens and closes its item. */
export function AccordionTrigger({
  className,
  children,
  indicator,
  ...props
}: WithSlotClassName<ComponentProps<typeof AccordionPrimitive.Trigger>> & {
  /**
   * The node after the children. Unset, it is a caret that turns while the item is open. Pass
   * `null` for none, and the children move to the start. The variant places a custom indicator
   * where the caret sits but does not turn it. Style its open state from the trigger's
   * `data-panel-open`, such as `in-data-[panel-open]:rotate-90`, as you would a leading icon in
   * the children.
   */
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

/** The panel that shows while its item is open. */
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
