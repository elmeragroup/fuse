"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretRight } from "../../icons/generated/caret-right";
import { DotsThree } from "../../icons/generated/dots-three";
import { cn } from "../../styles/cn";
import { breadcrumbVariants } from "./breadcrumb-variants";
import { breadcrumbStrings } from "./intl";

const styles = breadcrumbVariants();

export type BreadcrumbRootProps = ComponentProps<"nav"> & {
  /**
   * The navigation landmark's name. Unset, it comes from the locale dictionary. An `aria-label`
   * wins over it.
   */
  label?: string;
};

export type BreadcrumbListProps = ComponentProps<"ol">;
export type BreadcrumbItemProps = ComponentProps<"li">;
export type BreadcrumbLinkProps = Omit<useRender.ComponentProps<"a">, "render"> & {
  /**
   * Your router's link element, with its own destination prop, such as `<NextLink href="/" />` or
   * React Router's `<RouterLink to="/" />`. The link merges its classes and props onto it, and the
   * router handles the click.
   */
  render?: useRender.ComponentProps<"a">["render"];
};
export type BreadcrumbPageProps = ComponentProps<"span">;
export type BreadcrumbSeparatorProps = Omit<ComponentProps<"li">, "children"> & {
  /**
   * The mark between two items. Unset, it is a caret. Pass an icon or a character such as `/`. An
   * `<svg>` child draws at 14px. The separator is hidden from screen readers.
   */
  children?: ComponentProps<"li">["children"];
};

export type BreadcrumbEllipsisProps = Omit<ComponentProps<"span">, "children"> & {
  /**
   * The screen reader text for the items the ellipsis stands for. Unset, it comes from the locale
   * dictionary.
   */
  label?: string;
};

/**
 * The trail of links to the current page. Its landmark name and the ellipsis text come from the
 * locale dictionary. `Breadcrumb.Link` is the library's example of `useRender` with
 * `state.slot` setting `data-slot`.
 */
export function BreadcrumbRoot({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: BreadcrumbRootProps): ReactElement {
  const strings = useLocalizedStrings(breadcrumbStrings);

  return (
    <nav
      data-slot="breadcrumb"
      aria-label={ariaLabel ?? label ?? strings.format("landmark")}
      className={cn(className)}
      {...props}
    />
  );
}

/** The ordered list that holds the items and separators. */
export function BreadcrumbList({ className, ...props }: BreadcrumbListProps): ReactElement {
  return <ol data-slot="breadcrumb-list" className={cn(styles.list(), className)} {...props} />;
}

/** One entry of the trail, holding a link, the page or an ellipsis. */
export function BreadcrumbItem({ className, ...props }: BreadcrumbItemProps): ReactElement {
  return <li data-slot="breadcrumb-item" className={cn(styles.item(), className)} {...props} />;
}

/** A link to an ancestor page. */
export function BreadcrumbLink({ className, render, ...props }: BreadcrumbLinkProps): ReactElement {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(styles.link(), className),
      },
      props
    ),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

/** The current page, marked `aria-current="page"`. */
export function BreadcrumbPage({ className, ...props }: BreadcrumbPageProps): ReactElement {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(styles.page(), className)}
      {...props}
    />
  );
}

/** The mark between two items. */
export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: BreadcrumbSeparatorProps): ReactElement {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn(styles.separator(), className)}
      {...props}>
      {children ?? <CaretRight />}
    </li>
  );
}

/** Three dots that stand for items left out of the trail. */
export function BreadcrumbEllipsis({ className, label, ...props }: BreadcrumbEllipsisProps): ReactElement {
  const strings = useLocalizedStrings(breadcrumbStrings);

  return (
    <span data-slot="breadcrumb-ellipsis" className={cn(styles.ellipsis(), className)} {...props}>
      <DotsThree aria-hidden="true" />
      <span className="sr-only">{label ?? strings.format("more")}</span>
    </span>
  );
}

BreadcrumbRoot.displayName = "Breadcrumb.Root";
BreadcrumbList.displayName = "Breadcrumb.List";
BreadcrumbItem.displayName = "Breadcrumb.Item";
BreadcrumbLink.displayName = "Breadcrumb.Link";
BreadcrumbPage.displayName = "Breadcrumb.Page";
BreadcrumbSeparator.displayName = "Breadcrumb.Separator";
BreadcrumbEllipsis.displayName = "Breadcrumb.Ellipsis";
