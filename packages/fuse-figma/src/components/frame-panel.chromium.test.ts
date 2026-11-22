/**
 * Unit under test: the shadow and the highlight of the Frame set's first panel, as the kit builds
 * them and an in-memory Figma file that the token sync wrote resolves them under every combination of
 * the file's modes. `padding-box-fill.chromium.test.ts` checks the panel's fill, corner and border
 * with shadows off; this suite checks what that one leaves out.
 * The pins come from `sweptFile` in `test/mode-sweep.ts`, which stops unless they are one per
 * combination of the theme catalog's modes, so a mode the sync leaves out fails the suite.
 * Oracle: Chromium's computed style of the real Fuse Frame on Fuse's built CSS, with the page stamped
 * as `test:compare` stamps the same modes:
 *
 * - The panel's drop shadows, each layer of its computed `box-shadow` that paints, by color, offsets,
 *   blur and spread. Chromium writes the color in the space it was declared in, as
 *   `oklab(0 0 0 / 0.05)`, which `@elmeragroup/color` parses.
 * - The highlight, the panel's `::before`: its shadows the same way, its corners by their computed
 *   radii, and its edges by where Chromium places it inside the panel's border box. Chromium draws
 *   its shadow though it paints nothing else. Figma draws a frame's shadow only where the frame paints,
 *   and a fill black at alpha 0.0015 was enough (probe FR1), so the highlight's fill takes an alpha
 *   from 0.0015, the least FR1 drew a shadow from, to below half an 8-bit step, 1/510, which moves no
 *   channel, as Chromium paints nothing of the highlight itself.
 */
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { computedShadows, roundedShadows } from "../../test/composited-pixels.ts";
import type { Shadow } from "../../test/composited-pixels.ts";
import { openFusePage } from "../../test/fuse-page.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { colorIn, named, pixelsIn, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import { frame } from "../compare/frame-cell.ts";
import { themeStamps } from "../compare/preview-theme.ts";
import type { Rgba } from "../variable-set.ts";
import { cornerLengths } from "./corner-spec.ts";
import type { BoxSpec, ColorSpec, FrameLayerSpec, NumberSpec, ShadowSpec } from "./kit-spec.ts";

/** The page's body: the `frame` compare cell, the docs default demo's Frame in its default layout. */
const BODY = renderToStaticMarkup(frame.element({ layout: "gutter" }, new Set()));

/** The least fill alpha a frame cast its shadow from in probe FR1. */
const LEAST_CASTING_ALPHA = 0.0015;

/** Half an 8-bit step: a fill below it moves no channel of what lies under it. */
const HALF_STEP = 1 / 510;

/** What Chromium computes for the first panel and its highlight under one pin. */
type Measured = {
  readonly panelShadow: string;
  readonly highlightShadow: string;
  readonly highlightRadii: readonly number[];
  readonly highlightInsets: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
};

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let modes: readonly SweptMode[];
let measured: readonly Measured[];

