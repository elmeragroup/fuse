"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { isNode } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import {
  CarouselContext,
  CarouselSnapshotContext,
  useCarouselContext,
  useCarouselSnapshot,
} from "./carousel-context";
import type {
  CarouselActions,
  CarouselContextValue,
  CarouselControlReason,
  CarouselIndexChangeDetails,
  CarouselIndexChangeReason,
  CarouselMeta,
  CarouselState,
  CarouselWiring,
} from "./carousel-context";
import { createCarouselEngine } from "./carousel-engine";
import type { CarouselEngine, CarouselOrientation, CarouselSnapshot } from "./carousel-engine";
import { clampIndex } from "./carousel-pages";
import { useCarouselRotation } from "./carousel-rotation";
import { carouselVariants } from "./carousel-variants";
import { carouselStrings } from "./intl";

/**
 * A carousel's accessible name. The Root is a region landmark, which needs one; the role
 * description already says "carousel", so the name should not.
 */
export type CarouselName =
  | {
      /** The visible heading's id, the name APG prefers when the carousel has a heading. */
      "aria-labelledby": string;
      "aria-label"?: string;
    }
  | {
      "aria-labelledby"?: string;
      /** The name, when the carousel has no visible heading. */
      "aria-label": string;
    };

/** `Carousel.Root` takes a `div`'s props, Base UI's `render`, a required name and the page props. */
export type CarouselRootProps = Omit<
  useRender.ComponentProps<"div">,
  "aria-label" | "aria-labelledby" | "defaultValue"
> &
  CarouselName & {
    /** The current page, from 0, when the parent owns it. Pair it with `onIndexChange`. */
    index?: number;
    /** The page shown first when the Root owns the page. Defaults to `0`. */
    defaultIndex?: number;
    /**
     * Receives every page change and its reason. A controlled Root that does not take the new
     * `index` scrolls back to its own once the user's scroll ends.
     */
    onIndexChange?: (index: number, details: CarouselIndexChangeDetails) => void;
    /** The axis the viewport scrolls on. A vertical carousel needs a height. Defaults to `"horizontal"`. */
    orientation?: CarouselOrientation;
  };

/** `Carousel.Viewport` takes a `div`'s props plus Base UI's `render`. */
export type CarouselViewportProps = useRender.ComponentProps<"div">;

/** `Carousel.Slide` takes a `div`'s props plus Base UI's `render`. */
export type CarouselSlideProps = useRender.ComponentProps<"div">;

const styles = carouselVariants();
const verticalStyles = carouselVariants({ orientation: "vertical" });

/**
 * The provider every Carousel part reads, and the carousel container APG describes: a `region`
 * landmark with the localized role description "carousel" and the name the types require. It owns
 * the page, as `index` or `defaultIndex`, and the engine that measures `Carousel.Viewport`, so the
 * parts and `useCarousel()` read one state.
 *
 * The pages are the viewport's snap positions, measured after mount, so the server renders no
 * indicators and the page shown first moves into place before the first client paint. The slide
 * numbers, the pages and the slides in view come from one measurement of the document, retaken
 * after every change that can move a slide, a reorder included. While the viewport has no layout
 * box, as under `display: none`, the Root keeps its page and measures again once it shows.
 * Features exist by mounting their part: controls, indicators, a status and automatic rotation
 * each come from their own part, never a boolean prop. The pages do not loop.
 */
