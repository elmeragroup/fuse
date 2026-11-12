/**
 * Unit under test: SparklineHover's glide, over the Sparkline's markup and chart.css. Oracles: the
 * image's own box, worked by hand. Three values own a third of its width each, centred at a sixth,
 * a half and five sixths; [2, 6, 4] spans [2, 6], so 6 sits at the top edge and 4 halfway down.
 * Hovering the first value, then the third, moves the one crosshair from a sixth to five sixths of
 * the width and the dot from the bottom edge to halfway down. A line's band runs from the box's left
 * bleed to the second value's centre around the first value, and from the second value's centre
 * past the right edge around the third, so at 100 px across, on the line at row 16, only the first
 * band strokes the line whole, and at 200 px, row 8, only the second does. The rest of the line
 * shows at the hover dim, 0.45, so pure blue on white reads 255 × 0.55 ≈ 140 in red there, and
 * about 0 where the band strokes it.
 */
import { useEffect, useState } from "react";
import type { HTMLAttributes } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  hoverIn,
  imageNamed,
  placeIn,
  rows,
  settleStylesheet,
  shareIn,
  shownIn,
} from "../../../test/chart/sparkline";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";
import { Sparkline } from "./sparkline";
import type { SparklineProps } from "./sparkline";
import { SparklineHover } from "./sparkline-hover";

const NAME = "Spot price";

const image = () => imageNamed(`${NAME}. Lowest 2, highest 6.`);
const shown = (selector: string) => shownIn(image(), selector);
const shareOf = (element: Element) => shareIn(image(), element);
const placeOf = (element: Element) => placeIn(image(), element);
const hoverAt = (x: number) => hoverIn(image(), x);

/** Whether a wrapper took the image over: its glide group carries the takeover marker. */
const taken = () =>
  image().querySelector('[data-slot="sparkline-glide"]')?.hasAttribute("data-glide") ?? false;

/** The swap of the root a mounted `Swapping` renders, which the test calls. */
type SwapHandle = { root: (() => void) | null };

const SWAP: SwapHandle = { root: null };

/**
 * A custom element for `render` that forwards its ref and replaces its own root, a `div`, with a
 * `section` through its own state, so SparklineHover does not render again.
 */
function Swapping(
  props: HTMLAttributes<HTMLElement> & {
    /** The merged ref `useRender` passes, a callback over any element. */
    readonly ref?: (node: HTMLElement | null) => void | (() => void);
  }
) {
  const [tag, setTag] = useState<"div" | "section">("div");
  useEffect(() => {
    SWAP.root = () => {
      setTag("section");
    };
    return () => {
      SWAP.root = null;
    };
  }, []);
  return tag === "div" ? <div {...props} /> : <section {...props} />;
}

/**
 * The wrapper's element: a `div`, a `section`, a `Swapping`, or a `div` that writes its own
 * `data-slot` over the wrapper's.
 */
const ELEMENTS = {
  div: <div />,
  section: <section />,
  swapping: <Swapping />,
  tile: <div data-slot="tile" />,
} as const;

/** A consumer's inline ref, a new function on every render. */
const inlineRef = () => (node: HTMLElement | null) => {
  void node;
};

/** How the gliding fixture draws. */
type Gliding = {
  readonly variant?: SparklineProps["variant"];
  readonly data?: readonly number[];
  /** Alone in its SparklineHover, or inside a second one. */
  readonly wrapping?: "single" | "nested";
  /** The wrapper's width in CSS pixels. */
  readonly width?: number;
  /** The element the wrapper renders. */
  readonly element?: keyof typeof ELEMENTS;
  /** Give the wrapper a consumer's inline ref. */
  readonly withRef?: boolean;
  /** A label beside the Sparkline, inside the wrapper. */
  readonly label?: string;
};

/**
 * The same Sparkline inside a SparklineHover, on a white page in pure blue. The description keeps
 * the name of [2, 6, 4] whatever the data, so `image` finds it after new data.
 */
function gliding({
  variant = "line",
  data = [2, 6, 4],
  wrapping = "single",
  width = 300,
  element = "div",
  withRef = false,
  label,
}: Gliding = {}) {
  const sparkline = (
    <Sparkline
      aria-label={NAME}
      data={data}
      locale="en-US"
      curve="linear"
      variant={variant}
      description="Lowest 2, highest 6."
    />
  );
  // The wrapper hangs from the right of a 300 px row, so a narrower one keeps its third value under
  // a pointer that rests there.
  return (
    <div style={{ width: 300, display: "flex", justifyContent: "flex-end" }}>
      <SparklineHover
        render={ELEMENTS[element]}
        ref={withRef ? inlineRef() : undefined}
        style={{ width, background: "#fff", "--chart-1": "#00f" }}>
        {wrapping === "nested" ? <SparklineHover>{sparkline}</SparklineHover> : sparkline}
        {label === undefined ? null : <span>{label}</span>}
      </SparklineHover>
    </div>
  );
}

