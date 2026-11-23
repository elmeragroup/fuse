import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import { LocaleProvider } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { roleHex } from "../src/brand/role-value";
import type { ColorRole } from "../src/brand/role-value";
import { SiteHero } from "../src/claude-builds/site/site-hero";
import "../src/index.css";
import { SceneTheme } from "../src/primitives/scene-theme";
import { WEEK_KWH } from "../src/sample/customer-data";
import { WeekBars } from "../src/sample/week-bars";
import { play, render, Timeline, unmountTree } from "./frame-harness";

afterEach(unmountTree);

/** The bars every chart on the page draws, in slot order. */
function barsOf(root: ParentNode = document): readonly SVGPolygonElement[] {
  return [...root.querySelectorAll<SVGPolygonElement>('[data-slot="chart-bar"]')];
}

/** A bar's height in the plot's user units, which are layout pixels, from the corners it draws. */
function heightOf(bar: SVGPolygonElement): number {
  const ys = [...bar.points].map((point) => point.y);
  return Math.max(...ys) - Math.min(...ys);
}

/** A bar's computed fill as opaque hex, read through the colour package. */
function fillHex(bar: SVGPolygonElement): string {
  return Hex.formatOpaque(CssColor.toSrgb(getOrThrow(CssColor.parse(getComputedStyle(bar).fill))));
}

/** An element's computed background as opaque hex, read through the colour package. */
function backgroundHex(element: Element): string {
  return Hex.formatOpaque(
    CssColor.toSrgb(getOrThrow(CssColor.parse(getComputedStyle(element).backgroundColor)))
  );
}

/** What a frame draws of its charts: each bar's corners and fill, whether a chart waits, and its loaders. */
type DrawnCharts = {
  readonly bars: readonly string[];
  readonly waiting: boolean;
  readonly loaders: number;
};

/** What the page's charts draw on this frame. */
function drawn(): DrawnCharts {
  return {
    bars: barsOf().map((bar) => `${bar.getAttribute("points") ?? ""} ${fillHex(bar)}`),
    waiting: document.querySelector('[data-slot="chart"][data-entrance="waiting"]') !== null,
    loaders: document.querySelectorAll('[data-slot="chart-plot"] > [data-slot="loader"]').length,
  };
}

/** A look a frame can wear. */
type Look = { readonly brand: BrandCode; readonly scheme: ResolvedColorScheme };

/** A frame's theme and Fuse's English locale on Remotion's timeline, as a scene renders its content. */
function Frame({
  look,
  frame = 0,
  children,
}: {
  readonly look: Look;
  readonly frame?: number;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Timeline frame={frame}>
      <LocaleProvider locale="en-US">
        <SceneTheme brand={look.brand} scheme={look.scheme} className="font-sans text-foreground">
          {children}
        </SceneTheme>
      </LocaleProvider>
    </Timeline>
  );
}

/**
 * The site's hero at its section's size on a scale and an offset, as the session's camera shows it.
 * The camera's scale is the drop's, the page at the stage's width.
 */
function Hero({
  look,
  scale = 1,
  frame = 0,
}: {
  readonly look: Look;
  readonly scale?: number;
  readonly frame?: number;
}): ReactElement {
  return (
    <Frame look={look} frame={frame}>
      <div style={{ width: 960, height: 416, scale: String(scale), transformOrigin: "top left" }}>
        <SiteHero brand={look.brand} />
      </div>
    </Frame>
  );
}

