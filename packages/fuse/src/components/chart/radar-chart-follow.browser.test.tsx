// The radar's angle follower under a moving pointer, in Chromium with motion on. Units under test:
// RadarChart.ActiveDot and the Grid's hand on the Root's follower (MOTION-REVIEW Fix R1, R1.9).
// Oracles, worked by hand: seven spokes 360/7° apart on a [0, 5] domain, the vertex of value v on
// spoke i at radius v/5 and angle 360i/7; spoke 2 is missing, so the polygon's edge there runs
// straight from spoke 1's vertex to spoke 3's. The dot must lie on one of these straight edges in
// every frame, mapped to the screen by the layer's own CTM, and the hand's computed rotation must
// match the dot's angle about the dial's rendered centre.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { clientPoint, dialPoint, hoverAt } from "../../../test/chart/pie";
import { radarLayer } from "../../../test/chart/radar";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";

const VALUES = [5, 4, null, 3, 5, 2, 4] as const;

function Spokes(): ReactElement {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadarChart.Root
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

describe("the radar's active dot on the Root's follower (R1.9)", () => {
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
      const vertices = VALUES.flatMap((value, index) => {
        if (value === null) return [];
        const point = dialPoint((360 * index) / 7, value / 5);
        const [x, y] = clientPoint(layer, point.x, point.y);
        return [{ x, y }];
      });
      const edges = vertices.map(
        (vertex, index) => [vertex, vertices[(index + 1) % vertices.length] ?? vertex] as const
      );
      const centre = clientPoint(layer, 0, 0);
      const spokeAt = (spoke: number) => {
        const point = dialPoint((360 * spoke) / 7 + 2, 0.7);
        return clientPoint(layer, point.x, point.y);
      };
      await hoverAt(...spokeAt(from));
      for (let wait = 0; wait < 20; wait += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
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
      const off: number[] = [];
      const turn: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 700) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!group.hasAttribute("data-value")) continue;
        const box = dot.getBoundingClientRect();
        const point = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        off.push(Math.min(...edges.map(([a, b]) => toSegment(point, a, b))));
        const angle = (Math.atan2(point.x - centre[0], centre[1] - point.y) * 180) / Math.PI;
        turn.push(Math.abs(apart(Number.parseFloat(getComputedStyle(hand).rotate), angle)));
      }
      expect(off.length).toBeGreaterThan(20);
      expect(Math.max(...off)).toBeLessThanOrEqual(0.5);
      expect(Math.max(...turn)).toBeLessThanOrEqual(0.5);
    }
  );
});
