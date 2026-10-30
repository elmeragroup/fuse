// Unit under test: Root's label registry driven by Root's animation loop, as two value reference
// lines and a bar move through random data updates, resizes and order swaps, while the lines'
// labels register, unregister and change size at random points, and two slot references' labels
// arrive, depart and move into and out of the plot. Each commit runs what a reference
// runs: its label's registration, its size, the plot's bounds, then its guide's placement. Oracles:
// placeLabels applied to the guides the loop drew in that frame, for the labels registered then, in
// the order they registered, under the row of slot labels whenever a labelled slot guide draws in
// the plot in that frame, which the registry must reproduce exactly; and the bar at the first
// line's value, whose top the loop must draw on the same number as that line in every frame.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createChartLabels } from "./chart-labels";
import type { LabelNode } from "./chart-labels";
import { SAME_PLOT, createChartMotion } from "./chart-motion";
import type { MarkValues, Placement } from "./chart-motion";
import { placeLabels } from "./layout/reference-labels";
import type { LabelSize } from "./layout/reference-labels";

/** A label node that keeps the offset the registry writes. */
function node(): LabelNode & { bottom: () => number | null } {
  const props = new Map<string, string>();
  return {
    style: {
      setProperty: (name, value) => props.set(name, value),
      removeProperty: (name) => props.delete(name),
    },
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    bottom: () => {
      const value = props.get("--chart-label-bottom");
      return value === undefined ? null : Number.parseFloat(value);
    },
  };
}

/** What a reference holds about its label in the model of its commits. */
type LineLabel = {
  /** Whether the reference has a label. */
  shown: boolean;
  /** The label's size, as its text sets it. */
  size: LabelSize;
  /** The order the label registered in, or -1 while it is not registered. */
  order: number;
  /** Unregisters the label. */
  remove: () => void;
};

const step = fc.oneof(
  fc.record({
    kind: fc.constant("update" as const),
    // A value may sit on the domain's maximum, the plot's top, where the row of slot labels holds
    // a label down.
    first: fc.oneof(fc.constant("top" as const), fc.integer({ min: 0, max: 24 })),
    second: fc.oneof(fc.constant("top" as const), fc.integer({ min: 0, max: 24 })),
    max: fc.constantFrom(8, 12, 20),
  }),
  fc.record({ kind: fc.constant("swap" as const) }),
  fc.record({ kind: fc.constant("resize" as const), height: fc.constantFrom(100, 200, 400) }),
  fc.record({ kind: fc.constant("label" as const), line: fc.constantFrom(0, 1) }),
  fc.record({
    kind: fc.constant("text" as const),
    line: fc.constantFrom(0, 1),
    height: fc.double({ min: 10, max: 32, noNaN: true }),
  }),
  fc.record({ kind: fc.constant("slot-label" as const), slot: fc.constantFrom(0, 1) }),
  fc.record({
    kind: fc.constant("slot-move" as const),
    slot: fc.constantFrom(0, 1),
    // Half the moves carry the guide out of the 400 px plot, to either side.
    at: fc.oneof(
      fc.integer({ min: 0, max: 400 }),
      fc.integer({ min: -80, max: -1 }),
      fc.integer({ min: 401, max: 480 })
    ),
  }),
  fc.record({ kind: fc.constant("wait" as const), ms: fc.integer({ min: 1, max: 600 }) })
);

