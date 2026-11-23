/**
 * Unit under test: each description of the Timeline list links set, as the kit builds it, its
 * colors resolved in an in-memory Figma file that the token sync wrote.
 * Oracle: Chromium's rendering of the real Fuse `TimelineList` links demo on Fuse's built CSS, with
 * the page stamped in each of the file's mode combinations as `test:compare` stamps them: where the
 * `<a>` sits in the description's text, the computed `text-decoration-line`,
 * `text-decoration-color`, `color` and `font-weight` of the link and of the description around it,
 * and the link's `href` as the browser's URL parser reads it. Figma links a range only to an
 * absolute `http` or `https` URL, and refused a fragment and a path on 2026-11-21 (live probe RH1,
 * RH2), so a character links to the `href` only where the parser reads it as such a URL.
 *
 * A description draws its link as a range of its one text. The case compares each character's
 * underline, fill, underline color and link, and the text's face, under every pin, so a range at the
 * wrong index, a missing underline, or a link fill bound to the wrong role in any mode fails it.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { computedColor, named, resolvedIn, stampsOf, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { STYLES_LAYERS } from "../compare/preview-page.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import { timelineListLinks } from "../compare/timeline-list-cell.ts";
import { FONT_WEIGHT_STYLES } from "./kit-spec.ts";
import type { ChildLayerSpec, ColorSpec, TextLayerSpec } from "./kit-spec.ts";

/** What Chromium computes for one description under one pin. */
type MeasuredDescription = {
  readonly text: string;
  /** The link's first character's index in `text`, and the index after its last. */
  readonly link: { readonly start: number; readonly end: number };
  readonly linkLine: string;
  readonly linkColor: string;
  readonly linkDecorationColor: string;
  readonly linkWeight: string;
  /** The link's `href` where the URL parser reads it as an absolute `http` or `https` URL, else null. */
  readonly linkTarget: string | null;
  readonly color: string;
  readonly line: string;
  readonly decorationColor: string;
  readonly weight: string;
};

/**
 * The page: the links demo's list, as the kit's renderer draws it, on a docs-like host, with
 * Tailwind's preflight in the base layer and the docs layout's `font-sans text-foreground` on the
 * body, as the comparison page loads them (`compare/preview-page.ts`).
 */
