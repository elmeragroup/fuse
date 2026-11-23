/**
 * Unit under test: the arrow of each `Tooltip content` variant as the kit builds it, a turned frame
 * placed by its centre (`pivot`): the popup's edge it hangs from, its offset from the popup's centre
 * along that edge and its inset from the edge; and the order of each `Tooltip (open)` variant's
 * popup and trigger along its auto layout. Oracle: Chromium's layout of the real Fuse Tooltip,
 * opened on each side of its trigger in every mode the capture measures, with the docs Basic demo's
 * text and with a text that wraps the popup to more lines, so the popup's width and height both
 * change under a centre the spec holds fixed. The test reads the centre of the arrow's border box,
 * which a turn about its centre leaves where it was, against the popup's border box, the frame
 * Figma places the arrow in. It goes red where the build places the arrow on another edge, at
 * another offset or inset, or refuses a side, and where Tooltip's CSS moves the arrow so that a
 * fixed centre no longer holds it. For the open set, the oracle is the same layout: the root runs
 * as a column where Chromium puts the popup above or below the trigger and as a row where it puts it
 * left or right, with the popup first where it sits above or left, and its `content` instance shows
 * the popup variant of the side Chromium opened it on.
 */
import * as Effect from "effect/Effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fuseModule, openFusePage } from "../../test/fuse-page.ts";
import { placedBeside, specCentre } from "../../test/popup-place.ts";
import type { Box } from "../../test/popup-place.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { buildComponentSets } from "./build-kit.ts";
import { walkLayers } from "./kit-spec.ts";
import type { ComponentSetSpec, PivotSpec, VariantSpec } from "./kit-spec.ts";
import { TOOLTIP_SIDE_OFFSET, TOOLTIP_SIDES } from "./tooltip-sides.ts";
import type { TooltipSide } from "./tooltip-sides.ts";
import { TOOLTIP_TEXT } from "./tooltip-text.ts";

/** How far apart, in CSS pixels, the spec's centre and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** A text that wraps the popup's `max-w-xs` to more lines at either density on any platform. */
const LONG_TEXT =
  "Add this item to your library, where you can find it later from any device you sign in on.";

/** The texts each side renders. */
const TEXTS = [TOOLTIP_TEXT, LONG_TEXT] as const;

/**
 * The page's script: one open Tooltip per side and text, each the docs Basic demo's ghost icon
 * trigger in a slot with room on every side, its popup portalled into the slot. A `mount-tooltips`
 * event on the window mounts them afresh, so Base UI positions each popup once against its
 * trigger's current place.
 */
const ENTRY = `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Button } from ${fuseModule("button.js")};
import { Info } from ${fuseModule("icons.js")};
import { Tooltip } from ${fuseModule("tooltip.js")};
const sides = ${JSON.stringify(TOOLTIP_SIDES)};
const texts = ${JSON.stringify(TEXTS)};
const roots = [];
for (const side of sides) {
  texts.forEach((text, index) => {
    const slot = document.createElement("div");
    slot.dataset.side = side;
    slot.dataset.text = String(index);
    slot.style.cssText = "display:flex;align-items:flex-start;justify-content:flex-start;width:880px;height:400px;padding:180px 0 0 400px;box-sizing:border-box";
    document.body.append(slot);
    roots.push({ slot, side, text, root: undefined });
  });
}
const mount = () => {
  for (const each of roots) {
    each.root?.unmount();
    each.root = createRoot(each.slot);
    flushSync(() => each.root.render(
      createElement(Tooltip.Provider, null,
        createElement(Tooltip.Root, { defaultOpen: true },
          createElement(Tooltip.Trigger, {
            render: createElement(Button, { variant: "ghost", size: "icon", "aria-label": each.text }),
          }, createElement(Info, { "aria-hidden": true })),
          createElement(Tooltip.Content, { container: each.slot, side: each.side }, each.text)))));
  }
};
mount();
window.addEventListener("mount-tooltips", mount);
`;

