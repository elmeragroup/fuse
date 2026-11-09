/**
 * Unit under test: how the Carousel engine measures its layout, and reads where a scroll ended,
 * while an ancestor's transform moves between the reads of one measurement, in Chromium, Firefox
 * and WebKit. The `Resampled` fixture stands in for WebKit, which samples a running transform
 * afresh at each layout read: it moves its ancestor's scale as each slide's box is read. Oracle:
 * the hand-sized slides, 200px each in a 200px viewport unless a case sizes them otherwise, at 0,
 * 200, 400 and 600px, and at 0, 400, 800 and 1200px once an ancestor's 200px gap trails each one.
 */
import { useCallback, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, wait } from "../../../test/animation-frames";
import {
  carouselIndicators,
  carouselViewport,
  currentIndicator,
  settledOn,
} from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { CarouselIndexChangeReason } from "./carousel-context";
import { Carousel } from "./index";

/** The slide length on the scroll axis. */
const LENGTH = 200;

/**
 * Slides under an ancestor at half scale, whose scale moves to `nextScale()` as each slide's box is
 * read, until it returns `undefined`. It stands in for WebKit, which samples a running transform
 * animation afresh at each layout read, so a loaded runner that reads slowly finds the viewport's
 * box at one scale and the slides' at others. An ancestor's `--resampled-gap` gives every slide a
 * trailing gap, which nothing in the carousel observes. By default four slides a 200px viewport
 * wide; the layout props set up others.
 */
function Resampled({
  nextScale,
  defaultIndex = 0,
  index,
  onIndexChange,
  width = LENGTH,
  count = 4,
  viewportStyle,
  wrapperStyle,
  slideStyle,
  bodyStyle,
}: {
  readonly nextScale: () => number | undefined;
  readonly defaultIndex?: number;
  /** When set, the Root is controlled at this page. */
  readonly index?: number;
  readonly onIndexChange: (index: number, details: { readonly reason: CarouselIndexChangeReason }) => void;
  readonly width?: number;
  readonly count?: number;
  readonly viewportStyle?: CSSProperties;
  /** When set, the slides sit in one wrapper inside the viewport, styled so. */
  readonly wrapperStyle?: CSSProperties;
  readonly slideStyle?: CSSProperties;
  readonly bodyStyle?: CSSProperties;
}): ReactElement {
  const ancestor = useRef<HTMLDivElement>(null);
  const resample = useCallback(
    (slide: HTMLElement | null) => {
      if (slide === null) {
        return;
      }
      const read = slide.getClientRects.bind(slide);
      slide.getClientRects = () => {
        const scale = nextScale();
        if (scale !== undefined && ancestor.current !== null) {
          ancestor.current.style.transform = `scale(${scale})`;
        }
        return read();
      };
    },
    [nextScale]
  );
  const slides = Array.from({ length: count }, (_, index) => (
    <Carousel.Slide key={index} ref={resample} className="resampled-slide" style={slideStyle}>
      <span style={{ display: "block", height: LENGTH, ...bodyStyle }}>Slide body {index + 1}</span>
    </Carousel.Slide>
  ));
  return withLocale(
    "en-US",
    <div
      ref={ancestor}
      aria-label="Ancestor"
      role="group"
      style={{ transform: "scale(0.5)", transformOrigin: "0 0" }}>
      <style>{".resampled-slide { margin-inline-end: var(--resampled-gap, 0px); }"}</style>
      <Carousel.Root
        aria-label="Offers"
        style={{ width }}
        defaultIndex={defaultIndex}
        index={index}
        onIndexChange={onIndexChange}>
        <Carousel.Viewport style={viewportStyle}>
          {wrapperStyle === undefined ? slides : <div style={wrapperStyle}>{slides}</div>}
        </Carousel.Viewport>
        <Carousel.Controls>
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
      </Carousel.Root>
    </div>
  );
}

/**
 * A scale that moves up a hundredth at each of the first `reads` slide reads from half, as a
 * popup's opening transition would between reads, and then rests where it got to. While it moves
 * the viewport's box never reads the same twice around the slides'.
 */
function movingFor(reads: number): () => number | undefined {
  let read = 0;
  return () => (read < reads ? 0.5 + ++read / 100 : undefined);
}

/** Whether each slide, by its accessible name `n of count`, is hidden from assistive technology. */
function inertSlides(count: number): boolean[] {
  return Array.from({ length: count }, (_, index) =>
    roleNamed("group", `${index + 1} of ${count}`).hasAttribute("inert")
  );
}

