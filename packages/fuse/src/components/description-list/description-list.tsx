import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { labelTypeClass } from "../../styles/label-type";
import { DescriptionListHeading } from "./description-list-heading";

export type DescriptionListRootProps = ComponentProps<"div">;
export type DescriptionListContentProps = ComponentProps<"dl"> & {
  /**
   * How terms and details sit. `responsive` stacks each details under its term on phones and
   * sets them in two columns, with a rule between rows, from `sm` up. `inline` keeps each term
   * and its details on one row at every width, for label/value rows in cards and summaries: the
   * details align to the end, a short one never wraps and a long one wraps within 60% of the
   * row. Inline rows take the label type, have no rules and space with the small surface gap,
   * and the term is not muted. A colour class on a cell wins in both layouts. The inline cells'
   * padding, rules, column and alignment come from the list, so override them with a
   * `[:where([data-layout=inline])>&]:` class or a CSS rule. Defaults to `responsive`.
   */
  layout?: "responsive" | "inline";
};
export type DescriptionListTermProps = ComponentProps<"dt">;
export type DescriptionListDetailsProps = ComponentProps<"dd">;
export type { DescriptionListHeadingProps } from "./description-list-heading";

/**
 * Semantic `<dl>/<dt>/<dd>` composite. A server compound: it owns no state, handlers or
 * browser APIs. `Heading` is a client `useRender` island, so other outline levels stay
 * possible without making this module a client boundary.
 */
function DescriptionListRoot(props: DescriptionListRootProps): ReactElement {
  return <div data-slot="description-list" {...props} />;
}

// Each layout publishes the term and details colours as the private `--description-list-term` and
// `--description-list-details`, so a nested list resets them and a consumer colour class on a cell
// still wins in both layouts. Inline cells take the surrounding text colour, such as a card's. The
// term and details style the rest of the inline layout from their own list's `data-layout`, as
// its direct children, so a responsive list nested in an inline one keeps its own layout. Plain
// `cn` constants rather than a `tv` recipe keep tailwind-variants out of this entry's size budget.

/** The responsive list: one column on phones, then a term column capped at min(50%, 20rem). */
const responsiveContentClass = cn(
  "text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6 grid grid-cols-1 [--description-list-details:var(--foreground)] [--description-list-term:var(--muted-foreground)]"
);

/**
 * The inline list: `minmax(0,1fr)` for the terms and `fit-content(60%)` for the details, rows
 * spaced by the small surface gap, the label type set here for the cells to inherit, and
 * consecutive inline lists spaced by the large surface gap.
 */
const inlineContentClass = cn(
  "grid grid-cols-[minmax(0,1fr)_fit-content(60%)] gap-x-(--surface-gap-md) gap-y-(--surface-gap-sm)",
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

function DescriptionListTerm({ className, ...props }: DescriptionListTermProps): ReactElement {
  return (
    <dt
      data-slot="description-list-term"
      className={cn(
        "col-start-1 border-t py-(--row-py) pr-(--row-px) text-[color:var(--description-list-term,var(--muted-foreground))] first-of-type:border-none",
        "[:where([data-layout=inline])>&]:min-w-0 [:where([data-layout=inline])>&]:border-none [:where([data-layout=inline])>&]:p-0 [:where([data-layout=inline])>&]:wrap-anywhere",
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
        "sm:border-t py-(--row-py) text-[color:var(--description-list-details,var(--foreground))] first-of-type:border-none",
        "[:where([data-layout=inline])>&]:col-start-2 [:where([data-layout=inline])>&]:min-w-0 [:where([data-layout=inline])>&]:border-none [:where([data-layout=inline])>&]:py-0 [:where([data-layout=inline])>&]:text-end [:where([data-layout=inline])>&]:wrap-anywhere",
        className
      )}
      {...props}
    />
  );
}

DescriptionListRoot.displayName = "DescriptionList.Root";
DescriptionListContent.displayName = "DescriptionList.Content";
DescriptionListTerm.displayName = "DescriptionList.Term";
DescriptionListDetails.displayName = "DescriptionList.Details";

export const DescriptionList = {
  Root: DescriptionListRoot,
  Heading: DescriptionListHeading,
  Content: DescriptionListContent,
  Term: DescriptionListTerm,
  Details: DescriptionListDetails,
};
