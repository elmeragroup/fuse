import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { DescriptionListHeading } from "./description-list-heading";

export type DescriptionListRootProps = ComponentProps<"div">;
export type DescriptionListContentProps = ComponentProps<"dl">;
export type DescriptionListTermProps = ComponentProps<"dt">;
export type DescriptionListDetailsProps = ComponentProps<"dd">;
export type { DescriptionListHeadingProps } from "./description-list-heading";

/**
 * Semantic `<dl>/<dt>/<dd>` composite. Server compound —
 * it owns no state, no handlers, and no browser APIs (performance.md §RSC
 * classification). `Heading` is a client `useRender` island so other outline levels
 * stay possible without flipping this module to a client boundary.
 */
function DescriptionListRoot(props: DescriptionListRootProps): ReactElement {
  return <div data-slot="description-list" {...props} />;
}

function DescriptionListContent({ className, ...props }: DescriptionListContentProps): ReactElement {
  return (
    <dl
      data-slot="description-list-content"
      className={cn(
        "text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6 grid grid-cols-1",
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
        "col-start-1 border-t py-2 pr-2 text-muted-foreground first-of-type:border-none",
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
      className={cn("sm:border-t py-2 text-foreground first-of-type:border-none", className)}
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
