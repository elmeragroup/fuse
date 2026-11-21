import { createElement } from "react";

import { NodeServices } from "@effect/platform-node";
/**
 * Unit under test: the Icon button set's `size=icon-inline` variants, as the kit builds them: a root
 * of a fixed width and a fixed height, each a literal length.
 * Oracle: Chromium's layout of the real Fuse `<Button size="icon-inline">` around a `<Plus />`, for
 * every variant at rest, disabled and pending, standing alone on a page with Fuse's styles and the
 * kit's fonts, as the capture renders a cell, in every mode the capture measures. Hover and focus
 * render the rest markup, so the rest sample's border box is theirs too. The button takes the line
 * height of the text around it, `1lh` with an `aspect-ratio` of 1, so standing alone its border box
 * is a square as tall as the page's own line. The test checks the width and height of each of the 35
 * built variants against its sample's border box in every mode. It goes red where the set draws no
 * `icon-inline` variant, where the build hugs either side, and where a mode lays the button out at
 * another size than the one the build fixes.
 */
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Button, buttonVariants } from "../../../fuse/dist/button.js";
import { Plus } from "../../../fuse/dist/icons.js";
import { openSweep } from "../../test/sweep-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { SizeSpec } from "./kit-spec.ts";
import { ownKey } from "./own-key.ts";

/** How far apart, in CSS pixels, a built length and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

type ButtonVariant = keyof typeof buttonVariants.variants.variant;

/** Every variant the recipe declares. */
const VARIANTS = Object.keys(buttonVariants.variants.variant).filter((value): value is ButtonVariant =>
  ownKey(buttonVariants.variants.variant, value)
);

/**
 * The states whose markup differs, each as the props that render it and the built states it stands
 * for. Hover and focus render the rest markup and the recipe sets no length for them, so the rest
 * sample's geometry is theirs too.
 */
const STATES = [
  { states: ["rest", "hover", "focus"], props: {} },
  { states: ["disabled"], props: { disabled: true } },
  { states: ["pending"], props: { isPending: true } },
] as const;

/**
 * The samples: every variant in every state whose markup differs, each with the keys of the built
 * variants it stands for.
 */
const SAMPLES = VARIANTS.flatMap((variant) =>
  STATES.map(({ states, props }) => ({
    keys: states.map((state) => `icon-button/variant=${variant},size=icon-inline,state=${state}`),
    markup: renderToStaticMarkup(
      createElement(
        Button,
        { ...props, variant, size: "icon-inline", "aria-label": "Button" },
        createElement(Plus)
      )
    ),
  }))
);

/** Each sample's markup, in a slot of its own. */
function sampleSlots(): readonly string[] {
  return SAMPLES.map(
    ({ markup }, index) => `<div data-sample="${String(index)}" style="margin:8px">${markup}</div>`
  );
}

/** The border box of one sample's button in one mode, in CSS pixels. */
type Measured = {
  /** The sample's index in {@link SAMPLES}. */
  readonly sample: number;
  readonly mode: string;
  readonly width: number;
  readonly height: number;
};

/** Measure every sample's button in every mode, once its fonts have loaded there. */
function measureEveryMode(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(async (modes) => {
    const out: Measured[] = [];
    for (const mode of modes) {
      for (const [name, value] of Object.entries(mode.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(mode.body)) {
        document.body.setAttribute(name, value);
      }
      await document.fonts.load(getComputedStyle(document.body).font);
      await document.fonts.ready;
      for (const slot of document.querySelectorAll("[data-sample]")) {
        const button = slot.querySelector('[data-slot="button"]');
        if (button === null) {
          throw new Error("a sample holds no button");
        }
        const box = button.getBoundingClientRect();
        out.push({
          sample: Number(slot.getAttribute("data-sample")),
          mode: JSON.stringify(mode),
          width: box.width,
          height: box.height,
        });
      }
    }
    return out;
  }, EVERY_MODE);
}

/** The fixed literal length of a built side, or undefined where the side hugs, fills or binds. */
function literalLength(size: SizeSpec): number | undefined {
  return size.kind === "fixed" && size.length.kind === "literal" ? size.length.value : undefined;
}

let browser: Browser;
let measured: readonly Measured[];
let built: ReadonlyMap<string, { readonly width: number | undefined; readonly height: number | undefined }>;

beforeAll(async () => {
  const sets = await Effect.runPromise(buildComponentSets());
  const iconButton = sets.find((each) => each.componentSet.key === "icon-button");
  built = new Map(
    (iconButton?.componentSet.variants ?? []).map((variant) => [
      variant.key,
      {
        width: literalLength(variant.root.sizing.horizontal),
        height: literalLength(variant.root.sizing.vertical),
      },
    ])
  );
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openSweep(page, assets, sampleSlots());
  measured = await measureEveryMode(page);
}, 300_000);

afterAll(async () => {
  await browser.close();
});

describe("the Icon button set's icon-inline variants", () => {
  it("measures every sample in every mode", () => {
    expect(measured).toHaveLength(SAMPLES.length * EVERY_MODE.length);
  });

  it("compare every built icon-inline variant", () => {
    const compared = new Set(SAMPLES.flatMap(({ keys }) => keys));
    const builtInline = [...built.keys()].filter((key) => key.includes(",size=icon-inline,"));
    expect({ count: builtInline.length, unchecked: builtInline.filter((key) => !compared.has(key)) }).toEqual(
      {
        count: 35,
        unchecked: [],
      }
    );
  });

  it("fix the width and height Chromium lays the button out at in every mode", () => {
    const apart = measured.flatMap((sample) =>
      (SAMPLES[sample.sample]?.keys ?? []).flatMap((key) => {
        const variant = built.get(key);
        if (variant === undefined) {
          return [`${key}: the build draws no such variant`];
        }
        return (["width", "height"] as const).flatMap((side) => {
          const length = variant[side];
          return length !== undefined && Math.abs(length - sample[side]) <= TOLERANCE_PX
            ? []
            : [
                `${key} ${sample.mode}: ${side} ${length === undefined ? "not a fixed literal" : String(length)} in Figma, ${String(sample[side])} in Chromium`,
              ];
        });
      })
    );
    expect(apart).toEqual([]);
  });
});