describe("Carousel measured while an ancestor's scale moves between its box reads", () => {
  it("waits for a steady reading, then places its default page", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    // The first measurement reads every slide at a hundredth scale after the viewport at half, and
    // the next reads the first slide back at half after the viewport at a hundredth: neither is one
    // picture, and only the third, a frame or two on, reads every box at half.
    const scales = [0.01, 0.01, 0.01, 0.01, 0.5];
    renderThemed(
      <Resampled
        nextScale={() => scales.shift()}
        defaultIndex={2}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, 2 * LENGTH);
    await pollFrames(currentIndicator, 2);
    expect(carouselIndicators()).toHaveLength(4);
    await pollFrames(() => inertSlides(4), [true, true, false, true]);

    await userEvent.click(roleNamed("button", "Next slide"));
    await settledOn(viewport, 3 * LENGTH);
    await pollFrames(currentIndicator, 3);
    expect(changes).toEqual([[3, "next"]]);
  });

  it("gets pages while the scale never rests, and measures afresh once it does", async () => {
    let reads = 0;
    let moving = true;
    // From half scale up to 0.9 and back, one step per slide read, until the test stops it.
    const nextScale = () => (moving ? 0.5 + (reads++ % 5) / 10 : undefined);
    renderThemed(<Resampled nextScale={nextScale} defaultIndex={2} onIndexChange={() => undefined} />);
    // Past its bound the engine accepts a reading it cannot prove steady, so it does not stall,
    // though a reading that mixes scales may place its page wrong.
    await pollFrames(() => carouselIndicators().length > 0, true);

    // Once the scale rests, the next change to the viewport's subtree measures again. A scroll the
    // best-effort placement started, which the browser may have snapped elsewhere, then ends on
    // the page it shows, and a control scrolls by the steady reading.
    moving = false;
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    viewport.classList.add("resting");
    await pollFrames(() => carouselIndicators().length, 4);
    await pollFrames(() => currentIndicator() * LENGTH === Math.round(viewport.scrollLeft), true);
    // Pressed through the DOM: where the best-effort placement already put page 3, its indicator
    // is the current one, which a pointer waits on as disabled, and pressing it keeps the page.
    roleNamed("button", "Slide 3 of 4").click();
    await settledOn(viewport, 2 * LENGTH);
    await pollFrames(currentIndicator, 2);
    await pollFrames(() => inertSlides(4), [true, true, false, true]);
  });

  it("reads where a re-snap ended from the moved slides, reporting no page in between", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const scales: number[] = [];
    renderThemed(
      <Resampled
        nextScale={() => scales.shift()}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.click(roleNamed("button", "Next slide"));
    await settledOn(viewport, LENGTH);
    await wait(400);
    expect(changes).toEqual([[1, "next"]]);

    // A 200px gap moves slide 2 to 400px, and the browser re-snaps to it there. The measurement
    // at that scroll's end reads the first slide's box at another scale than the viewport's.
    scales.push(0.6);
    roleNamed("group", "Ancestor").style.setProperty("--resampled-gap", `${LENGTH}px`);
    await settledOn(viewport, 2 * LENGTH);
    await wait(400);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(currentIndicator()).toBe(1);
    expect(changes).toEqual([[1, "next"]]);
  });
});

/** A scale for `Resampled` that moves while started. */
type Sway = {
  readonly next: () => number | undefined;
  readonly start: () => void;
  readonly stop: () => void;
};

/**
 * A scale that, once started, moves up a hundredth at each slide read, from half to 0.69 and round
 * again, and rests where it got to once stopped. A measurement of four slides moves it four steps
 * of twenty, so it never reads the viewport's box the same before and after the slides'.
 */
function swaying(): Sway {
  let moving = false;
  let read = 0;
  return {
    next: () => (moving ? 0.5 + (++read % 20) / 100 : undefined),
    start: () => {
      moving = true;
    },
    stop: () => {
      moving = false;
    },
  };
}

/**
 * A scale that, once started, sways as `swaying` does through every slide read of one measurement
 * and holds still through every read of the next, by turns, starting with a swaying one. The
 * engine reads all of a measurement's slides in one go, so the reads before the next microtask are
 * one measurement's.
 */
function alternating(): Sway {
  const sway = swaying();
  let moving = false;
  let swayNext = true;
  // Whether the measurement under way sways, or `null` between measurements.
  let swaysNow: boolean | null = null;
  return {
    next: () => {
      if (!moving) {
        return undefined;
      }
      if (swaysNow === null) {
        swaysNow = swayNext;
        swayNext = !swayNext;
        queueMicrotask(() => {
          swaysNow = null;
        });
      }
      return swaysNow ? sway.next() : undefined;
    },
    start: () => {
      moving = true;
      sway.start();
    },
    stop: () => {
      moving = false;
    },
  };
}

/** A finger held on the viewport. */
type HeldFinger = { readonly lift: () => void };

