import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { labelTypeClass } from "../../styles/label-type";
import { DescriptionListHeading } from "./description-list-heading";

/** `DescriptionList.Root` takes a native `div`'s props. */
export type DescriptionListRootProps = ComponentProps<"div">;
/** `DescriptionList.Content` takes a native `dl`'s props, the `layout` and `dividers`. */
export type DescriptionListContentProps = ComponentProps<"dl"> & {
  /**
   * How each Item's terms and details sit. `responsive` stacks the details under the term on
   * phones and sets them in two columns from `sm` up, with a rule between Items.
   *
   * `inline` is for label and value rows in receipts, order summaries and price boxes. Each Item
   * shares its own row between its term and details, with the details at the end of the row.
   * When the two do not fit on one line, both wrap within the row. Only when the term's longest
   * word and the details' longest word cannot share the row does the details move under its term,
   * and a word wider than the whole row then breaks in the details. Inline rows take the label
   * type, follow density as field labels do, space with the small surface gap and have no rules.
   * The term is not muted: add `text-muted-foreground` to a term to mute it, or `font-medium` to a
   * details to stress it. To group rows, use one inline list per group. Consecutive inline lists
   * space with the large surface gap.
   *
   * A colour class on a term or details wins in both layouts. To override the inline cells'
   * padding, sizing and alignment, use a `[:where([data-layout=inline]>*)>&]:` class or a CSS
   * rule. To override an inline Item's row, wrap and gap, use a `[:where([data-layout=inline])>&]:`
   * class.
   */
  layout?: "responsive" | "inline";
  /**
   * Whether a responsive list draws a rule above every Item but the first. Pass `false` for a list
   * whose rows need no rules, such as one inside a card that already separates it. It reaches only
   * this list's own Items, so a list nested inside keeps its own rules. An inline list draws no
   * rules either way.
   */
  dividers?: boolean;
  /**
   * The list's Items. Wrap each term and its details in a `DescriptionList.Item`, the `<div>`
   * HTML allows around one name-value group. Do not mix Items with bare terms and details: HTML
   * forbids it, the inline layout styles cells only inside an Item, and rules fall between Items.
   */
  children?: ComponentProps<"dl">["children"];
};
/** `DescriptionList.Item` takes a native `div`'s props. */
export type DescriptionListItemProps = ComponentProps<"div"> & {
  /**
   * The group's terms and details. An Item can hold several terms of one details, or several
   * details of one term. Its last term pairs with its first details, and earlier terms and later
   * details take rows of their own.
   */
  children?: ComponentProps<"div">["children"];
};
/** `DescriptionList.Term` takes a native `dt`'s props. */
export type DescriptionListTermProps = ComponentProps<"dt"> & {
  /**
   * The term. It wraps at its spaces and hyphens, so a hyphenated label such as "Målepunkt-ID" can
   * split at the hyphen beside a long value. Write it with a non-breaking hyphen, U+2011, to keep
   * it whole.
   */
  children?: ComponentProps<"dt">["children"];
};
/** `DescriptionList.Details` takes a native `dd`'s props. */
export type DescriptionListDetailsProps = ComponentProps<"dd"> & {
  /**
   * The value. In a `layout="inline"` list, it wraps between its words beside its term. There, an
   * email address too wide to sit beside its term moves under it whole, and one wider than the row
   * breaks inside it. Put a `<wbr>` before the `@` to let it break at the `@` instead, which often
   * keeps it beside its term.
   */
  children?: ComponentProps<"dd">["children"];
};
export type { DescriptionListHeadingProps } from "./description-list-heading";

/**
 * A semantic `<dl>`, `<dt>` and `<dd>` list. A server compound: it owns no state, handlers or
 * browser APIs. `Heading` is a client `useRender` part, so other outline levels stay possible
 * without making this module a client boundary.
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
// keep tailwind-variants out of this entry's bundle.

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
  dividers = true,
  ...props
}: DescriptionListContentProps): ReactElement {
  return (
    <dl
      data-slot="description-list-content"
      data-layout={layout}
      // Rules are the responsive default, so only their absence is written: the Items read
      // `data-dividers=false` and nothing reads a `true`. `false` is true of an inline list too,
      // which never draws rules, so the attribute is written whatever the layout.
      {...(dividers ? null : { "data-dividers": "false" })}
      className={cn(layout === "inline" ? inlineContentClass : responsiveContentClass, className)}
      {...props}
    />
  );
}

// A responsive Item spans the list's columns as a subgrid, so its term and details sit in the
// list's shared columns, and draws the rule above itself unless it is the first or its own list, as
// its direct child, writes `data-dividers=false`; a list nested in a divider-less one keeps its
// rules, and the reverse. Only Items draw rules, so the terms or details of one group are never
// split by one. An inline Item is a wrapping flex row. Its term and details start at their longest
// word and grow alike up to their full width, so a short one gives the rest to the other, and a
// term and its details wrap apart only when their two longest words can't share the row: then the
// details moves under its term instead of breaking a word, and breaks one only when it is wider
// than the row. The last term never breaks a word, so a single word wider than the whole row would
// overflow it. An Item's earlier terms and later details take lines of their own, capped at the
// row, so an earlier term does break a word that wide; its last term pairs with its first details,
// as in the responsive layout.
function DescriptionListItem({ className, ...props }: DescriptionListItemProps): ReactElement {
  return (
    <div
      data-slot="description-list-item"
      className={cn(
        "col-span-full grid grid-cols-subgrid border-t first-of-type:border-none [:where([data-dividers=false])>&]:border-none",
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
