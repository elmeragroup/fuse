// RadialChart under the reader's reduced-motion preference, in every engine. Units under test: the
// rings' hover scale and the tracks' scale-out. Oracle: SPEC's Motion rule, written by hand. Under
// reduced motion every mark draws at rest at once, so the active ring takes its 1.03 at once and no
// scale runs as a transition or an animation.
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadialChart } from "./radial-chart-namespace";

it("scales the active ring at once and plays no scale-out", async () => {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadialChart.Root
          data={[
            { ring: "a", kwh: 40 },
            { ring: "b", kwh: 60 },
          ]}
          config={{ a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } }}
          nameKey="ring"
          valueKey="kwh"
          aria-label="Ringer">
          <RadialChart.Track />
          <RadialChart.Bar />
        </RadialChart.Root>
      </div>
    </LocaleProvider>
  );
  await userEvent.tab();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // DOM audit: the ring groups carry data-ring, read by the attribute the stylesheet keys on.
  const group = host.querySelector("[data-ring]:not([data-ring-track])");
  expect(getComputedStyle(group ?? host).scale).toBe("1.03");
  const scaling = host
    .getAnimations({ subtree: true })
    .filter(
      (animation) =>
        (animation instanceof CSSTransition && animation.transitionProperty === "scale") ||
        (animation instanceof CSSAnimation && animation.animationName === "chart-ring-grow")
    );
  expect(scaling).toHaveLength(0);
});
