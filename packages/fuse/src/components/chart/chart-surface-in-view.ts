"use client";

/**
 * Whether a chart's plot surface is in view, after any clipping by its scrolling ancestors. The
 * tooltip reads it to keep a default item's popup shut while the plot is out of view. On each axis,
 * the plot must show at least half of the smaller of its own extent and the room that the viewport
 * and any clipping ancestor leave it. A plot wider or taller than twice the viewport therefore
 * counts once it fills half the viewport on that axis, and a plot in a scroll panel less than half
 * its height counts once it fills half the panel's height. A surface with no box, as under
 * `display: none`, is out of view. The answer is read on each observer report, and again within a
 * frame of a window resize, a clipping ancestor's resize, or a scroll of the document or of an
 * element that contains the surface.
 */
import { useEffect, useState } from "react";

import { flushSync } from "react-dom";

import { windowShowing } from "../../internal/dom-node";
import type { ClipRegion } from "./chart-clip-region";
import { clipRegion, flatContains } from "./chart-clip-region";

/** Every 1% of the surface's area, so the observer reports close to where either axis crosses its cutoff. */
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
 * @param clip - The part of the window that the surface's clipping ancestors leave visible, read with
 * the entry.
 * @returns Whether the surface is in view.
 */
function halfInView(entry: IntersectionObserverEntry, clip: ClipRegion): boolean {
  const { boundingClientRect: box, intersectionRect: seen } = entry;
  if (!entry.isIntersecting) return false;
  // The clip region lies within the surface's own window. A same-origin frame's `rootBounds` is the
  // top document's viewport, which can be smaller.
  const viewport = viewportOf(entry);
  const capWidth = Math.min(box.width, viewport.width, clip.x.end - clip.x.start);
  const capHeight = Math.min(box.height, viewport.height, clip.y.end - clip.y.start);
  return capWidth > 0 && capHeight > 0 && seen.width >= capWidth / 2 && seen.height >= capHeight / 2;
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
    // An observer may still deliver a report it queued before cleanup, as WebKit does. Cleanup sets
    // this and clears `observed`, and every callback checks one of them, so such a report cannot
    // listen or observe again.
    let disposed = false;
    const { ownerDocument } = root;
    const view = ownerDocument.defaultView ?? window;
    // The observer reports only as the surface's visible area crosses a threshold. A scroll or
    // resize can move the clip region without that, and a panel far smaller than the surface
    // crosses none. Observing the surface again makes the observer report it afresh, at most once
    // per frame.
    let frame = 0;
    const refresh = (): void => {
      if (disposed || frame !== 0) return;
      // Animation frames come from the window that still shows the figure's document. An iframe's
      // window shows another document once the iframe navigates.
      frame =
        windowShowing(ownerDocument)?.requestAnimationFrame(() => {
          frame = 0;
          if (observed === null) return;
          visibility.unobserve(observed);
          visibility.observe(observed);
        }) ?? 0;
    };
    // A scroll moves the surface only when it scrolls the document or an element that contains it.
    const scrolled = (event: Event): void => {
      if (observed === null) return;
      const target = event.target;
      if (target === ownerDocument || (target instanceof view.Element && flatContains(target, observed)))
        refresh();
    };
    // A scroll event in a shadow root never reaches the window, so each clipping ancestor gets its
    // own listener. Its padding box is what clips, and a padding change alters its content box or
    // its border box, so each box gets an observer.
    const clippers = new Set<HTMLElement>();
    const clipContentBoxes = new ResizeObserver(refresh);
    const clipBorderBoxes = new ResizeObserver(refresh);
    const watchClippers = (next: readonly HTMLElement[]): void => {
      for (const clipper of clippers) {
        if (next.includes(clipper)) continue;
        clippers.delete(clipper);
        clipContentBoxes.unobserve(clipper);
        clipBorderBoxes.unobserve(clipper);
        clipper.removeEventListener("scroll", refresh);
      }
      for (const clipper of next) {
        if (clippers.has(clipper)) continue;
        clippers.add(clipper);
        clipContentBoxes.observe(clipper);
        clipBorderBoxes.observe(clipper, { box: "border-box" });
        clipper.addEventListener("scroll", refresh, { passive: true });
      }
    };
    const visibility = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1);
        if (last?.target !== observed) return;
        const clip = clipRegion(last.target);
        watchClippers(clip.clippers);
        setInView(halfInView(last, clip));
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
      if (disposed) return;
      const surface = root.querySelector(selector);
      if (surface === observed) return;
      if (observed !== null) {
        visibility.unobserve(observed);
        sizes.unobserve(observed);
      }
      observed = surface;
      watchClippers([]);
      setInView(false);
      if (surface === null) return;
      visibility.observe(surface);
      sizes.observe(surface);
    };
    mounts.observe(root, { childList: true, subtree: true });
    // Any call on an iframe's window throws once it shows a cross-origin document. Aborting the
    // signal removes these listeners without a call on the window.
    const listening = new AbortController();
    const { signal } = listening;
    view.addEventListener("scroll", scrolled, { capture: true, passive: true, signal });
    view.addEventListener("resize", refresh, { passive: true, signal });
    follow();
    return () => {
      disposed = true;
      observed = null;
      mounts.disconnect();
      visibility.disconnect();
      sizes.disconnect();
      watchClippers([]);
      clipContentBoxes.disconnect();
      clipBorderBoxes.disconnect();
      listening.abort();
      windowShowing(ownerDocument)?.cancelAnimationFrame(frame);
      setInView(false);
    };
  }, [id, figure, watching]);
  return watching && inView;
}
