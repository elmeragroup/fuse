/**
 * Unit under test: the side paddings of the Button set, as the kit builds them, resolved in an
 * in-memory Figma file that the token sync wrote. The fake resolves each alias in the frame's mode
 * for the alias target's collection, as Figma does.
 * Oracle: Chromium's computed `padding-left` and `padding-right` of the real Fuse `<Button>`, on
 * Fuse's built CSS with the page stamped as `test:compare` stamps the same modes. The Button
 * capture is neutral, so only a pinned branded theme reaches the floor that lifts a dense label
 * edge (issue #858).
 *
 * The page draws each Button once and measures it under every combination of the file's modes.
 * A case names an identity and a density and compares the Button under every pin that takes them,
 * so a wrong value in any brand, scheme or segment copy of a padding fails the case. The file and
 * its pins come from `sweptFile` in `test/mode-sweep.ts`, which stops unless the pins are one per
 * scheme, identity, segment, brand and density mode of the theme catalog, so a mode the sync drops
 * or doubles fails every case.
 *
 * The recipe pads a label Button by its size, by a leading or trailing `data-icon` child and by
 * the floor, which a ButtonGroup clears. No padding class sits under a hover, focus, active,
 * disabled or invalid variant, so the table measures rest and pending, whose spinner is a leading
 * `data-icon` child that the markup draws. Every variant pads alike, so the table measures the
 * default one.
 *
 * The sync keeps each identity's floor in a table of its own, since the theme catalog does not
 * carry it, so a second check reads `--button-label-px-min` in Chromium under every pin and
 * compares it with the synced `button-label-px-min`.
 *
 * Data table filter bar's filtered cell holds Button instances: the chip's operator and value
 * segments, which set `--button-px-floor: 0px`, and Clear, which keeps the floor. An instance draws
 * its main's padding unless it overrides it, so a third check compares the padding each of them
 * draws, its override's or its Button variant's, with the real bar's segments in Chromium.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { named, pixelsIn, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptFile, SweptMode } from "../../test/mode-sweep.ts";
import { labelButton } from "../compare/button-cell.ts";
import { dataTableFilterBar } from "../compare/data-table-filter-cell.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { STYLES_LAYERS } from "../compare/preview-page.ts";
import { themeStamps } from "../compare/preview-theme.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import { BUTTON_LABEL_SIZES } from "./button-kit.ts";
import { walkLayers } from "./kit-spec.ts";
import type { InstanceLayerSpec, NumberSpec } from "./kit-spec.ts";

/** The Button set's `state` and `icon` values that place a different element at a label edge. */
const EDGES = [
  { state: "rest", icon: "none", label: "no icon" },
  { state: "rest", icon: "start", label: "start icon" },
  { state: "rest", icon: "end", label: "end icon" },
  { state: "pending", icon: "none", label: "no icon" },
  { state: "pending", icon: "end", label: "end icon" },
] as const;

/** The identity and density modes the table pins, as the file names them, each with the name its case shows. */
const IDENTITIES = [
  { mode: "Neutral", label: "neutral" },
  { mode: "Branded", label: "branded" },
] as const;
const DENSITIES = [
  { mode: "Dense", label: "dense" },
  { mode: "Comfortable", label: "comfortable" },
] as const;

/** A Button of the set that the page draws, at a label size with an element at its edges. */
type TableButton = {
  readonly name: string;
  /** The Button's variant key in the built kit. */
  readonly key: string;
  readonly properties: Readonly<Record<string, string>>;
};

const BUTTONS: readonly TableButton[] = BUTTON_LABEL_SIZES.flatMap((size) =>
  EDGES.map((edge) => ({
    name: `${size} / ${edge.state} / ${edge.label}`,
    key: `button/variant=default,size=${size},state=${edge.state},icon=${edge.icon}`,
    properties: { variant: "default", size, state: edge.state, icon: edge.icon },
  }))
);

/** One row of the table: a Button of the page under the pins that take an identity and a density. */
type PaddingCase = {
  readonly name: string;
  readonly identity: (typeof IDENTITIES)[number]["mode"];
  readonly density: (typeof DENSITIES)[number]["mode"];
  /** The Button's variant key in the built kit. */
  readonly key: string;
  /** The Button's index in `BUTTONS`. */
  readonly button: number;
};

