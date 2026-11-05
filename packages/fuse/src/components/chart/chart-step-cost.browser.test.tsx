// The cost of a key step, in Chromium: CONTRACT section 9.1's switch trigger 3, which holds a
// step's work constant however many points the chart holds. Unit under test: the plot surface's
// ArrowRight step. Oracle: the same 60-step sweep over a tenth of the points, so the expectation is
// that the two sweeps cost the same work, not any count Fuse produces. The work is what V8's block
// coverage counts in Fuse's own modules, every function call and every pass through a block, loop
// bodies included, with the DOM nodes and attributes the sweep changes and the layouts and style
// recalculations Chromium runs. Counted work is independent of the machine's speed, where a
// long-task budget failed on loaded runners.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cdp, server } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

type Coverage = {
  readonly result: readonly {
    readonly url: string;
    readonly functions: readonly { readonly ranges: readonly { readonly count: number }[] }[];
  }[];
};
type Metrics = { readonly metrics: readonly { readonly name: string; readonly value: number }[] };
type CostCdp = {
  send: ((
    method:
      | "Profiler.enable"
      | "Profiler.disable"
      | "Profiler.stopPreciseCoverage"
      | "Performance.enable"
      | "Performance.disable"
  ) => Promise<void>) &
    ((
      method: "Profiler.startPreciseCoverage",
      params: { readonly callCount: true; readonly detailed: true }
    ) => Promise<void>) &
    ((method: "Profiler.takePreciseCoverage") => Promise<Coverage>) &
    ((method: "Performance.getMetrics") => Promise<Metrics>);
};

const chromium = server.browser === "chromium";

/** Vitest's CDP session. */
function session(): CostCdp {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  return cdp() as CostCdp;
}

// V8 attaches block counters to a function as it compiles, and a function compiled before block
// coverage starts counts only its calls. Coverage therefore starts before the first chart mounts and
// runs to the file's end: stopping it would drop the counters of every function compiled so far.
beforeAll(async () => {
  if (!chromium) return;
  await session().send("Profiler.enable");
  await session().send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  await session().send("Performance.enable");
});

afterAll(async () => {
  if (!chromium) return;
  await session().send("Profiler.stopPreciseCoverage");
  await session().send("Profiler.disable");
  await session().send("Performance.disable");
});

/**
 * The blocks Fuse's own modules ran since the last read: each range's count, a function's whole
 * body among them, so a loop's body counts once per pass. Vite serves Fuse's source under /src/ and
 * dependencies under /node_modules/. Reading coverage resets its counters.
 */
async function blocksRun(): Promise<number> {
  const { result } = await session().send("Profiler.takePreciseCoverage");
  return result
    .filter(({ url }) => new URL(url, location.href).pathname.startsWith("/src/"))
    .flatMap(({ functions }) => functions)
    .flatMap(({ ranges }) => ranges)
    .reduce((sum, { count }) => sum + count, 0);
}

async function metric(name: string): Promise<number> {
  const { metrics } = await session().send("Performance.getMetrics");
  return metrics.find((entry) => entry.name === name)?.value ?? 0;
}

/**
 * Mount `length` quarter hours, sweep 60 ArrowRight steps, and count the sweep's work: the blocks
 * Fuse ran, the DOM nodes and attributes it changed, and the layouts and style recalculations.
 */
async function sweep(length: number) {
  // Quarter hours from 2026-10-01 in Oslo. The sweep stays on the first day, before any DST change.
  const start = Date.parse("2026-09-30T22:00:00Z");
  const rows = Array.from({ length }, (_, index) => ({
    start: new Date(start + index * 900_000),
    price: Math.sin(index / 40),
  }));
  const config = { price: { label: "Spotpris", color: "chart-1" } } as const;
  const { host, unmount } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <Chart.Root
        data={rows}
        config={config}
        xKey="start"
        interval="quarter-hour"
        timeZone="Europe/Oslo"
        aria-label="Pris"
      />
    </LocaleProvider>
  );
  // DOM audit: the plot's single tab stop is the listbox's option.
  host.querySelector<HTMLElement>('[role="option"]')?.focus();
  let changes = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      changes += record.type === "childList" ? record.addedNodes.length + record.removedNodes.length : 1;
    }
  });
  try {
    // The mount's own effects settle first, and their count is read away.
    await nextFrames(20);
    await blocksRun();
    const layouts = await metric("LayoutCount");
    const styles = await metric("RecalcStyleCount");
    observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    for (let step = 0; step < 60; step += 1) {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
      );
      await nextFrames(1);
    }
    await nextFrames(6);
    return {
      position: document.activeElement?.getAttribute("aria-posinset"),
      blocks: await blocksRun(),
      changes,
      layouts: (await metric("LayoutCount")) - layouts,
      styles: (await metric("RecalcStyleCount")) - styles,
    };
  } finally {
    observer.disconnect();
    unmount();
  }
}

describe("switch trigger 3, the cost of a step", () => {
  // A step that rebuilds Root's model or walks the rows, in a loop or through callbacks, runs at
  // least 27,000 more blocks a step at 30,000 points, millions over the sweep.
  it.runIf(chromium)("does the same work per ArrowRight step over 30,000 points as over 3,000", async () => {
    // A first sweep warms what Fuse builds once per page, such as its formatters, so the two
    // measured sweeps start from the same state.
    await sweep(3000);
    const small = await sweep(3000);
    const large = await sweep(30_000);
    expect(small.position).toBe("61");
    expect(large.position).toBe("61");
    expect(small.blocks).toBeGreaterThan(0);
    // The warm sweeps' counts differ by well under 1%, so a 10% bound separates them from a step
    // that scales with the data.
    expect(large.blocks, JSON.stringify({ small, large })).toBeLessThan(small.blocks * 1.1);
    expect({ changes: large.changes, layouts: large.layouts, styles: large.styles }).toEqual({
      changes: small.changes,
      layouts: small.layouts,
      styles: small.styles,
    });
  });
});