describe("labels placed from drawn guides", () => {
  it("writes placeLabels of the drawn guides of the registered labels in every frame, and draws the bar's top with its line", () => {
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 20 }), (steps) => {
        const queued: ((time: number) => void)[] = [];
        let now = 0;
        const motion = createChartMotion({
          now: () => now,
          requestFrame: (callback) => queued.push(callback),
          cancelFrame: () => undefined,
        });
        const labels = createChartLabels();
        const nodes = [node(), node()];
        const keys = ["line-0", "line-1"];
        // What each line's reference holds about its label.
        const lines = [0, 1].map((): LineLabel => ({
          shown: true,
          size: { height: 16, inset: 20 },
          order: -1,
          remove: () => undefined,
        }));
        let mounted = 0;
        let bounds = { end: 200, pixel: 1 };
        // Two slot references on a 400 px wide plot: whether each has a label, where its guide
        // heads, where it draws now, and the function that unregisters its label.
        const slots = [0, 1].map((index) => ({
          labelled: index === 0,
          target: 100 + index * 200,
          drawn: 100 + index * 200,
          remove: (): void => undefined,
          registered: false,
        }));
        const drawSlot =
          (index: number) =>
          ([at = 0]: MarkValues): void => {
            const slot = slots[index];
            if (slot === undefined) return;
            slot.drawn = at;
            labels.showSlot(`slot-${String(index)}`, at >= 0 && at <= 400);
          };
        const drawn = { lines: [0, 0], bar: 0 };
        // The first line starts on the plot's top edge, where the row of slot labels matters.
        let chart = { first: 20, second: 5, max: 20, height: 200 };
        // A value's edge, snapped to whole pixels as a 1x plot draws it.
        const edge = (value: number) => Math.round(chart.height - (value / chart.max) * chart.height);
        const writer =
          (index: number) =>
          ([at = 0]: MarkValues): void => {
            drawn.lines[index] = at;
            labels.move(keys[index] ?? "", [at, at]);
          };
        const drawBar = ([, top = 0]: MarkValues): void => {
          drawn.bar = top;
        };
        // One commit, as each reference runs it: registration, size, plot, then placement, the
        // bar first as Root's children run.
        const commit = (placement: Placement): void => {
          motion.place("bar", [40, edge(chart.first), 20], drawBar, placement, ["x", "y", "x"]);
          slots.forEach((slot, index) => {
            const key = `slot-${String(index)}`;
            if (slot.labelled && !slot.registered) slot.remove = labels.addSlot(key);
            if (!slot.labelled && slot.registered) slot.remove();
            slot.registered = slot.labelled;
            motion.place(key, [slot.target], drawSlot(index), placement, ["x"]);
          });
          lines.forEach((line, index) => {
            const key = keys[index] ?? "";
            if (line.shown && line.order === -1) {
              line.order = mounted;
              mounted += 1;
              line.remove = labels.add(key, nodes[index] ?? node(), "line", line.size);
            }
            if (!line.shown && line.order !== -1) {
              line.remove();
              line.order = -1;
            }
            labels.resize(key, line.size);
            labels.measure(bounds);
            const target = edge(index === 0 ? chart.first : chart.second);
            motion.place(key, [target], writer(index), placement, ["y"]);
          });
        };
        commit({ kind: "snap" });
        const check = (): void => {
          const registered = lines.flatMap((line, index) =>
            line.order === -1 ? [] : [{ index, order: line.order, size: line.size }]
          );
          // The row of slot labels shows while any labelled slot guide draws inside the plot.
          const row = slots.some((slot) => slot.registered && slot.drawn >= 0 && slot.drawn <= 400);
          const expected = placeLabels(
            registered.map(({ index, order, size }) => {
              const at = drawn.lines[index] ?? 0;
              return { kind: "line" as const, order, span: [at, at] as const, ...size };
            }),
            { start: row ? 0 : Number.NEGATIVE_INFINITY, ...bounds }
          );
          registered.forEach(({ index }, place) => {
            expect(nodes[index]?.bottom()).toBe(expected[place]);
          });
          lines.forEach((line, index) => {
            if (line.order === -1) expect(nodes[index]?.bottom()).toBeNull();
          });
          expect(drawn.bar).toBe(drawn.lines[0]);
        };
        check();
        for (const action of steps) {
          if (action.kind === "wait") {
            now += action.ms;
            const frame = queued.pop();
            queued.length = 0;
            frame?.(now);
          } else {
            let placement: Placement = { kind: "settle", scale: SAME_PLOT };
            if (action.kind === "update") {
              const at = (value: number | "top") => (value === "top" ? action.max : value);
              chart = { ...chart, first: at(action.first), second: at(action.second), max: action.max };
              placement = { kind: "move" };
            }
            if (action.kind === "swap") {
              chart = { ...chart, first: chart.second, second: chart.first };
              placement = { kind: "move" };
            }
            if (action.kind === "resize") {
              // A resize maps every running tween into the new box, which scales y alone.
              placement = { kind: "settle", scale: { x: 1, y: action.height / chart.height } };
              chart = { ...chart, height: action.height };
              bounds = { ...bounds, end: action.height };
            }
            const slot =
              action.kind === "slot-label" || action.kind === "slot-move" ? slots[action.slot] : undefined;
            if (slot !== undefined && action.kind === "slot-label") slot.labelled = !slot.labelled;
            if (slot !== undefined && action.kind === "slot-move") {
              // A slot guide moves with a data update, which may carry it out of the plot.
              slot.target = action.at;
              placement = { kind: "move" };
            }
            const line = action.kind === "label" || action.kind === "text" ? lines[action.line] : undefined;
            if (line !== undefined && action.kind === "label") line.shown = !line.shown;
            if (line !== undefined && action.kind === "text") {
              line.size = { height: action.height, inset: action.height + 4 };
            }
            commit(placement);
            now += 1;
          }
          check();
        }
      }),
      {
        // Every run checks a labelled slot guide leaving the plot under a value label at its top.
        examples: [
          [
            [
              { kind: "slot-move", slot: 0, at: -50 },
              { kind: "wait", ms: 600 },
            ],
          ],
        ],
      }
    );
  });
});
