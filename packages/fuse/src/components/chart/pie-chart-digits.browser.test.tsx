// A pie centre's digits under hover steps and at rest, in Chromium with motion on. Unit under test:
// PieChart.CenterValue's digit roll. Each describe names its oracle.
import interUrl from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import { describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../../dist/styles.css";
import { frame, rectOf } from "../../../test/chart/panel-readers";
import { clientPoint, dialPoint, hoverAt, pieSvg } from "../../../test/chart/pie";
import { emulatePixelRatio } from "../../../test/page-metrics";
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
  // Oracle, from the rule: a hover step that lands less than 150 ms after the last one swaps the
  // digits at once, with no reel transition, while one that comes 150 ms or more after the last rolls
  // its reels. The slices hold 412, 268 and 154 kr, three digits each, so their reels line up and a
  // step that rolls moves every changed reel.
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

/** Font sizes whose line, 1.2 of the size, is no whole number of pixels. */
const SIZES = [12.25, 13, 13.5, 14.25, 15.5, 16, 16.25, 17, 18.5, 19];

/** Two totals that hold every figure once between them. */
const TOTALS = [12345, 67890];

/** Sub-pixel offsets that set each pie's line at another fraction of a pixel. */
const NUDGES = [0, 0.3, 0.55, 0.8];

/** A small pie of one slice whose centre prints its total at a font size, in red. */
function Total({ kr, size, nudge }: { readonly kr: number; readonly size: number; readonly nudge: number }) {
  return (
    <div style={{ width: 124, paddingTop: nudge }}>
      <PieChart.Root
        data={[{ part: "energi", kr }]}
        config={{ energi: { label: "Energi", color: "chart-1" } }}
        nameKey="part"
        valueKey="kr"
        innerRadius={0.9}
        data-intro="none"
        aria-label="Regning"
        style={{ "--chart-polar-size": "7.5rem" }}>
        <PieChart.Pie />
        <PieChart.Center>
          <PieChart.CenterValue style={{ fontSize: size, color: "rgb(255 0 0)" }} />
        </PieChart.Center>
      </PieChart.Root>
    </div>
  );
}

/** The CDP call that captures the page's pixels, which only Chromium serves. */
type ScreenshotCdp = {
  readonly send: (
    method: "Page.captureScreenshot",
    params: {
      readonly format: "png";
      readonly clip: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
        readonly scale: number;
      };
    }
  ) => Promise<{ readonly data: string }>;
};

/** An ink reading of a captured box, from 0 for none to 1 for full, at a device pixel. */
type Ink = (x: number, y: number) => number;

/**
 * A client box's pixels at the device's ratio, as two inks: red text darkens the blue channel, and
 * blue text the red one.
 */
async function inks(
  box: DOMRect
): Promise<{ readonly scale: number; readonly red: Ink; readonly blue: Ink }> {
  if (box.bottom > innerHeight || box.right > innerWidth) throw new Error("expected the box in the frame");
  const offset = window.frameElement?.getBoundingClientRect() ?? new DOMRect();
  // SAFETY: Vitest types its CDP session as {}; Playwright's session implements send.
  const session = cdp() as ScreenshotCdp;
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    clip: {
      x: offset.left + box.left,
      y: offset.top + box.top,
      width: box.width,
      height: box.height,
      scale: 1,
    },
  });
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("expected a 2d canvas");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const ink =
    (channel: number): Ink =>
    (x, y) =>
      1 - (pixels[(y * canvas.width + x) * 4 + channel] ?? 255) / 255;
  return { scale: canvas.width / box.width, red: ink(2), blue: ink(0) };
}

/** The ink-weighted mean device row of a device rectangle, failing where it holds no ink. */
function inkRow(ink: Ink, area: { left: number; right: number; top: number; bottom: number }): number {
  let rows = 0;
  let total = 0;
  for (let y = area.top; y < area.bottom; y++) {
    for (let x = area.left; x < area.right; x++) {
      rows += ink(x, y) * (y + 0.5);
      total += ink(x, y);
    }
  }
  if (total < 1) throw new Error("expected ink in the area");
  return rows / total;
}

