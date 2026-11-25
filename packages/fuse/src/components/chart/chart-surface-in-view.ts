"use client";

/**
 * Whether a chart's plot surface is in view, after any clipping by its scrolling ancestors. The
 * tooltip reads it to keep a default item's popup shut while the plot is out of view. On each axis,
 * the visible extent must be at least half of the surface's extent or of the viewport's, whichever
 * is smaller. Width and height are checked separately, so a plot wider or taller than twice the
 * viewport still counts once half the viewport's extent on that axis shows it. A surface with no
 * box, as under `display: none`, is out of view.
 */
import { useEffect, useState } from "react";

import { flushSync } from "react-dom";

/** Every 1% of the surface's area, so the observer reports close to where either axis crosses half. */
const IN_VIEW_THRESHOLDS = Array.from({ length: 101 }, (_, step) => step / 100);

/**
 * The viewport an entry measures against. A cross-origin frame's observer gets no `rootBounds`,
 * and then the surface's own window is the viewport.
 *
 * @param entry - The observer's entry for the surface.
 * @returns The viewport's width and height.
 */
function viewportOf(entry: IntersectionObserverEntry) {
  if (entry.rootBounds !== null) return entry.rootBounds;
  const view = entry.target.ownerDocument.defaultView;
  return {
    width: view?.innerWidth ?? entry.boundingClientRect.width,
    height: view?.innerHeight ?? entry.boundingClientRect.height,
  };
}

/**
 * Whether an observer's entry shows the surface in view, by the rule this module's header states.
 *
 * @param entry - The observer's latest entry for the surface.
 * @returns Whether the surface is in view.
 */
function halfInView(entry: IntersectionObserverEntry): boolean {
  const { boundingClientRect: box, intersectionRect: seen } = entry;
  if (!entry.isIntersecting || box.width === 0 || box.height === 0) return false;
  const viewport = viewportOf(entry);
  return (
    seen.width >= Math.min(box.width, viewport.width) / 2 &&
    seen.height >= Math.min(box.height, viewport.height) / 2
  );
}

/**
 * Whether the chart's surface is in view. An `IntersectionObserver` watches the surface only while
 * `watching` holds. The surface mounts and unmounts with the chart's data, so a `MutationObserver`
 * on the Root's figure looks it up again within the figure after each change below it. The lookup,
 * the `MutationObserver` and the `IntersectionObserver` work while the figure is outside a
 * document, as when a Root renders into a container its host appends later, and the
 * `IntersectionObserver` reports the surface once it is attached. A new surface counts as out of
 * view until its first report. Watching starts out of view, and so the server render and the first
 * client render agree.
 *
 * @param id - The Root's id, whose surface element is `${id}-surface`.
 * @param figure - The Root's figure once it has mounted.
 * @param watching - Whether to watch.
 * @returns Whether the surface is in view, or false while not watching.
 */
export function useSurfaceInView(id: string, figure: () => HTMLElement | null, watching: boolean): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!watching) return undefined;
    const root = figure();
    if (root === null) return undefined;
    const selector = `#${CSS.escape(`${id}-surface`)}`;
    let observed: Element | null = null;
    const visibility = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1);
        if (last?.target === observed) setInView(halfInView(last));
      },
      { threshold: IN_VIEW_THRESHOLDS }
    );
    // The intersection report lands in a task after the frame that hid the surface, so that frame
    // would still paint the popup wherever Base UI moved it. A resize report runs before that paint,
    // and a surface that lost its box closes the popup in it.
    const sizes = new ResizeObserver((entries) => {
      const last = entries.at(-1);
      if (last?.target === observed && (last.contentRect.width === 0 || last.contentRect.height === 0))
        flushSync(() => {
          setInView(false);
        });
    });
    const mounts = new MutationObserver(() => {
      follow();
    });
    const follow = (): void => {
      const surface = root.querySelector(selector);
      if (surface === observed) return;
      if (observed !== null) {
        visibility.unobserve(observed);
        sizes.unobserve(observed);
      }
      observed = surface;
      setInView(false);
      if (surface === null) return;
      visibility.observe(surface);
      sizes.observe(surface);
    };
    mounts.observe(root, { childList: true, subtree: true });
    follow();
    return () => {
      mounts.disconnect();
      visibility.disconnect();
      sizes.disconnect();
      setInView(false);
    };
  }, [id, figure, watching]);
  return watching && inView;
}
