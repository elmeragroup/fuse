// Chart.Crosshair's line in Chromium: its fade, its width token and its glide. Oracles: DECISIONS
// D15, a line that fades over 10% of the plot at the ends `fade` names, along the value axis, and
// the hairline as its default width; D16, a step glides the line from where it shows to the next
// slot, and the line rests on the next slot's column, which its `x` attribute names at once.
import { describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { S06Chart } from "../../../test/chart/bar-charts";
import { surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import type { ChartCrosshairProps } from "./chart-crosshair";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** The mask a fade should resolve to, as this engine computes the same gradient written by hand. */
function expectedMask(direction: "to bottom" | "to left", fade: "both" | "top" | "bottom" | "none"): string {
  const stops = {
    both: "transparent, #000 10%, #000 90%, transparent",
    top: "transparent, #000 10%",
    bottom: "#000 90%, transparent",
  } as const;
  const probe = document.createElement("div");
  if (fade !== "none") probe.style.maskImage = `linear-gradient(${direction}, ${stops[fade]})`;
  document.body.append(probe);
  const mask = getComputedStyle(probe).maskImage;
  probe.remove();
  return mask;
}

function crosshair(host: HTMLElement): SVGSVGElement {
  // DOM audit: the crosshair is aria-hidden plot output, so its slot is the only locator.
  const layer = host.querySelector<SVGSVGElement>('[data-slot="chart-crosshair"]');
  if (layer === null) throw new Error("no crosshair");
  return layer;
}

function mark(host: HTMLElement): SVGRectElement {
  // DOM audit: the crosshair's mark is aria-hidden plot output.
  const rect = host.querySelector<SVGRectElement>('[data-slot="chart-crosshair-mark"]');
  if (rect === null) throw new Error("no crosshair mark");
  return rect;
}

async function enterChart(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}");
}

function lineChart(props: ChartCrosshairProps, orientation?: "horizontal", width = 600) {
  return (
    <div style={{ width }}>
      <S06Chart orientation={orientation}>
        <Chart.Line dataKey="household" />
        <Chart.Crosshair {...props} />
      </S06Chart>
    </div>
  );
}

describe("the line crosshair's fade", () => {
  it.each([
    [undefined, "both"],
    ["both", "both"],
    ["top", "top"],
    ["bottom", "bottom"],
    ["none", "none"],
  ] as const)("fades a vertical chart's line for fade=%s at its %s ends", (fade, ends) => {
    const { host } = renderThemed(lineChart({ variant: "line", fade }));
    expect(getComputedStyle(crosshair(host)).maskImage).toBe(expectedMask("to bottom", ends));
  });

  it("reads the ends along the value axis of a horizontal chart, whose top is its right end", () => {
    const { host } = renderThemed(lineChart({ variant: "line", fade: "top" }, "horizontal"));
    expect(getComputedStyle(crosshair(host)).maskImage).toBe(expectedMask("to left", "top"));
  });

  it("leaves the band unmasked", () => {
    const { host } = renderThemed(lineChart({ variant: "band", fade: "both" }));
    expect(getComputedStyle(crosshair(host)).maskImage).toBe("none");
  });
});

describe("the line crosshair's width", () => {
  it("draws the hairline by default and the width --chart-crosshair-width names", async () => {
    const plain = renderThemed(lineChart({ variant: "line" }));
    await enterChart(plain.host);
    // A hairline is 1 px rounded down to whole device pixels, at least one.
    const dpr = devicePixelRatio;
    expect(Number(mark(plain.host).getAttribute("width"))).toBeCloseTo(Math.max(1, Math.floor(dpr)) / dpr, 6);
    plain.unmount();
    const wide = renderThemed(lineChart({ variant: "line", style: { "--chart-crosshair-width": "3px" } }));
    await enterChart(wide.host);
    expect(Number(mark(wide.host).getAttribute("width"))).toBeCloseTo(Math.floor(3 * dpr) / dpr, 6);
  });
});

describe("a change of the line crosshair's width token", () => {
  it("draws the new width at once and on the next step, with no resize", async () => {
    const { host, rerender } = renderThemed(
      lineChart({ variant: "line", style: { "--chart-crosshair-width": "1px" } })
    );
    await enterChart(host);
    const dpr = devicePixelRatio;
    expect(Number(mark(host).getAttribute("width"))).toBeCloseTo(Math.max(1, Math.floor(dpr)) / dpr, 6);
    rerender(lineChart({ variant: "line", style: { "--chart-crosshair-width": "3px" } }));
    await nextFrames(2);
    expect(Number(mark(host).getAttribute("width"))).toBeCloseTo(Math.floor(3 * dpr) / dpr, 6);
    await userEvent.keyboard("{ArrowRight}");
    expect(Number(mark(host).getAttribute("width"))).toBeCloseTo(Math.floor(3 * dpr) / dpr, 6);
  });
});

describe("the line crosshair's glide", () => {
  it("starts a step from where the line shows and lands on the next slot's column", async () => {
    const { host } = renderThemed(lineChart({ variant: "line" }));
    await enterChart(host);
    const before = mark(host).getBoundingClientRect().left;
    const plot = crosshair(host).getBoundingClientRect().left;
    await userEvent.keyboard("{ArrowRight}");
    const rect = mark(host);
    const target = Number(rect.getAttribute("x"));
    expect(target + plot).toBeGreaterThan(before + 5);
    // The glide's first frame shows the line where it was.
    const animations = crosshair(host).getAnimations({ subtree: true });
    expect(animations.length).toBeGreaterThan(0);
    for (const animation of animations) animation.pause();
    for (const animation of animations) animation.currentTime = 0;
    expect(rect.getBoundingClientRect().left).toBeCloseTo(before, 1);
    for (const animation of animations) animation.finish();
    expect(rect.getBoundingClientRect().left).toBeCloseTo(target + plot, 1);
  });
});

/** The one CDP call this file makes, which vitest types as an empty interface. */
type MediaCdp = {
  readonly send: (
    method: "Emulation.setEmulatedMedia",
    params: { readonly features: readonly { readonly name: string; readonly value: string }[] }
  ) => Promise<void>;
};

/** Point at the middle of S06's hour `slot`, of 24, halfway down the plot. */
async function pointAtSlot(host: HTMLElement, slot: number): Promise<void> {
  // DOM audit: the plot's listbox is its one pointer target.
  const surface = host.querySelector<HTMLElement>('[role="listbox"]');
  if (surface === null) throw new Error("no plot");
  const box = surface.getBoundingClientRect();
  await userEvent.hover(surface, {
    position: { x: (box.width * (slot + 0.5)) / 24, y: box.height / 2 },
    force: true,
  });
}

/** The crosshair rests: nothing animates it, and its mark shows on the column its geometry names. */
function expectAtRest(host: HTMLElement): void {
  expect(crosshair(host).getAnimations({ subtree: true })).toEqual([]);
  const rect = mark(host);
  const vertical =
    rect.getAttribute("height") !== null &&
    Number(rect.getAttribute("height")) > Number(rect.getAttribute("width"));
  const plot = surfaceBox(host);
  if (vertical)
    expect(rect.getBoundingClientRect().left).toBeCloseTo(plot.left + Number(rect.getAttribute("x")), 1);
}

// Oracle: D16 and round 1's P1. A glide is a step's motion only. Anything that places the
// crosshair otherwise (a reappearance, a resize, a change of variant, reduced motion) shows its
// geometry at once, with no translate left over from a glide it interrupted.
describe("the line crosshair's glide ends wherever a step's glide does not apply", () => {
  it("lands a reappearing line on its slot after a leave mid-glide", async () => {
    const { host } = renderThemed(lineChart({ variant: "line" }));
    await pointAtSlot(host, 2);
    await pointAtSlot(host, 10);
    expect(crosshair(host).getAnimations({ subtree: true }).length).toBeGreaterThan(0);
    await userEvent.unhover(host.querySelector('[role="listbox"]') ?? document.body);
    await pointAtSlot(host, 18);
    expectAtRest(host);
  });

  it("places the line at once when the plot resizes mid-glide", async () => {
    const { host, rerender } = renderThemed(lineChart({ variant: "line" }));
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(crosshair(host).getAnimations({ subtree: true }).length).toBeGreaterThan(0);
    rerender(lineChart({ variant: "line" }, undefined, 480));
    await nextFrames(2);
    expectAtRest(host);
  });

  it("places the band at once when the variant changes mid-glide", async () => {
    const { host, rerender } = renderThemed(lineChart({ variant: "line" }));
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(crosshair(host).getAnimations({ subtree: true }).length).toBeGreaterThan(0);
    rerender(lineChart({ variant: "band" }));
    await nextFrames(2);
    expect(crosshair(host).getAnimations({ subtree: true })).toEqual([]);
    const plot = surfaceBox(host);
    const rect = mark(host);
    expect(rect.getBoundingClientRect().left).toBeCloseTo(plot.left + Number(rect.getAttribute("x")), 1);
  });

  it("ends a running glide when the reader turns reduced motion on", async () => {
    // SAFETY: vitest types CDPSession as {}; Playwright's Chromium session implements send.
    const session = cdp() as MediaCdp;
    const { host } = renderThemed(lineChart({ variant: "line" }));
    await enterChart(host);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(crosshair(host).getAnimations({ subtree: true }).length).toBeGreaterThan(0);
    try {
      await session.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
      await nextFrames(2);
      expectAtRest(host);
    } finally {
      await session.send("Emulation.setEmulatedMedia", { features: [] });
    }
  });
});