function linksDocument(preflight: string, css: string): string {
  const list = renderToStaticMarkup(timelineListLinks.element({ state: "rest" }, new Set()));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
@layer base {
${preflight}
}
${css}
</style></head><body class="font-sans text-foreground">${list}</body></html>`;
}

/** Stamp each pin's theme in turn and read every description and its link. */
function measurePins(
  page: Page,
  stamps: readonly ThemeStamps[]
): Promise<readonly (readonly MeasuredDescription[])[]> {
  return page.evaluate(
    (pins) =>
      pins.map((pin) => {
        for (const [name, value] of Object.entries(pin.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(pin.body)) {
          document.body.setAttribute(name, value);
        }
        return [...document.querySelectorAll("[data-slot=timeline-list-description]")].map((description) => {
          const link = description.querySelector("a");
          if (link === null) {
            throw new Error("a links description holds no link");
          }
          const before = document.createRange();
          before.setStart(description, 0);
          before.setEndBefore(link);
          const start = before.toString().length;
          const own = getComputedStyle(description);
          const linked = getComputedStyle(link);
          const href = link.getAttribute("href") ?? "";
          const absolute = URL.canParse(href) ? new URL(href) : undefined;
          return {
            text: description.textContent,
            link: { start, end: start + link.textContent.length },
            linkLine: linked.textDecorationLine,
            linkColor: linked.color,
            linkDecorationColor: linked.textDecorationColor,
            linkWeight: linked.fontWeight,
            linkTarget:
              absolute !== undefined && ["http:", "https:"].includes(absolute.protocol) ? href : null,
            color: own.color,
            line: own.textDecorationLine,
            decorationColor: own.textDecorationColor,
            weight: own.fontWeight,
          };
        });
      }),
    stamps
  );
}

/** A color as 8-bit sRGB channels and alpha, the precision a Figma paint and a screen share. */
function bytes(color: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}): string {
  return [color.r, color.g, color.b, color.a].map((channel) => Math.round(channel * 255)).join(",");
}

/** A spec color as the file resolves it under a pin, as 8-bit sRGB. */
function resolvedBytes(figma: InMemoryFigma, color: ColorSpec, pin: SweptMode): string {
  const value = resolvedIn(figma, color, pin);
  return value instanceof Object ? bytes(value) : `not a color: ${String(value)}`;
}

/** A character's look: its underline, fill, underline color and link. */
type Look = {
  readonly underlined: boolean;
  readonly fill: string;
  readonly underline?: string;
  readonly link: string | null;
};

/** Each run of characters that look alike, as `start-end look`, for a short mismatch line. */
function runs(looks: readonly Look[]): string {
  const joined: { start: number; end: number; key: string }[] = [];
  looks.forEach((look, index) => {
    const key = JSON.stringify(look);
    const last = joined.at(-1);
    if (last?.key === key) {
      last.end = index + 1;
    } else {
      joined.push({ start: index, end: index + 1, key });
    }
  });
  return joined.map((run) => `${String(run.start)}-${String(run.end)} ${run.key}`).join("; ");
}

/** The text layers at or below some layers, depth first. */
function textsIn(layers: readonly ChildLayerSpec[]): readonly TextLayerSpec[] {
  return layers.flatMap((layer) =>
    layer.kind === "text" ? [layer] : layer.kind === "frame" ? textsIn(layer.children) : []
  );
}

/** What a text shows at each of its characters: whether it is underlined, its fill and its underline's color. */
function characterLooks(figma: InMemoryFigma, text: TextLayerSpec, pin: SweptMode): readonly Look[] {
  return Array.from({ length: text.characters.length }, (_, index) => {
    const range = text.ranges?.find((each) => each.start <= index && index < each.end);
    const fill = range?.color ?? text.color;
    const underline = range?.underline ?? text.underline;
    const link = range?.hyperlink ?? null;
    return underline === undefined
      ? { underlined: false, fill: resolvedBytes(figma, fill, pin), link }
      : {
          underlined: true,
          fill: resolvedBytes(figma, fill, pin),
          underline: resolvedBytes(figma, underline.color ?? fill, pin),
          link,
        };
  });
}

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let pins: readonly SweptMode[];
let measured: readonly (readonly MeasuredDescription[])[];

beforeAll(async () => {
  kit = await builtKit();
  ({ figma, modes: pins } = await sweptFile());
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(linksDocument(assets.preflight, `${assets.styles}\n${assets.themes}`));
  measured = await measurePins(page, pins.map(stampsOf));
});

afterAll(async () => {
  await browser?.close();
});

describe("the Timeline list links set's descriptions", () => {
  it("draws each link as Chromium draws the real links demo under every pin", () => {
    const texts = textsIn(variantRoot(kit.spec, "timeline-list-links/state=rest").children);
    const apart = pins.flatMap((pin, index) =>
      (measured[index] ?? []).flatMap((description) => {
        const text = texts.find((each) => each.characters === description.text);
        if (text === undefined) {
          return [`${named(pin)}: no text layer shows ${JSON.stringify(description.text)}`];
        }
        const expected = Array.from({ length: description.text.length }, (_, at): Look => {
          const linked = description.link.start <= at && at < description.link.end;
          const fill = bytes(computedColor(linked ? description.linkColor : description.color));
          const line = linked ? description.linkLine : description.line;
          const link = linked ? description.linkTarget : null;
          return line === "underline"
            ? {
                underlined: true,
                fill,
                underline: bytes(
                  computedColor(linked ? description.linkDecorationColor : description.decorationColor)
                ),
                link,
              }
            : { underlined: false, fill, link };
        });
        const drawn = characterLooks(figma, text, pin);
        const faces = [description.weight, description.linkWeight].map((weight) =>
          FONT_WEIGHT_STYLES.get(Number(weight))
        );
        const looks =
          runs(drawn) === runs(expected)
            ? []
            : [
                `${named(pin)} ${JSON.stringify(description.text)}: drawn ${runs(drawn)}, Chromium ${runs(expected)}`,
              ];
        const weights = faces.every((face) => face === text.fontStyle)
          ? []
          : [
              `${named(pin)} ${JSON.stringify(description.text)}: drawn ${text.fontStyle}, Chromium ${faces.join(" and ")}`,
            ];
        return [...looks, ...weights];
      })
    );
    expect(measured.flat()).not.toHaveLength(0);
    expect(apart).toEqual([]);
  });
});
