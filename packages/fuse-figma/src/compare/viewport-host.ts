/**
 * The host the compare page draws around a fixed root its definition places in a viewport, as a
 * Dialog's popup and its scrim sit in the browser window: a box as large as the declared viewport whose
 * `contain: layout` makes it the containing block of every fixed box inside it (CSS Containment 2
 * §3.2), so `fixed inset-0`, `top-1/2` and percentages resolve against it as they do against the
 * window. The overlay portals into it through the ref its content receives. Media queries still read
 * the page's window, 2400px wide, as the kit draws the desktop arm, and so do `dvh` and `dvw`, so a set
 * whose fixed root reads those needs more than this host.
 *
 * It imports only React, so the compare page's client bundle can take it.
 */

import { createElement, useRef } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

/** A viewport a definition declares, in pixels. */
export type HostViewport = { readonly width: number; readonly height: number };

/** The host's props: the viewport, and the content, given the ref of the host it portals into. */
type ViewportHostProps = {
  readonly viewport: HostViewport;
  readonly content: (host: RefObject<HTMLDivElement | null>) => ReactNode;
};

function ViewportHost({ viewport, content }: ViewportHostProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  return createElement(
    "div",
    {
      ref: host,
      "data-compare-viewport": "",
      style: { position: "relative", width: viewport.width, height: viewport.height, contain: "layout" },
    },
    content(host)
  );
}

/**
 * The host around an overlay the content renders, as large as the viewport.
 *
 * @param viewport - The viewport the definition declares.
 * @param content - The overlay, given the host's ref as its portal container.
 * @returns The host element.
 */
export function viewportHost(
  viewport: HostViewport,
  content: (host: RefObject<HTMLDivElement | null>) => ReactNode
): ReactElement {
  return createElement(ViewportHost, { viewport, content });
}
