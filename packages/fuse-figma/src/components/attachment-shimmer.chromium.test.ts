/**
 * Unit under test: the fill of the title of each `uploading` and `processing` Attachment variant as
 * the kit builds it, resolved through the file `figma:sync` writes under every pick of one mode per
 * collection. Oracle: Chromium's paint of the real Fuse Attachment's title in that state, rendered
 * as the capture and compare pages render the cell (`compare/attachment-cell.ts`), on Fuse's built
 * CSS with animations off, as those pages turn them off (`compare/preview-page.ts`).
 *
 * The page stamps each theme once and paints each title twice on the same layout: as Fuse paints
 * it, and through the same text clip in one flat color, the kit's fill resolved under each pick that
 * stamps that theme. The two must match within {@link TOLERANCE} for every pick, with the docs demo's
 * file name and with one long enough that the title truncates. The test goes red where any pick resolves the kit's title to
 * another fill, and where Fuse's CSS moves the resting highlight onto the glyphs.
 *
 * A control row holds the highlight on the glyphs, as the running sweep does as it passes over
 * them, and must differ from the kit's paint past the tolerance, so the comparison can see a
 * highlight where one paints.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import { openFusePage } from "../../test/fuse-page.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { colorIn, named, stampsOf, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import { attachment } from "../compare/attachment-cell.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import { crop, decodePng } from "../compare/raster.ts";
import type { Raster } from "../compare/raster.ts";
import { ATTACHMENT_TITLE_TEXT } from "./attachment-kit.ts";
import { walkLayers } from "./kit-spec.ts";
import type { ColorSpec } from "./kit-spec.ts";

/**
 * How far apart, out of 255 in any channel, a pixel of a shimmering title and of the same title in
 * the kit's fill may sit. The band's edge in the end corner tints a truncated title's ellipsis a few
 * levels. A highlight on the glyphs sits far past it, as the control row shows.
 *
 * The kit's twin paints through `background-clip: text` as Fuse's title does, because Chromium
 * rasterizes clipped glyphs on another path than glyphs in their own fill. On Linux, plain text gets
 * subpixel (LCD) antialiasing and clipped text gets grayscale antialiasing, so the same glyphs in
 * the same color differ by about 93 levels at their edges.
 */
const TOLERANCE = 8;

/** The sizes the set draws. */
const SIZES = ["default", "sm", "xs"] as const;

/** The states that sweep the title. */
const SHIMMERING = ["uploading", "processing"] as const;

/**
 * The titles each size renders: the docs demo's file name, and one too long for the title at any
 * size, which CSS truncates with an ellipsis.
 */
const TEXTS = {
  demo: ATTACHMENT_TITLE_TEXT,
  long: "2026-11-quarterly-meter-readings-for-every-substation-in-the-northern-grid-region-final-signed.pdf",
} as const;

type TextName = keyof typeof TEXTS;

/**
 * How a row paints its title: as Fuse paints it, through the text clip in the kit's fill alone, or
 * with the highlight held on the glyphs.
 */
type Paint = "fuse" | "kit" | "control";

/**
 * Where the control centers its highlight, in CSS pixels from the title box's start: on the glyphs,
 * as the running sweep passes over them.
 */
const CONTROL_CENTER_PX = 24;

/** The control's highlight spread, in CSS pixels, near `3ch + 40px` at the title's sizes. */
const CONTROL_SPREAD_PX = 60;

/** A row the page draws. */
type Row = {
  readonly size: (typeof SIZES)[number];
  readonly state: (typeof SHIMMERING)[number];
  readonly text: TextName;
  readonly paint: Paint;
};

const ROWS: readonly Row[] = SIZES.flatMap((size) =>
  (["demo", "long"] as const).flatMap((text) => [
    ...SHIMMERING.flatMap((state) =>
      (["fuse", "kit"] as const).map((paint) => ({ size, state, text, paint }))
    ),
    { size, state: "uploading" as const, text, paint: "control" as const },
  ])
);

function rowId(row: Row): string {
  return `${row.size}/${row.state}/${row.text}/${row.paint}`;
}

/**
 * The page's body: each row as the compare page renders the cell, in a host whose whole-pixel
 * height keeps every title on the same fraction of a pixel.
 */
function rowsBody(): string {
  return ROWS.map(
    (row) =>
      `<div data-row="${rowId(row)}" data-text="${row.text}" data-paint="${row.paint}" style="height:96px">${renderToStaticMarkup(attachment.element({ size: row.size, state: row.state }, new Set()))}</div>`
  ).join("\n");
}

function stampsKey(stamps: ThemeStamps): string {
  const sorted = (record: Readonly<Record<string, string>>) =>
    Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([sorted(stamps.root), sorted(stamps.body)]);
}

/** A theme the page stamps, with every pick of modes that stamps it. */
type Theme = { readonly stamps: ThemeStamps; readonly pins: readonly SweptMode[] };