// Unit under test: the hero's chart of the day's hourly prices. Oracle: the Norwegian market's
// published figures, which the card prints beside the chart: NOK 0.41 at the night low, the 04:00
// hour, NOK 1.32 at the morning peak, the 08:00 hour, and the day's average NOK 0.84. Bars rise
// from zero, so the two bars' heights stand in the ratio of the two prices.
describe("the hero's price chart", () => {
  const ELMA = { brand: "elma", scheme: "light" } as const;
  const PRICES = { low: 0.41, high: 1.32 } as const;
  const HOURS = { low: 4, peak: 8, perDay: 24 } as const;

  it("draws one bar per hour at rest on a cold mount, in the prices' proportion", () => {
    render(<Hero look={ELMA} />);
    const state = drawn();
    expect(state.waiting).toBe(false);
    expect(state.loaders).toBe(0);
    const bars = barsOf();
    expect(bars).toHaveLength(HOURS.perDay);
    const [low, peak] = [bars[HOURS.low], bars[HOURS.peak]];
    if (low === undefined || peak === undefined)
      throw new Error("The night low or the morning peak has no bar");
    // Each bar snaps its ends to whole device pixels, so a height can be off by one pixel.
    expect(Math.abs(heightOf(low) / heightOf(peak) - PRICES.low / PRICES.high)).toBeLessThan(
      1 / heightOf(peak)
    );
  });

  it("paints the hours above the day's average in the negative role and those below in the positive", () => {
    render(<Hero look={ELMA} />);
    const bars = barsOf();
    const [low, peak] = [bars[HOURS.low], bars[HOURS.peak]];
    if (low === undefined || peak === undefined)
      throw new Error("The night low or the morning peak has no bar");
    expect(fillHex(peak)).not.toBe(fillHex(low));
    expect(fillHex(low)).toBe(roleHex(ELMA, "chart-sentiment-positive"));
    expect(fillHex(peak)).toBe(roleHex(ELMA, "chart-sentiment-negative"));
  });

  it("draws the same marks under the camera's scale as at the page's own size", () => {
    render(<Hero look={ELMA} />);
    const plain = barsOf().map(heightOf);
    unmountTree();
    render(<Hero look={ELMA} scale={4 / 3} />);
    const scaled = barsOf().map(heightOf);
    expect(scaled).toHaveLength(plain.length);
    // The plot measures its layout size, which no scale changes; only where a pixel edge rounds may move.
    scaled.forEach((height, hour) => {
      expect(Math.abs(height - (plain[hour] ?? Number.NaN))).toBeLessThanOrEqual(1);
    });
  });
});

// Unit under test: the week of use, which the release's product shot and the brand book's collage
// draw. Oracle: the week's readings in the sample data, which the bars must stand in proportion
// to from a zero baseline.
describe("the week of use", () => {
  const LOOK = { brand: "elma", scheme: "light" } as const;
  /** Thursday is the week's highest day and Tuesday its lowest. */
  const DAYS = { tuesday: 1, thursday: 3 } as const;

  it("draws one bar per day at rest on a cold mount, in the readings' proportion", () => {
    render(
      <Frame look={LOOK}>
        <div className="flex h-60 w-120 flex-col">
          <WeekBars weekdays />
        </div>
      </Frame>
    );
    const state = drawn();
    expect(state.waiting).toBe(false);
    expect(state.loaders).toBe(0);
    const bars = barsOf();
    expect(bars).toHaveLength(WEEK_KWH.length);
    const [tuesday, thursday] = [bars[DAYS.tuesday], bars[DAYS.thursday]];
    if (tuesday === undefined || thursday === undefined) throw new Error("Tuesday or Thursday has no bar");
    expect(Math.abs(heightOf(tuesday) / heightOf(thursday) - 12.4 / 15.2)).toBeLessThan(
      1 / heightOf(thursday)
    );
  });
});

