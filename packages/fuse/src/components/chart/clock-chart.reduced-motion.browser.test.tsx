// ClockChart under the reader's reduced-motion preference, in every engine. Units under test: the
// clock's series marks on the loop, the ActiveDot's ride and the Scrubber's turn. Oracle: SPEC's
// Motion rule, written by hand. Under reduced motion every mark draws at rest at once, so a client
// mount draws each wedge at its reading in its first frame, and no entrance, ride or turn runs.
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";

const DAY = Date.parse("2025-10-24T22:00:00Z");

it("draws the dial at rest at once and plays no entrance, ride or turn", async () => {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * 3_600_000, kwh: 4 }))}
          config={{ kwh: { label: "kWh", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          aria-label="Døgn">
          <ClockChart.Dots dataKey="kwh" />
          <ClockChart.ActiveDot dataKey="kwh" />
          <ClockChart.Scrubber />
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // DOM audit: the dots are aria-hidden plot output, read by their slot and group.
  const dots = host.querySelector('[data-slot="clock-chart-dot"][data-part="dots"]')?.getAttribute("d") ?? "";
  // Every reading is the domain's maximum, so every dot sits on the rim at once.
  for (const [, x = "0", y = "0"] of dots.matchAll(/M(-?[\d.]+),(-?[\d.]+)h0/gu)) {
    expect(Math.hypot(Number(x), Number(y))).toBeCloseTo(1, 2);
  }
  await userEvent.tab();
  await userEvent.keyboard("{ArrowRight}{ArrowLeft}");
  const moving = host
    .getAnimations({ subtree: true })
    .filter(
      (animation) => !(animation instanceof CSSTransition && animation.transitionProperty === "opacity")
    );
  expect(moving).toHaveLength(0);
});