const CASES: readonly PaddingCase[] = IDENTITIES.flatMap((identity) =>
  DENSITIES.flatMap((density) =>
    BUTTONS.map((button, index) => ({
      name: `${identity.label} / ${density.label} / ${button.name}`,
      identity: identity.mode,
      density: density.mode,
      key: button.key,
      button: index,
    }))
  )
);

/** The Data table filter bar cell whose Button instances the third check measures. */
const FILTER_VARIANT = "data-table-filter-bar/state=rest,filters=status";

/** The bar's Button instances, by the key of their layer and the `data-slot` of their element. */
const FILTER_BUTTONS = [
  { key: "operator", slot: "data-table-filter-operator" },
  { key: "value", slot: "data-table-filter-value" },
  { key: "clear", slot: "data-table-filter-clear" },
] as const;

/** One row of the third check: a Button instance of the bar under the pins that take an identity and a density. */
type FilterCase = {
  readonly name: string;
  readonly identity: (typeof IDENTITIES)[number]["mode"];
  readonly density: (typeof DENSITIES)[number]["mode"];
  /** The instance's index in `FILTER_BUTTONS`. */
  readonly button: number;
};

const FILTER_CASES: readonly FilterCase[] = IDENTITIES.flatMap((identity) =>
  DENSITIES.flatMap((density) =>
    FILTER_BUTTONS.map((button, index) => ({
      name: `${identity.label} / ${density.label} / ${button.key}`,
      identity: identity.mode,
      density: density.mode,
      button: index,
    }))
  )
);