function renderGliding(options?: Gliding) {
  return renderThemed(gliding(options));
}

/** The animations a script started, such as a glide, as opposed to the stylesheet's own. */
function scripted(): Animation[] {
  return document
    .getAnimations()
    .filter((animation) => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition));
}

/** Seek every glide to a share of its own duration and hold it there. */
function seekGlides(share: number): void {
  const glides = scripted();
  expect(glides.length).toBeGreaterThan(0);
  for (const glide of glides) {
    glide.pause();
    glide.currentTime = Number(glide.effect?.getComputedTiming().duration ?? 0) * share;
  }
}

const crosshair = '[data-slot="sparkline-crosshair"]';
const dot = '[data-slot="sparkline-dot"]:is([data-part="hover"], [data-part="glide"])';

/** The red channel at 100 px and 200 px across, on the line's rows there. */
async function bandReds(): Promise<readonly [number, number]> {
  const [left] = await rows(image(), 100, [16]);
  const [right] = await rows(image(), 200, [8]);
  return [left?.[0] ?? -1, right?.[0] ?? -1];
}

/**
 * Hover the first value, let its marks settle, then hover the third. The glides the second step
 * starts are paused in the pointerover's own dispatch, by a listener on the window, which the
 * event reaches after React's root, so however long the pointer command takes to return, they
 * hold where they started until a test seeks them.
 */
async function firstToThird(): Promise<void> {
  settleStylesheet();
  await hoverAt(1 / 6);
  await expect.poll(() => placeOf(shown(crosshair)).x).toBe(0.17);
  settleStylesheet();
  const hold = () => {
    for (const glide of scripted()) glide.pause();
  };
  window.addEventListener("pointerover", hold);
  try {
    await hoverAt(0.9);
  } finally {
    window.removeEventListener("pointerover", hold);
  }
  settleStylesheet();
}

afterEach(async () => {
  await commands.parkPointer();
  await emulateReducedMotion("no-preference");
});

