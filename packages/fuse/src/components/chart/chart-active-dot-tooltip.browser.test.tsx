// The active dot under the tooltip's roof with motion on, and once reduced motion turns off, in
// Chromium. Oracle: the popup's place when it opens on a slot at once, which a glide onto the same
// slot must land it on.
import { describe, expect, it, onTestFinished } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { ONE_SERIES, PERCENT, moveTo } from "../../../test/chart/active-dot";
import { glideLanded, popup } from "../../../test/chart/marks";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** 600 readings a pixel apart: k0 at 10, then 60 from k1 on, so a step from k0 to k1 is mostly a rise. */
const RISE = Array.from({ length: 600 }, (_, index) => ({
  name: `k${String(index)}`,
  v: index === 0 ? 10 : 60,
}));

/**
 * A ping dot on the rise, its ring either held at twice its size by a stylesheet, so its own scale
 * sits between the dot's layer and the screen, or running its own animation.
 */
function PingChart({ ring }: { readonly ring: "scaled" | "animated" }) {
  return (
    <div style={{ padding: "200px 24px 24px", width: 648, boxSizing: "border-box" }}>
      {ring === "scaled" ? (
        <style>
          {
            '[data-slot="chart-dot"][data-part="ping"] { animation: none !important; transform: scale(2) !important; }'
          }
        </style>
      ) : null}
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={RISE}
          config={ONE_SERIES}
          xKey="name"
          xScale="point"
          yInclude={PERCENT}
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Ping rise">
          <Chart.Line dataKey="v" curve="linear" />
          <Chart.ActiveDot dataKey="v" variant="ping" />
          <Chart.Tooltip />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

describe("a ping dot's glide under the tooltip's roof", () => {
  it("leaves the popup where it rests when it opens on the slot, though the ring is scaled", async () => {
    // Open on k1 at once.
    const fresh = renderThemed(<PingChart ring="scaled" />);
    await nextFrames(2);
    moveTo(fresh.host, 1, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    const opened = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    fresh.unmount();
    // Reach k1 by a step from k0: the dot glides up 100 px while the popup measures the roof.
    const stepped = renderThemed(<PingChart ring="scaled" />);
    await nextFrames(2);
    moveTo(stepped.host, 0, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    moveTo(stepped.host, 1, 0, RISE.length);
    await nextFrames(60);
    await glideLanded();
    const glided = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    expect(Math.abs(glided - opened), JSON.stringify({ opened, glided })).toBeLessThanOrEqual(1);
  });

  // Unit under test: the roof's reach for a ping ring after the reader's motion preference changes
  // with the popup open. Oracle: the popup's place when it opens on the slot with motion on from the
  // start, whose roof carries the 2 px the ring reaches past the popup's gap. At rest the dot itself
  // keeps the popup above the ring's widest reach, so the place is the only signal there.
  it("lands where an open with motion on puts it after reduced motion turns off with the popup open", async () => {
    onTestFinished(() => emulateReducedMotion("no-preference"));
    // Open on k1 at once with motion on, the ring held at its start, so every read sees one ring.
    const fresh = renderThemed(<PingChart ring="animated" />);
    await nextFrames(2);
    holdRings(fresh.host);
    moveTo(fresh.host, 1, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    const opened = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    fresh.unmount();
    // Open on k0 under reduced motion, where no ring animates, then turn reduced motion off.
    await emulateReducedMotion("reduce");
    const flipped = renderThemed(<PingChart ring="animated" />);
    await nextFrames(2);
    moveTo(flipped.host, 0, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    await emulateReducedMotion("no-preference");
    await nextFrames(2);
    holdRings(flipped.host);
    // Step to k1: the dot glides up 100 px while the popup measures the roof.
    moveTo(flipped.host, 1, 0, RISE.length);
    await nextFrames(60);
    await glideLanded();
    const glided = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    expect(Math.abs(glided - opened), JSON.stringify({ opened, glided })).toBeLessThanOrEqual(1);
  });
});

/**
 * Pause each ping ring's animation at its start, where the ring is the dot's own size, so every
 * read of the roof sees one ring while its keyframes still say how far it reaches.
 */
function holdRings(host: HTMLElement): void {
  // DOM audit: the ping ring is aria-hidden plot output, so its part is the only locator.
  const rings = host.querySelectorAll('[data-slot="chart-dot"][data-part="ping"]');
  const animations = [...rings].flatMap((ring) => ring.getAnimations());
  expect(animations.length, "running ping animations").toBeGreaterThan(0);
  for (const animation of animations) {
    animation.pause();
    animation.currentTime = 0;
  }
}
