import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { DescriptionListHeading } from "./description-list-heading";
import { descriptionListContentVariants } from "./description-list-variants";

export type DescriptionListRootProps = ComponentProps<"div">;
export type DescriptionListContentProps = ComponentProps<"dl"> & {
  /**
   * How terms and details sit. `responsive` stacks each details under its term on phones and
   * sets them in two columns, with a rule between rows, from `sm` up. `inline` keeps each term
   * and its details on one row at every width, for label/value rows in cards and summaries: the
   * details align to the end, a short one never wraps and a long one wraps within 60% of the
   * row. Inline rows take the label type, have no rules and space with the small surface gap,
   * and the term is not muted. Defaults to `responsive`.
   */
  layout?: keyof typeof descriptionListContentVariants.variants.layout;
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

function DescriptionListContent({
  className,
  layout = "responsive",
  ...props
}: DescriptionListContentProps): ReactElement {
  return (
    <dl
      data-slot="description-list-content"
      data-layout={layout}
      className={cn(descriptionListContentVariants({ layout }), className)}
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
        "in-data-[layout=inline]:border-none in-data-[layout=inline]:p-0",
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
        "sm:border-t py-(--row-py) text-foreground first-of-type:border-none",
        "in-data-[layout=inline]:col-start-2 in-data-[layout=inline]:min-w-0 in-data-[layout=inline]:border-none in-data-[layout=inline]:py-0 in-data-[layout=inline]:text-end in-data-[layout=inline]:wrap-anywhere",
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
