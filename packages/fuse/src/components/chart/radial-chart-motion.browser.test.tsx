// RadialChart's motion against SPEC's Motion table, in Chromium with motion on. Units under test:
// RadialChart.Bar on its Root's loop, and the Track's scale-out and the rings' hover scale in the
// stylesheet. Oracles, written by hand from the Motion table: ring i's value sweeps from 0 at
// 160 + i·100 ms over 1000 ms; each track scales out on a 100/15 spring, i·80 ms apart, whose
// damping ratio 15 / (2·√100) = 0.75 settles within 0.1 % before its envelope
// e^(−7.5t) / √(1 − 0.75²) does, at ln 1512 / 7.5 ≈ 976 ms; an update morphs each ring over 480 ms
// (Q5); and the hover scales on 400/25, whose envelope at ζ = 0.625, ω = 20 settles by
// ln 1281 / 12.5 ≈ 573 ms. Time is read from each frame's own timestamp.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { polarFigure, rings } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadialChart } from "./radial-chart-namespace";

/** Half a frame and more either side of a scheduled time, for the frame that straddles it. */
const SLACK = 34;

/** How closely an angle reads back from a dash rounded to 4 decimals, in degrees. */
const ROUNDED = 0.01;

/** How far a ring's dash reaches along its sweep, in degrees, its round caps included. */
function extent(path: SVGPathElement | undefined): number {
  const length = Number((path?.getAttribute("stroke-dasharray") ?? "").split(" ")[0]);
  const start = -Number(path?.getAttribute("stroke-dashoffset") ?? 0);
  return start + length + (path?.getAttribute("stroke-linecap") === "round" ? start : 0);
}

/** Every frame's time since a start and each ring's extent, until `until` ms past the start. */
async function record(
  host: HTMLElement,
  start: () => number | null,
  until: number
): Promise<{ readonly t: number; readonly extents: readonly number[] }[]> {
  const frames: { readonly t: number; readonly extents: readonly number[] }[] = [];
  for (;;) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const from = start();
    if (from === null) continue;
    frames.push({ t: now - from, extents: rings(host).map((path) => extent(path)) });
    if (now - from > until) return frames;
  }
}

function Chart({ kwh, intro }: { readonly kwh: readonly number[]; readonly intro?: "none" }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadialChart.Root
          data={["a", "b", "c"].map((ring, index) => ({ ring, kwh: kwh[index] ?? 0 }))}
          config={{
            a: { label: "A", color: "chart-1" },
            b: { label: "B", color: "chart-2" },
            c: { label: "C", color: "chart-3" },
          }}
          nameKey="ring"
          valueKey="kwh"
          max={100}
          data-intro={intro}
          aria-label="Ringer">
          <RadialChart.Track />
          <RadialChart.Bar />
        </RadialChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("the rings' motion (SPEC's Motion table)", () => {
  it("sweeps ring i's value from 0 at 160 + i·100 ms over 1000 ms, and scales each track out i·80 ms apart", async () => {
    const { host } = renderThemed(<Chart kwh={[50, 75, 25]} />);
    const figure = polarFigure(host);
    let from: number | null = null;
    let grows: readonly { readonly delay: number; readonly duration: number }[] = [];
    const frames = await record(
      host,
      () => {
        if (from === null && figure.hasAttribute("data-drawn")) {
          from = performance.now();
          // DOM audit: the scale-out is a CSS animation on each track, read from its own animations.
          grows = [...host.querySelectorAll('[data-slot="pie-chart-track"]')].map((track) => {
            const timing = track.getAnimations()[0]?.effect?.getComputedTiming();
            return { delay: Number(timing?.delay), duration: Number(timing?.duration) };
          });
        }
        return from;
      },
      1600
    );
    expect(grows.map(({ delay }) => delay)).toEqual([0, 80, 160]);
    for (const { duration } of grows) {
      expect(duration).toBeGreaterThanOrEqual(600);
      expect(duration).toBeLessThanOrEqual(976);
    }
    [180, 270, 90].forEach((angle, index) => {
      const begins = 160 + 100 * index;
      const ends = begins + 1000;
      const seen = frames.map((frame) => ({ t: frame.t, angle: frame.extents[index] ?? 0 }));
      expect(seen.filter(({ t }) => t < begins - SLACK).every((frame) => frame.angle === 0)).toBe(true);
      expect(
        seen.filter(({ t }) => t > ends + SLACK).every((frame) => Math.abs(frame.angle - angle) < ROUNDED)
      ).toBe(true);
      expect(seen.some((frame) => frame.angle > 1 && frame.angle < angle - 1)).toBe(true);
      seen.forEach((frame, at) => {
        expect(frame.angle).toBeGreaterThanOrEqual((seen[at - 1]?.angle ?? 0) - ROUNDED);
      });
    });
  });

  it("morphs each ring to new data over 480 ms, between its old angle and its new (Q5)", async () => {
    const { host, rerender } = renderThemed(<Chart kwh={[50, 75, 25]} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Chart kwh={[25, 100, 50]} intro="none" />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    const moves = [
      [180, 90],
      [270, 360],
      [90, 180],
    ];
    moves.forEach(([before = 0, after = 0], index) => {
      const low = Math.min(before, after);
      const high = Math.max(before, after);
      const seen = frames.map((frame) => frame.extents[index] ?? 0);
      expect(seen.every((angle) => angle >= low - ROUNDED && angle <= high + ROUNDED)).toBe(true);
      expect(seen.some((angle) => angle > low + 1 && angle < high - 1)).toBe(true);
      const settled = frames.filter(({ t }) => t > 480 + SLACK);
      expect(settled.every((frame) => Math.abs((frame.extents[index] ?? 0) - after) < ROUNDED)).toBe(true);
    });
  });

  it("scales the active ring on the 400/25 spring", async () => {
    const { host } = renderThemed(<Chart kwh={[50, 75, 25]} intro="none" />);
    await userEvent.tab();
    // DOM audit: the hover scale is a CSS transition on the ring's group, read from its own animations.
    const group = host.querySelector("[data-ring]:not([data-ring-track])");
    const scale = group
      ?.getAnimations()
      .find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "scale");
    const duration = Number(scale?.effect?.getComputedTiming().duration);
    expect(duration).toBeGreaterThanOrEqual(400);
    expect(duration).toBeLessThanOrEqual(573);
  });
});
