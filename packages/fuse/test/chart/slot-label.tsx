/**
 * The fixtures and readers Chart.SlotLabel's suites share: an Oslo day chart whose axis and Root a
 * test can restyle or replace without rendering the pill, and readers of what the pill shows. The
 * pill is aria-hidden plot output, so its slots and parts are the only locators.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { userEvent } from "vitest/browser";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartStyle, XFormat } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";

/** The chart's market. */
export const ZONE = "Europe/Oslo";

/** A day and a short month, such as `30. sep.` in nb-NO. */
export const DAY_AND_MONTH = { day: "numeric", month: "short" } as const;

/**
 * `count` Oslo days from 20 September 2026, each at local midnight: UTC+2 until summer time ends on
 * 25 October, the 36th day, and UTC+1 after it.
 *
 * @param count - How many days.
 * @returns The rows.
 */
export function days(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    day: new Date(Date.UTC(2026, 8, 20 + index) - (index <= 35 ? 2 : 1) * 3_600_000),
    kwh: 10 + ((index * 7) % 13),
  }));
}

/** How a test reaches into the mounted chart without rendering the pill. */
type Handles = {
  /** Replace the SwitchingAxis's XAxis with a new one. */
  replaceAxis: () => void;
  /** Restyle the StyledAxis's XAxis. */
  styleAxis: (style: ChartStyle) => void;
  /** Restyle the Root. */
  styleRoot: (style: ChartStyle) => void;
};

/** The mounted chart's handles. Each runs its update at once. */
export const handles: Handles = {
  replaceAxis: () => undefined,
  styleAxis: () => undefined,
  styleRoot: () => undefined,
};

/** An XAxis whose own parent replaces it under a new key, or restyles it. */
function OwnedAxis({ format }: { format?: XFormat }): ReactNode {
  const [generation, setGeneration] = useState(0);
  const [style, setStyle] = useState<ChartStyle | undefined>(undefined);
  useEffect(() => {
    handles.replaceAxis = () => {
      flushSync(() => setGeneration((value) => value + 1));
    };
    handles.styleAxis = (next) => {
      flushSync(() => setStyle(next));
    };
  }, []);
  return <Chart.XAxis key={generation} format={format} style={style} />;
}

/** A Root whose own state restyles it, so its children, built by the caller, stay the same. */
function OwnedRoot({ count, children }: { count: number; children: ReactNode }): ReactNode {
  const [style, setStyle] = useState<ChartStyle | undefined>(undefined);
  useEffect(() => {
    handles.styleRoot = (next) => {
      flushSync(() => setStyle(next));
    };
  }, []);
  return (
    <Chart.Root
      data={days(count)}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="day"
      interval="day"
      timeZone={ZONE}
      data-intro="none"
      aria-label="Forbruk per dag"
      style={style}>
      {children}
    </Chart.Root>
  );
}

/**
 * Oslo days as a line with an x axis and a SlotLabel in a line crosshair, 640 px wide.
 *
 * @param props - The day count, the axis's and the label's formats, a scale on the chart's
 *   wrapper, and whether the axis is one `handles` reaches.
 * @returns The page.
 */
export function DayChart({
  count,
  format,
  slotFormat,
  scale,
  owned,
}: {
  count: number;
  format?: XFormat;
  slotFormat?: XFormat;
  scale?: number;
  owned?: boolean;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <button type="button">før</button>
      <div
        style={{
          width: 640,
          transform: scale === undefined ? undefined : `scale(${String(scale)})`,
          transformOrigin: "0 0",
        }}>
        <OwnedRoot count={count}>
          {owned === true ? <OwnedAxis format={format} /> : <Chart.XAxis format={format} />}
          <Chart.Line dataKey="kwh" />
          <Chart.Crosshair>
            <Chart.SlotLabel format={slotFormat} />
          </Chart.Crosshair>
        </OwnedRoot>
      </div>
    </LocaleProvider>
  );
}

/**
 * Every kind of space as a plain one, since Fuse prints canonical spaces where Intl may not.
 *
 * @param text - A label.
 * @returns The label with plain spaces.
 */
export const spaced = (text: string): string => text.replace(/\s/gu, " ");

/**
 * Day `index` of the fixture as Intl prints it in Oslo.
 *
 * @param index - The day.
 * @param options - The Intl options.
 * @returns The label, with plain spaces.
 */
export function intl(index: number, options: Intl.DateTimeFormatOptions): string {
  return spaced(
    new Intl.DateTimeFormat("nb-NO", { ...options, timeZone: ZONE }).format(days(index + 1)[index]?.day)
  );
}

/**
 * The pill.
 *
 * @param host - The rendered page's host.
 * @returns The pill's element.
 */
export function slotLabel(host: HTMLElement): HTMLElement {
  const pill = host.querySelector<HTMLElement>('[data-slot="chart-slot-label"]');
  if (pill === null) throw new Error("no slot label");
  return pill;
}

/**
 * The pill's parts, each a clipped column holding its stack of values.
 *
 * @param host - The rendered page's host.
 * @returns The parts in order.
 */
export function parts(host: HTMLElement): HTMLElement[] {
  return [...slotLabel(host).querySelectorAll<HTMLElement>('[data-part="part"]')];
}

/**
 * The value each part shows: the item of its stack that sits in the part's clipped line.
 *
 * @param host - The rendered page's host.
 * @returns The shown items in order.
 */
export function shown(host: HTMLElement): HTMLElement[] {
  return parts(host).flatMap((part) => {
    const top = part.getBoundingClientRect().top;
    const item = [...part.querySelectorAll<HTMLElement>('[data-part="stack"] > span')].find(
      (candidate) => Math.abs(candidate.getBoundingClientRect().top - top) < 0.5
    );
    return item === undefined ? [] : [item];
  });
}

/**
 * The label the pill shows.
 *
 * @param host - The rendered page's host.
 * @returns The text, with plain spaces.
 */
export function shownText(host: HTMLElement): string {
  return spaced(
    shown(host)
      .map((item) => item.textContent)
      .join("")
  );
}

/**
 * The box of an item's text itself, which a wider box around it cannot hide.
 *
 * @param item - A shown item.
 * @returns The text's client box.
 */
export function textBox(item: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(item);
  return range.getBoundingClientRect();
}

/**
 * The client box of the label the pill shows.
 *
 * @param host - The rendered page's host.
 * @returns The union of the shown texts' boxes.
 */
export function shownBox(host: HTMLElement): DOMRect {
  const boxes = shown(host).map(textBox);
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/** Play every glide and fade to its end. */
export function settle(): void {
  for (const animation of document.getAnimations()) animation.finish();
}

/**
 * Point at the middle of slot `index` of `count`, halfway down the plot, as a hand does.
 *
 * @param host - The rendered page's host.
 * @param index - The slot.
 * @param count - The slots in the plot.
 */
export async function hoverSlot(host: HTMLElement, index: number, count: number): Promise<void> {
  const surface = host.querySelector<HTMLElement>('[role="listbox"]');
  if (surface === null) throw new Error("no plot");
  const box = surface.getBoundingClientRect();
  await userEvent.hover(surface, {
    position: { x: (box.width * (index + 0.5)) / count, y: box.height / 2 },
    force: true,
  });
  settle();
}
