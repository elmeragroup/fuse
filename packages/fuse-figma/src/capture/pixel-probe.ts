/**
 * Whether one element's background shows, unchanged, across a region of the page, read from
 * Chromium's pixels. A caller selects the elements of a shot: those to hide, the backgrounds to
 * clear and the one element to paint. The probe screenshots the region with that element's own fill
 * where it is an opaque color, and again with its background painted in each sentinel color, and
 * compares the bytes. `coinciding-around.ts` stages a root's candidates with it.
 */
import type { CDPSession } from "playwright";
import { PNG } from "pngjs";

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";

import { clearFill } from "./clear-fill.ts";

/** A box in CSS pixels, relative to the viewport. */
export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** An RGB triple of bytes as a PNG holds it. */
type Bytes = readonly [number, number, number];

/**
 * The colors the painted element's background takes in turn, with the bytes Chromium writes for
 * each. Magenta and green put every channel at 0 in one and 255 in the other, so paint over the
 * element that is not fully clear moves some channel off its sentinel in one of them. An effect that
 * reads the backdrop, as a `backdrop-filter` of `brightness(2)` or a `mix-blend-mode` of `overlay`,
 * leaves 0 and 255 where they are. The third color puts every channel away from both ends and from
 * the middle, and is no gray, so such an effect moves it too. The shot of the element's own fill
 * catches that effect only where the fill is an opaque color, and a candidate whose fill is clear
 * here still counts, so the third color stays. Playwright launches Chromium with
 * `--force-color-profile=srgb`, which writes each color to the PNG unchanged.
 */
const SENTINELS = ["#FF00FF", "#00FF00", "#40C060"].map((hex) => {
  const color = getOrThrow(Hex.parse(hex));
  const byte = (channel: number): number => Math.round(channel * 255);
  const bytes: Bytes = [byte(color.r), byte(color.g), byte(color.b)];
  return { css: `rgb(${bytes.join(", ")})`, bytes };
});

/**
 * How a caller selects a shot's elements: the source of a page function called on the probe's
 * object with the caller's arguments. It returns the scene, an object of the page's elements:
 * `hidden`, an array of those to hide with `opacity: 0`; `cleared`, an array of those whose
 * backgrounds to clear; `painted`, the one to paint; and `shown`, an array of those to make
 * visible. The probe calls it once per region, on the page as the page styles it.
 */
export type Staging = {
  readonly source: string;
  readonly args: readonly unknown[];
};

/** A session of shots on one page, which leaves the page's styles as it found them. */
export type PixelProbe = {
  /**
   * Whether every pixel of the region shows the painted element's background: its own fill, where
   * that is an opaque color, and each sentinel. The region takes the pixels Chromium paints for a
   * box at the rect. A region with no pixel shows nothing, and so does a shot whose styles the page
   * overrides, as an inline `!important` declaration does. A partly transparent background color
   * shows nothing either, since Chromium blends it with what lies behind the element and a sentinel
   * hides that. Where a staged element or its open shadow tree runs an animation or transition, the
   * region shows nothing and the probe stages none of its styles, since a staged rule's
   * `transition: none` would cancel a running transition.
   *
   * @param staging - The elements the shot hides, clears and paints.
   * @param region - The rect whose pixels the shot reads.
   * @returns Whether the background shows across the region in every shot.
   * @throws An `Error` where a page function throws, a defect in it or in the page.
   */
  readonly shows: (staging: Staging, region: Rect) => Promise<boolean>;
};

/**
 * Open a probe on the page and run the shots. Each region's shots restore the page when they end,
 * also where a shot throws.
 *
 * @template T - What the shots find.
 * @param cdp - A DevTools session on the page.
 * @param objectId - The remote object each staging function is called on.
 * @param shots - The shots to take.
 * @returns What the shots find.
 * @throws An `Error` where a page function throws, a defect in it or in the page.
 */
export async function withPixelProbe<T>(
  cdp: CDPSession,
  objectId: string,
  shots: (probe: PixelProbe) => Promise<T>
): Promise<T> {
  const call = async (functionDeclaration: string, args: readonly unknown[], state?: string) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.callFunctionOn", {
      objectId,
      returnByValue: state !== undefined,
      functionDeclaration,
      arguments: [...(state === undefined ? [] : [{ objectId: state }]), ...args.map((value) => ({ value }))],
    });
    if (exceptionDetails !== undefined) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result;
  };
  const { objectId: state } = await call(NEW_STATE_IN_PAGE, []);
  if (state === undefined) {
    throw new Error("The page returned no object to hold the probe's sheets in");
  }
  try {
    return await shots({
      shows: async (staging, region) => {
        const pixels = pixelsOf(region);
        if (pixels === undefined) {
          return false;
        }
        try {
          // SAFETY: `stageInPage` returns a `Staged` as plain JSON.
          const staged = (await call(stageInPage(staging.source), [staging.args], state)).value as Staged;
          if (staged._tag === "animating" || (staged.alpha < 255 && !clearFill(staged.color))) {
            return false;
          }
          const own = staged.fill === null ? [] : [{ css: null, bytes: staged.fill }];
          for (const shot of [...own, ...SENTINELS]) {
            // SAFETY: `PAINT_IN_PAGE` returns a `Painted` as plain JSON.
            const painted = (await call(PAINT_IN_PAGE, [shot.css], state)).value as Painted;
            if (!painted.applied || !(await shotShows(cdp, pixels, painted, shot.bytes))) {
              return false;
            }
          }
          return true;
        } finally {
          await call(RESTORE_IN_PAGE, [], state);
        }
      },
    });
  } finally {
    await cdp.send("Runtime.releaseObject", { objectId: state });
  }
}

