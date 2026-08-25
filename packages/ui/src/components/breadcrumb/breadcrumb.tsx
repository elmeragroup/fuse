"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretRight } from "../../icons/generated/caret-right";
import { DotsThree } from "../../icons/generated/dots-three";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { breadcrumbStrings } from "./intl";

const selfFocusRing = focusRing({ target: "self" }).root();

export type BreadcrumbRootProps = ComponentProps<"nav"> & {
  /**
   * Landmark label. Defaults to the locale dictionary; an explicit `aria-label`
   * wins over this prop (breadcrumb.md §3).
   */
  label?: string;
};

export type BreadcrumbListProps = ComponentProps<"ol">;
export type BreadcrumbItemProps = ComponentProps<"li">;
export type BreadcrumbLinkProps = useRender.ComponentProps<"a">;
export type BreadcrumbPageProps = ComponentProps<"span">;
export type BreadcrumbSeparatorProps = ComponentProps<"li">;

export type BreadcrumbEllipsisProps = ComponentProps<"span"> & {
  /**
   * Screen-reader-only copy for omitted items. Defaults to the locale dictionary
   * (breadcrumb.md §3).
   */
  label?: string;
};

/**
 * Client breadcrumb trail (breadcrumb.md §2/§7). `Breadcrumb.Link` is the library
 * exemplar for `useRender` + `state.slot → data-slot`. Landmark and ellipsis copy
 * come from the provider dictionary.
 */
function BreadcrumbRoot({
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

function BreadcrumbList({ className, ...props }: BreadcrumbListProps): ReactElement {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "text-sm sm:gap-2.5 flex flex-wrap items-center gap-1.5 wrap-break-word text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: BreadcrumbItemProps): ReactElement {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({ className, render, ...props }: BreadcrumbLinkProps): ReactElement {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn("transition-colors hover:text-foreground", selfFocusRing, className),
      },
      props
    ),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({ className, ...props }: BreadcrumbPageProps): ReactElement {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: BreadcrumbSeparatorProps): ReactElement {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}>
      {children ?? <CaretRight />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, label, ...props }: BreadcrumbEllipsisProps): ReactElement {
  const strings = useLocalizedStrings(breadcrumbStrings);

  return (
    <span
      data-slot="breadcrumb-ellipsis"
      className={cn("flex size-5 items-center justify-center [&>svg]:size-4", className)}
      {...props}>
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

export const Breadcrumb = {
  Root: BreadcrumbRoot,
  List: BreadcrumbList,
  Item: BreadcrumbItem,
  Link: BreadcrumbLink,
  Page: BreadcrumbPage,
  Separator: BreadcrumbSeparator,
  Ellipsis: BreadcrumbEllipsis,
};
