"use client";

import { createContext, use, useMemo } from "react";

import type { CarouselOrientation, CarouselSnapshot } from "./carousel-engine";

/** Why the page changed, as `onIndexChange` reports it. */
export type CarouselIndexChangeReason =
  /** A swipe, wheel turn, keyboard scroll or focus scroll of the viewport. */
  | "scroll"
  /** `Carousel.Previous`. */
  | "previous"
  /** `Carousel.Next`. */
  | "next"
  /** A `Carousel.Indicator`. */
  | "indicator"
  /** Rotation under `Carousel.Autoplay`. */
  | "autoplay"
  /** `useCarousel().actions`, from a custom control. */
  | "action";

/** The reasons a press or an action gives: neither the viewport's scroll nor rotation. */
export type CarouselControlReason = Exclude<CarouselIndexChangeReason, "scroll" | "autoplay">;

/** What `onIndexChange` receives beside the new page. */
export type CarouselIndexChangeDetails = {
  /** What changed the page. */
  readonly reason: CarouselIndexChangeReason;
};

/** What a carousel shows. */
export type CarouselState = {
  /** The current page, from 0. */
  readonly index: number;
  /**
   * How many pages the viewport scrolls through: one per distinct snap position, so six slides
   * showing three at a time make four pages. It is 0 until the viewport is measured after mount.
   */
  readonly pageCount: number;
  /** A page before the current one exists. */
  readonly canPrevious: boolean;
  /**
   * A page after the current one exists. Before the first measurement it is `true`, so a
   * server-rendered Next does not paint disabled and then enable.
   */
  readonly canNext: boolean;
  /**
   * A mounted `Carousel.Autoplay` rotates the pages, unless the user or reduced motion stopped
   * it. Keyboard focus inside the carousel stops it. Rotation still pauses while the pointer is
   * over the carousel or the document is hidden.
   */
  readonly rotating: boolean;
};

/** What a part or a custom control can do. */
export type CarouselActions = {
  /** Scroll to a page. A page past either end scrolls to that end. It stops rotation. */
  readonly goTo: (index: number) => void;
  /** Scroll to the previous page. It stops rotation. */
  readonly previous: () => void;
  /** Scroll to the next page. It stops rotation. */
  readonly next: () => void;
  /** Start rotation under a mounted `Carousel.Autoplay`. */
  readonly play: () => void;
  /** Stop rotation until `play` starts it again. */
  readonly stop: () => void;
};

/** The carousel's configuration, for a custom part. */
export type CarouselMeta = {
  /** The axis the viewport scrolls on. */
  readonly orientation: CarouselOrientation;
};

/** The wiring the parts share. Private to the parts. */
export type CarouselWiring = {
  /** The Viewport's ref, which the Root's engine measures and scrolls. */
  readonly setViewport: (element: HTMLElement | null) => void;
  /** Track a mounted Slide. The returned function stops tracking it. */
  readonly registerSlide: (element: HTMLElement) => () => void;
  /** Change the page for a control's reason. A control press stops rotation. */
  readonly navigate: (index: number, reason: CarouselControlReason) => void;
  /** Mount `Carousel.Autoplay`. The returned function unmounts it. */
  readonly mountAutoplay: () => () => void;
  /** Set the rotation's delay, in ms, keeping the user's choice to play or stop. */
  readonly setAutoplayDelay: (delay: number) => void;
  /** `off` while the pages rotate, so a screen reader is not interrupted; `polite` otherwise. */
  readonly live: "off" | "polite";
};

/** The Root's context: what it shows, what it does, and the wiring the parts read. */
export type CarouselContextValue = {
  readonly state: CarouselState;
  readonly actions: CarouselActions;
  readonly meta: CarouselMeta;
  readonly wiring: CarouselWiring;
};

/** The Root's context. `Carousel.Root` provides it. */
export const CarouselContext = createContext<CarouselContextValue | null>(null);

/**
 * The Root's last measurement: the slides in document order, their numbers, the pages and the
 * slides in view. Every slide number, indicator name and inert slide reads it, so they always agree.
 * `null` before the first measurement. Private to the parts.
 *
 * It is a context of its own, apart from {@link CarouselContext}, because it changes on every
 * change to the slides in view, about twice per slide a scroll passes, while `state`, `actions`,
 * `meta` and the wiring keep their identity. Only the parts that read it, Slide and Indicator,
 * re-render then, not every part and every `useCarousel()` caller.
 */
export const CarouselSnapshotContext = createContext<CarouselSnapshot | null>(null);

/**
 * The enclosing Root's last measurement, for a part that reads slide numbers or the slides in view.
 *
 * @returns The snapshot, or `null` before the first measurement or outside a Root.
 */
export function useCarouselSnapshot(): CarouselSnapshot | null {
  return use(CarouselSnapshotContext);
}

/**
 * The enclosing Root's context, for a part.
 *
 * @param part - The part's name, such as `Carousel.Next`, for the error message.
 * @returns The context value.
 * @throws When no `Carousel.Root` encloses the caller, which is a defect in the tree.
 */
export function useCarouselContext(part: string): CarouselContextValue {
  const context = use(CarouselContext);
  if (context === null) {
    throw new Error(`${part} must be used within Carousel.Root.`);
  }
  return context;
}

/**
 * The enclosing `Carousel.Root`'s state, actions and configuration, for a custom control such as
 * a thumbnail strip or a page count of your own. `state` has `index`, `pageCount`, `canPrevious`,
 * `canNext` and `rotating`. `actions` has `goTo`, `previous`, `next`, `play` and `stop`. `meta`
 * has `orientation`. The result keeps its identity until one of them changes.
 *
 * @returns The current page, the page count, whether each direction can move and whether the
 *   pages rotate; the actions that change them; and the orientation.
 * @throws When no `Carousel.Root` encloses the caller.
 */
export function useCarousel(): {
  readonly state: CarouselState;
  readonly actions: CarouselActions;
  readonly meta: CarouselMeta;
} {
  const { state, actions, meta } = useCarouselContext("useCarousel");
  return useMemo(() => ({ state, actions, meta }), [state, actions, meta]);
}