/** The device pixels a screenshot reads, in viewport coordinates, at a device scale of 1. */
type PixelBox = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/**
 * The pixels Chromium paints for a box at the rect, which snaps each edge of a box it lays out to
 * the nearest whole pixel: a 100px box at x = 0.25 paints columns 0 to 99, and one at x = 0.5
 * columns 1 to 100. A sibling's paint snaps the same way, so a 1px sibling at the box's left edge
 * lands in column 0, inside the region. A pixel the rect touches by less than half lies outside it,
 * and paint there goes unseen. Taking those pixels too would fail every box at a fractional offset,
 * since the snapped paint behind it leaves one of them out. The rule holds for layout positions. A
 * fractional `transform` moves the paint without snapping and antialiases its edges, so a box under
 * one can fail with nothing over it.
 */
function pixelsOf(rect: Rect): PixelBox | undefined {
  const x = Math.round(rect.left);
  const y = Math.round(rect.top);
  const width = Math.round(rect.right) - x;
  const height = Math.round(rect.bottom) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

/**
 * What the page returns when it stages a region. Where a staged element runs an animation, it stages
 * nothing. Otherwise it returns the painted element's computed `background-color`, the alpha byte
 * Chromium paints for it, and the bytes of its own fill where that is an opaque color and no image
 * paints.
 */
type Staged =
  | { readonly _tag: "animating" }
  | { readonly _tag: "staged"; readonly color: string; readonly alpha: number; readonly fill: Bytes | null };

/** What the page returns when it paints a shot: whether every staged style took, and where it scrolled. */
type Painted = {
  readonly applied: boolean;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
};

/** Whether every pixel of a screenshot of the box is the color, opaque. */
async function shotShows(
  cdp: CDPSession,
  pixels: PixelBox,
  painted: Painted,
  [red, green, blue]: Bytes
): Promise<boolean> {
  const fits =
    pixels.x >= 0 &&
    pixels.y >= 0 &&
    pixels.x + pixels.width <= painted.viewportWidth &&
    pixels.y + pixels.height <= painted.viewportHeight;
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...pixels, x: pixels.x + painted.scrollX, y: pixels.y + painted.scrollY, scale: 1 },
    captureBeyondViewport: !fits,
    optimizeForSpeed: true,
  });
  const shot = PNG.sync.read(Buffer.from(data, "base64")).data;
  for (let at = 0; at < pixels.width * pixels.height * 4; at += 4) {
    if (shot[at] !== red || shot[at + 1] !== green || shot[at + 2] !== blue || shot[at + 3] !== 255) {
      return false;
    }
  }
  return true;
}

/** The page side of the probe's state: the sheets it adopted, the rule of each element it styles, and the checks each shot runs. */
const NEW_STATE_IN_PAGE = `function () { return { sheets: new Map(), rules: new Map(), painted: null, checks: [] }; }`;

/**
 * The page side of staging a region, called on the probe's object with its state and the staging's
 * arguments. It selects the scene on the page as the page styles it, then styles each element it
 * names through a constructed sheet adopted into the element's document or shadow root. A rule
 * selects its element by its place in the tree, so the shot writes no attribute a page's selector
 * could read, as `#root:not([style]) + #s` reads the root's style attribute. Each rule's
 * declarations are `!important`, and its selector carries the weight of eight IDs, so only an
 * inline or layered `!important` declaration overrides it, and {@link PAINT_IN_PAGE} checks that
 * none did. Each rule stops transitions, so a shot shows its values at once.
 *
 * A cleared or painted background keeps one `none` per image layer, since the color paints across
 * the last layer's `background-clip`: a color under `none, none` with a clip of `border-box, text`
 * paints only in text. Chromium computes one clip per image layer, so the clips count the layers.
 * The page paints the painted element's computed `background-color` on a canvas for its alpha, and
 * for its own fill where that alpha is opaque and every image layer is `none`.
 *
 * Before it styles anything, it checks each element of the scene and its open shadow tree for a
 * running animation or transition through `getAnimations()`. A staged rule's `transition: none`
 * cancels a running transition of its element, and the page would not get it back.
 */