/** The file's picks of modes, grouped by the theme each stamps on the page. */
function themesOf(pins: readonly SweptMode[]): readonly Theme[] {
  const byKey = new Map<string, { stamps: ThemeStamps; pins: SweptMode[] }>();
  for (const pin of pins) {
    const stamps = stampsOf(pin);
    const key = stampsKey(stamps);
    const theme = byKey.get(key) ?? { stamps, pins: [] };
    theme.pins.push(pin);
    byKey.set(key, theme);
  }
  return [...byKey.values()];
}

/**
 * A color field as the file resolves it under a pick of modes, as a CSS color.
 *
 * @throws When the variable resolves to no color, a defect in the synced file.
 */
function cssColor(figma: InMemoryFigma, color: ColorSpec, pin: SweptMode): string {
  const { r, g, b, a } = colorIn(figma, color, pin);
  return `rgb(${String(r * 255)} ${String(g * 255)} ${String(b * 255)} / ${String(a)})`;
}

/**
 * The kit title's fill for a size and state.
 *
 * @throws When the kit has no such variant, or its title frame holds no text layer.
 */
async function kitTitleColor(size: string, state: string): Promise<ColorSpec> {
  const { spec } = await builtKit();
  const title = walkLayers(variantRoot(spec, `attachment/size=${size},state=${state}`)).find(
    (layer) => layer.key === "title"
  );
  const text = title?.kind === "frame" ? title.children.find((layer) => layer.kind === "text") : undefined;
  if (text?.kind !== "text") {
    throw new Error(`the kit's attachment ${size}/${state} has no title text`);
  }
  return text.color;
}

/**
 * The largest difference, out of 255 in any channel, between two pictures.
 *
 * @throws When their sizes differ: the rows lay out alike, so a size apart is a defect of the page.
 */
function largestDifference(one: Raster, other: Raster): number {
  if (one.width !== other.width || one.height !== other.height) {
    throw new Error(
      `${String(one.width)}×${String(one.height)} and ${String(other.width)}×${String(other.height)} differ in size`
    );
  }
  let largest = 0;
  for (let index = 0; index < one.data.length; index += 1) {
    largest = Math.max(largest, Math.abs((one.data[index] ?? 0) - (other.data[index] ?? 0)));
  }
  return largest;
}

/**
 * How far one row's title sits from its kit-painted twin, the row with the same size, state and
 * text, under one pick of modes.
 */
type Measured = {
  readonly row: Row;
  readonly pin: string;
  /** Whether the title's text runs past its box, and CSS cuts it with an ellipsis. */
  readonly truncated: boolean;
  /** The largest difference, out of 255 in any channel, between the two titles' pixels. */
  readonly difference: number;
};

/** What the page reads of one title before the shot. */
type TitleBox = {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly truncated: boolean;
};

