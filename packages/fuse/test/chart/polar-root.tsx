/**
 * The fixtures and readers the polar Root suites share: a three-part bill whose shares set the
 * slices' angles, two series over three categories named by letter, a pie that prints in Norwegian,
 * and readers for the popup's lane, opacity and exit.
 */
import type { ReactNode } from "react";

import { expect, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { ChartConfig } from "../../src/components/chart/chart-types";
import { PieChart } from "../../src/components/chart/pie-chart-namespace";
import { LocaleProvider } from "../../src/intl/locale-context";
import { nextFrames } from "../animation-frames";
import { popup } from "./marks";

/** A bill's three parts as shares of 100, so each value prints as its own share. */
export const THREE_PART_BILL = [
  { name: "strom", v: 62 },
  { name: "nettleie", v: 34 },
  { name: "avgifter", v: 4 },
];

/** The three parts' names and colors. */
export const THREE_PART_BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
} as const;

/** Two series over three categories named by letter. */
export const LETTER_SPOKES = [
  { cat: "a", v: 1, w: 3 },
  { cat: "b", v: 2, w: 2 },
  { cat: "c", v: 3, w: 1 },
];

/** A pie of the three-part bill, by default, in a box of `width` pixels under the Norwegian locale. */
export function Pie({
  children,
  width = 400,
  data = THREE_PART_BILL,
  config = THREE_PART_BILL_CONFIG,
}: {
  readonly children?: ReactNode;
  readonly width?: number;
  readonly data?: readonly { readonly name: string; readonly v: number }[];
  readonly config?: ChartConfig;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width }}>
        <PieChart.Root data={data} config={config} nameKey="name" valueKey="v" aria-label="Kake">
          {children}
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The popup's lane, as Base UI marks the side its positioner sits on. */
export function side(): string | null {
  // The popup portals out of the host, and its positioner is its parent.
  return popup()?.parentElement?.getAttribute("data-side") ?? null;
}

/** The open popup's computed opacity, or NaN while none is open. */
export function opacity(): number {
  const open = popup();
  return open === null ? Number.NaN : Number(getComputedStyle(open).opacity);
}

/** Tabs from the button before the chart onto the chart. */
export async function tabIn(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}");
}

/**
 * Sets the viewport and waits until the browser has delivered the resize, so no late resize lands
 * during the test. The next test gets the default viewport back.
 */
export async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height);
  onTestFinished(() => page.viewport(414, 896));
  await expect.poll(() => [window.innerWidth, window.innerHeight]).toEqual([width, height]);
  await nextFrames(2);
}

/**
 * Pauses the popup's exit halfway. Once Base UI marks the popup `data-ending-style`, the helper holds
 * its opacity transition toward the close's 0 at half its duration.
 *
 * @param popup - The open popup.
 * @returns The paused transition.
 */
export function pausedExit(popup: HTMLElement): Promise<Animation> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!popup.hasAttribute("data-ending-style")) return;
      observer.disconnect();
      // Reading them computes the ending style, which starts the exit's transitions.
      const fade = popup
        .getAnimations()
        .find((running) => running instanceof CSSTransition && running.transitionProperty === "opacity");
      if (fade === undefined) {
        reject(new Error("no exit transition"));
        return;
      }
      fade.pause();
      fade.currentTime = Number(fade.effect?.getComputedTiming().duration) / 2;
      resolve(fade);
    });
    observer.observe(popup, { attributes: true, attributeFilter: ["data-ending-style"] });
  });
}
