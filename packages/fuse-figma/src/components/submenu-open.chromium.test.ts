/**
 * Unit under test: where the built `Dropdown menu submenu (open)` set puts the sub content beside
 * the popup: the root row's item spacing, and the column beside the popup, its left and top padding,
 * its item spacing and the stand-ins for the rows above the sub trigger. Oracle: Chromium's layout of the
 * compare renderer's open Submenu demo (`compare/dropdown-menu-cell.ts`) in every mode the capture
 * measures, where Base UI's positioner places the sub content at `DropdownMenu.SubContent`'s default
 * offsets. The test resolves each bound length in the mode's density through the synced variable
 * set, lays the row and the column out as Figma's auto layout would, and checks the sub content's
 * left and top edges against the popup's in Chromium. The popup's width comes from Chromium, since
 * the popup set's own width is not under test here. It goes red where the build's lengths, the
 * stand-ins or Base UI's offsets change so that the two place the sub content apart.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect, Result } from "effect";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { captureTargets } from "../capture/capture-targets.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import type { PageMode } from "../capture/page-modes.ts";
import { CAPTURE_THEME, requestOf } from "../capture/run-capture.ts";
import { CompareBrowser } from "../compare/browser-render.ts";
import { loadRenderers } from "../compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { PAGE_LAYOUT } from "../compare/preview-page.ts";
import { fuseVariableSet } from "../fuse-variable-set.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { ChildLayerSpec, FrameLayerSpec, NumberSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

const SET = "dropdown-menu-submenu-open";

/** What the page reads in one mode, in CSS pixels, from the popup's top left corner. */
type Measured = {
  readonly mode: PageMode;
  readonly popupWidth: number;
  readonly subX: number;
  readonly subY: number;
};

/**
 * Stamp the page in a mode, load the faces its rows' text needs, and read the popup and the sub
 * content once both boxes hold still for two frames, so Base UI has placed the sub content in that
 * mode.
 */
