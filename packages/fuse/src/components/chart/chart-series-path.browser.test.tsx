// The resting line an active dot rides. Unit under test: useSeriesPath's resting state as
// useRestingLine keeps it. Oracle: the hook's contract, one draw for each resting state, counted
// through the draw callback a part hands it, across a re-render that changes none of its numbers.
import { useLayoutEffect, useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import { nextFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { useSeriesPart } from "./chart-context";
import { Chart } from "./chart-namespace";
import { placeOf } from "./chart-path-draw";
import type { ChartPaths } from "./chart-paths";
import { useRestingLine, useSeriesPath } from "./chart-series-path";
import { LINE_STRIDE, linePaths } from "./layout/line-path";

/** What the part handed over: Root's paths, its re-render, and how often it drew its line. */
type Seen = { paths: ChartPaths | null; rerender: () => void; draws: number };

/** A part that registers its series' resting line as a Line does, and draws nothing itself. */
function RestingLine({
  onReady,
  onDraw,
}: {
  /** Hands over Root's paths and a re-render of the part, once it commits. */
  readonly onReady: (paths: ChartPaths, rerender: () => void) => void;
  /** Called each time the part draws its resting line. */
  readonly onDraw: () => void;
}): ReactElement | null {
  const { context, layout } = useSeriesPart("Probe", "v");
  const { resting, seriesIndex } = useSeriesPath("Probe", () => undefined, {
    context,
    layout,
    dataKey: "v",
    curve: "linear",
    route: "line",
    stride: LINE_STRIDE,
  });
  const [, setRenders] = useState(0);
  useLayoutEffect(() => {
    onReady(context.paths, () => {
      setRenders((count) => count + 1);
    });
  });
  useRestingLine(context.paths, seriesIndex, "line", resting, (rest) => {
    onDraw();
    return linePaths(rest.rest, rest.topology, placeOf(rest.look)).line;
  });
  return null;
}

describe("a series path's resting line", () => {
  it("draws once for each resting state, however often its part renders", async () => {
    const seen: Seen = {
      paths: null,
      rerender: () => undefined,
      draws: 0,
    };
    renderThemed(
      <LocaleProvider locale="en-US">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={["a", "b", "c"].map((name, index) => ({ name, v: [1, 3, 2][index] }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Resting line">
            <RestingLine
              onReady={(paths, rerender) => {
                seen.paths = paths;
                seen.rerender = rerender;
              }}
              onDraw={() => {
                seen.draws += 1;
              }}
            />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(3);
    const line = seen.paths?.line(0, "line");
    expect(line).toMatch(/^M/u);
    expect(seen.draws).toBe(1);
    seen.rerender();
    await nextFrames(2);
    expect(seen.paths?.line(0, "line")).toBe(line);
    expect(seen.draws).toBe(1);
  });
});
