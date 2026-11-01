// CONTRACT section 9.1's pattern checks, run in Chromium before any other
// part exists. Oracle: the spoken logs in test/chart/pattern-phrases.json, which
// .scratch/charts-v1/tools/l05-oracles/pattern_phrases.py writes from frozen Elhub data, layer 03's
// literal spoken forms, the drafted dictionary and vsr's own phrase grammar. No expectation comes
// from Fuse.
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, server, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { FALL_BACK_HOURS, S06_HOURS } from "../../../test/chart/elhub-rows";
import type { HourRow } from "../../../test/chart/elhub-rows";
import phrases from "../../../test/chart/pattern-phrases.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** Section 9.1's key sequence, in vsr's key names. */
const KEYS = [
  "Tab",
  "ArrowRight",
  "ArrowRight",
  "PageDown",
  "End",
  "Home",
  "ArrowDown",
  "ArrowDown",
  "ArrowUp",
  "Enter",
  "Escape",
  "Escape",
  "Shift+Tab",
] as const;

/** Wait for `count` animation frames. */
async function frames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

type FocusRecord = { readonly type: string; readonly target: string; readonly related: string };

const describeElement = (node: EventTarget | null): string =>
  node instanceof HTMLElement ? `${node.getAttribute("role") ?? node.tagName.toLowerCase()}` : "null";

function chart(rows: readonly HourRow[], labels: readonly string[]) {
  const format = { preset: "energy", unit: "kWh" } as const;
  const household = { label: labels[0] ?? "", color: "chart-1", format } as const;
  const config: ChartConfig =
    labels.length > 1
      ? { household, cabin: { label: labels[1] ?? "", color: "chart-2", format } }
      : { household };
  return renderThemed(
    <LocaleProvider locale="nb-NO">
      <button type="button">før</button>
      <Chart.Root
        data={rows}
        config={config}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        aria-label="Forbruk per time">
        <Chart.Bar dataKey="household" />
      </Chart.Root>
      <button type="button">etter</button>
    </LocaleProvider>
  );
}

/** Run the key sequence, logging focus events and the active element after each step. */
async function walk(host: HTMLElement) {
  const records: FocusRecord[] = [];
  const log = (event: FocusEvent): void => {
    records.push({
      type: event.type,
      target: describeElement(event.target),
      related: describeElement(event.relatedTarget),
    });
  };
  document.addEventListener("focusin", log, true);
  document.addEventListener("focusout", log, true);
  const active: string[] = [];
  host.querySelector("button")?.focus();
  await virtual.start({ container: host });
  try {
    for (const key of KEYS) {
      await virtual.press(key);
      const element = document.activeElement;
      const inListbox = element instanceof HTMLElement && element.closest('[role="listbox"]') !== null;
      active.push(inListbox ? describeElement(element) : describeElement(element));
    }
    return { spoken: await virtual.spokenPhraseLog(), records, active };
  } finally {
    await virtual.stop();
    document.removeEventListener("focusin", log, true);
    document.removeEventListener("focusout", log, true);
  }
}

afterEach(async () => {
  await virtual.stop();
});

describe.each([
  ["S06", S06_HOURS, phrases.s06],
  ["the fall-back day", FALL_BACK_HOURS, phrases.fallBack],
] as const)("the listbox pattern on %s", (_, rows, byLocale) => {
  it("speaks the expected log in nb-NO", async () => {
    const expected = byLocale["nb-NO"];
    const { host } = chart(rows, expected.labels);
    const { spoken } = await walk(host);
    expect(spoken).toEqual(expected.log);
  });

  it("keeps DOM focus on an option inside the listbox after every step", async () => {
    const { host } = chart(rows, byLocale["nb-NO"].labels);
    const { records, active } = await walk(host);
    // Every step before Shift+Tab leaves an option focused. Shift+Tab returns to the button.
    expect(active).toEqual([...Array.from({ length: KEYS.length - 1 }, () => "option"), "button"]);
    // No focusout leaves the listbox for nothing or for the outside until Shift+Tab.
    const outs = records.filter(({ type }) => type === "focusout");
    expect(
      outs.slice(1, -1).every(({ target, related }) => target === "option" && related === "option")
    ).toBe(true);
    expect(outs.at(-1)).toEqual({ type: "focusout", target: "option", related: "button" });
  });
});

describe("the negative control", () => {
  it("speaks no option after ArrowRight under the aria-activedescendant fallback", async () => {
    // A test-only page wired as the fallback of section 9.1: the listbox holds focus and points
    // at its option. vsr speaks on focus, so a changing aria-activedescendant stays silent.
    const host = document.createElement("div");
    document.body.append(host);
    const before = document.createElement("button");
    before.textContent = "før";
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-label", "Forbruk per time, datapunkter");
    listbox.tabIndex = 0;
    const option = (index: number): HTMLElement => {
      const element = document.createElement("div");
      element.id = `fallback-option-${String(index)}`;
      element.setAttribute("role", "option");
      element.setAttribute("aria-label", `option ${String(index)}`);
      return element;
    };
    listbox.append(option(0));
    listbox.setAttribute("aria-activedescendant", "fallback-option-0");
    listbox.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      listbox.replaceChildren(option(1));
      listbox.setAttribute("aria-activedescendant", "fallback-option-1");
    });
    host.append(before, listbox);
    before.focus();
    await virtual.start({ container: host });
    await virtual.press("Tab");
    const afterTab = (await virtual.spokenPhraseLog()).length;
    await virtual.press("ArrowRight");
    const log = await virtual.spokenPhraseLog();
    await virtual.stop();
    host.remove();
    expect(log.slice(afterTab).filter((phrase) => phrase.startsWith("option"))).toEqual([]);
  });
});

