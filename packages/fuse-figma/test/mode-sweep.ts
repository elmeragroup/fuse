/**
 * A sweep of one set's cells over every pin a designer can give a frame, on the page `figma:capture`
 * renders them on, and the in-memory Figma file the token sync writes. A Chromium test reads what
 * the browser computes for a cell under each pin and holds the built variant's fields, resolved in
 * the file under the same pin, to it, where `figma:capture --check` reads one theme only. A suite
 * that draws its own page, as the Button label padding test does, takes only the file and its pins
 * from {@link sweptFile}.
 *
 * A pin is one mode of each of the file's collections. The file resolves a field under a pin as
 * Figma does, following each alias in the mode the pin gives the alias target's collection. A brand
 * that allows one segment shows the same theme under either `Fuse segment` mode, so two pins can
 * stamp one theme, but they resolve different aliases. The page measures each theme once, and every
 * pin that stamps it reads that measurement.
 *
 * The page renders each cell from the capture's own request, so it forces the same states on the
 * same elements, and then stamps each theme on `<html>` and `<body>` in turn, as `preview-theme.ts`
 * stamps a preview's theme. A cell whose forced state changed nothing against its resting twin
 * fails the sweep, since the capture would have focused it for real and the page can focus only one
 * element at a time.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect, Result, Schema } from "effect";
import { TestConsole } from "effect/testing";
import type { Page } from "playwright";

import * as CssColor from "@elmeragroup/color/css-color";
import { BRAND_CODES, BRANDS, THEME_IDENTITIES, THEME_SEGMENTS } from "@elmeragroup/fuse/theme-catalog";

import { captureTargets } from "../src/capture/capture-targets.ts";
import { EVERY_MODE } from "../src/capture/page-modes.ts";
import { CAPTURE_THEME, requestOf } from "../src/capture/run-capture.ts";
import { CompareBrowser, forcesState } from "../src/compare/browser-render.ts";
import { loadRenderers } from "../src/compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";
import { cellSelector, PAGE_LAYOUT } from "../src/compare/preview-page.ts";
import { parsePreviewTheme, themeStamps } from "../src/compare/preview-theme.ts";
import type { PreviewTheme, ThemeStamps } from "../src/compare/preview-theme.ts";
import { possibleCells, variantKey } from "../src/components/component-spec.ts";
import type { Cell } from "../src/components/component-spec.ts";
import type { ColorSpec, NumberSpec } from "../src/components/kit-spec.ts";
import type { Rgba } from "../src/variable-set.ts";
import { FILE_KEY, run, TOKEN } from "./cli-fixture.ts";
import { InMemoryFigma } from "./in-memory-figma.ts";

/** A frame's mode for each collection of the file, by collection name. */
export type Pin = Readonly<Record<string, string>>;

/** A pin a designer can give a frame, and the theme the page stamps for it. */
export type SweptMode = {
  readonly pin: Pin;
  readonly theme: PreviewTheme;
};

/** The file the token sync writes, and every pin of its collections' modes. */
export type SweptFile = {
  readonly figma: InMemoryFigma;
  readonly modes: readonly SweptMode[];
};

const capitalized = (value: string): string => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

/**
 * The theme modes each pin takes, as the theme catalog names them: the two supported color
 * schemes, each identity, each segment, each brand by its display name, with a one-segment brand
 * marked `(<segment> only)`, and the two densities. The sync writes no other mode a theme reads.
 */
const CATALOG_MODES: ReadonlyMap<string, readonly string[]> = new Map([
  ["Fuse tokens", ["Light", "Dark"]],
  ["Fuse identity", THEME_IDENTITIES.map(capitalized)],
  ["Fuse segment", THEME_SEGMENTS.map(capitalized)],
  [
    "Fuse brand",
    BRAND_CODES.map((code) => {
      const [only, ...others] = BRANDS[code].segments;
      return others.length === 0 ? `${BRANDS[code].displayName} (${only} only)` : BRANDS[code].displayName;
    }),
  ],
  ["Fuse density", ["Dense", "Comfortable"]],
]);

/** A pin's theme modes, in the catalog's collection order. */
const themeModesOf = (pin: Pin): string =>
  [...CATALOG_MODES.keys()].map((collection) => pin[collection] ?? "").join(" / ");