/** Stamp a theme on the page, set every title's text and the controls' highlight, and read the titles' boxes. */
async function stampTheme(page: Page, stamps: ThemeStamps): Promise<readonly TitleBox[]> {
  return page.evaluate(
    async (each) => {
      for (const [name, value] of Object.entries(each.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(each.body)) {
        document.body.setAttribute(name, value);
      }
      const rows = [...document.querySelectorAll<HTMLElement>("[data-row]")];
      const titleOf = (row: HTMLElement) => {
        const title = row.querySelector<HTMLElement>('[data-slot="attachment-title"]');
        if (title === null) {
          throw new Error(`row ${row.dataset.row ?? ""} has no title`);
        }
        return title;
      };
      for (const row of rows) {
        titleOf(row).textContent = row.dataset.text === "long" ? each.texts.long : each.texts.demo;
      }
      await Promise.all(rows.map((row) => document.fonts.load(getComputedStyle(titleOf(row)).font)));
      await document.fonts.ready;
      for (const row of rows.filter((each) => each.dataset.paint === "control")) {
        // The gradient image is as wide as the title box and twice the spread, as the utility
        // sizes it, placed so that its center, where the highlight peaks, sits on the glyphs.
        const title = titleOf(row);
        const width = title.getBoundingClientRect().width;
        title.style.setProperty("--shimmer-spread", `${String(each.spread)}px`);
        title.style.backgroundSize = `${String(width * 2 + each.spread * 2)}px 100%`;
        title.style.backgroundPosition = `${String(each.center - width - each.spread)}px 0`;
      }
      return rows.map((row) => {
        const title = titleOf(row);
        const box = title.getBoundingClientRect();
        return {
          id: row.dataset.row ?? "",
          left: Math.floor(box.left + window.scrollX),
          top: Math.floor(box.top + window.scrollY),
          right: Math.ceil(box.right + window.scrollX),
          bottom: Math.ceil(box.bottom + window.scrollY),
          truncated:
            title.scrollWidth > title.clientWidth && getComputedStyle(title).textOverflow === "ellipsis",
        } satisfies TitleBox;
      });
    },
    { ...stamps, texts: TEXTS, center: CONTROL_CENTER_PX, spread: CONTROL_SPREAD_PX }
  );
}

/**
 * Paint the kit rows' titles in their fills, by `size/state`, on the same layout: a gradient of the
 * one fill, through the text clip the shimmer utility sets.
 */
async function paintKit(page: Page, colors: Readonly<Record<string, string>>): Promise<void> {
  await page.evaluate((each) => {
    for (const row of document.querySelectorAll<HTMLElement>('[data-row][data-paint="kit"]')) {
      const title = row.querySelector<HTMLElement>('[data-slot="attachment-title"]');
      const [size = "", state = ""] = (row.dataset.row ?? "").split("/");
      const color = each[`${size}/${state}`] ?? "";
      if (title !== null) {
        title.style.backgroundImage = `linear-gradient(${color}, ${color})`;
      }
    }
  }, colors);
}

/** The kit-painted twin of a row: the row with the same size, state and text. */
function kitTwinId(row: Row): string {
  return rowId({ ...row, paint: "kit" });
}

/**
 * Shoot the page and compare each Fuse and control row's title with its kit-painted twin's in the
 * same shot.
 *
 * @throws When the page has no title box for a row.
 */
async function compareTitles(
  page: Page,
  boxes: readonly TitleBox[]
): Promise<readonly { readonly row: Row; readonly difference: number }[]> {
  const shot = decodePng(await page.screenshot({ fullPage: true }));
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const titleOf = (id: string): Raster => {
    const box = byId.get(id);
    if (box === undefined) {
      throw new Error(`the page has no title for ${id}`);
    }
    return crop(
      shot,
      { x: box.left, y: box.top },
      { width: box.right - box.left, height: box.bottom - box.top }
    );
  };
  return ROWS.filter((row) => row.paint !== "kit").map((row) => ({
    row,
    difference: largestDifference(titleOf(rowId(row)), titleOf(kitTwinId(row))),
  }));
}

/**
 * Stamp every theme once, and paint the kit's rows once for each distinct set of fills the theme's
 * picks resolve, so a fill that differs under one pick lands on that pick alone.
 */
async function measureEveryPin(
  page: Page,
  figma: InMemoryFigma,
  themes: readonly Theme[]
): Promise<readonly Measured[]> {
  const fills = new Map<string, ColorSpec>();
  for (const size of SIZES) {
    for (const state of SHIMMERING) {
      fills.set(`${size}/${state}`, await kitTitleColor(size, state));
    }
  }
  const out: Measured[] = [];
  for (const theme of themes) {
    const boxes = await stampTheme(page, theme.stamps);
    const truncated = new Map(boxes.map((box) => [box.id, box.truncated]));
    const picksByColors = new Map<string, { colors: Record<string, string>; pins: SweptMode[] }>();
    for (const pin of theme.pins) {
      const colors = Object.fromEntries([...fills].map(([key, color]) => [key, cssColor(figma, color, pin)]));
      const key = JSON.stringify(colors);
      const group = picksByColors.get(key) ?? { colors, pins: [] };
      group.pins.push(pin);
      picksByColors.set(key, group);
    }
    for (const { colors, pins } of picksByColors.values()) {
      await paintKit(page, colors);
      const differences = await compareTitles(page, boxes);
      for (const pin of pins) {
        for (const { row, difference } of differences) {
          out.push({ row, pin: named(pin), truncated: truncated.get(rowId(row)) ?? false, difference });
        }
      }
    }
  }
  return out;
}

let browser: Browser | undefined;
let themes: readonly Theme[];
let pinCount: number;
let measured: readonly Measured[];

beforeAll(async () => {
  const { figma, modes: pins } = await sweptFile();
  pinCount = pins.length;
  themes = themesOf(pins);
  browser = await chromium.launch();
  const page = await browser.newPage();
  await openFusePage(page, { body: rowsBody() });
  measured = await measureEveryPin(page, figma, themes);
});

afterAll(async () => {
  await browser?.close();
});

describe("the shimmering Attachment titles", () => {
  it.each(SIZES.flatMap((size) => SHIMMERING.map((state) => ({ size, state }))))(
    "draws the $state title at $size size in the fill Chromium paints with animations off, under every pick",
    ({ size, state }) => {
      const fuse = measured.filter(
        (each) => each.row.paint === "fuse" && each.row.size === size && each.row.state === state
      );
      expect(fuse).toHaveLength(pinCount * Object.keys(TEXTS).length);
      // The long file name must truncate.
      const whole = fuse
        .filter((each) => each.row.text === "long" && !each.truncated)
        .map((each) => each.pin);
      expect(whole).toEqual([]);
      const apart = fuse
        .filter((each) => each.difference > TOLERANCE)
        .map((each) => `${each.row.text} ${each.pin}: ${String(each.difference)}`);
      expect(apart).toEqual([]);
    }
  );

  it.each(SIZES)("sees the highlight on the glyphs at %s size under every pick", (size) => {
    const control = measured.filter((each) => each.row.paint === "control" && each.row.size === size);
    expect(control).toHaveLength(pinCount * Object.keys(TEXTS).length);
    const unseen = control
      .filter((each) => each.difference <= TOLERANCE)
      .map((each) => `${each.row.text} ${each.pin}: ${String(each.difference)}`);
    expect(unseen).toEqual([]);
  });
});
