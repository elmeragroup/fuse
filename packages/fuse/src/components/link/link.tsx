"use client";

import type { ReactElement } from "react";
import { cloneElement, isValidElement } from "react";

import { unwrapLazyRenderProp } from "@base-ui/react/internals/useRenderElement";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { linkVariants } from "./link-variants";

export type LinkProps = useRender.ComponentProps<"a"> & VariantProps<typeof linkVariants>;

/**
 * A render element's `className`: a string, or a state callback such as React Aria's `Link` takes.
 * Link never calls the callback, the element does with its own state, so the state is `never` here.
 */
type RenderElementClassName = string | ((state: never) => string | undefined) | undefined;

type RenderElement = ReactElement<{ className?: RenderElementClassName }>;

/**
 * The element a `render` value holds, or `undefined` for a render function or no `render`. A
 * Server Component's element reaches a client component as React Flight's lazy node, which is no
 * valid element until Base UI's `unwrapLazyRenderProp` unwraps it, as `useRender` does.
 */
function renderElementOf(render: LinkProps["render"]): RenderElement | undefined {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public render prop accepts an element or a render function.
  if (render === undefined || typeof render === "function") {
    return undefined;
  }
  const element = unwrapLazyRenderProp(render);
  return isValidElement<RenderElement["props"]>(element) ? element : undefined;
}

/**
 * Hands Link's classes to a render element that sets its own `className`, merged ahead of it.
 *
 * `useRender` would join the two with `mergeProps`, which concatenates: it stringifies a state
 * callback into the class attribute, and it lets Link's classes win a Tailwind conflict.
 * `mergeClassName` keeps the callback a callback, run by the element it belongs to, and merges
 * the element's classes last. Returns `undefined` when the element sets no `className`.
 */
function renderWithClassName(render: LinkProps["render"], classes: string): ReactElement | undefined {
  const element = renderElementOf(render);
  const own = element?.props.className;
  return element === undefined || own === undefined
    ? undefined
    : cloneElement(element, { className: mergeClassName(own, classes) });
}

/**
 * A text link, underlined by default, that sits in a sentence and takes its type.
 *
 * Link renders an `<a>` and routes nothing itself. To navigate through an app's router, pass the
 * router's link as `render`, and Link merges its classes, `data-slot` and props onto it:
 *
 * ```tsx
 * <Link render={<NextLink href="/invoices/1042" />}>Invoice 1042</Link>
 * ```
 *
 * The same `render` composition takes React Router's `Link` or React Aria's `Link`, whose
 * `RouterProvider` then routes an internal `href`. A `className` on the render element, a string
 * or React Aria's state callback, merges after Link's classes and wins a conflict. For a link
 * that leaves the site, set `target` and `rel` yourself, and add an icon after the text: Link
 * sizes an inline SVG to the text.
 */
export function Link({
  className,
  variant,
  underline,
  weight,
  truncate,
  render,
  ...props
}: LinkProps): ReactElement {
  const classes = cn(linkVariants({ variant, underline, weight, truncate }), className);
  const classedRender = renderWithClassName(render, classes);
  return useRender({
    defaultTagName: "a",
    props: {
      "data-slot": "link",
      ...mergeProps<"a">(classedRender === undefined ? { className: classes } : {}, props),
    },
    render: classedRender ?? render,
  });
}

Link.displayName = "Link";
