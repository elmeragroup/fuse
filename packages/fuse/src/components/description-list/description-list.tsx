import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { labelTypeClass } from "../../styles/label-type";
import { DescriptionListHeading } from "./description-list-heading";

export type DescriptionListRootProps = ComponentProps<"div">;
export type DescriptionListContentProps = ComponentProps<"dl"> & {
  /**
   * How each Item's terms and details sit. `responsive` stacks the details under the term on
   * phones and sets them in two columns from `sm` up, with a rule between Items at every width.
   * `inline` is for label/value rows in cards and summaries: each Item shares its own row between
   * its term and details, whatever the other Items hold. The details sits beside its term, at the
   * end of the row. When the two don't fit on one line, both wrap within the row: each keeps its
   * longest word and they share the rest, so a short one leaves the other room. Only when the term's
   * longest word and the details' longest word can't share the row does the details move under its
   * term, still at the end, rather than break a word; a word wider than the whole row then breaks in
   * the details. Inline rows take the label type, have no rules and space with the small surface
   * gap, and the term is not muted. A colour class on a cell wins in both layouts. The inline cells'
   * padding, sizing and alignment come from the list, so override them with a
   * `[:where([data-layout=inline]>*)>&]:` class or a CSS rule. Override an inline Item's row, wrap
   * and gap with a `[:where([data-layout=inline])>&]:` class. Defaults to `responsive`.
   */
  layout?: "responsive" | "inline";
};
export type DescriptionListItemProps = ComponentProps<"div">;
export type DescriptionListTermProps = ComponentProps<"dt">;
export type DescriptionListDetailsProps = ComponentProps<"dd">;
export type { DescriptionListHeadingProps } from "./description-list-heading";

/**
 * Semantic `<dl>/<dt>/<dd>` composite. Every name-value group sits in an `Item`, the `<div>`
 * HTML allows around one group, so a list never mixes Items and bare terms and details. A
 * server compound: it owns no state, handlers or browser APIs. `Heading` is a client
 * `useRender` island, so other outline levels stay possible without making this module a
 * client boundary.
 */
function DescriptionListRoot(props: DescriptionListRootProps): ReactElement {
  return <div data-slot="description-list" {...props} />;
}

// The inline layout publishes the term and details colours as the private `--description-list-term`
// and `--description-list-details`, and the responsive one resets them, so its cells fall back to
// `--muted-foreground` and `--foreground` read in their own theme scope. A nested list resets them
// too, and a consumer colour class on a cell still wins in both layouts. Inline cells take the
// surrounding text colour, such as a card's. An Item styles its inline layout from its own list's
// `data-layout`, as its direct child, and a term or details from its Item's list, so a responsive
// list nested in an inline one keeps its own layout. Plain `cn` constants rather than a `tv` recipe
// keep tailwind-variants out of this entry's size budget.

/**
 * The responsive list: one column on phones, then a term column capped at min(50%, 20rem) that
 * every Item shares through a subgrid, so the list sizes its columns to its widest term and widest
 * details, as one grid would. Both lists start from one `minmax(0,1fr)` column, so an unbroken word
 * can't widen the Items past the list on a phone.
 */
const responsiveContentClass = cn(
  "text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6 grid grid-cols-1 [--description-list-details:initial] [--description-list-term:initial]"
);

/**
 * The inline list: Items spaced by the small surface gap, the label type set here for the cells
 * to inherit, and consecutive inline lists spaced by the large surface gap.
 */
const inlineContentClass = cn(
  "grid grid-cols-1 gap-y-(--surface-gap-sm)",
  labelTypeClass,
  "[--description-list-details:currentColor] [--description-list-term:currentColor]",
  "[&+&]:mt-(--surface-gap-lg)"
);

function DescriptionListContent({
  className,
  layout = "responsive",
  ...props
}: DescriptionListContentProps): ReactElement {
  return (
    <dl
      data-slot="description-list-content"
      data-layout={layout}
      className={cn(layout === "inline" ? inlineContentClass : responsiveContentClass, className)}
      {...props}
    />
  );
}

// A responsive Item spans the list's columns as a subgrid, so its term and details sit in the
// list's shared columns, and draws the rule above itself unless it is the first. Only Items draw
// rules, so the terms or details of one group are never split by one. An inline Item is a wrapping
// flex row. Its term and details start at their longest word and grow alike up to their full width,
// so a short one gives the rest to the other, and the row wraps only when the two longest words
// can't share it: then the details moves under its term instead of breaking a word, and breaks one
// only when it is wider than the row. The term never breaks a word, so a single term word wider than
// the whole row would overflow it. An Item's earlier terms and later details take lines of their
// own, so its last term pairs with its first details, as in the responsive layout.
function DescriptionListItem({ className, ...props }: DescriptionListItemProps): ReactElement {
  return (
    <div
      data-slot="description-list-item"
      className={cn(
        "col-span-full grid grid-cols-subgrid border-t first-of-type:border-none",
        "[:where([data-layout=inline])>&]:flex [:where([data-layout=inline])>&]:flex-wrap [:where([data-layout=inline])>&]:gap-x-(--surface-gap-md) [:where([data-layout=inline])>&]:border-none",
        className
      )}
      {...props}
    />
  );
}

function DescriptionListTerm({ className, ...props }: DescriptionListTermProps): ReactElement {
  return (
    <dt
      data-slot="description-list-term"
      className={cn(
        "col-start-1 py-(--row-py) pr-(--row-px) text-[color:var(--description-list-term,var(--muted-foreground))]",
        "[:where([data-layout=inline]>*)>&]:max-w-max [:where([data-layout=inline]>*)>&]:shrink-0 [:where([data-layout=inline]>*)>&]:grow [:where([data-layout=inline]>*)>&]:basis-[min-content] [:where([data-layout=inline]>*)>&]:p-0 [:where([data-layout=inline]>*)>&]:wrap-break-word [:where([data-layout=inline]>*)>&]:not-last-of-type:max-w-full [:where([data-layout=inline]>*)>&]:not-last-of-type:basis-full",
        className
      )}
      {...props}
    />
  );
}

function DescriptionListDetails({ className, ...props }: DescriptionListDetailsProps): ReactElement {
  return (
    <dd
      data-slot="description-list-details"
      className={cn(
        "sm:col-start-2 ms-0 py-(--row-py) text-[color:var(--description-list-details,var(--foreground))]",
        "[:where([data-layout=inline]>*)>&]:ms-auto [:where([data-layout=inline]>*)>&]:max-w-max [:where([data-layout=inline]>*)>&]:min-w-0 [:where([data-layout=inline]>*)>&]:grow [:where([data-layout=inline]>*)>&]:basis-[min-content] [:where([data-layout=inline]>*)>&]:py-0 [:where([data-layout=inline]>*)>&]:text-end [:where([data-layout=inline]>*)>&]:wrap-break-word [:where([data-layout=inline]>*)>&]:not-first-of-type:max-w-full [:where([data-layout=inline]>*)>&]:not-first-of-type:basis-full",
        className
      )}
      {...props}
    />
  );
}

DescriptionListRoot.displayName = "DescriptionList.Root";
DescriptionListContent.displayName = "DescriptionList.Content";
DescriptionListItem.displayName = "DescriptionList.Item";
DescriptionListTerm.displayName = "DescriptionList.Term";
DescriptionListDetails.displayName = "DescriptionList.Details";

export const DescriptionList = {
  Root: DescriptionListRoot,
  Heading: DescriptionListHeading,
  Content: DescriptionListContent,
  Item: DescriptionListItem,
  Term: DescriptionListTerm,
  Details: DescriptionListDetails,
};