function stageInPage(staging: string): string {
  return `function (state, args) {
  const scene = (${staging}).apply(this, args);
  const staged = [...scene.hidden, ...scene.cleared, scene.painted, ...scene.shown];
  const running = (scope) => scope.getAnimations().some((animation) => animation.playState === "running");
  if (staged.some((element) => running(element) || (element.shadowRoot !== null && running(element.shadowRoot)))) {
    return { _tag: "animating" };
  }
  const images = (element) => getComputedStyle(element).backgroundImage;
  const nones = (element) => getComputedStyle(element).backgroundClip.split(",").map(() => "none").join(", ");
  const own = getComputedStyle(scene.painted);
  const canvas = new OffscreenCanvas(1, 1).getContext("2d");
  canvas.fillStyle = own.backgroundColor;
  canvas.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = canvas.getImageData(0, 0, 1, 1).data;
  const fill = alpha === 255 && images(scene.painted) === nones(scene.painted) ? [red, green, blue] : null;
  const selectorOf = (element) => {
    const steps = [];
    let at = element;
    for (; at.parentElement !== null; at = at.parentElement) { steps.unshift(":nth-child(" + String([...at.parentElement.children].indexOf(at) + 1) + ")"); }
    const top = at.parentNode;
    if (at === document.documentElement) { steps.unshift(":root"); }
    else if (top instanceof ShadowRoot) { steps.unshift(":host", ":nth-child(" + String([...top.children].indexOf(at) + 1) + ")"); }
    else { throw new Error("The probe can only style an element in the document or a shadow root"); }
    return steps.join(" > ") + ":is(*, :not(*)" + "#p".repeat(8) + ")";
  };
  const ruleOf = (element) => {
    const known = state.rules.get(element);
    if (known !== undefined) { return known.style; }
    const scope = element.getRootNode();
    let sheet = state.sheets.get(scope);
    if (sheet === undefined) {
      sheet = new CSSStyleSheet();
      scope.adoptedStyleSheets = [...scope.adoptedStyleSheets, sheet];
      state.sheets.set(scope, sheet);
    }
    const rule = sheet.cssRules[sheet.insertRule(selectorOf(element) + " {}", sheet.cssRules.length)];
    rule.style.setProperty("transition", "none", "important");
    state.rules.set(element, rule);
    return rule.style;
  };
  const checks = [];
  scene.shown.forEach((element) => {
    ruleOf(element).setProperty("visibility", "visible", "important");
    checks.push(() => getComputedStyle(element).visibility === "visible");
  });
  scene.hidden.forEach((element) => {
    ruleOf(element).setProperty("opacity", "0", "important");
    checks.push(() => getComputedStyle(element).opacity === "0");
  });
  const blank = (element) => {
    const none = nones(element);
    ruleOf(element).setProperty("background-image", none, "important");
    checks.push(() => images(element) === none);
  };
  scene.cleared.forEach((element) => {
    blank(element);
    ruleOf(element).setProperty("background-color", "transparent", "important");
    checks.push(() => getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)");
  });
  blank(scene.painted);
  state.painted = { element: scene.painted, style: ruleOf(scene.painted), own: own.backgroundColor };
  state.checks = checks;
  return { _tag: "staged", color: own.backgroundColor, alpha, fill };
}`;
}

/**
 * The page side of a shot, called on the probe's object with its state and the color to paint, or
 * `null` for the painted element's own fill. It sets the painted rule's `background-color` and
 * checks that every staged style took, as an inline `!important` declaration can stop one.
 */
const PAINT_IN_PAGE = `function (state, color) {
  const { element, style, own } = state.painted;
  if (color === null) { style.removeProperty("background-color"); } else { style.setProperty("background-color", color, "important"); }
  const applied = state.checks.every((check) => check()) && getComputedStyle(element).backgroundColor === (color ?? own);
  return { applied, scrollX: window.scrollX, scrollY: window.scrollY, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
}`;

/**
 * The page side of the restore, called on the probe's object with its state. It drops every staged
 * value while the rules still stop transitions, has Chromium compute the restored style, then
 * removes the sheets, so no value changes while a transition could run and none starts.
 */
const RESTORE_IN_PAGE = `function (state) {
  for (const rule of state.rules.values()) { for (const name of [...rule.style]) { if (!name.startsWith("transition")) { rule.style.removeProperty(name); } } }
  for (const element of state.rules.keys()) { const style = getComputedStyle(element); void style.opacity; void style.visibility; void style.backgroundColor; void style.backgroundImage; }
  for (const [scope, sheet] of state.sheets) { scope.adoptedStyleSheets = scope.adoptedStyleSheets.filter((adopted) => adopted !== sheet); }
  state.sheets.clear();
  state.rules.clear();
  state.painted = null;
  state.checks = [];
}`;