describe("the accessibility tree in Chromium", () => {
  type AxNode = {
    readonly nodeId: string;
    readonly parentId?: string;
    readonly role?: { readonly value?: string };
    readonly name?: { readonly value?: string };
    readonly properties?: readonly {
      readonly name: string;
      readonly value: { readonly value?: string | number | boolean };
    }[];
  };
  type FrameTree = {
    readonly frame: { readonly id: string; readonly url: string };
    readonly childFrames?: readonly FrameTree[];
  };
  type AxCdp = {
    send: ((method: "Page.getFrameTree") => Promise<{ readonly frameTree: FrameTree }>) &
      ((
        method: "Accessibility.getFullAXTree",
        params: { readonly frameId: string }
      ) => Promise<{ readonly nodes: readonly AxNode[] }>);
  };

  /** Every frame below the top page, where Vitest runs the test, deepest last. */
  const frames = (tree: FrameTree): string[] => [tree.frame.id, ...(tree.childFrames ?? []).flatMap(frames)];

  it.runIf(server.browser === "chromium")(
    "reports the focused node as an option with its name, inside a horizontal listbox",
    async () => {
      const { host } = chart(S06_HOURS, phrases.s06["nb-NO"].labels);
      host.querySelector("button")?.focus();
      await virtual.start({ container: host });
      await virtual.press("Tab");
      await virtual.press("ArrowRight");
      await virtual.press("ArrowRight");
      await virtual.stop();
      // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
      const session = cdp() as AxCdp;
      const { frameTree } = await session.send("Page.getFrameTree");
      const trees = await Promise.all(
        frames(frameTree).map((frameId) => session.send("Accessibility.getFullAXTree", { frameId }))
      );
      const nodes = trees.flatMap((tree) => tree.nodes);
      const property = (node: AxNode, name: string): string | number | boolean | undefined =>
        node.properties?.find((entry) => entry.name === name)?.value.value;
      // Each document's web area reports focus too, so the focused element is the other node.
      const focused = nodes.find(
        (node) => property(node, "focused") === true && node.role?.value !== "RootWebArea"
      );
      // Hand-written from S06's third hour: per-meter 1.1781 kWh household and 0.6535 kWh cabin.
      expect(focused?.role?.value).toBe("option");
      expect(focused?.name?.value).toBe(
        "kl. 02 til 03: Husholdning 1,18 kilowattimer, Hytte 0,65 kilowattimer"
      );
      // CDP's AX properties carry no position or set size, so the vsr logs above judge them.
      const parent = nodes.find((node) => node.nodeId === focused?.parentId);
      expect(parent?.role?.value).toBe("listbox");
      expect(property(parent ?? { nodeId: "" }, "orientation")).toBe("horizontal");
    }
  );
});

describe("switch trigger 3, the cost of a step", () => {
  type ThrottleCdp = {
    send: (method: "Emulation.setCPUThrottlingRate", params: { readonly rate: number }) => Promise<void>;
  };

  it.runIf(server.browser === "chromium")(
    "runs a 60-step ArrowRight sweep over 3,000 points with no long task over 50 ms at 4x throttling",
    async () => {
      // 3,000 quarter hours from 2026-10-01 in Oslo, which crosses no DST change.
      const start = Date.parse("2026-09-30T22:00:00Z");
      const rows = Array.from({ length: 3000 }, (_, index) => ({
        start: new Date(start + index * 900_000),
        price: Math.sin(index / 40),
      }));
      const config = { price: { label: "Spotpris", color: "chart-1" } } as const;
      const { host } = renderThemed(
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
      const option = host.querySelector<HTMLElement>('[role="option"]');
      option?.focus();
      // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
      const session = cdp() as ThrottleCdp;
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ type: "longtask", buffered: false });
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      // The mount's own effects and the throttling switch settle first, so the sweep counts steps only.
      await frames(20);
      longTasks.length = 0;
      try {
        for (let step = 0; step < 60; step += 1) {
          const target = document.activeElement;
          target?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
          );
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        await frames(6);
      } finally {
        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        observer.disconnect();
      }
      expect(document.activeElement?.getAttribute("aria-posinset")).toBe("61");
      expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
    }
  );
});

describe("switch trigger 2, tooltip continuity", () => {
  it("keeps one tooltip popup through every key step", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data={S06_HOURS}
          config={{ household: { label: "Husholdning", color: "chart-1" } }}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per time">
          <Chart.Bar dataKey="household" />
          <Chart.Tooltip />
        </Chart.Root>
      </LocaleProvider>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await frames(3);
    // DOM audit: the popup portals to the theme scope container, outside the render host.
    const popup = document.querySelector('[data-slot="chart-tooltip"]');
    const container = popup?.parentElement?.parentElement;
    expect(popup).not.toBeNull();
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) removed.push(...record.removedNodes);
    });
    if (container) observer.observe(container, { childList: true, subtree: true });
    for (const key of ["{ArrowRight}", "{ArrowRight}", "{PageDown}", "{End}", "{Home}"]) {
      await userEvent.keyboard(key);
      await frames(2);
    }
    observer.disconnect();
    // DOM audit: the same popup element is still the one in the document.
    expect(document.querySelector('[data-slot="chart-tooltip"]')).toBe(popup);
    expect(
      removed.filter((node) => node === popup || (node instanceof Element && node.contains(popup)))
    ).toEqual([]);
  });
});
