"use client";

import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

import { unwrapLazyRenderProp } from "@base-ui/react/internals/useRenderElement";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { linkVariants } from "./link-variants";

type LinkVariantProps = VariantProps<typeof linkVariants>;

/** `Link` takes a native `a` element's props, the recipe's axes and a `render` element. */
export type LinkProps = Omit<useRender.ComponentProps<"a">, "href" | "target" | "render" | "children"> & {
  /**
   * The destination: another page, a section of this page, or a file. For an action, such as
   * opening a dialog or saving a form, use a Button. A screen reader announces a link as a link,
   * and Space does not activate it.
   */
  href?: useRender.ComponentProps<"a">["href"];
  /**
   * Set `_blank`, with `rel="noreferrer"`, to open another site in a new tab. Say that the link
   * opens a new tab in text a screen reader reads, such as an `sr-only` span in `children`.
   */
  target?: useRender.ComponentProps<"a">["target"];
  /**
   * The link text. Name the destination, as in "Read the invoice help articles", not "click
   * here". An inline SVG after the text, marked `data-icon="inline-end"`, draws one `em` square in
   * the link's colour and stays on the last word's line. Mark one before the text
   * `data-icon="inline-start"`.
   */
  children?: ReactNode;
  /**
   * Your router's link element, with its own destination prop, such as
   * `<NextLink href="/invoices/1042" />` or React Router's `<RouterLink to="/invoices/1042" />`.
   * Link merges its classes, `data-slot` and props onto it, and the router handles the click. A
   * `className` on the element, a string or a state callback, merges after Link's classes and
   * wins a conflict.
   */
  render?: useRender.ComponentProps<"a">["render"];
  /**
   * The text colour. `default` takes the colour of the text around it, so a link in an error
   * message is the error colour. The others set a text role. Some themes set `primary` to the
   * text colour, so keep the underline wherever colour is the only other difference.
   */
  variant?: LinkVariantProps["variant"];
  /**
   * How a reader tells the link from its sentence. `always` underlines at rest in a dimmed line
   * and draws it in the full colour under the pointer. Keep it in running text, where nothing
   * else marks the link. `hover` underlines only under the pointer, for a place that already
   * reads as links, such as a row of footer links. `none` never underlines and fades the text
   * under the pointer, for a link a container marks, such as a card's title.
   */
  underline?: LinkVariantProps["underline"];
  /**
   * The link's own weight. Unset, the link takes the weight of its sentence, as it always takes
   * the sentence's font, size and line height.
   */
  weight?: LinkVariantProps["weight"];
  /**
   * Cuts a long link to its container's width with an ellipsis. Give the link a box to fit, such
   * as a flex row with a set width, and keep the full text in reach, such as on the page it opens.
   */
  truncate?: LinkVariantProps["truncate"];
};

/**
 * A render element's `className`, a string or a state callback such as React Router's `NavLink`
 * takes. Link never calls the callback. The element calls it with its own state, so the state is
 * `never` here.
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
 * `useRender` would join the two with `mergeProps`, which concatenates. It stringifies a state
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

/** A text link, underlined by default, that sits in a sentence and takes its type. */
export function Link({
  className,
  // Restates the recipe's defaults so the API extractor records them, until it reads recipe
  // defaults itself (elmeragroup/internal#39).
  variant = "default",
  underline = "always",
  weight,
  truncate = false,
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
