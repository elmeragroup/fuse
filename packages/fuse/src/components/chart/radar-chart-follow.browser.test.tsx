// The radar's angle follower under a moving pointer, in Chromium with motion on. Units under test:
// RadarChart.ActiveDot and the Grid's hand on the Root's follower. Oracles, worked by hand: seven spokes 360/7° apart on a [0, 5] domain, the
// vertex of value v on spoke i at radius v/5 and angle 360i/7. Spoke 2 is missing, so the Line
// draws no edge from spoke 1 to 2 or from 2 to 3, and the dot shows on the drawn edges only: in
// every frame it shows, it lies on one of them, mapped to the screen by the layer's own CTM, and the
// hand's computed rotation matches the dot's angle about the dial's rendered centre. Between
// spoke 1, at 51.43°, and spoke 3, at 154.29°, the dot shows nothing and fades out where it left.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { clientPoint, dialPoint, hoverAt } from "../../../test/chart/pie";
import { radarLayer } from "../../../test/chart/radar";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";

const VALUES = [5, 4, null, 3, 5, 2, 4] as const;

function Spokes({ size }: { readonly size?: string }): ReactElement {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: size === undefined ? 320 : 720 }}>
        <RadarChart.Root
          style={size === undefined ? undefined : { "--chart-polar-size": size }}
          data={VALUES.map((value, index) => ({ spoke: `s${String(index)}`, a: value }))}
          config={{ a: { label: "NO1", color: "chart-1" } }}
          nameKey="spoke"
          max={5}
          data-intro="none"
          aria-label="Radar">
          <RadarChart.Grid />
          <RadarChart.Line dataKey="a" />
          <RadarChart.ActiveDot dataKey="a" />
        </RadarChart.Root>
      </div>
    </LocaleProvider>
  );
}

type Point = { readonly x: number; readonly y: number };

