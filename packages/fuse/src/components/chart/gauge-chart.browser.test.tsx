// GaugeChart in Chromium. Units under test: GaugeChart.Root and its marks, Track, Fill, Ruler,
// Needle, Zone, Sector, ProgressRing, Dots and the Center parts. Oracles, written by hand: the
// spec's meter contract (role meter, its domain, the clamped value ARIA allows, and the true value's
// spoken text, "3,9 kilowattimer" in Bokmål and "3.9 kilowatt-hours" in US English, each joined by
// the no-break space every chart label writes); a 270° sweep
// from −135°, where 3.9 of 0–5 kWh sits 0.78 · 270 = 210.6° along, at 75.6°; the lit-notch rule,
// round(40 · share) and at least one above min, 31 at 3.9; the ruler's 0.2 kWh ticks, 20 of them at
// or behind 3.9; the rim's room, 0.11 for an outside ruler, 0.08 for a zone and 0.06 for a ring;
// the browser's own fill test for the gap between two notches, which keeps its whole device pixels
// on a larger dial; and the spec's motion rules, one
// value per frame for every mark, a sweep that only grows, and a retarget that starts where the
// dial shows.
import { Activity } from "react";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, pollFrames, recordFrames } from "../../../test/animation-frames";
import { render } from "../../../test/browser-render";
import { centreText } from "../../../test/chart/pie";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import {
  computedContrast,
  fkasPrivate,
  renderThemed,
  snapshotDocumentTheme,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import "./chart.css";
import { GaugeChart } from "./gauge-chart-namespace";

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

/** The frames a poll waits through the 1160 ms entrance, at 60 frames a second and some to spare. */
const ENTRANCE_FRAMES = 240;

/** Degrees per kWh on the default 270° sweep over 0–5 kWh. */
const PER_KWH = 270 / 5;

/** The needle's angle for a reading, from the sweep's start at −135°. */
function angleOf(kwh: number): number {
  return -135 + Math.min(5, Math.max(0, kwh)) * PER_KWH;
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

/** Restores the document's theme a contrast case stamped. */
let restoreTheme = (): void => undefined;

/** The session the page's media emulation goes through. */
type MediaCdp = {
  send: (method: "Emulation.setEmulatedMedia", params: { media: "print" | "screen" }) => Promise<void>;
};

/** Emulate the print or the screen media type for the page. */
async function emulateMedia(media: "print" | "screen"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session = cdp() as MediaCdp;
  await session.send("Emulation.setEmulatedMedia", { media });
}

function Gauge({
  value,
  locale = "nb-NO",
  intro,
  width = 320,
  endAngle = 135,
  children = (
    <>
      <GaugeChart.Track />
      <GaugeChart.Fill />
      <GaugeChart.Ruler />
      <GaugeChart.Needle />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
      </GaugeChart.Center>
    </>
  ),
}: {
  readonly value: number | null;
  readonly locale?: SupportedLocale;
  readonly intro?: "none";
  readonly width?: number;
  readonly endAngle?: number;
  readonly children?: ReactNode;
}) {
  return (
    <LocaleProvider locale={locale}>
      <div style={{ width }}>
        <GaugeChart.Root
          value={value}
          max={5}
          valueFormat={energy}
          data-intro={intro}
          endAngle={endAngle}
          aria-label="Forbruk denne timen">
          {children}
        </GaugeChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The needle's turn in degrees. */
function needle(host: HTMLElement): number {
  const hand = host.querySelector('[data-slot="gauge-chart-needle"] [data-part="hand"]');
  const turn = /rotate\((-?[\d.]+)\)/u.exec(hand?.getAttribute("transform") ?? "");
  return Number(turn?.[1] ?? Number.NaN);
}

/** How many of the fill's notches are lit. */
function litCount(host: HTMLElement): number {
  return host.querySelectorAll('[data-slot="gauge-chart-fill"] [data-slot="gauge-chart-notch"][data-lit]')
    .length;
}

/** How many ruler ticks the reading has passed. */
function passedTicks(host: HTMLElement): number {
  return host.querySelectorAll('[data-slot="gauge-chart-tick"][data-passed]').length;
}

/** The lit notches the spec's rule gives an offset: its share of 40, rounded, one at least. */
function litFor(offset: number): number {
  if (offset <= 0) return 0;
  return Math.min(40, Math.max(1, Math.round((40 * offset) / 270)));
}

/** The ticks, one each 0.2 kWh from 0, at or behind an offset above 0. */
function ticksFor(offset: number): number {
  if (offset <= 0) return 0;
  return Math.floor(offset / PER_KWH / 0.2 + 1e-6) + 1;
}

describe("the meter", () => {
  it.each([
    ["nb-NO", "3,9\u00a0kilowattimer"],
    ["en-US", "3.9\u00a0kilowatt-hours"],
  ] as const)(
    "names the dial as a meter over its domain with the value's spoken text in %s",
    async (locale, text) => {
      const { host } = renderThemed(<Gauge value={3.9} locale={locale} intro="none" />);
      const meter = page.getByRole("meter", { name: "Forbruk denne timen" });
      await expect.element(meter).toHaveAttribute("aria-valuemin", "0");
      await expect.element(meter).toHaveAttribute("aria-valuemax", "5");
      await expect.element(meter).toHaveAttribute("aria-valuenow", "3.9");
      await expect.element(meter).toHaveAttribute("aria-valuetext", text);
      // The drawing is presentational and nothing in the chart takes focus.
      expect(host.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
      for (const svg of host.querySelectorAll("svg")) {
        expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    }
  );

  it("takes its name from a headline through aria-labelledby", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <GaugeChart.Root value={2} max={5} valueFormat={energy} data-intro="none" aria-labelledby="peak">
          <GaugeChart.Headline id="peak">Effekttrinn</GaugeChart.Headline>
          <GaugeChart.Track />
        </GaugeChart.Root>
      </LocaleProvider>
    );
    await expect.element(page.getByRole("meter", { name: "Effekttrinn" })).toBeInTheDocument();
  });

  it("clamps the drawing and the meter's value past either end, and keeps the true value in its text", async () => {
    const { host, rerender } = renderThemed(<Gauge value={5.6} intro="none" />);
    await nextFrames(1);
    const figure = host.querySelector('[data-slot="gauge-chart"]');
    const meter = page.getByRole("meter");
    expect(figure?.hasAttribute("data-over-max")).toBe(true);
    await expect.element(meter).toHaveAttribute("aria-valuenow", "5");
    await expect.element(meter).toHaveAttribute("aria-valuetext", "5,6\u00a0kilowattimer");
    expect(centreText(host, "gauge-chart-center-value")).toBe("5,6\u00a0kWh");
    expect([needle(host), litCount(host)]).toEqual([135, 40]);
    rerender(<Gauge value={-0.4} intro="none" />);
    // The update sweeps down to the start, and rests there.
    await recordFrames(
      () => null,
      () => needle(host) === -135
    );
    expect(figure?.hasAttribute("data-under-min")).toBe(true);
    expect(figure?.hasAttribute("data-over-max")).toBe(false);
    await expect.element(meter).toHaveAttribute("aria-valuenow", "0");
    expect([needle(host), litCount(host), passedTicks(host)]).toEqual([-135, 0, 0]);
  });

  it("drops the meter and shows Empty while the value is null", async () => {
    const { host } = renderThemed(
      <Gauge value={null} intro="none">
        <GaugeChart.Track />
        <GaugeChart.Empty />
      </Gauge>
    );
    expect(host.querySelector('[role="meter"]')).toBeNull();
    await expect.element(page.getByText("Ingen data for perioden")).toBeVisible();
  });
});

describe("the dial at rest", () => {
  it("turns the needle, lights the notches and passes the ticks of 3.9 kWh", async () => {
    const { host } = renderThemed(<Gauge value={3.9} intro="none" />);
    await nextFrames(1);
    expect(needle(host)).toBeCloseTo(75.6, 6);
    expect(litCount(host)).toBe(31);
    expect(passedTicks(host)).toBe(20);
    expect(centreText(host, "gauge-chart-center-value")).toBe("3,9\u00a0kWh");
  });

  it("lights one notch for a value just above min", async () => {
    const { host } = renderThemed(<Gauge value={0.01} intro="none" />);
    await nextFrames(1);
    expect(litCount(host)).toBe(1);
  });

  it("draws every notch alike, evenly turned, with gaps that keep their pixels as the dial grows", async () => {
    // A 200 px figure draws a smaller dial than the 15rem a 320 px figure reaches.
    const { host, rerender } = renderThemed(<Gauge value={3.9} intro="none" width={200} />);
    await nextFrames(1);
    const notches = (): SVGPathElement[] => [
      ...host.querySelectorAll<SVGPathElement>(
        '[data-slot="gauge-chart-track"] [data-slot="gauge-chart-notch"]'
      ),
    ];
    expect(notches()).toHaveLength(40);
    expect(new Set(notches().map((notch) => notch.getAttribute("d"))).size).toBe(1);
    const turns = notches().map((notch) =>
      Number(/rotate\((-?[\d.]+)\)/u.exec(notch.getAttribute("transform") ?? "")?.[1])
    );
    const steps = turns.slice(1).map((turn, index) => turn - (turns[index] ?? 0));
    for (const step of steps) expect(step).toBeCloseTo(steps[0] ?? 0, 2);
    expect((turns[0] ?? 0) + 135).toBeCloseTo(135 - (turns.at(-1) ?? 0), 2);
    const small = gapAt(host, notches(), steps[0] ?? 0);
    // A gap lies between neighbours, narrower than a notch.
    expect(small.degrees).toBeGreaterThan(0);
    expect(small.degrees).toBeLessThan(small.notch);
    rerender(<Gauge value={3.9} intro="none" width={320} />);
    await nextFrames(2);
    const grownTurns = notches().map((notch) =>
      Number(/rotate\((-?[\d.]+)\)/u.exec(notch.getAttribute("transform") ?? "")?.[1])
    );
    const grown = gapAt(host, notches(), (grownTurns[1] ?? 0) - (grownTurns[0] ?? 0));
    // The gap is whole device pixels, so a larger dial keeps it as wide, to the path data's 3
    // decimals, and gives its notches the rest.
    expect(grown.pixels).toBeCloseTo(small.pixels, 0);
    expect(grown.notch).toBeGreaterThan(small.notch);
  });
});

/** A gap's angle, its notch's angle, and the gap in CSS pixels. */
type GapReading = { readonly degrees: number; readonly notch: number; readonly pixels: number };

/**
 * The gap after the first notch, which the browser's fill test finds at mid radius along the notch's
 * own frame: its angle, the notch's own angle, and the gap in CSS pixels.
 */
function gapAt(host: HTMLElement, notches: readonly SVGPathElement[], step: number): GapReading {
  const [first] = notches;
  if (first === undefined) throw new Error("no notch");
  const radius = 0.92;
  const inside = (degrees: number): boolean => {
    const a = (degrees * Math.PI) / 180;
    return first.isPointInFill(new DOMPoint(radius * Math.sin(a), -radius * Math.cos(a)));
  };
  let low = 0;
  let high = step;
  for (let round = 0; round < 40; round += 1) {
    const middle = (low + high) / 2;
    if (inside(middle)) low = middle;
    else high = middle;
  }
  const degrees = step - 2 * low;
  const svg = host.querySelector<SVGSVGElement>('[data-slot="gauge-chart-track"]');
  const pixelsPerUnit = (svg?.getBoundingClientRect().width ?? 0) / (svg?.viewBox.baseVal.width ?? 1);
  return { degrees, notch: 2 * low, pixels: ((degrees * Math.PI) / 180) * radius * pixelsPerUnit };
}

describe("the outside-in layout", () => {
  /** The track's scale the stylesheet computes, as a number. */
  function trackScale(host: HTMLElement): number {
    const frame = host.querySelector('[data-slot="chart-polar-frame"]');
    return frame === null ? Number.NaN : Number(getComputedStyle(frame).getPropertyValue("--_gauge-track"));
  }

  it("scales the track in by the room an outside ruler, a zone and a progress ring take at the rim", () => {
    const { host, rerender } = renderThemed(<Gauge value={3} intro="none" />);
    expect(trackScale(host)).toBeCloseTo(1, 6);
    rerender(
      <Gauge value={3} intro="none">
        <GaugeChart.Ruler variant="outside" />
        <GaugeChart.Zone from={4} to={5} color="chart-sentiment-negative" />
        <GaugeChart.ProgressRing />
        <GaugeChart.Track />
      </Gauge>
    );
    expect(trackScale(host)).toBeCloseTo(1 - 0.11 - 0.08 - 0.06, 6);
    rerender(
      <Gauge value={3} intro="none">
        <GaugeChart.ProgressRing />
        <GaugeChart.Track />
      </Gauge>
    );
    expect(trackScale(host)).toBeCloseTo(0.94, 6);
  });

  it("closes the layers inside the track in on the rim when no track draws", () => {
    const { host } = renderThemed(
      <Gauge value={3} intro="none">
        <GaugeChart.Ruler variant="outside" />
        <GaugeChart.Sector />
        <GaugeChart.Dots />
      </Gauge>
    );
    // The outside ruler's 0.11 at the rim, then out by the notches' depth: what lay at 0.84 of the
    // track's radius lies where its rim would.
    expect(trackScale(host)).toBeCloseTo((1 - 0.11) / 0.84, 5);
  });

  it("puts each zone's band over its own range, clamped to the domain", () => {
    const { host } = renderThemed(
      <Gauge value={3} intro="none">
        <GaugeChart.Zone from={4} to={9} color="chart-sentiment-negative" />
        <GaugeChart.Zone from={6} to={9} color="chart-seq-5" />
      </Gauge>
    );
    const bands = [...host.querySelectorAll<SVGPathElement>('[data-slot="gauge-chart-zone-band"]')];
    expect(bands).toHaveLength(1);
    const [band] = bands;
    const at = (degrees: number) => {
      const a = (degrees * Math.PI) / 180;
      return new DOMPoint(0.98 * Math.sin(a), -0.98 * Math.cos(a));
    };
    // 4 kWh sits at 81°, and the band runs from just past it to 135°, the sweep's end.
    expect([78, 84, 130, 140].map((degrees) => band?.isPointInFill(at(degrees)))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});

/** Every mark's reading of the value in one frame. */
type Frame = {
  readonly angle: number;
  readonly lit: number;
  readonly ticks: number;
  readonly dots: number;
  /** Whether the progress ring ends on the needle's angle, or null where its floor may show. */
  readonly ring: boolean | null;
  readonly sector: number;
};

/** The point at an angle and a radius, in a dial layer's own units. */
function dialPoint(degrees: number, radius: number): DOMPoint {
  const a = (degrees * Math.PI) / 180;
  return new DOMPoint(radius * Math.sin(a), -radius * Math.cos(a));
}

/**
 * Whether a band ends on an angle: the browser's fill test finds it half a degree before the angle
 * and not half a degree past it, at a radius across its band.
 */
function endsOn(path: SVGPathElement | null, degrees: number, radius: number): boolean {
  if (path === null) return false;
  return (
    path.isPointInFill(dialPoint(degrees - 0.5, radius)) &&
    !path.isPointInFill(dialPoint(degrees + 0.5, radius))
  );
}

/**
 * Radii across the straight part of the progress ring's end: its band runs from 0.975 of its
 * layer's radius to the rim, and its corners round within a quarter of the band's width.
 */
const RING_RADII = [0.982, 0.9875, 0.993] as const;

/** Each dot's offset along the sweep, read from where it sits. */
function dotOffsets(host: HTMLElement): number[] {
  return [...host.querySelectorAll<SVGCircleElement>('[data-slot="gauge-chart-dot"]')].map((dot) => {
    const angle = (Math.atan2(dot.cx.baseVal.value, -dot.cy.baseVal.value) * 180) / Math.PI;
    return angle + 135;
  });
}

/** Read every mark's value in one frame. */
function readFrame(host: HTMLElement): Frame {
  const angle = needle(host);
  const sector = host.querySelector<HTMLElement>('[data-slot="gauge-chart-sector"]');
  return {
    angle,
    lit: litCount(host),
    ticks: passedTicks(host),
    dots: host.querySelectorAll('[data-slot="gauge-chart-dot"][data-lit]').length,
    ring:
      angle + 135 > 1
        ? RING_RADII.every((radius) =>
            endsOn(
              host.querySelector<SVGPathElement>(
                '[data-slot="gauge-chart-progress-ring"] [data-part="value"]'
              ),
              angle,
              radius
            )
          )
        : null,
    sector: Number.parseFloat(sector?.style.getPropertyValue("--_sector-span") ?? ""),
  };
}

/** Every mark of the dial, so one frame reads them all. */
const ALL_MARKS = (
  <>
    <GaugeChart.ProgressRing />
    <GaugeChart.Sector />
    <GaugeChart.Dots />
    <GaugeChart.Track />
    <GaugeChart.Fill />
    <GaugeChart.Ruler />
    <GaugeChart.Needle />
  </>
);

/**
 * How far the needle's written angle and a dot's written centre, each rounded to 3 decimals, may
 * lie from the value the frame drew, in degrees.
 */
const WRITTEN = 0.1;

/** Expect a count to lie between what a rule gives just below and just above an offset. */
function expectAround(actual: number, rule: (offset: number) => number, offset: number): void {
  expect(actual).toBeGreaterThanOrEqual(rule(offset - WRITTEN));
  expect(actual).toBeLessThanOrEqual(rule(offset + WRITTEN));
}

/**
 * Each frame agrees with its own needle: the spec's one value per frame. A count may differ only
 * where the needle's offset sits within the rounding of a written attribute of a boundary.
 */
function expectOneValue(frames: readonly Frame[], offsets: readonly number[]): void {
  const dotsFor = (offset: number): number => (offset > 0 ? offsets.filter((at) => at <= offset).length : 0);
  for (const frame of frames) {
    const offset = frame.angle + 135;
    expectAround(frame.lit, litFor, offset);
    expectAround(frame.ticks, ticksFor, offset);
    expectAround(frame.dots, dotsFor, offset);
    expect(frame.sector).toBeCloseTo(offset, 2);
    // The ring keeps one device pixel of arc above 0, so it reads its offset once that floor passes.
    if (frame.ring !== null) expect(frame.ring).toBe(true);
  }
}

describe("motion", () => {
  it("sweeps in from min on first view, every mark reading the needle's value in every frame", async () => {
    const { host } = renderThemed(<Gauge value={3.9}>{ALL_MARKS}</Gauge>);
    const offsets = dotOffsets(host);
    const rest = angleOf(3.9);
    const frames = await recordFrames(
      () => readFrame(host),
      () => Math.abs(needle(host) - rest) < 1e-6
    );
    expect(frames[0]?.angle).toBe(-135);
    expect(frames.at(-1)?.angle).toBeCloseTo(rest, 6);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]?.angle).toBeGreaterThanOrEqual(frames[index - 1]?.angle ?? Number.NaN);
    }
    expectOneValue(frames, offsets);
  });

  it("bends the sweep when a value lands mid-sweep, from where the dial shows, and never passes it", () => {
    // The page's frames and clock are fake for this case, so the loop's own seam, the browser's
    // requestAnimationFrame and performance.now, runs frame by frame at 16 ms, however slow the
    // runner: 7 frames into the 480 ms update the needle is mid-sweep on every machine.
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      const { host, rerender } = renderThemed(
        <Gauge value={1} intro="none">
          {ALL_MARKS}
        </Gauge>
      );
      const offsets = dotOffsets(host);
      const step = (): Frame => {
        vi.advanceTimersByTime(16);
        return readFrame(host);
      };
      expect(needle(host)).toBeCloseTo(angleOf(1), 6);
      rerender(
        <Gauge value={4.5} intro="none">
          {ALL_MARKS}
        </Gauge>
      );
      const rising = Array.from({ length: 7 }, step);
      const shown = needle(host);
      expect(shown).toBeGreaterThan(angleOf(1));
      expect(shown).toBeLessThan(angleOf(4.5));
      const [, , , , , beforeLast = rising[0], last = rising[0]] = rising;
      expect(last?.angle).toBeGreaterThan(beforeLast?.angle ?? Number.NaN);
      rerender(
        <Gauge value={0.5} intro="none">
          {ALL_MARKS}
        </Gauge>
      );
      // The commit that brings 0.5 kWh leaves the dial where it showed: no jump.
      expect(needle(host)).toBe(shown);
      // The needle keeps the direction it rose in for the next frame, where a plain move turns at
      // once, and then settles onto 0.5 kWh without passing it, within twice the update's 480 ms,
      // the longest a turn the spring softens to keep its way for a frame takes.
      const frames = Array.from({ length: 61 }, step);
      expect(frames[0]?.angle).toBeGreaterThan(shown);
      expect(frames.at(-1)?.angle).toBe(angleOf(0.5));
      for (const frame of frames) expect(frame.angle).toBeGreaterThanOrEqual(angleOf(0.5));
      expectOneValue([...rising, ...frames], offsets);
    } finally {
      vi.useRealTimers();
    }
  });

  it("draws the reading at rest at once under reduced motion", async () => {
    await emulateReducedMotion("reduce");
    const { host } = renderThemed(<Gauge value={3.9}>{ALL_MARKS}</Gauge>);
    await nextFrames(1);
    const figure = host.querySelector('[data-slot="gauge-chart"]');
    expect(figure?.hasAttribute("data-drawn")).toBe(true);
    const frame = readFrame(host);
    expect(frame.angle).toBeCloseTo(angleOf(3.9), 6);
    expectOneValue([frame], dotOffsets(host));
  });
});

describe("the centre", () => {
  it("prints a price's number large and its unit small, breaking the unit only before its VAT basis", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <GaugeChart.Root
          value={142.3}
          max={300}
          valueFormat={{ preset: "unit-price", currency: "NOK", minor: true, vat: "included" }}
          data-intro="none"
          aria-label="Spotpris">
          <GaugeChart.Center>
            <GaugeChart.CenterValue />
          </GaugeChart.Center>
        </GaugeChart.Root>
      </LocaleProvider>
    );
    await nextFrames(1);
    const value = host.querySelector('[data-slot="gauge-chart-center-value"]');
    expect(value?.querySelector('[data-part="unit"]')?.textContent).toBe("øre/kWh inkl.\u00a0mva");
    expect(centreText(host, "gauge-chart-center-value")).toBe("142,3\u00a0øre/kWh inkl.\u00a0mva");
  });
});

describe("a sweep that changes", () => {
  /** Every mark that turns a share into an angle, the solid band among them. */
  const SWEEP_MARKS = (
    <>
      <GaugeChart.ProgressRing />
      <GaugeChart.Sector />
      <GaugeChart.Dots />
      <GaugeChart.Track variant="solid" />
      <GaugeChart.Fill />
      <GaugeChart.Needle />
    </>
  );

  /**
   * Where the marks stand on a sweep from −135° to `end`: the needle's angle, its share of the
   * sweep, whether it and the sector lie inside the sweep, and whether the fill, the ring and the
   * sector end on the needle's angle.
   */
  function marksOn(host: HTMLElement, end: number) {
    const angle = needle(host);
    const sector = host.querySelector<HTMLElement>('[data-slot="gauge-chart-sector"]');
    const sectorEnd = -135 + Number.parseFloat(sector?.style.getPropertyValue("--_sector-span") ?? "NaN");
    const fill = host.querySelector<SVGPathElement>('[data-slot="gauge-chart-fill"] [data-part="solid"]');
    const ring = host.querySelector<SVGPathElement>(
      '[data-slot="gauge-chart-progress-ring"] [data-part="value"]'
    );
    // A share past a degree of the sweep, so the band's one-pixel floor is not what draws.
    const drawn = angle + 135 > 1;
    return {
      angle,
      share: (angle + 135) / (end + 135),
      inside: angle >= -135 - 1e-6 && angle <= end + 1e-6 && sectorEnd <= end + 1e-3,
      agree:
        Math.abs(sectorEnd - angle) < 1e-3 &&
        (!drawn ||
          ([0.93, 0.95, 0.97].every((radius) => endsOn(fill, angle, radius)) &&
            RING_RADII.every((radius) => endsOn(ring, angle, radius)))),
    };
  }

  /** Run `count` frames of 16 ms on the faked clock, reading the marks on each. */
  function framesOn(host: HTMLElement, end: number, count: number) {
    return Array.from({ length: count }, () => {
      vi.advanceTimersByTime(16);
      return marksOn(host, end);
    });
  }

  it.each([
    ["4.5 of 5 kWh, whose 270° sweep shrinks to 180°", 4.5, 45, 27],
    ["5 of 5 kWh, whose 270° sweep shrinks to 135°", 5, 0, 0],
  ])(
    "snaps every mark inside the new sweep, at the same share and agreeing in every frame: %s",
    (_, value, end, expected) => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
      try {
        const { host, rerender } = renderThemed(
          <Gauge value={value} intro="none">
            {SWEEP_MARKS}
          </Gauge>
        );
        rerender(
          <Gauge value={value} intro="none" endAngle={end}>
            {SWEEP_MARKS}
          </Gauge>
        );
        for (const frame of [marksOn(host, end), ...framesOn(host, end, 40)]) {
          expect(frame.angle).toBeCloseTo(expected, 6);
          expect(frame.inside).toBe(true);
          expect(frame.agree).toBe(true);
        }
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("keeps the share continuous when the sweep changes mid-sweep, and carries on to rest", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      const { host, rerender } = renderThemed(
        <Gauge value={1} intro="none">
          {SWEEP_MARKS}
        </Gauge>
      );
      rerender(
        <Gauge value={4.5} intro="none">
          {SWEEP_MARKS}
        </Gauge>
      );
      const rising = framesOn(host, 135, 5);
      const share = rising.at(-1)?.share ?? Number.NaN;
      // Mid-sweep: past 1 kWh's 0.2 of the domain, short of 4.5 kWh's 0.9.
      expect(share).toBeGreaterThan(0.2);
      expect(share).toBeLessThan(0.9);
      rerender(
        <Gauge value={4.5} intro="none" endAngle={45}>
          {SWEEP_MARKS}
        </Gauge>
      );
      // The commit draws the same share on the new sweep: the needle moves, the reading does not.
      const atChange = marksOn(host, 45);
      expect(atChange.share).toBeCloseTo(share, 4);
      expect(atChange.agree).toBe(true);
      const after = framesOn(host, 45, 61);
      // The sweep carries on up at its own pace, never back, and rests on 0.9 of the new sweep.
      expect(after[0]?.share).toBeGreaterThan(share);
      for (const [index, frame] of after.entries()) {
        expect(frame.inside).toBe(true);
        expect(frame.agree).toBe(true);
        expect(frame.share).toBeGreaterThanOrEqual((after[index - 1] ?? atChange).share - 1e-9);
      }
      expect(after.at(-1)?.angle).toBeCloseTo(-135 + 0.9 * 180, 6);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("one value, one angle", () => {
  it("ends the solid fill, the progress ring and the needle on the reading's angle, alone or together", async () => {
    const { host } = renderThemed(
      <Gauge value={3.9} intro="none">
        <GaugeChart.ProgressRing />
        <GaugeChart.Track variant="solid" />
        <GaugeChart.Fill />
        <GaugeChart.Needle />
      </Gauge>
    );
    await nextFrames(1);
    const angle = angleOf(3.9);
    expect(needle(host)).toBeCloseTo(angle, 6);
    const fill = host.querySelector<SVGPathElement>('[data-slot="gauge-chart-fill"] [data-part="solid"]');
    // Across the band from 0.9 to the rim, inside the quarter of its width its corners round in:
    // the end is a radial line on the angle, not a round cap that ends there on one radius only.
    for (const radius of [0.93, 0.95, 0.97]) expect(endsOn(fill, angle, radius)).toBe(true);
    const ring = host.querySelector<SVGPathElement>(
      '[data-slot="gauge-chart-progress-ring"] [data-part="value"]'
    );
    for (const radius of RING_RADII) expect(endsOn(ring, angle, radius)).toBe(true);
  });
});

describe("the layers without a track", () => {
  it("lets a progress ring alone carry the reading", async () => {
    const { host } = renderThemed(
      <Gauge value={3.9} intro="none">
        <GaugeChart.ProgressRing />
      </Gauge>
    );
    await nextFrames(1);
    const ring = host.querySelector<SVGPathElement>(
      '[data-slot="gauge-chart-progress-ring"] [data-part="value"]'
    );
    for (const radius of RING_RADII) expect(endsOn(ring, angleOf(3.9), radius)).toBe(true);
  });
});

describe("the cell's life", () => {
  it("plays the entrance once an empty gauge off screen gets a reading and scrolls into view", async () => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    document.body.prepend(spacer);
    try {
      const { host, rerender } = renderThemed(<Gauge value={null} />);
      rerender(<Gauge value={3.9} />);
      await nextFrames(2);
      const figure = host.querySelector('[data-slot="gauge-chart"]');
      expect(figure?.hasAttribute("data-drawn")).toBe(false);
      host.scrollIntoView();
      await pollFrames(() => figure?.hasAttribute("data-drawn") ?? false, true, ENTRANCE_FRAMES);
      await pollFrames(() => needle(host), angleOf(3.9), ENTRANCE_FRAMES);
    } finally {
      spacer.remove();
      window.scrollTo(0, 0);
    }
  });

  it("measures the cell a reading arrives in, as a gauge that had its reading from the start does", async () => {
    const notch = (host: HTMLElement): string | null =>
      host
        .querySelector('[data-slot="gauge-chart-track"] [data-slot="gauge-chart-notch"]')
        ?.getAttribute("d") ?? null;
    const late = renderThemed(<Gauge value={null} intro="none" width={200} />);
    late.rerender(<Gauge value={3.9} intro="none" width={200} />);
    // The dial grows once the reading is in, which only an observer on the live cell sees.
    late.rerender(<Gauge value={3.9} intro="none" width={320} />);
    const early = renderThemed(<Gauge value={3.9} intro="none" width={320} />);
    await pollFrames(() => notch(late.host), notch(early.host));
  });

  it("snaps to the reading React Activity showed it with, as every polar mark does", async () => {
    const shown = (mode: "visible" | "hidden", value: number) => (
      <Activity mode={mode}>
        <Gauge value={value} intro="none" />
      </Activity>
    );
    const { host, rerender } = renderThemed(shown("visible", 1));
    await nextFrames(1);
    expect(needle(host)).toBeCloseTo(angleOf(1), 6);
    rerender(shown("hidden", 4));
    rerender(shown("visible", 4));
    // The show's commit draws the new reading at rest, with no sweep from a state hidden away.
    expect(needle(host)).toBeCloseTo(angleOf(4), 6);
  });
});

describe("print", () => {
  it("runs no entrance or roll animation on the page it prints", async () => {
    await emulateMedia("print");
    try {
      const { host } = renderThemed(<Gauge value={3.9} />);
      // A print fires beforeprint, which draws every mark at rest; the media emulation fires none.
      window.dispatchEvent(new Event("beforeprint"));
      await nextFrames(1);
      const dial = host.querySelector('[data-slot="gauge-chart-track"] [data-part="gauge-dial"]');
      const reel = host.querySelector('[data-slot="gauge-chart-center"] [data-part="reel"]');
      expect(dial === null ? null : getComputedStyle(dial).animationName).toBe("none");
      expect(reel === null ? null : getComputedStyle(reel).transitionDuration).toBe("0s");
      expect(needle(host)).toBeCloseTo(angleOf(3.9), 6);
    } finally {
      await emulateMedia("screen");
    }
  });
});

describe("contrast", () => {
  afterEach(() => {
    restoreTheme();
  });

  it.each(["light", "dark"] as const)(
    "keeps the default fill at 3:1 on the page and on a card, and the unlit track discernible, in %s",
    async (scheme) => {
      restoreTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasPrivate, scheme);
      const { host } = render(
        <>
          <div data-surface="background" style={{ background: "var(--background)" }} />
          <div data-surface="card" style={{ background: "var(--card)" }} />
          <Gauge value={3.9} intro="none">
            <GaugeChart.Track />
            <GaugeChart.Fill />
          </Gauge>
          <Gauge value={3.9} intro="none">
            <GaugeChart.Track variant="solid" />
            <GaugeChart.Fill />
          </Gauge>
        </>
      );
      await nextFrames(1);
      const fill = getComputedStyle(
        host.querySelector('[data-slot="gauge-chart-fill"] [data-slot="gauge-chart-notch"][data-lit]') ??
          document.body
      ).fill;
      const tracks = [
        host.querySelector('[data-slot="gauge-chart-track"] [data-slot="gauge-chart-notch"]'),
        host.querySelector('[data-slot="gauge-chart-track"][data-variant="solid"] [data-part="solid"]'),
      ].map((mark) => (mark === null ? "transparent" : getComputedStyle(mark).fill));
      for (const surface of host.querySelectorAll("[data-surface]")) {
        const background = getComputedStyle(surface).backgroundColor;
        expect(computedContrast(fill, background)).toBeGreaterThanOrEqual(3);
        for (const track of tracks) {
          expect(computedContrast(track, background)).toBeGreaterThanOrEqual(1.5);
        }
      }
    }
  );
});