/** A finger down on the viewport, held until `lift` is called. */
function touchDown(viewport: HTMLElement): HeldFinger {
  const touch = (type: string) =>
    new PointerEvent(type, { pointerId: 1, pointerType: "touch", bubbles: true, composed: true });
  viewport.dispatchEvent(touch("pointerdown"));
  return { lift: () => document.dispatchEvent(touch("pointerup")) };
}

/** The carousel's frames and quiet spells, held so that only the test runs them. */
type Held = {
  /** Wait one frame of the test's own, in which a scroll's events arrive. */
  readonly frame: () => Promise<void>;
  /** Run the quiet spell under way, if any, at once. */
  readonly spell: () => void;
  /** Run the held frames and give the carousel its timers back. */
  readonly release: () => void;
};

/**
 * Hold every animation frame and timer the carousel asks for, so no next-frame retry measures and
 * an owed scroll end is read only when the test runs its quiet spell. Released however the test
 * ends, so a failure cannot hold a later test's frames or clock.
 */
function holdFrames(): Held {
  const queued: FrameRequestCallback[] = [];
  const request = window.requestAnimationFrame.bind(window);
  let ownFrame = false;
  const frames = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    if (ownFrame) {
      return request(callback);
    }
    queued.push(callback);
    return -queued.length;
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
    frames.mockRestore();
  });
  return {
    frame: async () => {
      ownFrame = true;
      const next = nextFrames(1);
      ownFrame = false;
      await next;
    },
    spell: () => {
      vi.advanceTimersToNextTimer();
    },
    release: () => {
      vi.useRealTimers();
      frames.mockRestore();
      for (const callback of queued.splice(0)) {
        callback(performance.now());
      }
    },
  };
}

/**
 * Input and navigation while every reading of the boxes is unsteady, which a measurement treats as
 * finding no usable layout. Oracle: the hand-sized slides, 200px each, and with the 200px gap at
 * 0, 400, 800 and 1200px.
 */