// Unit under test: the week of use's paint, which wears the brand. Oracle: the primary colour each
// brand's scope resolves for a probe painted `bg-primary` beside the chart, as the old hand-built
// bars were. Fuse's chart roles are the same in every brand, so a bar in a chart role would keep one
// colour through both brands.
describe("the week of use's paint", () => {
  const LOOKS = [
    { brand: "elma", scheme: "light" },
    { brand: "fkas", scheme: "light" },
  ] as const satisfies readonly Look[];

  it("paints a current day in each brand's primary, as the brand's scope resolves it", () => {
    const seen = LOOKS.map((look) => {
      render(
        <Frame look={look}>
          <div data-probe="" className="size-4 bg-primary" />
          <div className="flex h-60 w-120 flex-col">
            <WeekBars />
          </div>
        </Frame>
      );
      const probe = document.querySelector("[data-probe]");
      const sunday = barsOf().at(-1);
      if (probe === null || sunday === undefined) throw new Error("The probe or Sunday's bar is missing");
      const paint = { primary: backgroundHex(probe), bar: fillHex(sunday) };
      unmountTree();
      return paint;
    });
    const [first, second] = seen;
    if (first === undefined || second === undefined) throw new Error("A brand drew no week");
    expect(first.primary).not.toBe(second.primary);
    expect(first.bar).toBe(first.primary);
    expect(second.bar).toBe(second.primary);
  });
});

// Unit under test: a chart's frame through the video's chart frame. Oracle: a fresh render of the
// same frame. Remotion renders frames out of order across tabs, so a frame reached through the
// frames before it must draw what a cold mount of it draws.
describe("a chart's frame", () => {
  /** Frames 0 to 9, each moving and scaling the chart by a fraction of a pixel, as a camera does. */
  const HISTORY = Array.from({ length: 10 }, (_, frame) => frame);
  const LAST = HISTORY.length - 1;

  /**
   * The collage keeps each plate's element from frame to frame, so React renders no part of it on
   * a new frame. This element stands for one, built once outside the tree.
   */
  const KEPT_WEEK = (
    <div className="flex h-60 w-120 flex-col">
      <WeekBars weekdays />
    </div>
  );

  function Drifting({ frame }: { readonly frame: number }): ReactElement {
    return (
      <Frame look={{ brand: "fkas", scheme: "dark" }} frame={frame}>
        <div
          style={{
            translate: `${String(frame * 0.37)}px ${String(frame * 0.29)}px`,
            scale: String(1 + frame * 0.013),
            transformOrigin: "top left",
          }}>
          {KEPT_WEEK}
        </div>
      </Frame>
    );
  }

  it("draws the same marks reached through earlier frames as mounted fresh, below a kept element", async () => {
    const tree = (frame: number) => <Drifting frame={frame} />;
    await play(HISTORY, tree);
    const played = drawn();
    unmountTree();

    await play([LAST], tree);
    const fresh = drawn();
    expect(fresh.bars).toHaveLength(WEEK_KWH.length);
    expect(played).toEqual(fresh);
  });

  // The session flips the page's look on a beat. A flip within a market repaints the chart in the
  // new theme's roles; a flip to another market changes the prices, which the chart must draw at
  // rest on the flip's frame.
  const FLIPS = [
    { name: "within the Norwegian market", from: "elma", to: "fkas" },
    { name: "into the Finnish market", from: "fkas", to: "ngfi" },
  ] as const satisfies readonly { name: string; from: BrandCode; to: BrandCode }[];

  it.each(FLIPS)(
    "follows a flip $name on the flip's frame, as a fresh mount draws it",
    async ({ from, to }) => {
      const looks: readonly Look[] = [
        { brand: from, scheme: "light" },
        { brand: to, scheme: "dark" },
      ];
      const tree = (frame: number) => (
        <Hero look={looks[frame] ?? { brand: to, scheme: "dark" }} scale={4 / 3} frame={frame} />
      );
      const [before, after] = looks;
      if (before === undefined || after === undefined) throw new Error("The flip has no two looks");
      const role: ColorRole = "chart-sentiment-negative";
      expect(roleHex(after, role)).not.toBe(roleHex(before, role));

      await play([0, 1], tree);
      const played = drawn();
      const peak = barsOf()[8];
      if (peak === undefined) throw new Error("The morning peak has no bar");
      expect(fillHex(peak)).toBe(roleHex(after, role));
      unmountTree();

      await play([1], tree);
      expect(played).toEqual(drawn());
    }
  );
});
