// RadarChart under the reader's reduced-motion preference, in every engine. Units under test: the
// series marks on the loop, the grid's scale-outs, the labels' fade, the active dot's ride and the
// hand's turn. Oracle: SPEC's Motion rule, written by hand. Under reduced motion every mark draws at
// rest at once, so a client mount draws each series at its readings in its first frame, and no
// scale-out, fade, ride or turn runs.
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";

it("draws the series at rest at once and plays no scale-out, fade, ride or turn", async () => {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadarChart.Root
          data={[
            { spoke: "a", v: 4 },
            { spoke: "b", v: 2 },
            { spoke: "c", v: 3 },
            { spoke: "d", v: 1 },
          ]}
          config={{ v: { label: "V", color: "chart-1" } }}
          nameKey="spoke"
          max={4}
          aria-label="Radar">
          <RadarChart.Grid />
          <RadarChart.AngleAxis />
          <RadarChart.Line dataKey="v" />
          <RadarChart.ActiveDot dataKey="v" />
        </RadarChart.Root>
      </div>
    </LocaleProvider>
  );
  await nextFrames(1);
  // DOM audit: the line's run is aria-hidden plot output, read by its slot and part.
  const line = host.querySelector('[data-slot="radar-chart-line-path"][data-part="solid"]');
  expect(line?.getAttribute("d")).toBe("M0,-1L0.5,0L0,0.75L-0.25,0Z");
  await userEvent.tab();
  await userEvent.keyboard("{ArrowRight}");
  await userEvent.keyboard("{End}");
  const moving = host
    .getAnimations({ subtree: true })
    .filter(
      (animation) => !(animation instanceof CSSTransition && animation.transitionProperty === "opacity")
    );
  expect(moving).toHaveLength(0);
});