async function measureIn(page: Page, mode: PageMode): Promise<Measured> {
  const read = await page.evaluate(async (stamped) => {
    for (const [name, value] of Object.entries(stamped.root)) {
      document.documentElement.setAttribute(name, value);
    }
    for (const [name, value] of Object.entries(stamped.body)) {
      document.body.setAttribute(name, value);
    }
    const rows = [...document.querySelectorAll('[data-slot^="dropdown-menu-"]')];
    const faces = rows.map((row) => {
      const style = getComputedStyle(row);
      return [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(" ");
    });
    await Promise.all([...new Set(faces)].map((face) => document.fonts.load(face)));
    await document.fonts.ready;
    const boxes = () => {
      const popup = document.querySelector('[data-slot="dropdown-menu-content"]');
      const sub = document.querySelector('[data-slot="dropdown-menu-sub-content"]');
      if (popup === null || sub === null) {
        return undefined;
      }
      const outer = popup.getBoundingClientRect();
      const inner = sub.getBoundingClientRect();
      return { popupWidth: outer.width, subX: inner.left - outer.left, subY: inner.top - outer.top };
    };
    // After a density change the sub content can hold its old place for a few frames while Base UI
    // schedules the move, so a read counts only once its positioner measures the current trigger.
    const anchored = () => {
      const trigger = document.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
      const positioner = document.querySelector('[data-slot="dropdown-menu-sub-content"]')?.parentElement;
      if (trigger === null || positioner === null || positioner === undefined) {
        return false;
      }
      const bounds = trigger.getBoundingClientRect();
      const style = getComputedStyle(positioner);
      const near = (property: string, length: number) =>
        Math.abs(Number.parseFloat(style.getPropertyValue(property)) - length) <= 1 / devicePixelRatio;
      return near("--anchor-width", bounds.width) && near("--anchor-height", bounds.height);
    };
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let last = boxes();
    let still = 0;
    // The loop has no limit of its own: a sub content Base UI never settles leaves only the hang guard.
    while (still < 2) {
      await frame();
      const now = boxes();
      still = now !== undefined && anchored() && JSON.stringify(now) === JSON.stringify(last) ? still + 1 : 0;
      last = now;
    }
    return last;
  }, mode);
  if (read === undefined) {
    throw new Error("the page holds no popup and sub content");
  }
  return { mode, ...read };
}

/** The synced variable set's `Fuse density` collection. */
function densityCollection() {
  const set = fuseVariableSet();
  if (Result.isFailure(set)) {
    throw new Error("the synced variable set does not build");
  }
  const collection = set.success.collections.find((each) => each.name === "Fuse density");
  if (collection === undefined) {
    throw new Error("the synced variable set holds no Fuse density collection");
  }
  return collection;
}

/** The synced `Fuse density` collection. */
type DensityCollection = ReturnType<typeof densityCollection>;

/** The value of a `Fuse density` variable at a density, as the synced collection holds it. */
function densityValue(collection: DensityCollection, name: string, density: string): number {
  const mode = collection.modes.find((each) => each.toLowerCase() === density);
  const value =
    mode === undefined
      ? undefined
      : collection.variables.find((each) => each.name === name)?.values.get(mode);
  if (value?._tag !== "Float") {
    throw new Error(`Fuse density holds no number ${name} at ${density}`);
  }
  return value.value;
}

/** A length of the built spec in a mode: its literal, or its density variable's value there. */
function lengthIn(density: DensityCollection, number: NumberSpec | undefined, mode: PageMode): number {
  if (number === undefined) {
    return 0;
  }
  if (number.kind === "literal") {
    return number.value;
  }
  if (number.variable.collection !== "Fuse density") {
    throw new Error(`the built column binds ${number.variable.collection} / ${number.variable.name}`);
  }
  return densityValue(density, number.variable.name, mode.root["data-density"]);
}

/** A frame layer of the built spec. */
function frame(layer: ChildLayerSpec | undefined, what: string): FrameLayerSpec {
  if (layer?.kind !== "frame") {
    throw new Error(`the built set holds no frame for ${what}`);
  }
  return layer;
}

/**
 * The height Figma gives a frame of frames in a mode: a fixed length, or for a hugging frame its
 * paddings and its layers, summed with the item spacing in a column and the tallest in a row, at
 * least its minimum height. A frame with no layers that hugs either axis has no height to give:
 * live Figma probes (#821) found such a frame keeps the size it last had, so a stand-in drawn that
 * way may sit at any height on a fresh Apply.
 */
function heightIn(density: DensityCollection, layer: FrameLayerSpec, mode: PageMode): number {
  const { horizontal, vertical } = layer.sizing;
  if (layer.children.length === 0 && (horizontal.kind === "hug" || vertical.kind === "hug")) {
    throw new Error(`${layer.key} holds no layers and hugs them, so Figma keeps its last size`);
  }
  if (vertical.kind === "fixed") {
    return lengthIn(density, vertical.length, mode);
  }
  if (vertical.kind !== "hug") {
    throw new Error(`${layer.key} is ${vertical.kind} tall`);
  }
  const heights = layer.children.map((child) => heightIn(density, frame(child, layer.key), mode));
  const content =
    layer.direction === "VERTICAL"
      ? heights.reduce((sum, each) => sum + each, 0) +
        Math.max(0, heights.length - 1) * lengthIn(density, layer.itemSpacing, mode)
      : Math.max(0, ...heights);
  const padded =
    lengthIn(density, layer.paddingTop, mode) + content + lengthIn(density, layer.paddingBottom, mode);
  return Math.max(padded, lengthIn(density, layer.limits.minHeight, mode));
}

describe("the open submenu, placed as Figma lays out the built row and column", () => {
  it("puts the sub content where Base UI puts it beside the popup, in every mode", async () => {
    const target = captureTargets(new Set([SET]))[0];
    if (target === undefined) {
      throw new Error(`the kit holds no ${SET} manifest`);
    }
    const sets = await Effect.runPromise(buildComponentSets());
    const root = sets.find((set) => set.componentSet.key === SET)?.componentSet.variants[0]?.root;
    if (root === undefined) {
      throw new Error(`the build holds no ${SET} variant`);
    }
    const [popup, beside] = root.children;
    const column = frame(beside, "the column beside the popup");
    const [offset, sub] = column.children;
    // The row lays out the popup and the column, and the column the stand-ins and the sub content.
    // Both rows align their layers to the top, as Base UI aligns the sub content to its trigger's.
    expect([root.direction, root.counterAlign, popup?.kind, popup?.key]).toEqual([
      "HORIZONTAL",
      "MIN",
      "instance",
      "popup",
    ]);
    expect([column.direction, column.counterAlign, sub?.kind, sub?.key]).toEqual([
      "VERTICAL",
      "MIN",
      "instance",
      "sub-content",
    ]);
    const standIns = frame(offset, "the rows above the sub trigger");
    const measured = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const renderers = yield* loadRenderers(new Set([SET]));
          const renderer = renderers.get(SET);
          if (renderer === undefined) {
            throw new Error(`no renderer draws ${SET}`);
          }
          const assets = yield* readPageAssets(yield* locateFuseBuild(), renderers);
          const browser = yield* CompareBrowser.launch(assets);
          return yield* browser.openPreview(
            CAPTURE_THEME,
            [requestOf(target, renderer, { side: "right" }, 0)],
            PAGE_LAYOUT,
            async ({ page }) => {
              const out: Measured[] = [];
              for (const mode of EVERY_MODE) {
                out.push(await measureIn(page, mode));
              }
              return out;
            }
          );
        })
      ).pipe(Effect.provide(NodeServices.layer))
    );
    expect(measured).toHaveLength(EVERY_MODE.length);
    const density = densityCollection();
    const apart = measured.flatMap(({ mode, popupWidth, subX, subY }) => {
      const figmaX =
        popupWidth + lengthIn(density, root.itemSpacing, mode) + lengthIn(density, column.paddingLeft, mode);
      const figmaY =
        lengthIn(density, column.paddingTop, mode) +
        heightIn(density, standIns, mode) +
        lengthIn(density, column.itemSpacing, mode);
      const where = JSON.stringify(mode);
      return [
        ...(Math.abs(figmaX - subX) > TOLERANCE_PX
          ? [
              `${where}: the sub content starts ${String(figmaX)}px across in Figma, ${String(subX)}px in Chromium`,
            ]
          : []),
        ...(Math.abs(figmaY - subY) > TOLERANCE_PX
          ? [
              `${where}: the sub content starts ${String(figmaY)}px down in Figma, ${String(subY)}px in Chromium`,
            ]
          : []),
      ];
    });
    expect(apart).toEqual([]);
  });
});
