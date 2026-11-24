/**
 * The fixtures the late `defaultActive*` suites share: a parent that focuses the plot in the commit
 * that brings its rows, a parent that brings the rows in a transition whose stylesheet the test
 * holds, and a probe that prints the active point.
 */
import { startTransition, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useChartPoint } from "../../src/components/chart/use-chart-point";

/**
 * Focuses the plot's option from a layout effect in the commit that sets `loaded`. The chart Root
 * is its child, so the effect runs after the Root's own.
 */
export function FocusOnLoad({
  loaded,
  children,
}: {
  readonly loaded: boolean;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (loaded) ref.current?.querySelector<HTMLElement>('[role="option"]')?.focus();
  }, [loaded]);
  return <div ref={ref}>{children}</div>;
}

/**
 * Prints the active point's x, as a consumer's headline would read it. On a radar the x is the
 * spoke's name.
 */
export function PointProbe() {
  const point = useChartPoint();
  return <output data-point="">{point === null ? "none" : String(point.x)}</output>;
}

/**
 * Renders `children(false)`, then, once the test calls the function `bind` hands it,
 * `children(true)` in a transition that also loads the stylesheet at `href`. React renders the
 * rows and waits for the stylesheet before it commits them, so a test that holds the request to
 * `href` keeps the first rows on screen while React holds the next ones.
 */
export function LoadInTransition({
  href,
  bind,
  children,
}: {
  readonly href: string;
  readonly bind: (load: () => void) => void;
  readonly children: (loaded: boolean) => ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  bind(() => startTransition(() => setLoaded(true)));
  return (
    <>
      {children(loaded)}
      {loaded ? <link rel="stylesheet" href={href} precedence="late" /> : null}
    </>
  );
}

/**
 * Whether React has rendered the transition up to its stylesheet, past the chart before it.
 * React preloads the stylesheet as it renders the element, then holds the commit until it loads.
 *
 * @param href - The stylesheet's absolute URL.
 * @returns Whether React preloads it.
 */
export function preloadsSheet(href: string): boolean {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="style"]')].some(
    (link) => link.href === href
  );
}