beforeAll(async () => {
  const [built, file] = await Promise.all([builtKit(), sweptFile()]);
  kit = built;
  ({ figma, modes } = file);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
  await openFusePage(page, { body: BODY });
  const out: Measured[] = [];
  for (const mode of modes) {
    out.push(
      await page.evaluate(async (stamps) => {
        for (const [name, value] of Object.entries(stamps.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(stamps.body)) {
          document.body.setAttribute(name, value);
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const panel = document.querySelector('[data-slot="frame-panel"]');
        if (panel === null) {
          throw new Error("the page holds no frame panel");
        }
        const own = getComputedStyle(panel);
        const before = getComputedStyle(panel, "::before");
        // The highlight is `absolute inset-0`, so its edges sit on the panel's padding box.
        const px = (value: string) => Number.parseFloat(value);
        return {
          panelShadow: own.boxShadow,
          highlightShadow: before.boxShadow,
          highlightRadii: [
            before.borderTopLeftRadius,
            before.borderTopRightRadius,
            before.borderBottomRightRadius,
            before.borderBottomLeftRadius,
          ].map(px),
          highlightInsets: {
            top: px(own.borderTopWidth) + px(before.top),
            right: px(own.borderRightWidth) + px(before.right),
            bottom: px(own.borderBottomWidth) + px(before.bottom),
            left: px(own.borderLeftWidth) + px(before.left),
          },
        };
      }, themeStamps(mode.theme))
    );
  }
  measured = out;
});

afterAll(async () => {
  await browser?.close();
});

/** A FLOAT field as the file resolves it under a pin. */
const length = (spec: NumberSpec, mode: SweptMode): number => pixelsIn(figma, spec, mode);

/** A COLOR field as the file resolves it under a pin. */
const color = (spec: ColorSpec, mode: SweptMode): Rgba => colorIn(figma, spec, mode);

/** The spec's shadows in CSS order, first on top, as Figma lists them last on top, resolved under a pin. */
function specShadows(shadows: readonly ShadowSpec[], mode: SweptMode): readonly Shadow[] {
  return shadows.toReversed().map((shadow) => ({
    color: color(shadow.color, mode),
    x: shadow.offsetX,
    y: shadow.offsetY,
    blur: length(shadow.radius, mode),
    spread: length(shadow.spread, mode),
  }));
}

/** The first panel's frame, or the frame it sits in where a margin wraps it. */
function firstPanel(): BoxSpec {
  const root = variantRoot(kit.spec, "frame/layout=gutter");
  const panel = root.children.find((layer) => layer.kind === "frame" && layer.key === "panel-1");
  if (panel?.kind !== "frame") {
    throw new Error("the Frame set holds no first panel");
  }
  return panel;
}

/** The panel's highlight layer, its `::before`. */
function highlight(panel: BoxSpec): FrameLayerSpec {
  const layer = panel.children.find((child) => child.kind === "frame" && child.key === "::before");
  if (layer?.kind !== "frame") {
    throw new Error("the first panel holds no highlight");
  }
  return layer;
}

describe("the Frame panel", () => {
  it("casts the shadows Chromium computes under every pin", () => {
    const panel = firstPanel();
    const apart = modes.flatMap((mode, index) => {
      const spec = roundedShadows(specShadows(panel.shadows, mode));
      const browserShadows = roundedShadows(computedShadows(measured[index]?.panelShadow ?? ""));
      return spec === browserShadows ? [] : [`${named(mode)}: spec ${spec}, Chromium ${browserShadows}`];
    });
    expect(apart).toEqual([]);
  });

  it("draws its highlight with Chromium's shadows, corners and edges under every pin", () => {
    const layer = highlight(firstPanel());
    const placement = layer.placement;
    const insets =
      placement?.kind === "edges" &&
      placement.horizontal.kind === "stretch" &&
      placement.vertical.kind === "stretch"
        ? {
            top: placement.vertical.start,
            right: placement.horizontal.end,
            bottom: placement.vertical.end,
            left: placement.horizontal.start,
          }
        : undefined;
    const apart = modes.flatMap((mode, index) => {
      const chromium = measured[index];
      const fill =
        layer.fill === undefined || layer.fill.kind === "image" ? undefined : color(layer.fill, mode);
      const spec = {
        // Chromium draws the highlight's shadow and nothing of the highlight itself.
        castsShadows:
          layer.shadows.length === 0 ||
          (fill !== undefined && fill.a >= LEAST_CASTING_ALPHA && fill.a < HALF_STEP),
        shadows: roundedShadows(specShadows(layer.shadows, mode)),
        radii: cornerLengths(layer.cornerRadius).map((corner) => length(corner, mode)),
        insets,
      };
      const browserSide = {
        castsShadows: true,
        shadows: roundedShadows(computedShadows(chromium?.highlightShadow ?? "")),
        radii: chromium?.highlightRadii,
        insets: chromium?.highlightInsets,
      };
      const radiiMatch =
        spec.radii.length === 1
          ? (browserSide.radii ?? []).every((radius) => radius === spec.radii[0])
          : JSON.stringify(spec.radii) === JSON.stringify(browserSide.radii);
      return spec.castsShadows &&
        spec.shadows === browserSide.shadows &&
        radiiMatch &&
        JSON.stringify(spec.insets) === JSON.stringify(browserSide.insets)
        ? []
        : [`${named(mode)}: spec ${JSON.stringify(spec)}, Chromium ${JSON.stringify(browserSide)}`];
    });
    expect(apart).toEqual([]);
  });
});
