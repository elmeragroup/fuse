/**
 * Unit under test: the Toast set's close, as the kit builds it: the root's last layer, which holds the
 * close, its place and paddings, and the close instance's size.
 * Oracle: Chromium's layout of a real Fuse Toast, where `Toast.Close` sits at `absolute top-2
 * right-2` against the root, its containing block (CSS 2.1 §10.1, §10.3.7). The close's size in each
 * density is the value the token sync gives the variables the built instance's sizing binds, and
 * Figma's layout of the kit's shape follows probe PG16: a wrapper STRETCH across its parent and at
 * its top, aligned to its end, padded on the right and top and hugging its height, holds its instance
 * that far from the parent's right and top edges whatever the parent's size. The test places the close
 * as Figma would at the root's width in Chromium and compares its four edges with Chromium's box.
 *
 * The close's box follows from the root's width and top edge, the 8px offsets, and its own size, which
 * `control-h-sm` sets and which follows the document's density alone. A color scheme, an identity or
 * a brand changes colors, fonts and corners, none of which moves the root's edges or the offsets, and
 * a status changes only the icon before the text. So the test reads one mode of each density, in the
 * docs demo's 384px stack and in a 480px one, and with a description that wraps to two lines, whose
 * taller root would show a close anchored at the bottom. It goes red where the kit draws no close, or
 * places it apart from CSS.
 */
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fuseModule, openFusePage } from "../../test/fuse-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import type { PageMode } from "../capture/page-modes.ts";
import { fuseVariableSet } from "../fuse-variable-set.ts";
import type { VariableSet } from "../variable-set.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { ChildLayerSpec, ComponentSetSpec, NumberSpec } from "./kit-spec.ts";
import { TOAST_DESCRIPTION, TOAST_TITLE } from "./toast-text.ts";

/** How far apart, in CSS pixels, a Figma edge and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/**
 * The page's script: a Toast provider whose manager raised one toast before it mounted, with no
 * timeout, in the docs demo's stack. A `toast-change` event on the window sets its description.
 */
const ENTRY = `
import { createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LocaleProvider } from ${fuseModule("theme.js")};
import { Toast } from ${fuseModule("toast.js")};
const manager = Toast.createToastManager();
const id = manager.add({ title: ${JSON.stringify(TOAST_TITLE)}, description: ${JSON.stringify(TOAST_DESCRIPTION)}, timeout: 0 });
window.addEventListener("toast-change", (event) => manager.update(id, event.detail));
function Stack() {
  const host = useRef(null);
  return createElement("div", { ref: host, id: "host", style: { position: "relative", width: "100%", maxWidth: "384px", minHeight: "28rem" } },
    createElement(Toast.Provider, { toastManager: manager, children: createElement(Toast.Viewport, {
      container: host, style: { position: "absolute", right: 0, bottom: 0, width: "100%" } }) }));
}
const root = document.createElement("div");
document.body.append(root);
flushSync(() => createRoot(root).render(createElement(LocaleProvider, { locale: "en-US", children: createElement(Stack) })));
`;

/** A description that wraps to two lines in either stack at either density. */
const TWO_LINES = "You can finish it later, from the drafts list on any device.";

/** Each stack the test measures in: its width, and the description its toast holds. */
const STACKS = [
  { width: 384, description: TOAST_DESCRIPTION, lines: 1 },
  { width: 480, description: TOAST_DESCRIPTION, lines: 1 },
  { width: 384, description: TWO_LINES, lines: 2 },
] as const;

/** The first mode of each density, the one axis that changes the close's size. */
const DENSITY_MODES: readonly PageMode[] = ["dense", "comfortable"].flatMap((density) => {
  const mode = EVERY_MODE.find((each) => each.root["data-density"] === density);
  return mode === undefined ? [] : [mode];
});

/** The Figma mode of the `Fuse density` collection for a density: its name, capitalized. */
const densityMode = (mode: PageMode): string => {
  const density = mode.root["data-density"];
  return `${density.charAt(0).toUpperCase()}${density.slice(1)}`;
};

/** A box against the root's border box, in CSS pixels. */
type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** What the page measures of the toast in one state. */
type Reading = {
  /** The root's width and height. */
  readonly root: { readonly width: number; readonly height: number };
  /** The close's border box from the root's top left. */
  readonly close: Box;
  /** How many lines the description wraps to. */
  readonly lines: number;
};

let browser: Browser;
let page: Page;
let toastSet: ComponentSetSpec;
let variables: VariableSet;

/**
 * Read the toast once its fonts have loaded, polling each frame until it shows the description and
 * Base UI's measured height equals the root's height with `height: auto`, so the root has grown with
 * its text.
 */
async function read(description: string): Promise<Reading> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const handle = await page.waitForFunction(
    (text): Reading | false => {
      const root = document.querySelector<HTMLElement>('[data-slot="toast-root"]');
      if (root === null) {
        return false;
      }
      const close = root.querySelector('[data-slot="toast-close"]');
      const copy = root.querySelector('[data-slot="toast-description"]');
      if (close === null || copy === null || copy.textContent !== text) {
        return false;
      }
      const used = root.getBoundingClientRect().height;
      const { height } = root.style;
      root.style.height = "auto";
      const natural = root.getBoundingClientRect().height;
      root.style.height = height;
      if (used !== natural) {
        return false;
      }
      const outer = root.getBoundingClientRect();
      const box = close.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(copy).lineHeight);
      return {
        root: { width: outer.width, height: outer.height },
        close: {
          left: box.left - outer.left,
          top: box.top - outer.top,
          right: box.right - outer.left,
          bottom: box.bottom - outer.top,
        },
        lines: Math.round(copy.getBoundingClientRect().height / lineHeight),
      };
    },
    description,
    { polling: "raf", timeout: 0 }
  );
  const reading = await handle.jsonValue();
  if (reading === false) {
    throw new Error("the wait resolved before the toast settled");
  }
  return reading;
}

