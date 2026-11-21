/**
 * Unit under test: the widths the built `Select (open)` set gives its trigger and popup instances in
 * a root of a given width: an instance that fills the root's column is the root's content width, at
 * least its `minWidth`, and a fixed one its length. Oracle: Chromium's layout of the compare
 * renderer's open Fuse Select (`compare/select-cell.ts`) in every mode the capture measures. The page
 * mounts one cell per variant, from the variant's `size` and `width` properties alone. A hugging
 * cell sits as the renderer places it. A filling cell's host is set to each width in
 * {@link HOST_WIDTHS} in turn, which the test also gives the spec's root. Base UI sizes the popup to
 * `max(anchor, min-width)`, and the test reads each box once every positioner's `--anchor-width` is
 * its trigger's width in that mode. A host narrower than the popup's 144px minimum checks the
 * minimum, and one wider than it checks that the popup follows its trigger.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { captureTargets } from "../capture/capture-targets.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { CAPTURE_THEME, requestOf } from "../capture/run-capture.ts";
import { CompareBrowser } from "../compare/browser-render.ts";
import { loadRenderers } from "../compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { PAGE_LAYOUT } from "../compare/preview-page.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { ComponentRootSpec, InstanceLayerSpec, NumberSpec, SizeSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, the spec's width and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/**
 * The widths a filling cell's host takes in turn: the field box's 384px, a narrower column, and one
 * under the popup's 144px `min-w-36`.
 */
const HOST_WIDTHS = [384, 320, 128] as const;

const SET = "select-open";

/** One page cell: a built variant's properties and the request that renders them. */
type Sample = {
  readonly id: string;
  readonly variant: string;
  readonly width: string;
};

/** What the page reads of one cell in one mode at one host width, in CSS pixels. */
type Measured = {
  readonly id: string;
  readonly host: number | undefined;
  readonly mode: string;
  readonly trigger: number;
  readonly popup: number;
};

/** A literal length, which the spec's root and its instances carry here. */
function literal(length: NumberSpec, what: string): number {
  if (length.kind !== "literal") {
    throw new Error(`${what} binds a variable`);
  }
  return length.value;
}

/**
 * An instance's width in a root whose width is `root`, or undefined where the instance hugs, which
 * only the hugging trigger may: its length where fixed, and where it fills the root's column, the
 * root's content width, at least the instance's `minWidth`.
 */
function widthIn(
  layer: InstanceLayerSpec,
  rootSpec: ComponentRootSpec,
  root: number | undefined,
  what: string
): number | undefined {
  const sizing: SizeSpec = layer.sizing.horizontal;
  switch (sizing.kind) {
    case "hug":
      return undefined;
    case "fixed":
      return literal(sizing.length, what);
    case "fill": {
      if (root === undefined) {
        throw new Error(`${what} fills a root of no width`);
      }
      const content =
        root -
        literal(rootSpec.paddingLeft, `${what}'s root`) -
        literal(rootSpec.paddingRight, `${what}'s root`);
      return Math.max(content, layer.minWidth === undefined ? 0 : literal(layer.minWidth, what));
    }
    default:
      throw new Error(`${what} is ${sizing.kind}`);
  }
}

