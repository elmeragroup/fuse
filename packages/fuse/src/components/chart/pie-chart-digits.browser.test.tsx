// A pie centre's digits under hover steps, in Chromium with motion on. Unit under test:
// PieChart.CenterValue's digit roll. Oracle, from the rule: a hover step that
// lands less than 150 ms after the last one swaps the digits at once, with no reel transition, while
// one that comes 150 ms or more after the last rolls its reels. The slices hold 412, 268 and 154 kr,
// three digits each, so their reels line up and a step that rolls moves every changed reel.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { clientPoint, dialPoint, hoverAt, pieSvg } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

function Bill() {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <PieChart.Root
          data={[
            { part: "energi", kr: 412 },
            { part: "nettleie", kr: 268 },
            { part: "avgift", kr: 154 },
          ]}
          config={{
            energi: { label: "Energi", color: "chart-1" },
            nettleie: { label: "Nettleie", color: "chart-2" },
            avgift: { label: "Avgift", color: "chart-3" },
          }}
          nameKey="part"
          valueKey="kr"
          innerRadius={0.6}
          data-intro="none"
          aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Center>
            <PieChart.CenterValue />
          </PieChart.Center>
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The reels' running transitions, which a roll starts and a swap never does. */
function rolling(host: HTMLElement): number {
  // DOM audit: the centre's reels are aria-hidden plot text, read by their part.
  return [...host.querySelectorAll('[data-slot="pie-chart-center-value"] [data-part="reel"]')]
    .flatMap((reel) => reel.getAnimations())
    .filter((animation) => animation instanceof CSSTransition).length;
}

async function frames(ms: number): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("the centre's digits on hover steps", () => {
  it("rolls on a deliberate step and swaps at once on a fast one", async () => {
    const { host } = renderThemed(<Bill />);
    const svg = pieSvg(host);
    // Energi spans 0° to 177.8°, Nettleie to 293.4° and Avgift to 360°.
    const at = (angle: number) => {
      const point = dialPoint(angle, 0.8);
      return clientPoint(svg, point.x, point.y);
    };
    await hoverAt(...at(90));
    await frames(300);
    await hoverAt(...at(230));
    expect(rolling(host)).toBeGreaterThan(0);
    await frames(50);
    await hoverAt(...at(330));
    expect(rolling(host)).toBe(0);
  });
});