/** Stamp a mode on the page, as the capture does. */
async function stamp(mode: PageMode): Promise<void> {
  await page.evaluate((stamped) => {
    for (const [name, value] of Object.entries(stamped.root)) {
      document.documentElement.setAttribute(name, value);
    }
    for (const [name, value] of Object.entries(stamped.body)) {
      document.body.setAttribute(name, value);
    }
  }, mode);
}

/** A literal number of the built spec. */
function pixels(number: NumberSpec): number {
  if (number.kind !== "literal") {
    throw new Error("the built close holds a distance that is no literal");
  }
  return number.value;
}

/** A length of the built spec in a mode of the `Fuse density` collection, as the token sync holds it. */
function lengthIn(number: NumberSpec, mode: string): number {
  if (number.kind === "literal") {
    return number.value;
  }
  const value = variables.collections
    .find((collection) => collection.name === number.variable.collection)
    ?.variables.find((variable) => variable.name === number.variable.name)
    ?.values.get(mode);
  if (value?._tag !== "Float") {
    throw new Error(`the token sync holds no ${number.variable.name} length in ${mode}`);
  }
  return value.value;
}

/**
 * Where Figma draws a variant's close in a root of the given width and density mode, from the root's
 * last layer: a wrapper STRETCH across the root and at its top, which aligns the close to its end and
 * pads it there and at its top (PG16), and holds the close at its fixed sizing.
 */
function kitClose(layers: readonly ChildLayerSpec[], width: number, mode: string): Box {
  const wrapper = layers.at(-1);
  const [close] = wrapper?.kind === "frame" ? wrapper.children : [];
  if (
    wrapper?.kind !== "frame" ||
    wrapper.children.length !== 1 ||
    close?.kind !== "instance" ||
    close.key !== "close" ||
    close.sizing.horizontal.kind !== "fixed" ||
    close.sizing.vertical.kind !== "fixed" ||
    wrapper.placement?.kind !== "edges" ||
    wrapper.placement.horizontal.kind !== "stretch" ||
    wrapper.placement.vertical.kind !== "start" ||
    wrapper.sizing.vertical.kind !== "hug" ||
    wrapper.direction !== "HORIZONTAL" ||
    wrapper.primaryAlign !== "MAX" ||
    wrapper.counterAlign !== "MIN"
  ) {
    throw new Error("the root's last layer is no PG16 wrapper around the close");
  }
  const right = width - wrapper.placement.horizontal.end - pixels(wrapper.paddingRight);
  const top = wrapper.placement.vertical.start + pixels(wrapper.paddingTop);
  return {
    left: right - lengthIn(close.sizing.horizontal.length, mode),
    top,
    right,
    bottom: top + lengthIn(close.sizing.vertical.length, mode),
  };
}

beforeAll(async () => {
  variables = Result.getOrThrow(fuseVariableSet());
  const sets = await Effect.runPromise(buildComponentSets());
  const found = sets.find((set) => set.componentSet.key === "toast")?.componentSet;
  if (found === undefined) {
    throw new Error("the kit builds no toast set");
  }
  toastSet = found;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openFusePage(page, {
    htmlAttributes: { "data-theme": "light", "data-density": "dense" },
    entry: ENTRY,
  });
  await page.waitForSelector('[data-slot="toast-root"]');
});

afterAll(async () => {
  await browser.close();
});

/** The edges where Chromium's close and the kit's sit apart by more than the tolerance. */
function apart(measured: Box, kit: Box): readonly string[] {
  return (["left", "top", "right", "bottom"] as const).flatMap((edge) =>
    Math.abs(measured[edge] - kit[edge]) > TOLERANCE_PX
      ? [`${edge} ${String(kit[edge])} against ${String(measured[edge])}`]
      : []
  );
}

describe("the Toast set's close", () => {
  it("sits where Chromium puts it at each density, in a wider stack and over two lines", async () => {
    const variant = toastSet.variants.find((each) => each.key === "toast/status=neutral");
    const misplaced: string[] = [];
    for (const stack of STACKS) {
      await page.evaluate(
        ({ width, description }) => {
          document.getElementById("host")?.style.setProperty("max-width", `${String(width)}px`);
          window.dispatchEvent(new CustomEvent("toast-change", { detail: { description } }));
        },
        { width: stack.width, description: stack.description }
      );
      for (const mode of DENSITY_MODES) {
        await stamp(mode);
        const reading = await read(stack.description);
        expect([reading.root.width, reading.lines]).toEqual([stack.width, stack.lines]);
        const kit = kitClose(variant?.root.children ?? [], reading.root.width, densityMode(mode));
        const edges = apart(reading.close, kit);
        if (edges.length > 0) {
          misplaced.push(
            `${String(stack.width)}px ${String(stack.lines)} line ${densityMode(mode)}: ${edges.join(", ")}`
          );
        }
      }
    }
    expect([DENSITY_MODES.length, misplaced]).toEqual([2, []]);
  });
});