/** The theme modes the file's pins must take, once each. */
const CATALOG_PINS: readonly string[] = [...CATALOG_MODES.values()]
  .reduce<readonly string[]>(
    (pins, modes) => pins.flatMap((pin) => modes.map((mode) => (pin === "" ? mode : `${pin} / ${mode}`))),
    [""]
  )
  .toSorted();

async function syncFile(): Promise<SweptFile> {
  const figma = new InMemoryFigma(FILE_KEY, TOKEN);
  await Effect.runPromise(
    run(figma, ["--file-key", FILE_KEY, "sync"]).pipe(Effect.provide(TestConsole.layer))
  );
  const pins = figma.everyPin();
  if (JSON.stringify(pins.map(themeModesOf).toSorted()) !== JSON.stringify(CATALOG_PINS)) {
    throw new Error("the sync's modes are not one per scheme, identity, segment, brand and density");
  }
  const modes = pins.map((pin) => {
    const theme = parsePreviewTheme(Object.entries(pin).map(([collection, mode]) => ({ collection, mode })));
    if (Result.isFailure(theme)) {
      throw new Error(theme.failure.message);
    }
    return { pin, theme: theme.success };
  });
  const stamped = new Set(modes.map((mode) => JSON.stringify(stampsOf(mode))));
  const measured = new Set(EVERY_MODE.map((mode) => JSON.stringify(mode)));
  if (stamped.size !== measured.size || [...stamped].some((stamps) => !measured.has(stamps))) {
    throw new Error("the sync's pins stamp other themes than the capture measures");
  }
  return { figma, modes };
}

let synced: Promise<SweptFile> | undefined;

/**
 * Sync the Fuse tokens into an in-memory file through the CLI on the first call, and read every pin
 * of its collections' modes with the theme each stamps.
 *
 * @returns The file and its pins.
 * @throws When the pins are not the catalog's, one each, or stamp other themes than
 *   `EVERY_MODE`, the modes the capture measures.
 */
export function sweptFile(): Promise<SweptFile> {
  synced ??= syncFile();
  return synced;
}

/** A pin as a failure names it. */
export const named = (mode: SweptMode): string => Object.values(mode.pin).join(" / ");

/**
 * The attributes that stamp a page with a pin's theme, as `test:compare` stamps a preview.
 *
 * @param mode - The pin and its theme.
 * @returns The stamps on the root and the body.
 */
export const stampsOf = (mode: SweptMode): ThemeStamps => themeStamps(mode.theme);

/**
 * A built field under a pin, unchecked: a literal's value, or what its variable resolves to in the
 * file. A suite that shows a wrong kind of value in its mismatch line, rather than stopping on it,
 * reads the field through this.
 *
 * @param figma - The file the token sync wrote.
 * @param field - The field's value in the spec.
 * @param mode - The pin to resolve the variable under.
 * @returns The value the file renders.
 */
export function resolvedIn(
  figma: InMemoryFigma,
  field: NumberSpec | ColorSpec,
  mode: SweptMode
): ReturnType<InMemoryFigma["resolve"]> {
  if (field.kind === "variable") {
    return figma.resolve(field.variable.collection, field.variable.name, mode.pin);
  }
  return "value" in field ? field.value : field.color;
}

const isNumber = Schema.is(Schema.Number);

/**
 * A built length under a pin: a literal's value, or the number its variable resolves to in the file.
 *
 * @throws When the variable resolves to no number.
 */
export function pixelsIn(figma: InMemoryFigma, length: NumberSpec, mode: SweptMode): number {
  if (length.kind === "literal") {
    return length.value;
  }
  const value = resolvedIn(figma, length, mode);
  if (!isNumber(value)) {
    throw new Error(`${length.variable.name} resolves to no number under ${named(mode)}`);
  }
  return value;
}

const isRgba = Schema.is(
  Schema.Struct({ r: Schema.Number, g: Schema.Number, b: Schema.Number, a: Schema.Number })
);

/**
 * A built color under a pin: a literal, or the color its variable resolves to in the file.
 *
 * @throws When the variable resolves to no color.
 */
export function colorIn(figma: InMemoryFigma, color: ColorSpec, mode: SweptMode): Rgba {
  if (color.kind === "literal") {
    return color.color;
  }
  const value = resolvedIn(figma, color, mode);
  if (!isRgba(value)) {
    throw new Error(`${color.variable.name} resolves to ${String(value)}, no color, under ${named(mode)}`);
  }
  return value;
}