export function CarouselRoot({
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  orientation = "horizontal",
  className,
  render,
  ref,
  children,
  ...props
}: CarouselRootProps): ReactElement {
  const strings = useLocalizedStrings(carouselStrings);
  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const engine = useRef<CarouselEngine | null>(null);
  // The mounted Slides. The engine reads their order from the document whenever it measures.
  const members = useRef(new Set<HTMLElement>());
  const [snapshot, setSnapshot] = useState<CarouselSnapshot | null>(null);
  // Bumped when a scroll ends, so a controlled Root whose parent kept the old `index` scrolls back.
  const [settled, setSettled] = useState(0);

  const pageCount = snapshot?.pages.positions.length ?? 0;
  const controlled = indexProp !== undefined;
  const index = clampIndex(indexProp ?? uncontrolledIndex, pageCount);

  // The stable callbacks read the latest props and state from here. A layout effect publishes
  // them, so a render React discards never changes what an event sees.
  const latest = useRef({ index, pageCount, controlled, onIndexChange });
  useLayoutEffect(() => {
    latest.current = { index, pageCount, controlled, onIndexChange };
  });

  // Clamped against the page count the caller just measured, which the Root's own state only takes
  // on its next render.
  const change = useCallback((requested: number, reason: CarouselIndexChangeReason, pageCount: number) => {
    const current = latest.current;
    const next = clampIndex(requested, pageCount);
    if (next === current.index) {
      return;
    }
    current.onIndexChange?.(next, { reason });
    if (!current.controlled) {
      setUncontrolledIndex(next);
    }
  }, []);

  // Every navigation measures first, through the engine's one reconciliation, so it resolves its
  // destination against the layout as it is, not as it last reported, which an inherited change
  // can leave behind unreported.
  const resolve = useCallback(
    (requested: number, reason: CarouselIndexChangeReason) =>
      change(requested, reason, engine.current?.refresh() ?? latest.current.pageCount),
    [change]
  );

  const advance = useCallback((next: number) => resolve(next, "autoplay"), [resolve]);
  const rotation = useCarouselRotation(index, pageCount, advance);
  const { stop, play } = rotation;

  // A control press is the user's, so it stops rotation, even when the page stays.
  const navigate = useCallback(
    (requested: number, reason: CarouselControlReason) => {
      stop();
      resolve(requested, reason);
    },
    [resolve, stop]
  );

  // One engine per viewport element and orientation. Where the viewport is says which page is
  // selected; the user acting on it is what stops rotation, whether or not the page changes.
  useLayoutEffect(() => {
    if (viewport === null) {
      return;
    }
    const created = createCarouselEngine(viewport, orientation, members.current, {
      onSnapshot: setSnapshot,
      onPage: (page, pages) => change(page, "scroll", pages),
      onInteract: stop,
      onSettle: () => setSettled((count) => count + 1),
    });
    engine.current = created;
    return () => {
      created.destroy();
      engine.current = null;
    };
  }, [viewport, orientation, change, stop]);

  // The one reconciliation per commit, after the Slides' own effects have updated the members: the
  // engine measures if anything moved, applies this commit's page, then publishes.
  useLayoutEffect(() => {
    engine.current?.commit({ index, settled });
  });

  // A Slide only joins or leaves the members. The commit's reconciliation, or the engine's own once
  // this task ends for a Slide that mounts without the Root rendering, measures them all at once.
  const registerSlide = useCallback((element: HTMLElement) => {
    members.current.add(element);
    engine.current?.reconcileLater();
    return () => {
      members.current.delete(element);
      engine.current?.reconcileLater();
    };
  }, []);

  const state = useMemo<CarouselState>(
    () => ({
      index,
      pageCount,
      canPrevious: index > 0,
      canNext: pageCount === 0 || index < pageCount - 1,
      rotating: rotation.rotating,
    }),
    [index, pageCount, rotation.rotating]
  );
  const actions = useMemo<CarouselActions>(
    () => ({
      goTo: (next) => navigate(next, "action"),
      previous: () => navigate(latest.current.index - 1, "action"),
      next: () => navigate(latest.current.index + 1, "action"),
      play,
      stop,
    }),
    [navigate, play, stop]
  );
  const meta = useMemo<CarouselMeta>(() => ({ orientation }), [orientation]);
  const live = rotation.running ? "off" : "polite";
  const wiring = useMemo<CarouselWiring>(
    () => ({
      setViewport,
      registerSlide,
      navigate,
      mountAutoplay: rotation.mount,
      setAutoplayDelay: rotation.setDelay,
      live,
    }),
    [registerSlide, navigate, rotation.mount, rotation.setDelay, live]
  );
  const context = useMemo<CarouselContextValue>(
    () => ({ state, actions, meta, wiring }),
    [state, actions, meta, wiring]
  );

  const rootRef = useMergedRefs<HTMLElement>(ref, rotation.root);
  const rendered = useRender({
    defaultTagName: "div",
    render,
    ref: rootRef,
    props: {
      "data-slot": "carousel",
      "data-orientation": orientation,
      ...mergeProps<"div">(
        {
          role: "region",
          "aria-roledescription": strings.format("carousel"),
          className: cn(styles.root(), className),
          children,
          ...rotation.rootHandlers,
        },
        definedProps(props)
      ),
    },
  });

  return (
    <CarouselContext value={context}>
      <CarouselSnapshotContext value={snapshot}>{rendered}</CarouselSnapshotContext>
    </CarouselContext>
  );
}