/** Where the page shows each Button and the filtered bar, and the element that reads the floor. */
function tableDocument(css: string): string {
  const slots = [
    ...BUTTONS.map(
      (button, index) =>
        `<div data-button="${String(index)}">${renderToStaticMarkup(labelButton.element(button.properties, new Set()))}</div>`
    ),
    `<div data-filter>${renderToStaticMarkup(dataTableFilterBar.element({ state: "rest", filters: "status" }, new Set()))}</div>`,
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
${css}
</style></head><body><div data-floor style="width: var(--button-label-px-min)"></div>${slots.join("\n")}</body></html>`;
}

/** What Chromium computes under one pin, in CSS pixels. */
type Measured = {
  /** The width of an element whose `width` is `var(--button-label-px-min)`. */
  readonly floor: number;
  /** Each Button's sides, in `BUTTONS` order. */
  readonly sides: readonly { readonly left: number; readonly right: number }[];
  /** The sides of each of the bar's Buttons, in `FILTER_BUTTONS` order. */
  readonly filterSides: readonly { readonly left: number; readonly right: number }[];
};

/** Stamp each pin's theme in turn and read the floor and every case's side paddings. */
function measurePins(page: Page, stamps: readonly ThemeStamps[]): Promise<readonly Measured[]> {
  return page.evaluate(
    ({ pins, slots }) =>
      pins.map((pin) => {
        for (const [name, value] of Object.entries(pin.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(pin.body)) {
          document.body.setAttribute(name, value);
        }
        const floor = document.querySelector("[data-floor]");
        if (floor === null) {
          throw new Error("the page holds no floor probe");
        }
        const sides = [...document.querySelectorAll("[data-button]")].map((slot) => {
          const button = slot.firstElementChild;
          if (button === null) {
            throw new Error("a slot holds no Button");
          }
          const style = getComputedStyle(button);
          return { left: Number.parseFloat(style.paddingLeft), right: Number.parseFloat(style.paddingRight) };
        });
        const filterSides = slots.map((slot) => {
          const button = document.querySelector(`[data-filter] [data-slot="${slot}"]`);
          if (button === null) {
            throw new Error(`the bar holds no ${slot}`);
          }
          const style = getComputedStyle(button);
          return { left: Number.parseFloat(style.paddingLeft), right: Number.parseFloat(style.paddingRight) };
        });
        return { floor: floor.getBoundingClientRect().width, sides, filterSides };
      }),
    { pins: stamps, slots: FILTER_BUTTONS.map(({ slot }) => slot) }
  );
}

let browser: Browser | undefined;
let kit: BuiltSets;
let file: SweptFile;
let measured: readonly Measured[];

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(tableDocument(`${assets.styles}\n${assets.themes}`));
  measured = await measurePins(
    page,
    file.modes.map(({ theme }) => themeStamps(theme))
  );
});

/** The file's pins that take an identity and a density, each with its index among the file's. */
function pinsTaking(
  identity: string,
  density: string
): readonly { readonly mode: SweptMode; readonly index: number }[] {
  return file.modes.flatMap((mode, index) =>
    mode.pin["Fuse identity"] === identity && mode.pin["Fuse density"] === density ? [{ mode, index }] : []
  );
}

afterAll(async () => {
  await browser?.close();
});

// A case compares only the pins `pinsTaking` gives it, so a mode the catalog spells otherwise than
// `IDENTITIES` or `DENSITIES` would leave its cases nothing to compare.
describe("the pins the cases compare", () => {
  it("give each pin of the file to one identity and density, and some pins to each", () => {
    const groups = IDENTITIES.flatMap((identity) =>
      DENSITIES.map((density) => ({
        name: `${identity.label} / ${density.label}`,
        indexes: pinsTaking(identity.mode, density.mode).map(({ index }) => index),
      }))
    );
    expect([
      groups.filter(({ indexes }) => indexes.length === 0).map(({ name }) => name),
      groups.flatMap(({ indexes }) => indexes).toSorted((left, right) => left - right),
    ]).toEqual([[], file.modes.map((_, index) => index)]);
  });
});

describe("the Button set's side paddings", () => {
  it.each(CASES)(
    "pads $name as Chromium pads the real Button under every pin",
    ({ identity, density, key, button }) => {
      const root = variantRoot(kit.spec, key);
      const apart = pinsTaking(identity, density).flatMap(({ mode, index }) => {
        const synced = {
          left: pixelsIn(file.figma, root.paddingLeft, mode),
          right: pixelsIn(file.figma, root.paddingRight, mode),
        };
        const computed = measured[index]?.sides[button];
        return computed !== undefined && synced.left === computed.left && synced.right === computed.right
          ? []
          : [`${named(mode)}: synced ${JSON.stringify(synced)}, Chromium ${JSON.stringify(computed)}`];
      });
      expect(apart).toEqual([]);
    }
  );
});

describe("the synced Button label floor", () => {
  it("holds what Chromium computes for --button-label-px-min under every pin", () => {
    const floor: NumberSpec = {
      kind: "variable",
      variable: { collection: "Fuse tokens", name: "button-label-px-min" },
    };
    const apart = file.modes.flatMap((mode, index) => {
      const synced = pixelsIn(file.figma, floor, mode);
      const computed = measured[index]?.floor;
      return synced === computed
        ? []
        : [`${named(mode)}: synced ${JSON.stringify(synced)}, Chromium ${String(computed)}`];
    });
    expect(apart).toEqual([]);
  });
});

/**
 * The padding an instance draws on a side: its own override's, or else its Button variant's root's,
 * as an instance shows its main's fields until it overrides them.
 */
function drawnPadding(instance: InstanceLayerSpec, side: "paddingLeft" | "paddingRight"): NumberSpec {
  const [own] = (instance.overrides ?? []).flatMap((override) =>
    override.path.length === 0 && override.field === side ? [override.value] : []
  );
  return own ?? variantRoot(kit.spec, instance.variant)[side];
}

describe("Data table filter bar's Button instances", () => {
  it.each(FILTER_CASES)(
    "pad $name as Chromium pads the real bar's Button under every pin",
    ({ identity, density, button }) => {
      const key = FILTER_BUTTONS[button]?.key;
      const instance = walkLayers(variantRoot(kit.spec, FILTER_VARIANT)).find(
        (layer): layer is InstanceLayerSpec => layer.kind === "instance" && layer.key === key
      );
      if (instance === undefined) {
        throw new Error(`${FILTER_VARIANT} holds no ${String(key)} instance`);
      }
      const apart = pinsTaking(identity, density).flatMap(({ mode, index }) => {
        const synced = {
          left: pixelsIn(file.figma, drawnPadding(instance, "paddingLeft"), mode),
          right: pixelsIn(file.figma, drawnPadding(instance, "paddingRight"), mode),
        };
        const computed = measured[index]?.filterSides[button];
        return computed !== undefined && synced.left === computed.left && synced.right === computed.right
          ? []
          : [`${named(mode)}: synced ${JSON.stringify(synced)}, Chromium ${JSON.stringify(computed)}`];
      });
      expect(apart).toEqual([]);
    }
  );
});