/** The same characters as plain text, in the digits' font and line height, laid over them in blue. */
function plainTwin(digits: HTMLElement, figures: string): HTMLElement {
  const box = rectOf(digits);
  const style = getComputedStyle(digits);
  const twin = document.createElement("span");
  Object.assign(twin.style, {
    position: "fixed",
    left: `${String(box.left)}px`,
    top: `${String(box.top)}px`,
    display: "inline-flex",
    whiteSpace: "pre",
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontVariantNumeric: style.fontVariantNumeric,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    color: "rgb(0 0 255)",
    mixBlendMode: "multiply",
  });
  let next = 0;
  for (const child of digits.children) {
    const glyph = document.createElement("span");
    glyph.textContent = child.matches('[data-part="digit"]') ? (figures[next++] ?? "") : child.textContent;
    twin.append(glyph);
  }
  return twin;
}

describe("the centre's digits at rest", () => {
  // Oracle: the browser's own text. A reel at rest shows one digit, which paints on the device rows
  // the same characters paint as plain text laid over the reels in their font and line height. The
  // reels draw in red and the text in blue, multiplied, so each keeps its own channel, and both sit at
  // one horizontal sub-pixel position. A reel resting a fraction of a pixel off its line draws its
  // digit a whole device pixel or two above or below the text, by digit, font size and position.
  it.each([1, 1.5, 2])("paints each digit on plain text's rows at a %sx pixel ratio", async (ratio) => {
    const inter = new FontFace("Fuse Test Inter", `url(${interUrl})`);
    document.fonts.add(await inter.load());
    await emulatePixelRatio(ratio, { width: 1024, height: 960 });
    const cases = SIZES.flatMap((size, row) =>
      TOTALS.map((kr, column) => ({ size, kr, nudge: NUDGES[(row + column) % NUDGES.length] ?? 0 }))
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div
          data-sheet=""
          style={{ display: "flex", flexWrap: "wrap", fontFamily: '"Fuse Test Inter"', background: "#fff" }}>
          {cases.map(({ size, kr, nudge }) => (
            <Total key={`${String(size)}-${String(kr)}`} kr={kr} size={size} nudge={nudge} />
          ))}
        </div>
      </LocaleProvider>
    );
    await document.fonts.ready;
    await expect.poll(() => rolling(host)).toBe(0);
    // DOM audit: the reels are aria-hidden plot text, read by their part.
    const numbers = [
      ...host.querySelectorAll<HTMLElement>('[data-slot="pie-chart-center-value"] [data-part="digits"]'),
    ];
    expect(numbers).toHaveLength(cases.length);
    const twins = numbers.map((digits, index) => plainTwin(digits, String(cases[index]?.kr)));
    document.body.append(...twins);
    await frame();
    await frame();
    const sheet = rectOf(host.querySelector("[data-sheet]"));
    const image = await inks(sheet);
    for (const twin of twins) twin.remove();
    const misplaced: string[] = [];
    for (const [index, digits] of numbers.entries()) {
      const figures = String(cases[index]?.kr);
      // DOM audit: each figure's reel sits in its own cell, in the number's order.
      const cells = [...digits.querySelectorAll('[data-part="digit"]')];
      expect(cells).toHaveLength(figures.length);
      for (const [at, cell] of cells.entries()) {
        const box = rectOf(cell);
        const area = {
          left: Math.ceil((box.left - sheet.left) * image.scale),
          right: Math.floor((box.right - sheet.left) * image.scale),
          top: Math.floor((box.top - sheet.top) * image.scale) - 3,
          bottom: Math.ceil((box.bottom - sheet.top) * image.scale) + 3,
        };
        const offset = inkRow(image.red, area) - inkRow(image.blue, area);
        if (Math.abs(offset) >= 0.5) {
          misplaced.push(
            `${figures[at] ?? ""} at ${getComputedStyle(digits).fontSize}: ${offset.toFixed(2)} device px`
          );
        }
      }
    }
    expect(misplaced).toEqual([]);
  });
});
