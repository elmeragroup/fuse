// PieChart under the reader's reduced-motion preference, in every engine. Units under test: the
// pop and the centre's digit roll. Oracle: S1 and D8, written by hand. The active slice moves its
// whole 8 px at once, and the centre swaps its text with no roll, so neither runs a transition.
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { centreText, sectors } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

it("pops the active slice and swaps the centre's text at once", async () => {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <PieChart.Root
          data={[
            { part: "strom", kr: 50 },
            { part: "nettleie", kr: 50 },
          ]}
          config={{
            strom: { label: "Strøm", color: "chart-1" },
            nettleie: { label: "Nettleie", color: "chart-2" },
          }}
          nameKey="part"
          valueKey="kr"
          innerRadius={0.6}
          aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Center>
            <PieChart.CenterValue />
          </PieChart.Center>
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
  const [first] = sectors(host);
  const rest = first?.getBoundingClientRect().left ?? 0;
  await userEvent.tab();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // Strøm's bisector points at 3 o'clock.
  expect((first?.getBoundingClientRect().left ?? 0) - rest).toBeCloseTo(8, 0);
  expect(centreText(host, "pie-chart-center-value")).toBe("50");
  // DOM audit: the pop and the roll are transitions on the slice and the reels, read from their animations.
  const moving = host
    .getAnimations({ subtree: true })
    .filter(
      (animation) => animation instanceof CSSTransition && animation.transitionProperty === "translate"
    );
  expect(moving).toHaveLength(0);
});