describe("SparklineHover", () => {
  // A nested wrapper owns the Sparkline, so the outer one moves nothing and the glide starts where
  // the marks showed, not from twice the way.
  it.each(["single", "nested"] as const)(
    "glides one crosshair, one dot and the band from value to value, %s",
    async (wrapping) => {
      renderGliding({ wrapping });
      await firstToThird();
      // The glide starts where the marks showed, and only one set of marks shows.
      seekGlides(0);
      expect(placeOf(shown(crosshair)).x).toBe(0.17);
      expect(placeOf(shown(dot))).toEqual({ x: 0.17, y: 1 });
      const [leftBefore, rightBefore] = await bandReds();
      expect(leftBefore).toBeLessThan(60);
      expect(rightBefore).toBeGreaterThan(100);

      seekGlides(0.1);
      const between = shareOf(shown(crosshair)).x;
      expect(between).toBeGreaterThan(0.17);
      expect(between).toBeLessThan(0.83);
      expect(shareOf(shown(dot)).x).toBeCloseTo(between, 2);

      seekGlides(1);
      expect(placeOf(shown(crosshair)).x).toBe(0.83);
      expect(placeOf(shown(dot))).toEqual({ x: 0.83, y: 0.5 });
      const [leftAfter, rightAfter] = await bandReds();
      expect(leftAfter).toBeGreaterThan(100);
      expect(rightAfter).toBeLessThan(60);
    }
  );

  it("glides inside a render element that writes its own data-slot", async () => {
    renderGliding({ element: "tile" });
    await firstToThird();
    seekGlides(0);
    expect(placeOf(shown(crosshair)).x).toBe(0.17);
    seekGlides(1);
    expect(placeOf(shown(crosshair)).x).toBe(0.83);
  });

  it("glides the crosshair over bars and lifts the hovered bar at once", async () => {
    renderGliding({ variant: "bar" });
    await firstToThird();
    seekGlides(0);
    expect(placeOf(shown(crosshair)).x).toBe(0.17);
    const lifted = shown('[data-slot="sparkline-bar"][data-part="highlight"]');
    expect(placeOf(lifted).x).toBe(0.83);
    expect(Number(getComputedStyle(lifted).opacity)).toBe(1);
  });

  it("places the marks on the hovered value's new place when the data changes", async () => {
    // [2, 6, 10] spans [2, 10], so the third value moves from halfway down to the top edge.
    const { rerender } = renderGliding();
    await firstToThird();
    seekGlides(1);
    expect(placeOf(shown(dot))).toEqual({ x: 0.83, y: 0.5 });
    rerender(gliding({ data: [2, 6, 10] }));
    await expect.poll(() => placeOf(shown(dot))).toEqual({ x: 0.83, y: 0 });
    expect(placeOf(shown(crosshair)).x).toBe(0.83);
  });

  it("keeps a bar glide at its share of the box when the box resizes mid-glide, and lands on the hovered value", async () => {
    // At 150 px the third value's centre is still five sixths of the way across, and the pointer
    // still rests on it. The glide moves in shares of the box, so a glide held a tenth of its way
    // in shows the crosshair at the same share of the narrower image, where one in pixels would
    // show it two thirds of 300 px to the left of its rest, half a box further left, and it ends on
    // the hovered value.
    const { rerender } = renderGliding({ variant: "bar" });
    await firstToThird();
    seekGlides(0.1);
    const held = shareOf(shown(crosshair)).x;
    const before = image().getBoundingClientRect().width;
    rerender(gliding({ variant: "bar", width: 150 }));
    await nextFrames(2);
    expect(image().getBoundingClientRect().width).toBeLessThan(before);
    expect(shareOf(shown(crosshair)).x).toBeCloseTo(held, 2);
    seekGlides(1);
    expect(placeOf(shown(crosshair)).x).toBe(0.83);
  });

  it("keeps a running glide when something beside the Sparkline changes", async () => {
    const { rerender } = renderGliding();
    await firstToThird();
    seekGlides(0.1);
    const held = shareOf(shown(crosshair)).x;
    rerender(gliding({ label: "Today" }));
    await nextFrames(1);
    expect(scripted().length).toBeGreaterThan(0);
    expect(shareOf(shown(crosshair)).x).toBe(held);
  });

  // A parent's new `render` and a render element's own state each put a new element, holding a new
  // Sparkline, in place of the old one, and only the first renders SparklineHover again.
  it.each([
    {
      by: "a new `render` from the parent",
      element: "section",
      replace: (rerender: (node: ReturnType<typeof gliding>) => void) => {
        rerender(gliding({ element: "section" }));
      },
    },
    {
      by: "the render element's own state",
      element: "swapping",
      replace: () => {
        SWAP.root?.();
      },
    },
  ] as const)("takes over the new element that $by puts in place, and follows its data", async (c) => {
    // [2, 6, 10] spans [2, 10], so the third value moves from halfway down to the top edge.
    const { rerender } = renderGliding({ element: c.element === "section" ? "div" : "swapping" });
    await firstToThird();
    seekGlides(1);
    const before = image();
    c.replace(rerender);
    await expect.poll(() => image() !== before && taken()).toBe(true);
    // The pointer leaves and comes back, so the new Sparkline's first step places its marks at once.
    // Its entrance ends first, so the pointer command finds it still.
    const glideDot = '[data-slot="sparkline-dot"][data-part="glide"]';
    await commands.parkPointer();
    settleStylesheet();
    await hoverAt(0.9);
    settleStylesheet();
    expect(placeOf(shown(glideDot))).toEqual({ x: 0.83, y: 0.5 });
    rerender(gliding({ element: c.element, data: [2, 6, 10] }));
    await expect.poll(() => placeOf(shown(glideDot))).toEqual({ x: 0.83, y: 0 });
  });

  it("keeps a running glide when a consumer's inline ref renders the wrapper again", async () => {
    // Each render gives the wrapper a new ref, so React lets go of its element and attaches it again.
    const { rerender } = renderGliding({ withRef: true });
    await firstToThird();
    seekGlides(0.1);
    const held = shareOf(shown(crosshair)).x;
    rerender(gliding({ withRef: true }));
    await nextFrames(1);
    expect(scripted().length).toBeGreaterThan(0);
    expect(shareOf(shown(crosshair)).x).toBe(held);
    expect(taken()).toBe(true);
  });

  it("ends a running glide when the reader turns on reduced motion, and moves at once after", async () => {
    renderGliding();
    await firstToThird();
    seekGlides(0.1);
    await emulateReducedMotion("reduce");
    await expect.poll(() => scripted()).toEqual([]);
    expect(placeOf(shown(crosshair)).x).toBe(0.83);

    await hoverAt(1 / 6);
    expect(scripted()).toEqual([]);
    expect(placeOf(shown(crosshair)).x).toBe(0.17);
    expect(placeOf(shown(dot))).toEqual({ x: 0.17, y: 1 });
  });
});
