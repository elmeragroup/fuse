"use client";

import type { ComponentProps, ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { DotsThree } from "../../icons/generated/dots-three";
import { cn } from "../../styles/cn";
import type { ButtonProps } from "../button/button";
import { buttonVariants } from "../button/button-variants";
import { paginationStrings } from "./intl";
import { paginationVariants } from "./pagination-variants";

export type PaginationRootProps = ComponentProps<"nav"> & {
  /**
   * Landmark label. Defaults to the locale dictionary; an explicit `aria-label`
   * wins over this prop (pagination.md §3).
   */
  label?: string;
};

export type PaginationContentProps = ComponentProps<"ul">;
export type PaginationItemProps = ComponentProps<"li">;

export type PaginationLinkProps = {
  /**
   * Current page. Renders `aria-current="page"` and the outline button variant;
   * inactive links omit the attribute entirely (pagination.md §3/§7).
   */
  isActive?: boolean;
  /**
   * Recipe size axis borrowed from Button. Defaults to `"icon"`.
   */
  size?: ButtonProps["size"];
} & ComponentProps<"a">;

export type PaginationPreviousProps = Omit<PaginationLinkProps, "size"> & {
  /**
   * Recipe size axis borrowed from Button. Defaults to `"default"`.
   */
  size?: ButtonProps["size"];
  /**
   * Visible Previous copy. Defaults to the locale dictionary.
   */
  text?: string;
  /**
   * Accessible name. Defaults to the locale dictionary; an explicit `aria-label` wins.
   */
  label?: string;
};

export type PaginationNextProps = Omit<PaginationLinkProps, "size"> & {
  /**
   * Recipe size axis borrowed from Button. Defaults to `"default"`.
   */
  size?: ButtonProps["size"];
  /**
   * Visible Next copy. Defaults to the locale dictionary.
   */
  text?: string;
  /**
   * Accessible name. Defaults to the locale dictionary; an explicit `aria-label` wins.
   */
  label?: string;
};

export type PaginationEllipsisProps = ComponentProps<"span"> & {
  /**
   * Screen-reader-only ellipsis copy. Defaults to the locale dictionary.
   */
  label?: string;
};

/**
 * Client page-navigation compound (pagination.md §2/§7). Anchors are styled via
 * the borrowed public `buttonVariants`; landmark, Previous/Next, and ellipsis
 * copy come from the provider dictionary (performance.md §RSC classification).
 */
function PaginationRoot({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: PaginationRootProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);
  const { base } = paginationVariants();

  return (
    <nav
      data-slot="pagination"
      role="navigation"
      aria-label={ariaLabel ?? label ?? strings.format("landmark")}
      className={cn(base(), className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: PaginationContentProps): ReactElement {
  const { content } = paginationVariants();

  return <ul data-slot="pagination-content" className={cn(content(), className)} {...props} />;
}

function PaginationItem({ className, ...props }: PaginationItemProps): ReactElement {
  return <li data-slot="pagination-item" className={className} {...props} />;
}

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps): ReactElement {
  const { link } = paginationVariants();

  return (
    <a
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), link(), className)}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  text,
  label,
  size = "default",
  "aria-label": ariaLabel,
  ...props
}: PaginationPreviousProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);
  const { link, linkIcon } = paginationVariants({ direction: "previous" });

  return (
    <PaginationLink
      data-slot="pagination-previous"
      size={size}
      aria-label={ariaLabel ?? label ?? strings.format("goToPrevious")}
      className={cn(link(), className)}
      {...props}>
      <CaretLeft className={linkIcon()} />
      <span>{text ?? strings.format("previous")}</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  text,
  label,
  size = "default",
  "aria-label": ariaLabel,
  ...props
}: PaginationNextProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);
  const { link, linkIcon } = paginationVariants({ direction: "next" });

  return (
    <PaginationLink
      data-slot="pagination-next"
      size={size}
      aria-label={ariaLabel ?? label ?? strings.format("goToNext")}
      className={cn(link(), className)}
      {...props}>
      <span>{text ?? strings.format("next")}</span>
      <CaretRight className={linkIcon()} />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, label, ...props }: PaginationEllipsisProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);
  const { ellipsis, ellipsisIcon } = paginationVariants();

  return (
    <span data-slot="pagination-ellipsis" className={cn(ellipsis(), className)} {...props}>
      <DotsThree aria-hidden="true" className={ellipsisIcon()} />
      <span className="sr-only">{label ?? strings.format("morePages")}</span>
    </span>
  );
}

PaginationRoot.displayName = "Pagination.Root";
PaginationContent.displayName = "Pagination.Content";
PaginationItem.displayName = "Pagination.Item";
PaginationLink.displayName = "Pagination.Link";
PaginationPrevious.displayName = "Pagination.Previous";
PaginationNext.displayName = "Pagination.Next";
PaginationEllipsis.displayName = "Pagination.Ellipsis";

export const Pagination = {
  Root: PaginationRoot,
  Content: PaginationContent,
  Item: PaginationItem,
  Link: PaginationLink,
  Previous: PaginationPrevious,
  Next: PaginationNext,
  Ellipsis: PaginationEllipsis,
};