/** The distance from a point to a segment. */
function toSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** The signed difference of two angles, folded into [−180, 180). */
function apart(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

describe("the radar's active dot on the Root's follower", () => {
  it.each([
    [0, 1],
    [0, 3],
    [1, 3],
    [4, 6],
  ])(
    "keeps the dot on the polygon's straight edges and the hand on the dot from spoke %s to %s",
    async (from, to) => {
      const { host } = renderThemed(<Spokes />);
      const layer = radarLayer(host, "radar-chart-active-dot");
      // DOM audit: the dot's own path and the hand are aria-hidden plot output, read by their parts.
      const dot = layer.querySelector<SVGPathElement>('path[data-part="dots"]');
      const group = layer.querySelector("[data-follow]");
      const hand = host.querySelector<SVGLineElement>('[data-slot="radar-chart-spoke"][data-part="hand"]');
      if (dot === null || group === null || hand === null) throw new Error("no parts");
      const vertices = VALUES.map((value, index) => {
        if (value === null) return null;
        const point = dialPoint((360 * index) / 7, value / 5);
        const [x, y] = clientPoint(layer, point.x, point.y);
        return { x, y };
      });
      // The drawn edges, between neighbouring spokes that both hold a reading.
      const edges = vertices.flatMap((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length] ?? null;
        return vertex === null || next === null ? [] : [[vertex, next] as const];
      });
      const centre = clientPoint(layer, 0, 0);
      const spokeAt = (spoke: number) => {
        const point = dialPoint((360 * spoke) / 7 + 2, 0.7);
        return clientPoint(layer, point.x, point.y);
      };
      await hoverAt(...spokeAt(from));
      await nextFrames(20);
      page
        .getByRole("listbox")
        .element()
        .dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: spokeAt(to)[0],
            clientY: spokeAt(to)[1],
            pointerType: "mouse",
          })
        );
      const frames = await recordFrames(
        () => {
          if (!group.hasAttribute("data-value")) return null;
          const box = dot.getBoundingClientRect();
          const point = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          const angle = (Math.atan2(point.x - centre[0], centre[1] - point.y) * 180) / Math.PI;
          return {
            off: Math.min(...edges.map(([a, b]) => toSegment(point, a, b))),
            turn: Math.abs(apart(Number.parseFloat(getComputedStyle(hand).rotate), angle)),
          };
        },
        () => false,
        700
      );
      const shown = frames.filter((frame) => frame !== null);
      const off = shown.map((frame) => frame.off);
      const turn = shown.map((frame) => frame.turn);
      expect(off.length).toBeGreaterThan(20);
      expect(Math.max(...off)).toBeLessThanOrEqual(0.5);
      expect(Math.max(...turn)).toBeLessThanOrEqual(0.5);
    }
  );

  it("fades the dot out over the break at spoke 2 and back in past it", async () => {
    const { host } = renderThemed(<Spokes />);
    const layer = radarLayer(host, "radar-chart-active-dot");
    // DOM audit: the dot's own path and the hand are aria-hidden plot output, read by their parts.
    const dot = layer.querySelector<SVGPathElement>('path[data-part="dots"]');
    const group = layer.querySelector<SVGGElement>("[data-follow]");
    const hand = host.querySelector<SVGLineElement>('[data-slot="radar-chart-spoke"][data-part="hand"]');
    if (dot === null || group === null || hand === null) throw new Error("no parts");
    const spokeAt = (spoke: number) => {
      const point = dialPoint((360 * spoke) / 7 + 2, 0.7);
      return clientPoint(layer, point.x, point.y);
    };
    await hoverAt(...spokeAt(0));
    await nextFrames(20);
    page
      .getByRole("listbox")
      .element()
      .dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: spokeAt(3)[0],
          clientY: spokeAt(3)[1],
          pointerType: "mouse",
        })
      );
    const spoke1 = 360 / 7;
    const spoke3 = (3 * 360) / 7;
    const frames = await recordFrames(
      () => ({
        angle: ((Number.parseFloat(getComputedStyle(hand).rotate) % 360) + 360) % 360,
        shows: group.hasAttribute("data-value"),
        d: dot.getAttribute("d"),
        opacity: Number.parseFloat(getComputedStyle(group).opacity),
      }),
      () => false,
      700
    );
    const breaking = frames.filter(({ angle }) => angle > spoke1 + 0.5 && angle < spoke3 - 0.5);
    const inBreak = breaking.map(({ shows }) => shows);
    // The dot stays where it left the drawn edge while it fades.
    const leftAt = breaking[0]?.d ?? null;
    for (const { d } of breaking) expect(d).toBe(leftAt);
    const lowest = Math.min(1, ...breaking.map(({ opacity }) => opacity));
    // Short of spoke 1, or past spoke 3 as the spring overshoots it, the dot rides a drawn edge.
    const shownOutside = frames
      .filter(({ angle }) => angle <= spoke1 - 0.5 || angle >= spoke3 + 0.05)
      .map(({ shows }) => shows);
    expect(inBreak.length).toBeGreaterThan(3);
    expect(inBreak.every((shows) => !shows)).toBe(true);
    expect(lowest).toBeLessThan(0.5);
    expect(shownOutside.length).toBeGreaterThan(3);
    expect(shownOutside.every(Boolean)).toBe(true);
    // At rest on spoke 3 the dot shows again, faded back in.
    await expect.poll(() => getComputedStyle(group).opacity).toBe("1");
  });

  // Oracle: the 300 ms ceiling on UI motion. A pointer that rests on spoke 0 and
  // then jumps to spoke 3, 154.29° round, moves at a resting pace, which alone would carry the hand
  // 8 px of rim a frame: 4.6° on a 12.5rem dial of radius 100 px, so 34 frames, and 2.3° on a 25rem
  // one, so 67. Floored by the step's own span over 10 frames, as a step wider than 90°, on the
  // fastest follow spring, the hand lands within 1° of spoke 3 within 300 ms at both.
  it.each(["12.5rem", "25rem"])("lands a 154° step within 300 ms on a %s dial", async (size) => {
    const { host } = renderThemed(<Spokes size={size} />);
    const layer = radarLayer(host, "radar-chart-active-dot");
    // DOM audit: the hand is aria-hidden plot output, read by its part.
    const hand = host.querySelector<SVGLineElement>('[data-slot="radar-chart-spoke"][data-part="hand"]');
    if (hand === null) throw new Error("no hand");
    const spokeAt = (spoke: number) => {
      const point = dialPoint((360 * spoke) / 7, 0.7);
      return clientPoint(layer, point.x, point.y);
    };
    await hoverAt(...spokeAt(0));
    await nextFrames(30);
    const target = (3 * 360) / 7;
    const start = performance.now();
    page
      .getByRole("listbox")
      .element()
      .dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: spokeAt(3)[0],
          clientY: spokeAt(3)[1],
          pointerType: "mouse",
        })
      );
    const frames = await recordFrames(
      () => ({
        off: Math.abs(apart(Number.parseFloat(getComputedStyle(hand).rotate), target)),
        at: performance.now() - start,
      }),
      () => performance.now() - start >= 1500,
      Number.POSITIVE_INFINITY
    );
    let landed: number | null = null;
    for (const { off, at } of frames) {
      if (off <= 1) landed ??= at;
      else landed = null;
    }
    expect(landed).not.toBeNull();
    expect(landed ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(300);
  });
});
