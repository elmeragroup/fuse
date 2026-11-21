/**
 * The host the compare page draws around a fixed root its definition places in a viewport, as a
 * Dialog's popup and its scrim sit in the browser window: a box as large as the declared viewport whose
 * `contain: layout` makes it the containing block of every fixed box inside it (CSS Containment 2
 * §3.2), so `fixed inset-0`, `top-1/2` and percentages resolve against it as they do against the
 * window. The overlay portals into it through the ref its content receives. Media queries still read
 * the page's window, 2400px wide, as the kit draws the desktop arm, and so do `dvh` and `dvw`. A set
 * whose fixed root reads those passes the rules that restate them against the viewport, which the host
 * puts in a `<style>` of its own, as the Command palette's `12dvh` top becomes 60px in its 500px
 * viewport. The rules are `!important`, so they win over the utilities they restate.
 *
 * A host can clip what paints past it, as the browser window clips a panel's shadow that falls past
 * its edge, so the compare screenshot shows those pixels transparent, as the built Figma frame,
 * which clips its content, draws them.
 *
 * It imports only React at run time, so the compare page's client bundle can take it.
 */

import { createElement, useRef } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import type { Viewport } from "../components/css-values.ts";

/** How a host treats what its content paints past its edges. */
type HostOverflow = "visible" | "clip";

/** What a host adds around its content beside the viewport: the rules it restates, and its overflow. */
type ViewportHostOptions = {
  /** The rules that restate the content's `dvh` and `dvw` lengths against the viewport. */
  readonly css?: string;
  /** Whether the host clips what paints past it, `visible` by default. */
  readonly overflow?: HostOverflow;
};

/**
 * The host's props: the viewport, the content, given the ref of the host it portals into, the rules
 * that restate the content's `dvh` and `dvw` lengths against the viewport, or undefined, and its
 * overflow.
 */
type ViewportHostProps = {
  readonly viewport: Viewport;
  readonly content: (host: RefObject<HTMLDivElement | null>) => ReactNode;
  readonly css: string | undefined;
  readonly overflow: HostOverflow;
};

function ViewportHost({ viewport, content, css, overflow }: ViewportHostProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const size = { position: "relative", width: viewport.width, height: viewport.height, contain: "layout" };
  return createElement(
    "div",
    {
      ref: host,
      "data-compare-viewport": "",
      style: overflow === "clip" ? { ...size, overflow: "clip" } : size,
    },
    css === undefined ? undefined : createElement("style", { key: "viewport" }, css),
    content(host)
  );
}

/**
 * The host around an overlay the content renders, as large as the viewport.
 *
 * @param viewport - The viewport the definition declares.
 * @param content - The overlay, given the host's ref as its portal container.
 * @param options - The rules that restate the overlay's `dvh` and `dvw` lengths against the viewport,
 *   where it reads any, and whether the host clips what paints past it.
 * @returns The host element.
 */
export function viewportHost(
  viewport: Viewport,
  content: (host: RefObject<HTMLDivElement | null>) => ReactNode,
  options: ViewportHostOptions = {}
): ReactElement {
  return createElement(ViewportHost, {
    viewport,
    content,
    css: options.css,
    overflow: options.overflow ?? "visible",
  });
}