describe("Carousel used while its readings are unsteady", () => {
  it("reports a held scroll's page from the moved slides, never from the layout before them", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = swaying();
    renderThemed(
      <Resampled nextScale={sway.next} onIndexChange={(index, { reason }) => changes.push([index, reason])} />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    // Nothing reports the gap, so the last measurement still has the slides at 0, 200, 400 and
    // 600px, where 400px is page 3's.
    roleNamed("group", "Ancestor").style.setProperty("--resampled-gap", `${LENGTH}px`);
    const finger = touchDown(viewport);
    sway.start();
    viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
    await nextFrames(4);
    sway.stop();
    await wait(300);
    finger.lift();
    await pollFrames(currentIndicator, 1);
    await wait(300);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(changes).toEqual([[1, "scroll"]]);
  });

  it("settles a scroll that ended unsteady only once new held input is released", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = swaying();
    renderThemed(
      <Resampled
        nextScale={sway.next}
        index={0}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollBehavior: "auto" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    // A script's scroll to page 2, which ends while no reading holds still.
    sway.start();
    viewport.scrollTo({ left: LENGTH, behavior: "instant" });
    await wait(200);
    const finger = touchDown(viewport);
    const held = { left: Math.round(viewport.scrollLeft), changes: [...changes] };
    sway.stop();
    await wait(400);
    // Under the finger nothing settles: no page is reported and the controlled Root scrolls nowhere.
    expect({ left: Math.round(viewport.scrollLeft), changes }).toEqual(held);

    // Released, the scroll's end reports page 2, and the parent's index 0 brings page 1 back.
    finger.lift();
    await settledOn(viewport, 0);
    await wait(300);
    expect(changes).toEqual([[1, "scroll"]]);
    expect(currentIndicator()).toBe(0);
  });

  it("settles a scroll that ends while the readings never hold still", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = swaying();
    renderThemed(
      <Resampled
        nextScale={sway.next}
        index={0}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollBehavior: "auto" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    // A held scroll to page 2 reports no page while no reading holds still. Released, its end is
    // owed and read again and again with the scale still moving at every read. On a fast display
    // the next-frame retries reach the bound between two reads of the end, so it must not start
    // the bound over: past it, the end is read from the latest reading rather than owed once more.
    // Frames run as message tasks, back to back, far faster than any timer.
    const channel = new MessageChannel();
    const queued = new Map<number, FrameRequestCallback>();
    let handles = 0;
    channel.port1.onmessage = ({ data }: MessageEvent<number>) => {
      const callback = queued.get(data);
      queued.delete(data);
      callback?.(performance.now());
    };
    const frames = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      handles += 1;
      queued.set(handles, callback);
      channel.port2.postMessage(handles);
      return handles;
    });
    const cancels = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
      queued.delete(handle);
    });
    // Restored however the test ends, so a failure here cannot hold a later test's frames.
    onTestFinished(() => {
      sway.stop();
      frames.mockRestore();
      cancels.mockRestore();
      channel.port1.close();
    });
    sway.start();
    const finger = touchDown(viewport);
    viewport.scrollTo({ left: LENGTH, behavior: "instant" });
    await wait(50);
    finger.lift();
    // The end reports page 2, and the parent's index 0 brings page 1 back, the scale still moving.
    await expect.poll(() => Math.round(viewport.scrollLeft), { timeout: 3000 }).toBe(0);
    expect(changes).toEqual([[1, "scroll"]]);
  });

  it("keeps the page a held scroll ends on after taking over from its own scroll's owed end", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = swaying();
    // No snapping, so only the engine and the finger move the viewport.
    renderThemed(
      <Resampled
        nextScale={sway.next}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollSnapType: "none" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    // Page 3's indicator scrolls to 400px. While it runs, a gap moves page 3 to 800px and page 2 to
    // 400px, which nothing reports, and no reading holds still as the scroll ends.
    roleNamed("button", "Slide 3 of 4").click();
    roleNamed("group", "Ancestor").style.setProperty("--resampled-gap", `${LENGTH}px`);
    sway.start();
    await settledOn(viewport, 2 * LENGTH);
    // Long enough for its end to be read, and owed again, before the bound accepts a reading.
    await wait(150);
    // A finger takes over before any reading holds still, scrolls on to page 3 and back to 400px,
    // and holds there while the readings come to rest.
    const finger = touchDown(viewport);
    viewport.scrollTo({ left: 4 * LENGTH, behavior: "instant" });
    await nextFrames(2);
    viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
    await nextFrames(2);
    sway.stop();
    await wait(300);
    finger.lift();
    // The finger's scroll ended where page 2 now starts: that is the page, and nothing moves.
    await pollFrames(currentIndicator, 1);
    await wait(300);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(changes).toEqual([
      [2, "indicator"],
      [1, "scroll"],
    ]);
  });

  it("settles a scroll whose every read of its end is unsteady and every retry steady", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = alternating();
    renderThemed(
      <Resampled
        nextScale={sway.next}
        index={0}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollBehavior: "auto" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    try {
      // A script's scroll to page 2. Each read of its end sways and each next-frame retry after it
      // holds still, so the end is never read from a steady reading of its own.
      sway.start();
      viewport.scrollTo({ left: LENGTH, behavior: "instant" });
      // The end reports page 2, and the parent's index 0 brings page 1 back, the scale still moving.
      await pollFrames(() => changes, [[1, "scroll"]], 180);
      await settledOn(viewport, 0);
      await wait(300);
      expect(changes).toEqual([[1, "scroll"]]);
      expect(currentIndicator()).toBe(0);
    } finally {
      sway.stop();
    }
  });

  /**
   * What takes over from a scroll whose end is owed again, once a steady retry has read the slides
   * at 0, 200, 400 and 600px with the viewport at 400px, and the page the viewport is on once it
   * ends, with the slides at 0, 400, 800 and 1200px.
   */
  const takeovers: [string, (viewport: HTMLElement) => Promise<void>, number][] = [
    [
      // On to page 3 and back to where the retry read the slides.
      "a held finger",
      async (viewport) => {
        const finger = touchDown(viewport);
        viewport.scrollTo({ left: 4 * LENGTH, behavior: "instant" });
        await nextFrames(2);
        viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
        await nextFrames(2);
        finger.lift();
      },
      1,
    ],
    [
      "a script's scroll on a starved main thread",
      (viewport) => {
        viewport.scrollTo({ left: 4 * LENGTH, behavior: "instant" });
        // Busy past the quiet spell before the scroll's first frame, as a loaded runner can be, so
        // the end owed before the scroll comes due with the viewport moved and no scroll event yet.
        const until = performance.now() + 250;
        while (performance.now() < until) {
          // Spin.
        }
        return Promise.resolve();
      },
      2,
    ],
    [
      // On to page 3 and back to where the retry read the slides, before any scroll event.
      "a script's scroll away and back within one task",
      (viewport) => {
        viewport.scrollTo({ left: 4 * LENGTH, behavior: "instant" });
        viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
        return Promise.resolve();
      },
      1,
    ],
  ];

  it.each(takeovers)(
    "reads where a scroll ended from slides measured since %s took over its owed end",
    async (_, takeOver, expected) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      const alternate = alternating();
      const sway = swaying();
      let current: Sway = alternate;
      // Resolved as the first steady reading after the alternating scale starts reads the slides.
      const steadyRetry = Promise.withResolvers<void>();
      let started = false;
      const nextScale = () => {
        const scale = current.next();
        if (current === alternate && started && scale === undefined) {
          steadyRetry.resolve();
        }
        return scale;
      };
      // No snapping, so only the script and the takeover move the viewport.
      renderThemed(
        <Resampled
          nextScale={nextScale}
          onIndexChange={(index, { reason }) => changes.push([index, reason])}
          viewportStyle={{ scrollSnapType: "none" }}
        />
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(() => carouselIndicators().length, 4);

      try {
        // A script's scroll to page 3 at 400px. The read of its end sways, so it is owed again, and
        // the next frame's retry holds still, reading the slides at 0, 200, 400 and 600px.
        alternate.start();
        started = true;
        viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
        await steadyRetry.promise;
        // Before the end is read again, a 200px gap moves the slides to 0, 400, 800 and 1200px,
        // which nothing reports, and the takeover scrolls while no reading holds still.
        alternate.stop();
        // From half scale again, where `swaying` starts, so no measurement ends where it began.
        const ancestor = roleNamed("group", "Ancestor");
        ancestor.style.transform = "scale(0.5)";
        current = sway;
        sway.start();
        ancestor.style.setProperty("--resampled-gap", `${LENGTH}px`);
        await takeOver(viewport);
        await wait(300);
        sway.stop();
        // The page is the one the slides now put where the takeover's scroll ended, and nothing moves.
        await pollFrames(currentIndicator, expected);
        await wait(300);
        expect(Math.round(viewport.scrollLeft)).toBe(2 * expected * LENGTH);
        expect(changes).toEqual([[expected, "scroll"]]);
        expect(currentIndicator()).toBe(expected);
      } finally {
        alternate.stop();
        sway.stop();
      }
    }
  );
  it("goes to the page pressed while a scroll's end was owed, when a read of that end applies it", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    // Once started, the scale moves at every slide read until `moving` is cleared.
    let started = false;
    let moving = true;
    let reads = 0;
    const nextScale = () => {
      if (!started) {
        return undefined;
      }
      reads += 1;
      return moving ? 0.5 + (reads % 20) / 100 : undefined;
    };
    // No snapping, so only the script and the engine move the viewport: on a loaded runner Firefox
    // has turned the press's smooth scroll back to the slide the script's scroll left it snapped to.
    renderThemed(
      <Resampled
        nextScale={nextScale}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollSnapType: "none" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);
    const held = holdFrames();

    // A script's scroll to page 2 at 200px, whose end is read once, four slides, swaying, and so
    // owed again.
    started = true;
    viewport.scrollTo({ left: LENGTH, behavior: "instant" });
    while (reads < 4) {
      await held.frame();
      if (reads < 4) {
        held.spell();
      }
    }
    // Page 3 is pressed through the DOM. Its measurement sways too, as does any the Root's commit
    // of it brings, so the press's scroll waits for a usable reading.
    const pressedAt = changes.length;
    roleNamed("button", "Slide 3 of 4").click();
    // The Root has committed the press once its indicator is the current one.
    while (currentIndicator() !== 2) {
      await held.frame();
    }
    expect(Math.round(viewport.scrollLeft)).toBe(LENGTH);
    // The end's next read holds still and applies the press, whose smooth scroll heads for 400px
    // from 200px.
    moving = false;
    held.spell();
    held.release();
    // That scroll ends on page 3, and no page read where it started overrides the press.
    await settledOn(viewport, 2 * LENGTH);
    await wait(400);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(changes.slice(pressedAt)).toEqual([[2, "indicator"]]);
    expect(currentIndicator()).toBe(2);
  });

  it("reads a later scroll's end as often as the first before accepting an unsteady reading", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    // Once started, the scale moves at every slide read until `moving` is cleared.
    let started = false;
    let moving = true;
    let reads = 0;
    const nextScale = () => {
      if (!started) {
        return undefined;
      }
      reads += 1;
      return moving ? 0.5 + (reads % 20) / 100 : undefined;
    };
    renderThemed(
      <Resampled nextScale={nextScale} onIndexChange={(index, { reason }) => changes.push([index, reason])} />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    const held = holdFrames();
    // Four slides a measurement, and every measurement from here a read of a scroll's end.
    const measurements = () => Math.floor(reads / 4);
    // A frame, in which a scroll's end may arrive, and then one quiet spell, until the next read.
    const nextRead = async () => {
      const before = measurements();
      while (measurements() === before) {
        await held.frame();
        if (measurements() === before) {
          held.spell();
        }
      }
    };

    // A script's scroll to page 2 at 200px, whose end is read four times, never holding still.
    started = true;
    viewport.scrollTo({ left: LENGTH, behavior: "instant" });
    for (let read = 0; read < 4; read += 1) {
      await nextRead();
    }
    // Another script scroll, to page 3 at 400px, before the fifth read: once its scroll event has
    // come, its end is the one owed, and its first read, unsteady too, reports nothing.
    const scrolled = new Promise((resolve) => {
      viewport.addEventListener("scroll", resolve, { once: true });
    });
    viewport.scrollTo({ left: 2 * LENGTH, behavior: "instant" });
    await scrolled;
    await nextRead();
    expect(changes).toEqual([]);
    // Once the scale rests, the next read of its end reports page 3.
    moving = false;
    await nextRead();
    expect(changes).toEqual([[2, "scroll"]]);

    held.release();
    await wait(400);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(changes).toEqual([[2, "scroll"]]);
    expect(currentIndicator()).toBe(2);
  });

  /**
   * A Root whose parent shows the page an indicator press goes to but keeps its index through a
   * scroll, so the scroll's end brings the pressed page back.
   */
  function FollowsPresses({
    nextScale,
    onIndexChange,
  }: {
    readonly nextScale: () => number | undefined;
    readonly onIndexChange: (index: number, details: { readonly reason: CarouselIndexChangeReason }) => void;
  }): ReactElement {
    const [index, setIndex] = useState(0);
    return (
      <Resampled
        nextScale={nextScale}
        index={index}
        onIndexChange={(next, details) => {
          onIndexChange(next, details);
          if (details.reason === "indicator") {
            setIndex(next);
          }
        }}
      />
    );
  }

  /**
   * How the Root is owned, and the page and scroll position once the finger's scroll to page 4 at
   * 600px ends: the finger's page, or the press's page 3 at 400px that the parent kept.
   */
  const owners: [string, typeof Resampled | typeof FollowsPresses, number][] = [
    ["an uncontrolled Root", Resampled, 3],
    ["a parent that keeps the pressed page through a scroll", FollowsPresses, 2],
  ];

  it.each(owners)(
    "leaves a held scroll where the finger took it from a press still waiting, under %s",
    async (_, Owner, expected) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      const sway = swaying();
      renderThemed(
        <Owner nextScale={sway.next} onIndexChange={(index, { reason }) => changes.push([index, reason])} />
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(() => carouselIndicators().length, 4);

      // Page 3 is pressed through the DOM while no reading holds still, so its scroll to 400px waits
      // for one.
      sway.start();
      roleNamed("button", "Slide 3 of 4").click();
      await wait(100);
      expect(Math.round(viewport.scrollLeft)).toBe(0);
      // A finger takes over before any reading holds still, scrolls to page 4 at 600px, and holds
      // there while the readings come to rest: the press it took over from scrolls nowhere.
      const finger = touchDown(viewport);
      viewport.scrollTo({ left: 3 * LENGTH, behavior: "instant" });
      await nextFrames(2);
      sway.stop();
      await wait(400);
      expect(Math.round(viewport.scrollLeft)).toBe(3 * LENGTH);

      // Released, the scroll's end reports page 4; a parent that kept page 3 brings it back only now.
      finger.lift();
      await settledOn(viewport, expected * LENGTH);
      await pollFrames(currentIndicator, expected);
      await wait(300);
      expect(Math.round(viewport.scrollLeft)).toBe(expected * LENGTH);
      expect(changes).toEqual([
        [2, "indicator"],
        [3, "scroll"],
      ]);
    }
  );

  it.each(owners)(
    "leaves a scroll the finger already moved where it took it from a press that came to wait, under %s",
    async (_, Owner, expected) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      const sway = swaying();
      renderThemed(
        <Owner nextScale={sway.next} onIndexChange={(index, { reason }) => changes.push([index, reason])} />
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(() => carouselIndicators().length, 4);

      // A finger scrolls to page 2 at 200px while the readings hold still, so its scroll reports
      // pages as it goes.
      const finger = touchDown(viewport);
      viewport.scrollTo({ left: LENGTH, behavior: "instant" });
      await pollFrames(() => changes.length, 1);
      // Still held, page 3 is pressed once no reading holds still, so its scroll to 400px waits for
      // one, and the finger goes on to page 4 at 600px while the readings come to rest: the press
      // it took over from scrolls nowhere under it.
      sway.start();
      roleNamed("button", "Slide 3 of 4").click();
      await wait(100);
      expect(Math.round(viewport.scrollLeft)).toBe(LENGTH);
      viewport.scrollTo({ left: 3 * LENGTH, behavior: "instant" });
      await nextFrames(2);
      sway.stop();
      await wait(400);
      expect(Math.round(viewport.scrollLeft)).toBe(3 * LENGTH);

      // Released, the scroll's end reports page 4; a parent that kept page 3 brings it back only now.
      finger.lift();
      await settledOn(viewport, expected * LENGTH);
      await pollFrames(currentIndicator, expected);
      await wait(300);
      expect(Math.round(viewport.scrollLeft)).toBe(expected * LENGTH);
      expect(changes).toEqual([
        [1, "scroll"],
        [2, "indicator"],
        [3, "scroll"],
      ]);
    }
  );

  /**
   * How a held finger starts before it takes over from page 3, pressed while no reading holds
   * still, and the page it takes over on: from rest at page 1, or from a scroll that already
   * reported page 2. Each starts the sway.
   */
  const returns: [
    string,
    (viewport: HTMLElement, sway: Sway, changes: readonly unknown[]) => Promise<HeldFinger>,
    number,
  ][] = [
    [
      "a finger put down once the press waits",
      async (viewport, sway) => {
        // Page 3 is pressed while no reading holds still, so its scroll to 400px waits for one, and
        // only then a finger goes down at 0px.
        sway.start();
        roleNamed("button", "Slide 3 of 4").click();
        await wait(100);
        return touchDown(viewport);
      },
      0,
    ],
    [
      "a finger whose scroll already reported a page",
      async (viewport, sway, changes) => {
        // A finger scrolls to page 2 at 200px while the readings hold still, so its scroll reports
        // page 2, and then page 3 is pressed while no reading holds still.
        const finger = touchDown(viewport);
        viewport.scrollTo({ left: LENGTH, behavior: "instant" });
        await pollFrames(() => changes.length, 1);
        sway.start();
        roleNamed("button", "Slide 3 of 4").click();
        await wait(100);
        return finger;
      },
      1,
    ],
  ];

  /** How the Root is owned, and whether its parent keeps the pressed page through a scroll. */
  const keepers: [string, typeof Resampled | typeof FollowsPresses, boolean][] = [
    ["an uncontrolled Root", Resampled, false],
    ["a parent that keeps the pressed page through a scroll", FollowsPresses, true],
  ];

  describe.each(keepers)("under %s", (_, Owner, keeps) => {
    it.each(returns)("reports the page that %s takes over on and returns to", async (__, start, home) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      const sway = swaying();
      renderThemed(
        <Owner nextScale={sway.next} onIndexChange={(index, { reason }) => changes.push([index, reason])} />
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(() => carouselIndicators().length, 4);
      // A finger that scrolled before the press had its page reported as it went.
      const before: [number, CarouselIndexChangeReason][] = home === 0 ? [] : [[home, "scroll"]];

      const finger = await start(viewport, sway, changes);
      expect(Math.round(viewport.scrollLeft)).toBe(home * LENGTH);
      // The finger scrolls on a page, taking over from the press, and comes back, holding there
      // while the readings come to rest: the press scrolls nowhere under it.
      viewport.scrollTo({ left: (home + 1) * LENGTH, behavior: "instant" });
      await nextFrames(2);
      viewport.scrollTo({ left: home * LENGTH, behavior: "instant" });
      await nextFrames(2);
      sway.stop();
      await wait(400);
      expect(Math.round(viewport.scrollLeft)).toBe(home * LENGTH);

      // Released, the scroll's end reports the page it returned to, which the Root had left for
      // page 3; a parent that kept page 3 brings it back only now.
      finger.lift();
      const expected = keeps ? 2 : home;
      await settledOn(viewport, expected * LENGTH);
      await pollFrames(currentIndicator, expected);
      await wait(300);
      expect(Math.round(viewport.scrollLeft)).toBe(expected * LENGTH);
      expect(changes).toEqual([...before, [2, "indicator"], [home, "scroll"]]);
    });
  });

  /** Input held on the viewport that never scrolls it, released by `release`. */
  const stillHolds: [string, (viewport: HTMLElement) => () => void][] = [
    [
      "a finger that never moves",
      (viewport) => {
        const finger = touchDown(viewport);
        return finger.lift;
      },
    ],
    [
      "a held key that scrolls nothing",
      (viewport) => {
        const key = (type: string) =>
          new KeyboardEvent(type, { code: "ShiftLeft", key: "Shift", bubbles: true });
        viewport.dispatchEvent(key("keydown"));
        return () => document.dispatchEvent(key("keyup"));
      },
    ],
  ];

  it.each(stillHolds)(
    "goes to a page pressed after a scroll whose event comes only once %s is held",
    async (_, hold) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      const sway = swaying();
      // No snapping, so only the script and the engine move the viewport.
      renderThemed(
        <Resampled
          nextScale={sway.next}
          onIndexChange={(index, { reason }) => changes.push([index, reason])}
          viewportStyle={{ scrollSnapType: "none" }}
        />
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(() => carouselIndicators().length, 4);

      // In one task, so the scroll's event is still on its way: a script's scroll to page 2 at
      // 200px, page 3 pressed while no reading holds still, so its scroll to 400px waits for one,
      // and then input held on the viewport that moves nothing.
      sway.start();
      viewport.scrollTo({ left: LENGTH, behavior: "instant" });
      roleNamed("button", "Slide 3 of 4").click();
      const release = hold(viewport);
      await wait(100);
      expect(Math.round(viewport.scrollLeft)).toBe(LENGTH);

      // The held input scrolled nothing, so once the readings rest the press goes to page 3.
      sway.stop();
      await settledOn(viewport, 2 * LENGTH);
      release();
      await wait(400);
      expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
      expect(currentIndicator()).toBe(2);
      expect(changes).toEqual([[2, "indicator"]]);
    }
  );

  it("goes to a page pressed under a held finger whose scroll's event comes only once the press waits", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    const sway = swaying();
    // No snapping, so only the script and the engine move the viewport.
    renderThemed(
      <Resampled
        nextScale={sway.next}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
        viewportStyle={{ scrollSnapType: "none" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    // A finger held at 0px, and in one task, so the scroll's event is still on its way: a scroll to
    // page 2 at 200px, then page 3 pressed while no reading holds still, so its scroll to 400px
    // waits for one. The finger moves nothing after the press.
    const finger = touchDown(viewport);
    sway.start();
    viewport.scrollTo({ left: LENGTH, behavior: "instant" });
    roleNamed("button", "Slide 3 of 4").click();
    await wait(100);
    expect(Math.round(viewport.scrollLeft)).toBe(LENGTH);

    // Nothing moved since the press, so once the readings rest it goes to page 3, finger still down.
    sway.stop();
    await settledOn(viewport, 2 * LENGTH);
    finger.lift();
    await wait(400);
    expect(Math.round(viewport.scrollLeft)).toBe(2 * LENGTH);
    expect(currentIndicator()).toBe(2);
    expect(changes).toEqual([[2, "indicator"]]);
  });
});

