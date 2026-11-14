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

/** Resolved once at module scope, because these slots take no props. */
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
   * The navigation landmark's name. Unset, it comes from the locale dictionary. An `aria-label`
   * wins over it.
   */
  label?: string;
};

/** Props for `Pagination.Content`, the row of page links. */
export type PaginationContentProps = Omit<ComponentProps<"ul">, "children"> & {
  /**
   * The `Pagination.Item`s, one per link or ellipsis. In a narrow container the row wraps onto
   * more lines, so Previous and Next stay in reach.
   */
  children?: ComponentProps<"ul">["children"];
};
export type PaginationItemProps = ComponentProps<"li">;

export type PaginationLinkProps = {
  /**
   * Marks the current page. The link gets `aria-current="page"` and the outline button style.
   * Other links have no `aria-current`.
   */
  isActive?: boolean;
  /** The link's size, one of Button's sizes. */
  size?: ButtonProps["size"];
} & ComponentProps<"a">;

export type PaginationPreviousProps = Omit<PaginationLinkProps, "size" | "isActive" | "children"> & {
  /** The link's size, one of Button's sizes. */
  size?: ButtonProps["size"];
  /** The visible text beside the caret. Unset, it comes from the locale dictionary. */
  text?: string;
  /**
   * The link's accessible name, such as "Go to previous page". Unset, it comes from the locale
   * dictionary. An `aria-label` wins over it.
   */
  label?: string;
};

export type PaginationNextProps = Omit<PaginationLinkProps, "size" | "isActive" | "children"> & {
  /** The link's size, one of Button's sizes. */
  size?: ButtonProps["size"];
  /** The visible text beside the caret. Unset, it comes from the locale dictionary. */
  text?: string;
  /**
   * The link's accessible name, such as "Go to next page". Unset, it comes from the locale
   * dictionary. An `aria-label` wins over it.
   */
  label?: string;
};

export type PaginationEllipsisProps = Omit<ComponentProps<"span">, "children"> & {
  /**
   * The screen reader text for the pages the ellipsis stands for. Unset, it comes from the locale
   * dictionary.
   */
  label?: string;
};

/**
 * Links between the pages of a list. The links take Button's public `buttonVariants`. The landmark
 * name, the Previous and Next text and the ellipsis text come from the locale dictionary.
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

/** The row of page links. */
export function PaginationContent({ className, ...props }: PaginationContentProps): ReactElement {
  return <ul data-slot="pagination-content" className={cn(content(), className)} {...props} />;
}

/** One entry of the row, holding a link or an ellipsis. */
export function PaginationItem({ className, ...props }: PaginationItemProps): ReactElement {
  return <li data-slot="pagination-item" className={className} {...props} />;
}

/** A link to one page. */
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

/** The link to the previous page, with a caret before its text. */
export function PaginationPrevious({ size = "default", ...props }: PaginationPreviousProps): ReactElement {
  return <PaginationEdge direction="previous" size={size} {...props} />;
}

/** The link to the next page, with a caret after its text. */
export function PaginationNext({ size = "default", ...props }: PaginationNextProps): ReactElement {
  return <PaginationEdge direction="next" size={size} {...props} />;
}

/** Three dots that stand for pages left out of the row. */
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
