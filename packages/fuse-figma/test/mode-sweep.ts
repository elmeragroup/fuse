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

/** Every combination of the file's collection modes, one mode per collection. */
function everyPin(figma: InMemoryFigma): readonly Pin[] {
  return figma
    .collectionNames()
    .reduce<readonly Pin[]>(
      (pins, collection) =>
        pins.flatMap((pin) => figma.modeNames(collection).map((mode) => ({ ...pin, [collection]: mode }))),
      [{}]
    );
}

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
  const pins = everyPin(figma);
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
  const stamped = new Set(modes.map(({ theme }) => JSON.stringify(themeStamps(theme))));
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
  const value = figma.resolve(length.variable.collection, length.variable.name, mode.pin);
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
  const value = figma.resolve(color.variable.collection, color.variable.name, mode.pin);
  if (!isRgba(value)) {
    throw new Error(`${color.variable.name} resolves to no color under ${named(mode)}`);
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
          return {
            place: placeOf(element),
            styles: Object.fromEntries(
              input.properties.map((property) => [property, style.getPropertyValue(property)])
            ),
          };
        })
    );
  });
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
      const themes = new Map(
        modes.map(({ theme }) => {
          const stamps = themeStamps(theme);
          return [JSON.stringify(stamps), stamps] as const;
        })
      );
      const themeKeys = [...themes.keys()];
      const read = yield* browser.openPreview(
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
          return opened.page.evaluate(readEveryTheme, {
            cells: cells.map(({ request }) =>
              request.measured.map((selector) => cellSelector(request.id, selector))
            ),
            stamps: [...themes.values()],
            properties,
          });
        }
      );
      return modes.flatMap((mode) => {
        const at = themeKeys.indexOf(JSON.stringify(themeStamps(mode.theme)));
        return cells.map(({ key, cell }, index) => ({ key, cell, mode, elements: read[at]?.[index] ?? [] }));
      });
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
}