/**
 * The scroll-snap container that holds the slides. The browser scrolls it natively: a swipe, a
 * wheel, a trackpad and, once it has focus, the arrow keys, which the carousel never takes from a
 * field inside a slide. It is in the tab order for that keyboard scroll. It is the slides' live
 * region, `aria-live="polite"` while the pages do not rotate and `"off"` while they do.
 *
 * Space the slides with a margin on each slide, such as `me-4 last:me-0`. A vertical carousel
 * needs a height.
 */
export function CarouselViewport({ className, render, ref, ...props }: CarouselViewportProps): ReactElement {
  const { meta, wiring } = useCarouselContext("Carousel.Viewport");
  const mergedRef = useMergedRefs<HTMLElement>(ref, wiring.setViewport);
  return useRender({
    defaultTagName: "div",
    render,
    ref: mergedRef,
    props: {
      "data-slot": "carousel-viewport",
      ...mergeProps<"div">(
        {
          tabIndex: 0,
          "aria-live": wiring.live,
          "aria-atomic": false,
          className: cn((meta.orientation === "vertical" ? verticalStyles : styles).viewport(), className),
        },
        definedProps(props)
      ),
    },
  });
}

/**
 * One slide: a `group` with the localized role description "slide". Without a name of its own it
 * is named by its place, such as "3 of 6", which APG suggests when slides have no titles. Name it
 * with `aria-labelledby` when it has a visible title.
 *
 * A slide fully outside the viewport is `inert`, so Tab and a screen reader's reading order skip
 * what the user cannot see, as APG asks, and a slide in view or peeking in stays reachable. A
 * slide that holds focus stays reachable too. In-page search does not find text in an inert slide.
 * Size it with a class such as `basis-1/2`; it fills the viewport by default.
 */
export function CarouselSlide({ className, render, ref, ...props }: CarouselSlideProps): ReactElement {
  const { wiring } = useCarouselContext("Carousel.Slide");
  const strings = useLocalizedStrings(carouselStrings);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const { registerSlide } = wiring;
  const snapshot = useCarouselSnapshot();
  // The slide joins the members as its element attaches, in the commit that mounts it and before
  // any layout effect, so the Root's reconciliation in that commit already counts it.
  const slideRef = useCallback(
    (attached: HTMLElement | null) => {
      setElement(attached);
      if (attached === null) {
        return;
      }
      const leave = registerSlide(attached);
      return () => {
        leave();
        setElement(null);
      };
    },
    [registerSlide]
  );
  const mergedRef = useMergedRefs<HTMLElement>(ref, slideRef);

  // The number, the count and whether the slide is in view all come from one measurement.
  const position = (element === null ? undefined : snapshot?.numbers.get(element)) ?? -1;
  const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  const label =
    snapshot === null || position < 0 || named
      ? undefined
      : strings.format("slideLabel", { position: position + 1, count: snapshot.slides.length });
  const outOfView =
    snapshot !== null && element !== null && position >= 0 && !snapshot.visible.has(element) && !focusWithin;

  return useRender({
    defaultTagName: "div",
    render,
    ref: mergedRef,
    props: {
      "data-slot": "carousel-slide",
      // The consumer's own focus handlers merge after these and run first.
      ...mergeProps<"div">(
        {
          role: "group",
          "aria-roledescription": strings.format("slide"),
          ...definedProps({ "aria-label": label, inert: outOfView || undefined }),
          className: cn(styles.slide(), className),
          onFocus: () => setFocusWithin(true),
          onBlur: (event: FocusEvent<HTMLDivElement>) => {
            const next = event.relatedTarget;
            if (!isNode(next) || !event.currentTarget.contains(next)) {
              setFocusWithin(false);
            }
          },
        },
        definedProps(props)
      ),
    },
  });
}

CarouselRoot.displayName = "Carousel.Root";
CarouselViewport.displayName = "Carousel.Viewport";
CarouselSlide.displayName = "Carousel.Slide";