/** Stamp the page in a mode and load the faces its triggers' text needs in it. */
async function stamp(page: Page, mode: (typeof EVERY_MODE)[number]): Promise<void> {
  await page.evaluate(async (stamped) => {
    for (const [name, value] of Object.entries(stamped.root)) {
      document.documentElement.setAttribute(name, value);
    }
    for (const [name, value] of Object.entries(stamped.body)) {
      document.body.setAttribute(name, value);
    }
    const faces = [...document.querySelectorAll('[data-slot="select-trigger"]')].map((trigger) => {
      const style = getComputedStyle(trigger);
      return [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(" ");
    });
    await Promise.all([...new Set(faces)].map((face) => document.fonts.load(face)));
    await document.fonts.ready;
  }, mode);
}

/**
 * Read every cell's trigger and popup once every positioner's `--anchor-width` is its trigger's
 * width, which Base UI writes rounded to a whole pixel once it has measured the trigger. The wait
 * sets no timeout of its own, so a width Base UI never updates leaves only the hang guard to end the
 * test.
 */
async function readSettled(
  page: Page,
  ids: readonly string[]
): Promise<readonly { readonly id: string; readonly trigger: number; readonly popup: number }[]> {
  const handle = await page.waitForFunction(
    (expected) => {
      const read = expected.map((id) => {
        const cell = document.querySelector(`[data-compare-cell="${id}"]`);
        const trigger = cell?.querySelector('[data-slot="select-trigger"]');
        const popup = cell?.querySelector('[data-slot="select-content"]');
        const positioner = popup?.parentElement;
        if (
          trigger === null ||
          trigger === undefined ||
          popup === null ||
          popup === undefined ||
          !positioner
        ) {
          return undefined;
        }
        const width = trigger.getBoundingClientRect().width;
        const anchor = Number.parseFloat(positioner.style.getPropertyValue("--anchor-width"));
        return Math.abs(anchor - width) < 1
          ? { id, trigger: width, popup: popup.getBoundingClientRect().width }
          : undefined;
      });
      const settled = read.flatMap((each) => (each === undefined ? [] : [each]));
      return settled.length === expected.length ? settled : false;
    },
    ids,
    { polling: "raf", timeout: 0 }
  );
  const read = await handle.jsonValue();
  if (read === false) {
    throw new Error("the wait resolved before every popup settled");
  }
  return read;
}

/** Set each filling cell's host to a width; the host is the trigger's parent, as the renderer makes it. */
async function setHosts(page: Page, ids: readonly string[], width: number): Promise<void> {
  await page.evaluate(
    ({ cells, px }) => {
      for (const id of cells) {
        const trigger = document.querySelector(`[data-compare-cell="${id}"] [data-slot="select-trigger"]`);
        if (!(trigger?.parentElement instanceof HTMLElement)) {
          throw new Error(`cell ${id} holds no trigger in a host`);
        }
        trigger.parentElement.style.width = `${String(px)}px`;
      }
    },
    { cells: ids, px: width }
  );
}

/** Every cell measured in every mode: the hugging cells as they sit, each filling cell at each host width. */
async function measure(page: Page, samples: readonly Sample[]): Promise<readonly Measured[]> {
  const out: Measured[] = [];
  const all = samples.map(({ id }) => id);
  const filling = samples.filter(({ width }) => width === "fill").map(({ id }) => id);
  for (const [at, host] of HOST_WIDTHS.entries()) {
    await setHosts(page, filling, host);
    // The hugging cells do not follow the host width, so they are measured on the first pass only.
    const ids = at === 0 ? all : filling;
    for (const mode of EVERY_MODE) {
      await stamp(page, mode);
      const read = await readSettled(page, ids);
      out.push(
        ...read.map((each) => ({
          ...each,
          host: filling.includes(each.id) ? host : undefined,
          mode: JSON.stringify(mode),
        }))
      );
    }
  }
  return out;
}

const target = captureTargets(new Set([SET]))[0];

describe("the open Select's trigger and popup widths, as Base UI sizes them", () => {
  it("draws each variant's instances as wide as Chromium draws them, at every host width", async () => {
    if (target === undefined) {
      throw new Error(`the kit holds no ${SET} manifest`);
    }
    const sets = await Effect.runPromise(buildComponentSets());
    const open = sets.find((set) => set.componentSet.key === SET)?.componentSet;
    if (open === undefined) {
      throw new Error(`the build holds no ${SET} set`);
    }
    const requests = open.variants.map(({ properties }, index) => ({ properties, index }));
    const { measured, samples } = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const renderers = yield* loadRenderers(new Set([SET]));
          const renderer = renderers.get(SET);
          if (renderer === undefined) {
            throw new Error(`no renderer draws ${SET}`);
          }
          const assets = yield* readPageAssets(yield* locateFuseBuild(), renderers);
          const browser = yield* CompareBrowser.launch(assets);
          const cells = requests.map(({ properties, index }) => ({
            sample: {
              id: `c${String(index)}`,
              variant: open.variants[index]?.key ?? "",
              width: properties.width ?? "",
            },
            request: requestOf(target, renderer, properties, index),
          }));
          const read = yield* browser.openPreview(
            CAPTURE_THEME,
            cells.map(({ request }) => request),
            PAGE_LAYOUT,
            ({ page }) =>
              measure(
                page,
                cells.map(({ sample }) => sample)
              )
          );
          return { measured: read, samples: cells.map(({ sample }) => sample) };
        })
      ).pipe(Effect.provide(NodeServices.layer))
    );
    const apart = measured.flatMap((each) => {
      const sample = samples.find(({ id }) => id === each.id);
      const variant = open.variants.find(({ key }) => key === sample?.variant);
      if (sample === undefined || variant === undefined) {
        throw new Error(`the page measured ${each.id}, which no variant drew`);
      }
      const layer = (key: string): InstanceLayerSpec => {
        const found = variant.root.children.find((child) => child.key === key);
        if (found?.kind !== "instance") {
          throw new Error(`${variant.key} holds no ${key} instance`);
        }
        return found;
      };
      const trigger = layer("trigger");
      const popup = layer("popup");
      const where = `${variant.key} in a ${String(each.host ?? "hugging")} host ${each.mode}`;
      const wrong: string[] = [];
      // The trigger fills its column where the variant's width property says so, and hugs otherwise.
      if (trigger.sizing.horizontal.kind !== sample.width) {
        wrong.push(`${where}: the trigger is ${trigger.sizing.horizontal.kind}`);
      }
      for (const [name, layered, browserWidth] of [
        ["trigger", trigger, each.trigger],
        ["popup", popup, each.popup],
      ] as const) {
        const spec = widthIn(layered, variant.root, each.host, `${variant.key}'s ${name}`);
        // Only a hugging trigger has a width its text sets, which the spec does not hold.
        if (spec === undefined && !(name === "trigger" && sample.width === "hug")) {
          wrong.push(`${where}: the ${name} hugs in the spec, ${String(browserWidth)}px in Chromium`);
        } else if (spec !== undefined && Math.abs(spec - browserWidth) > TOLERANCE_PX) {
          wrong.push(
            `${where}: the ${name} is ${String(spec)}px in the spec, ${String(browserWidth)}px in Chromium`
          );
        }
      }
      return wrong;
    });
    expect(apart).toEqual([]);
    // Every host width measured every filling cell, so the comparison reached past the minimum.
    expect(new Set(measured.flatMap(({ host }) => (host === undefined ? [] : [host])))).toEqual(
      new Set(HOST_WIDTHS)
    );
  });
});