/**
 * A computed color as sRGB, parsed through `@elmeragroup/color`.
 *
 * @throws When the value is no CSS color.
 */
export function computedColor(value: string | undefined): Rgba {
  const parsed = CssColor.parse(value ?? "");
  if (parsed._tag === "err") {
    throw new Error(`Chromium computed ${value ?? "no value"}, which is no color`);
  }
  const { r, g, b, alpha } = CssColor.toSrgb(parsed.value);
  return { r, g, b, a: alpha };
}

/** Whether two colors sit within `tolerance`, in `0..1`, on every channel and the alpha. */
export function sameColor(left: Rgba, right: Rgba, tolerance: number): boolean {
  return (["r", "g", "b", "a"] as const).every(
    (channel) => Math.abs(left[channel] - right[channel]) <= tolerance
  );
}

/** A color as a failure names it, each channel to six places. */
export const rgba = ({ r, g, b, a }: Rgba): string =>
  [r, g, b, a].map((channel) => channel.toFixed(6)).join(" ");

/** One element of a cell as the page computes it under one theme. */
export type ComputedElement = {
  /**
   * Its place, as a manifest names a part: its own `data-slot`, or the element-ordinal path from the
   * nearest ancestor with one, such as `field/1/0`.
   */
  readonly place: string;
  /** The computed value of each property the sweep reads. */
  readonly styles: Readonly<Record<string, string>>;
  /** Its border box on the page, in CSS pixels. */
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};

/** One cell under one pin: its measured elements, then each element inside them, in document order. */
export type SweptCell = {
  readonly key: string;
  readonly cell: Cell;
  readonly mode: SweptMode;
  readonly elements: readonly ComputedElement[];
};

/** Stamp each theme on the page in turn and read the cells' computed styles under each. */
function readEveryTheme(input: {
  readonly cells: readonly (readonly string[])[];
  readonly stamps: readonly ThemeStamps[];
  readonly properties: readonly string[];
}): ComputedElement[][][] {
  const placeOf = (element: Element): string => {
    const slot = element.getAttribute("data-slot");
    const parent = element.parentElement;
    if (slot !== null || parent === null) {
      return slot ?? "";
    }
    return `${placeOf(parent)}/${String([...parent.children].indexOf(element))}`;
  };
  return input.stamps.map((stamps) => {
    for (const [name, value] of Object.entries(stamps.root)) {
      document.documentElement.setAttribute(name, value);
    }
    for (const [name, value] of Object.entries(stamps.body)) {
      document.body.setAttribute(name, value);
    }
    return input.cells.map((selectors) =>
      selectors
        .flatMap((selector) => [...document.querySelectorAll(selector)])
        .flatMap((root) => [root, ...root.querySelectorAll("*")])
        .map((element) => {
          const style = getComputedStyle(element);
          const { x, y, width, height } = element.getBoundingClientRect();
          return {
            place: placeOf(element),
            styles: Object.fromEntries(
              input.properties.map((property) => [property, style.getPropertyValue(property)])
            ),
            box: { x, y, width, height },
          };
        })
    );
  });
}

/** A set's cell as the page renders it from the capture's own request. */
type RenderedCell = {
  readonly cell: Cell;
  readonly key: string;
  readonly request: ReturnType<typeof requestOf>;
};

/**
 * Render a set's cells as `figma:capture` renders them, on a page with the kit's fonts, and read the
 * page once every forced state holds.
 *
 * @param set - The set's key.
 * @param include - Which of the set's cells to render.
 * @param read - What to read off the opened page, given the cells it renders.
 * @returns What `read` returned.
 * @throws When the kit captures no such set, or forcing left a cell at rest.
 */