/** What the page measures of one open Tooltip in one mode, in CSS pixels. */
type Measured = {
  readonly side: string;
  readonly text: number;
  readonly mode: string;
  /** The popup's `data-side` and `data-align`, which must name the side asked for, centred. */
  readonly placedSide: string;
  readonly placedAlign: string;
  readonly popup: Box;
  readonly trigger: Box;
  /** The popup's `clientWidth` and `clientHeight`, which CSSOM rounds to whole pixels. */
  readonly clientWidth: number;
  readonly clientHeight: number;
  /** The arrow's centre from the popup's top left corner. */
  readonly x: number;
  readonly y: number;
};

/**
 * Measure every Tooltip in every mode. In each mode, once its attributes and fonts apply, the page
 * moves each trigger by the fraction that puts its popup's start on a whole pixel, then mounts every
 * Tooltip afresh, and the test reads every Tooltip on each frame until {@link isReady} holds for
 * each. The wait sets no timeout of its own, so a popup that never opens on its side, in its place,
 * leaves only the hang guard to end the test.
 */
async function measureEveryMode(page: Page): Promise<readonly Measured[]> {
  const out: Measured[] = [];
  for (const mode of EVERY_MODE) {
    await page.evaluate(async (each) => {
      for (const [name, value] of Object.entries(each.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(each.body)) {
        document.body.setAttribute(name, value);
      }
      const popups = [...document.querySelectorAll('[data-slot="tooltip-content"]')];
      await Promise.all(popups.map((popup) => document.fonts.load(getComputedStyle(popup).font)));
      await document.fonts.ready;
      // Base UI rounds the popup's place to whole pixels, so each trigger moves by the fraction that
      // puts the popup's start on one where the popup's place follows the trigger's, as the compare
      // page's host does. Across its side, a popup is centred on the trigger; along it, the popup
      // starts or ends the offset away from it.
      const fraction = (length: number) => length - Math.floor(length);
      for (const slot of document.querySelectorAll<HTMLElement>("[data-side][data-text]")) {
        const popup = slot.querySelector('[data-slot="tooltip-content"]')?.getBoundingClientRect();
        const trigger = slot.querySelector("button")?.getBoundingClientRect();
        if (popup === undefined || trigger === undefined) {
          throw new Error("a slot lacks its popup or its trigger");
        }
        const across = slot.dataset.side === "top" || slot.dataset.side === "bottom";
        const left = across
          ? fraction((popup.width - trigger.width) / 2)
          : slot.dataset.side === "left"
            ? fraction(popup.width)
            : 0;
        const top = across ? 0 : fraction((popup.height - trigger.height) / 2);
        slot.style.paddingLeft = `${String(400 + left)}px`;
        slot.style.paddingTop = `${String(180 + top)}px`;
      }
      // The entry script mounts every Tooltip afresh on this event, synchronously.
      window.dispatchEvent(new Event("mount-tooltips"));
    }, mode);
    // Read every Tooltip on each frame until each is ready, so the oracle sees the settled layout.
    let readings = await readFrame(page, JSON.stringify(mode));
    while (!readings.every(isReady)) {
      readings = await readFrame(page, JSON.stringify(mode));
    }
    out.push(...readings);
  }
  return out;
}

/** What one frame shows of one open Tooltip: its measures, and whether its entrance has ended. */
type Frame = Measured & {
  /** Whether the popup has left its starting style and runs no transition or animation. */
  readonly entered: boolean;
};

/** Read every open Tooltip on the page's next animation frame, in the mode `modeName` names. */
async function readFrame(page: Page, modeName: string): Promise<readonly Frame[]> {
  return page.evaluate(
    (name) =>
      new Promise<Frame[]>((resolve, reject) => {
        requestAnimationFrame(() => {
          const boxOf = (element: Element) => {
            const { left, top, width, height } = element.getBoundingClientRect();
            return { left, top, width, height };
          };
          const readings: Frame[] = [];
          for (const slot of document.querySelectorAll<HTMLElement>("[data-side][data-text]")) {
            const popup = slot.querySelector<HTMLElement>('[data-slot="tooltip-content"]');
            const trigger = slot.querySelector("button");
            const arrow = popup?.querySelector('[aria-hidden="true"]') ?? null;
            if (popup === null || trigger === null || arrow === null) {
              reject(new Error("a slot lacks its popup, its trigger or its arrow"));
              return;
            }
            const box = boxOf(popup);
            const turned = boxOf(arrow);
            readings.push({
              side: slot.dataset.side ?? "",
              text: Number(slot.dataset.text),
              mode: name,
              placedSide: popup.dataset.side ?? "",
              placedAlign: popup.dataset.align ?? "",
              popup: box,
              trigger: boxOf(trigger),
              clientWidth: popup.clientWidth,
              clientHeight: popup.clientHeight,
              x: turned.left + turned.width / 2 - box.left,
              y: turned.top + turned.height / 2 - box.top,
              entered:
                !popup.hasAttribute("data-starting-style") &&
                popup.getAnimations({ subtree: true }).length === 0,
            });
          }
          resolve(readings);
        });
      }),
    modeName
  );
}

/**
 * Whether a Tooltip is ready to measure: its entrance has ended, and Base UI has opened its popup on
 * the side asked for, `TOOLTIP_SIDE_OFFSET` from its trigger and centred on it ({@link placedBeside}).
 * The pass that places the popup also writes the arrow's offset, so the arrow's centre is left for
 * the tests to assert.
 */
function isReady(reading: Frame): boolean {
  return (
    reading.entered &&
    reading.placedSide === reading.side &&
    placedBeside(reading.side, reading.popup, reading.trigger, TOOLTIP_SIDE_OFFSET)
  );
}

/** An auto layout's axis and its layers' keys in order. */
type OpenLayout = { readonly direction: string; readonly order: readonly string[] };

/**
 * The axis and order of a popup and its trigger as Chromium laid them out: a column where one ends
 * above the other begins, a row where one ends left of the other, the box that comes first in that
 * direction first. Boxes that overlap on both axes have no such layout.
 */
function layoutOf(popup: Box, trigger: Box): OpenLayout | "overlapping" {
  if (popup.top + popup.height <= trigger.top) {
    return { direction: "VERTICAL", order: ["content", "trigger"] };
  }
  if (trigger.top + trigger.height <= popup.top) {
    return { direction: "VERTICAL", order: ["trigger", "content"] };
  }
  if (popup.left + popup.width <= trigger.left) {
    return { direction: "HORIZONTAL", order: ["content", "trigger"] };
  }
  if (trigger.left + trigger.width <= popup.left) {
    return { direction: "HORIZONTAL", order: ["trigger", "content"] };
  }
  return "overlapping";
}

/** The variant of a set whose `side` property is `side`. */
function variantOn(set: ComponentSetSpec | undefined, side: TooltipSide): VariantSpec {
  const variant = set?.variants.find((each) => each.properties.side === side);
  if (variant === undefined) {
    throw new Error(`the build holds no ${String(set?.key)} variant on the ${side} side`);
  }
  return variant;
}

let browser: Browser;
let measured: readonly Measured[];
let pivots: ReadonlyMap<TooltipSide, PivotSpec>;
let openLayout: ReadonlyMap<TooltipSide, OpenLayout>;
let openContentSide: ReadonlyMap<TooltipSide, string | undefined>;

beforeAll(async () => {
  browser = await chromium.launch();
  const sets = await Effect.runPromise(buildComponentSets());
  const content = sets.find((each) => each.componentSet.key === "tooltip-content")?.componentSet;
  pivots = new Map(
    TOOLTIP_SIDES.map((side) => {
      const pivot = walkLayers(variantOn(content, side).root).find(
        (layer) => layer.kind === "frame" && layer.placement?.kind === "pivot"
      );
      if (pivot?.kind !== "frame" || pivot.placement?.kind !== "pivot") {
        throw new Error(`the build holds no arrow placed by its centre on the ${side} side`);
      }
      return [side, pivot.placement] as const;
    })
  );
  const open = sets.find((each) => each.componentSet.key === "tooltip-open")?.componentSet;
  openLayout = new Map(
    TOOLTIP_SIDES.map((side) => {
      const { root } = variantOn(open, side);
      return [side, { direction: root.direction, order: root.children.map((layer) => layer.key) }] as const;
    })
  );
  // Each open variant's `content` instance shows the content set's variant its key names.
  openContentSide = new Map(
    TOOLTIP_SIDES.map((side) => {
      const instance = variantOn(open, side).root.children.find(
        (layer) => layer.kind === "instance" && layer.key === "content"
      );
      const shown =
        instance?.kind === "instance" && instance.componentSet === "tooltip-content"
          ? content?.variants.find((variant) => variant.key === instance.variant)
          : undefined;
      return [side, shown?.properties.side] as const;
    })
  );
  const page = await browser.newPage({ viewport: { width: 880, height: 3200 } });
  await openFusePage(page, { entry: ENTRY });
  measured = await measureEveryMode(page);
});

afterAll(async () => {
  await browser.close();
});

describe("each side's Tooltip arrow and open popup, as the kit builds them", () => {
  // `isReady` held each popup to its side and its place before the readings return.
  it("measures every side and text in every mode, each popup aligned to its trigger's centre", () => {
    expect(measured).toHaveLength(TOOLTIP_SIDES.length * TEXTS.length * EVERY_MODE.length);
    expect(new Set(measured.map((reading) => reading.placedAlign))).toEqual(new Set(["center"]));
  });

  // The long text grows the popup on both axes, so a centre that holds in both texts holds as
  // CENTER and the edge's constraint keep it through a resize.
  it("grows the popup across and down with the long text", () => {
    for (const side of TOOLTIP_SIDES) {
      for (const mode of EVERY_MODE) {
        const [short, long] = TEXTS.map((_, text) =>
          measured.find(
            (each) => each.side === side && each.text === text && each.mode === JSON.stringify(mode)
          )
        );
        expect(long?.popup.width).toBeGreaterThan(short?.popup.width ?? Infinity);
        expect(long?.popup.height).toBeGreaterThan(short?.popup.height ?? Infinity);
      }
    }
  });

  // Along a top or bottom edge, Base UI writes the arrow's `left` from the popup's `clientWidth`,
  // which CSSOM rounds to a whole pixel (floating-ui's arrow middleware), so Chromium's arrow sits
  // off the popup's centre by up to half that rounding, which the kit does not draw. Across a left
  // or right edge, `top: 50%` places it, with no rounding. Inside the edge, CSS alone places it.
  it.each(TOOLTIP_SIDES)("puts the arrow's centre where Chromium does on the %s side", (side) => {
    const pivot = pivots.get(side);
    if (pivot === undefined) {
      throw new Error(`the build holds no arrow on the ${side} side`);
    }
    const off = measured
      .filter((reading) => reading.side === side)
      .flatMap((reading) => {
        const expected = specCentre(pivot, reading.popup.width, reading.popup.height);
        const rounding =
          pivot.edge === "top" || pivot.edge === "bottom"
            ? Math.abs(reading.clientWidth - reading.popup.width) / 2
            : 0;
        return Math.abs(expected.x - reading.x) > rounding + TOLERANCE_PX ||
          Math.abs(expected.y - reading.y) > TOLERANCE_PX
          ? [
              {
                side,
                mode: reading.mode,
                text: reading.text,
                popup: { width: reading.popup.width, height: reading.popup.height },
                expected,
                observed: { x: reading.x, y: reading.y },
              },
            ]
          : [];
      });
    expect(off).toEqual([]);
  });

  it.each(TOOLTIP_SIDES)(
    "lays the open set's popup and trigger out on Chromium's axis and in its order on the %s side",
    (side) => {
      const observed = new Set(
        measured
          .filter((reading) => reading.side === side)
          .map((reading) => JSON.stringify(layoutOf(reading.popup, reading.trigger)))
      );
      expect(observed).toEqual(new Set([JSON.stringify(openLayout.get(side))]));
    }
  );

  it.each(TOOLTIP_SIDES)("opens the open set's popup instance on Chromium's side on the %s side", (side) => {
    const observed = new Set(
      measured.filter((reading) => reading.side === side).map((reading) => reading.placedSide)
    );
    expect(observed).toEqual(new Set([openContentSide.get(side)]));
  });
});
