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

/** Resolved once at module scope — the recipe is prop-independent here (no per-render work). */
const { base, content, link, linkIcon, ellipsis, ellipsisIcon } = paginationVariants();

/**
 * The two edges differ by four values only, so `Pagination.Previous` and
 * `Pagination.Next` are one component parameterised by direction.
 */
const EDGES = {
  previous: {
    slot: "pagination-previous",
    Icon: CaretLeft,
    labelKey: "goToPrevious",
    textKey: "previous",
    link: paginationVariants({ direction: "previous" }).link,
  },
  next: {
    slot: "pagination-next",
    Icon: CaretRight,
    labelKey: "goToNext",
    textKey: "next",
    link: paginationVariants({ direction: "next" }).link,
  },
} as const;

type PaginationDirection = keyof typeof EDGES;

export type PaginationRootProps = ComponentProps<"nav"> & {
  /**
   * Landmark label. Defaults to the locale dictionary; an explicit `aria-label`
   * wins over this prop.
   */
  label?: string;
};

/** Wrapping row of page links; edge controls stay reachable in narrow containers. */
export type PaginationContentProps = ComponentProps<"ul">;
export type PaginationItemProps = ComponentProps<"li">;

export type PaginationLinkProps = {
  /**
   * Current page. Renders `aria-current="page"` and the outline button variant;
   * inactive links omit the attribute entirely.
   */
  isActive?: boolean;
  /**
   * Recipe size axis borrowed from Button. Defaults to `"icon"`.
   */
  size?: ButtonProps["size"];
} & ComponentProps<"a">;

export type PaginationPreviousProps = Omit<PaginationLinkProps, "size" | "isActive" | "children"> & {
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

export type PaginationNextProps = Omit<PaginationLinkProps, "size" | "isActive" | "children"> & {
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

export type PaginationEllipsisProps = Omit<ComponentProps<"span">, "children"> & {
  /**
   * Screen-reader-only ellipsis copy. Defaults to the locale dictionary.
   */
  label?: string;
};

/**
 * Client page-navigation compound. Anchors are styled via
 * the borrowed public `buttonVariants`; landmark, Previous/Next, and ellipsis
 * copy come from the provider dictionary.
 */
export function PaginationRoot({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: PaginationRootProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);

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

export function PaginationContent({ className, ...props }: PaginationContentProps): ReactElement {
  return <ul data-slot="pagination-content" className={cn(content(), className)} {...props} />;
}

export function PaginationItem({ className, ...props }: PaginationItemProps): ReactElement {
  return <li data-slot="pagination-item" className={className} {...props} />;
}

export function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps): ReactElement {
  return (
    <a
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), link(), className)}
      {...props}
    />
  );
}

function PaginationEdge({
  direction,
  className,
  text,
  label,
  size = "default",
  "aria-label": ariaLabel,
  ...props
}: PaginationPreviousProps & { direction: PaginationDirection }): ReactElement {
  const edge = EDGES[direction];
  const strings = useLocalizedStrings(paginationStrings);
  const caret = <edge.Icon className={linkIcon()} />;
  const copy = <span>{text ?? strings.format(edge.textKey)}</span>;

  return (
    <PaginationLink
      data-slot={edge.slot}
      size={size}
      aria-label={ariaLabel ?? label ?? strings.format(edge.labelKey)}
      className={cn(edge.link(), className)}
      {...props}>
      {direction === "previous" ? caret : copy}
      {direction === "previous" ? copy : caret}
    </PaginationLink>
  );
}

export function PaginationPrevious({ size = "default", ...props }: PaginationPreviousProps): ReactElement {
  return <PaginationEdge direction="previous" size={size} {...props} />;
}

export function PaginationNext({ size = "default", ...props }: PaginationNextProps): ReactElement {
  return <PaginationEdge direction="next" size={size} {...props} />;
}

export function PaginationEllipsis({ className, label, ...props }: PaginationEllipsisProps): ReactElement {
  const strings = useLocalizedStrings(paginationStrings);

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

// Client callers import this object from the implementation module.
// The package entry rebuilds the same parts in index.ts, which has no directive,
// so a server component can read each part.
export const Pagination = {
  Root: PaginationRoot,
  Content: PaginationContent,
  Item: PaginationItem,
  Link: PaginationLink,
  Previous: PaginationPrevious,
  Next: PaginationNext,
  Ellipsis: PaginationEllipsis,
};