function onCapturePage<T>(
  set: string,
  include: (cell: Cell) => boolean,
  read: (page: Page, cells: readonly RenderedCell[]) => Promise<T>
): Promise<T> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const [target] = captureTargets(new Set([set]));
      const renderers = yield* loadRenderers(new Set([set]));
      const renderer = renderers.get(set);
      if (target === undefined || renderer === undefined) {
        throw new Error(`the kit captures no set ${set}`);
      }
      const browser = yield* CompareBrowser.launch(
        yield* readPageAssets(yield* locateFuseBuild(), renderers)
      );
      const cells = possibleCells(target)
        .filter(include)
        .map((cell, index) => ({
          cell,
          key: variantKey(target, cell),
          request: requestOf(target, renderer, cell, index),
        }));
      return yield* browser.openPreview(
        CAPTURE_THEME,
        cells.map(({ request }) => request),
        PAGE_LAYOUT,
        async (opened) => {
          const unforced = cells.filter(
            ({ request }) => forcesState(request) && !opened.forced.has(request.id)
          );
          if (unforced.length > 0) {
            throw new Error(`forcing left ${unforced.map(({ key }) => key).join(", ")} at rest`);
          }
          return read(opened.page, cells);
        }
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
}

/**
 * Render a set's cells as `figma:capture` renders them and read the given computed properties of
 * each cell's elements under each pin. The page measures each theme the pins stamp once.
 *
 * @param set - The set's key.
 * @param include - Which of the set's cells to render.
 * @param modes - The pins to read each cell under.
 * @param properties - The CSS properties to read.
 * @returns Each cell under each pin.
 */
export function sweepSet(
  set: string,
  include: (cell: Cell) => boolean,
  modes: readonly SweptMode[],
  properties: readonly string[]
): Promise<readonly SweptCell[]> {
  const themes = new Map(
    modes.map((mode) => {
      const stamps = stampsOf(mode);
      return [JSON.stringify(stamps), stamps] as const;
    })
  );
  const themeKeys = [...themes.keys()];
  return onCapturePage(set, include, async (page, cells) => {
    const read = await page.evaluate(readEveryTheme, {
      cells: cells.map(({ request }) =>
        request.measured.map((selector) => cellSelector(request.id, selector))
      ),
      stamps: [...themes.values()],
      properties,
    });
    return modes.flatMap((mode) => {
      const at = themeKeys.indexOf(JSON.stringify(stampsOf(mode)));
      return cells.map(({ key, cell }, index) => ({ key, cell, mode, elements: read[at]?.[index] ?? [] }));
    });
  });
}

/** A run of text as a Figma text layer sets it on one line, its lengths in CSS pixels. */
export type TextRun = {
  readonly characters: string;
  readonly family: string;
  readonly weight: number;
  readonly size: number;
  /** The space added after each character, in pixels. */
  readonly letterSpacing: number;
};

/**
 * Set each run in a span of its own font and read its advance, once its face has loaded, or name the
 * fonts no face of the page matches, whose runs a fallback would set.
 */
async function readAdvances(
  runs: readonly TextRun[]
): Promise<{ readonly advances: readonly number[]; readonly missing: readonly string[] }> {
  const fontOf = ({ family, weight, size }: TextRun): string =>
    `${String(weight)} ${String(size)}px "${family}"`;
  const fonts = [...new Set(runs.map(fontOf))];
  const faces = await Promise.all(fonts.map((font) => document.fonts.load(font)));
  const missing = fonts.filter((_, index) => (faces[index] ?? []).length === 0);
  const advances = runs.map((run) => {
    const span = document.createElement("span");
    span.textContent = run.characters;
    span.style.cssText = `position:absolute;white-space:pre;font:${fontOf(run)};letter-spacing:${String(run.letterSpacing)}px`;
    document.body.append(span);
    const { width } = span.getBoundingClientRect();
    span.remove();
    return width;
  });
  return { advances, missing };
}

/**
 * The advance of each run of text, as Chromium sets it on one line on the page `figma:capture`
 * renders `set` on, which loads the kit's fonts. A test that lays a hugging text out takes its width
 * from here, from the characters and type the build gave the layer, not from the page's own text.
 *
 * @param set - The set whose page loads the faces.
 * @param runs - The runs to set.
 * @returns Each run's advance in CSS pixels, in order.
 * @throws When no face of the page matches a run's font, which would leave its advance a fallback's.
 */
export function textAdvances(set: string, runs: readonly TextRun[]): Promise<readonly number[]> {
  return onCapturePage(
    set,
    () => false,
    async (page) => {
      const { advances, missing } = await page.evaluate(readAdvances, runs);
      if (missing.length > 0) {
        throw new Error(`the page loads no face for ${missing.join(", ")}`);
      }
      return advances;
    }
  );
}