/**
 * Layouts whose painted boxes differ from what the layout tree's integer offsets and computed sizes
 * give, each measured first while the scale moves and then once it rests. Oracle: each slide's
 * hand-computed start in scroll px, where a snap-start slide's page begins.
 */
describe("Carousel measured from its painted boxes once an ancestor's scale rests", () => {
  // One wrapper in the viewport around the four slides, as wide as they are together.
  const wrapped = { display: "flex", flex: "none" } as const;
  const fixed = { flex: "none", width: LENGTH } as const;
  // Placing the default page is the Root's own page, never a change it reports.
  const changes: [number, CarouselIndexChangeReason][] = [];
  const record = (index: number, { reason }: { readonly reason: CarouselIndexChangeReason }) => {
    changes.push([index, reason]);
  };
  afterEach(() => {
    expect(changes).toEqual([]);
    changes.length = 0;
  });

  it.each([
    [
      "a positioned wrapper's 20px leading border",
      { ...wrapped, position: "relative", borderLeft: "20px solid" },
      20,
    ],
    ["a wrapper's translateX(30px)", { ...wrapped, transform: "translateX(30px)" }, 30],
  ] as const)("places its page past %s", async (_, wrapperStyle, lead) => {
    renderThemed(
      <Resampled
        nextScale={movingFor(24)}
        defaultIndex={2}
        onIndexChange={record}
        wrapperStyle={wrapperStyle}
        slideStyle={fixed}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // Slide 3 starts two slides past the lead, and is the only slide in view there.
    await settledOn(viewport, lead + 2 * LENGTH);
    await pollFrames(currentIndicator, 2);
    expect(carouselIndicators()).toHaveLength(4);
    await pollFrames(() => inertSlides(4), [true, true, false, true]);
  });

  it("makes three pages of six 99.65px slides in a 398px viewport", async () => {
    // The slides start at 0, 99.65 and 199.3; the fourth's 298.95 clamps to the end of the range,
    // 597.9 - 398 = 199.9, which is the third's page.
    renderThemed(
      <Resampled
        nextScale={movingFor(36)}
        defaultIndex={2}
        onIndexChange={record}
        width={398}
        count={6}
        slideStyle={{ flex: "none", width: 99.65 }}
      />
    );
    await pollFrames(currentIndicator, 2);
    expect(carouselIndicators()).toHaveLength(3);
    expect(roleNamed("button", "Next slide").getAttribute("aria-disabled")).toBe("true");
    // From 199.3, slides 3 to 6 are in view, the sixth all but its last 0.6px.
    await pollFrames(() => inertSlides(6), [true, true, false, false, false, false]);
  });

  it("places its page among inline slides", async () => {
    // Each slide is an inline box around a 200px inline block, on one line, so its computed width
    // is `auto` while its painted box is 200px wide.
    renderThemed(
      <Resampled
        nextScale={movingFor(24)}
        defaultIndex={2}
        onIndexChange={record}
        viewportStyle={{ display: "block", whiteSpace: "nowrap" }}
        slideStyle={{ display: "inline" }}
        bodyStyle={{ display: "inline-block", width: LENGTH, verticalAlign: "top" }}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, 2 * LENGTH);
    await pollFrames(currentIndicator, 2);
    expect(carouselIndicators()).toHaveLength(4);
    await pollFrames(() => inertSlides(4), [true, true, false, true]);
  });
});
