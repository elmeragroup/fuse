import { createElement } from "react";

/**
 * Unit under test: the place `accordion-kit.ts` declares for the Accordion item set's `infodropdown`
 * caret, as the kit builds it in the rest state: an icon outside the trigger's auto layout placed by
 * its distance to the trigger's right edge and by its centre's offset from the trigger's centre, at
 * its own size and turn, drawn as the trigger's last layer. The build reads no general rule for an
 * absolute icon, so this test is what keeps the declared place true to the component. Oracle: Chromium's
 * layout of the real Fuse `Accordion.Item` at rest in an `infodropdown` `Accordion.Root`, closed and
 * open at each radius, in every mode the capture measures, in hosts of three widths and with the docs
 * label and a label long enough to wrap the trigger onto more lines. The samples hold no hover, focus
 * or disabled state, so the comparison reads only the rest variants, and the kit inventory counts
 * the variants of the other states. Figma's MAX keeps a layer's distance to its
 * parent's right edge and CENTER its centre's offset from the parent's centre as the parent resizes
 * (N11), so the built distances must match Chromium's at every width and height, not only at the
 * capture's 384px. The caret's computed `rotate`, `scale` and `transform` must turn it as the built
 * rotation does, and Figma paints the last layer on top, so the caret must be the trigger's last
 * element child and the element Chromium hits at its centre. The test goes red where the build
 * places, sizes or turns the caret apart from Chromium, or leaves it in the trigger's flow, and where
 * Accordion's CSS moves, turns or covers the caret in any mode.
 */
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Accordion } from "../../../fuse/dist/accordion.js";
import { openFusePage } from "../../test/fuse-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { ACCORDION_TRIGGER_TEXT } from "./accordion-kit.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { BoxSpec, IconLayerSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** How far apart an entry of the built turn's matrix and Chromium's may sit: float rounding only. */
const TOLERANCE_MATRIX = 1e-6;

/** The radii and open states the set crosses with the variant. */
const RADII = ["none", "lg", "xl"] as const;
const OPEN = [false, true] as const;

/** Host widths around the capture's 384px, which the item fills as a block. */
const WIDTHS = [256, 384, 640] as const;

/** The docs label, and one a designer could type that wraps the trigger in the narrow hosts. */
const LABELS = [
  ACCORDION_TRIGGER_TEXT,
  "Shipping, returns and delivery times for every region we serve today",
] as const;

/** One sample item: its radius, whether it is open, its host's width and its label. */
type Sample = {
  readonly radius: (typeof RADII)[number];
  readonly open: boolean;
  readonly width: number;
  readonly label: string;
};

const SAMPLES: readonly Sample[] = RADII.flatMap((radius) =>
  OPEN.flatMap((open) => WIDTHS.flatMap((width) => LABELS.map((label) => ({ radius, open, width, label }))))
);

/** Each sample item's markup, in a host of its width. */
function sampleSlots(): readonly string[] {
  return SAMPLES.map((sample, index) => {
    const item = createElement(
      Accordion.Root,
      { variant: "infodropdown", radius: sample.radius, defaultValue: sample.open ? ["item"] : [] },
      createElement(
        Accordion.Item,
        { value: "item" },
        createElement(Accordion.Header, null, createElement(Accordion.Trigger, null, sample.label)),
        createElement(Accordion.Content, null, "Delivered within 3–5 business days.")
      )
    );
    return `<div data-sample="${String(index)}" style="width:${String(sample.width)}px;margin:8px">${renderToStaticMarkup(item)}</div>`;
  });
}

/**
 * The 2D part of a caret's computed `rotate`, `scale` and `transform`, as `[a, b, c, d]` of the
 * matrix they compose, or the values the page does not read.
 */
type Turn =
  | { readonly kind: "read"; readonly matrix: readonly number[] }
  | { readonly kind: "unread"; readonly value: string };

/** What the page measures of one sample's caret against its trigger in one mode, in CSS pixels. */
type Measured = {
  readonly sample: number;
  readonly mode: string;
  /** The trigger's border box height, to show the long label taller. */
  readonly trigger: number;
  /** The caret's right edge inside the trigger's right edge. */
  readonly end: number;
  /** The caret's centre below the trigger's centre. */
  readonly centre: number;
  readonly width: number;
  readonly height: number;
  readonly turn: Turn;
  /** Whether the caret is the trigger's last element child, which paints after the rest. */
  readonly last: boolean;
  /** What Chromium hits at the caret's centre: `caret` for the caret or inside it, else the tag. */
  readonly hit: string;
};

/** Measure every sample's caret in every mode, once its fonts have loaded there. */
function measureEveryMode(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(async (modes) => {
    // A computed `rotate` is `none`, an angle, an axis and an angle, or a vector and an angle, and a
    // computed `scale` is one to three numbers (CSS Transforms 2 §4). The page reads each as the
    // transform function it names, and reads no other value.
    const AXES = new Map([
      ["x", "1,0,0"],
      ["y", "0,1,0"],
      ["z", "0,0,1"],
    ]);
    const rotateFunction = (value: string): string | undefined => {
      const parts = value.split(" ");
      const [first = "", second = ""] = parts;
      const axis = AXES.get(first);
      return value === "none"
        ? ""
        : parts.length === 1
          ? `rotate(${first})`
          : parts.length === 2 && axis !== undefined
            ? `rotate3d(${axis},${second})`
            : parts.length === 4
              ? `rotate3d(${parts.join(",")})`
              : undefined;
    };
    const scaleFunction = (value: string): string | undefined => {
      const [x = "", y = x, z = "1", ...rest] = value.split(" ");
      return value === "none" ? "" : rest.length === 0 ? `scale3d(${x},${y},${z})` : undefined;
    };
    // CSS applies `rotate`, then `scale`, then `transform` (CSS Transforms 2 §6). A translate moves
    // the caret's box, which the end and centre distances read, and leaves the 2D part alone.
    const turnOf = (caret: Element): Turn => {
      const style = getComputedStyle(caret);
      const rotate = rotateFunction(style.rotate);
      const scale = scaleFunction(style.scale);
      if (rotate === undefined || scale === undefined) {
        return { kind: "unread", value: `rotate: ${style.rotate}; scale: ${style.scale}` };
      }
      const transform = style.transform === "none" ? "" : style.transform;
      const matrix = new DOMMatrixReadOnly(`matrix(1,0,0,1,0,0) ${rotate} ${scale} ${transform}`);
      return { kind: "read", matrix: [matrix.a, matrix.b, matrix.c, matrix.d] };
    };
    const out: Measured[] = [];
    for (const mode of modes) {
      for (const [name, value] of Object.entries(mode.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(mode.body)) {
        document.body.setAttribute(name, value);
      }
      const triggers = [...document.querySelectorAll('[data-slot="accordion-trigger"]')];
      await Promise.all(triggers.map((trigger) => document.fonts.load(getComputedStyle(trigger).font)));
      await document.fonts.ready;
      for (const slot of document.querySelectorAll("[data-sample]")) {
        const trigger = slot.querySelector('[data-slot="accordion-trigger"]');
        const caret = trigger?.querySelector(":scope > svg") ?? null;
        if (trigger === null || caret === null) {
          throw new Error("a sample item lacks its trigger or its caret");
        }
        // Chromium hits only what the viewport shows, so the caret scrolls in before its box reads.
        caret.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        const outer = trigger.getBoundingClientRect();
        const box = caret.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        out.push({
          sample: Number(slot.getAttribute("data-sample")),
          mode: JSON.stringify(mode),
          trigger: outer.height,
          end: outer.right - box.right,
          centre: box.top + box.height / 2 - (outer.top + outer.height / 2),
          width: box.width,
          height: box.height,
          turn: turnOf(caret),
          last: trigger.lastElementChild === caret,
          hit: hit !== null && caret.contains(hit) ? "caret" : (hit?.tagName ?? "nothing"),
        });
      }
    }
    return out;
  }, EVERY_MODE);
}

/** The caret the built trigger holds, which its header holds first, and whether it is the last layer. */
function caretOf(root: BoxSpec | undefined): Pick<BuiltCaret, "caret" | "last"> {
  const [header] = root?.children ?? [];
  const [trigger] = header?.kind === "frame" ? header.children : [];
  const layers = trigger?.kind === "frame" ? trigger.children : [];
  const caret = layers.find((layer) => layer.key === "caret");
  if (caret?.kind !== "icon") {
    throw new Error("the built trigger holds no caret icon");
  }
  return { caret, last: layers.at(-1) === caret };
}

/** What the built set gives the caret of each `infodropdown` rest variant, by its radius and open state. */
type BuiltCaret = {
  readonly key: string;
  readonly radius: string;
  readonly open: boolean;
  readonly caret: IconLayerSpec;
  /** Whether the caret is the built trigger's last layer, which Figma paints on top. */
  readonly last: boolean;
};

let browser: Browser;
let measured: readonly Measured[];
let built: readonly BuiltCaret[];

beforeAll(async () => {
  const sets = await Effect.runPromise(buildComponentSets());
  const set = sets.find((each) => each.componentSet.key === "accordion-item");
  built = (set?.componentSet.variants ?? []).flatMap((variant) => {
    const match = /variant=infodropdown,radius=(\w+),open=(\w+),state=rest$/.exec(variant.key);
    return match === null
      ? []
      : [
          {
            key: variant.key,
            radius: match[1] ?? "",
            open: match[2] === "true",
            ...caretOf(variant.root),
          },
        ];
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openFusePage(page, { body: sampleSlots().join("\n") });
  measured = await measureEveryMode(page);
}, 300_000);

afterAll(async () => {
  await browser.close();
});

describe("the infodropdown caret, placed as Figma keeps the built place", () => {
  it("builds the rest variant at each radius, closed and open, and measures every sample in every mode", () => {
    expect(built).toHaveLength(RADII.length * OPEN.length);
    expect(measured).toHaveLength(SAMPLES.length * EVERY_MODE.length);
  });

  // The long label wraps the trigger past one line in the narrowest host, so the comparison covers a
  // trigger taller than the short label's in the same item and mode, where a top inset would part
  // from a centre.
  it("measures the long label's trigger taller than the short one's in the narrowest host", () => {
    const narrowest = Math.min(...WIDTHS);
    const heightOf = (radius: string, open: boolean, mode: string, label: string) =>
      measured.find((each) => {
        const sample = SAMPLES[each.sample];
        return (
          each.mode === mode &&
          sample?.width === narrowest &&
          sample.radius === radius &&
          sample.open === open &&
          sample.label === label
        );
      })?.trigger;
    const [short, long] = LABELS;
    const unwrapped = EVERY_MODE.flatMap((mode) =>
      RADII.flatMap((radius) =>
        OPEN.flatMap((open) => {
          const key = JSON.stringify(mode);
          const [shortHeight, longHeight] = [short, long].map((label) => heightOf(radius, open, key, label));
          return shortHeight !== undefined && longHeight !== undefined && longHeight > shortHeight
            ? []
            : [`${radius}, open ${String(open)}, ${key}: ${String(shortHeight)} and ${String(longHeight)}`];
        })
      )
    );
    expect(unwrapped).toEqual([]);
  });

  it("matches Chromium's caret size, end distance and centre offset in every sample", () => {
    const apart = built.flatMap(({ key, radius, open, caret }) => {
      const { placement, size } = caret;
      if (placement === undefined || size.kind !== "literal") {
        return [`${key}: the caret has no place, or no literal size`];
      }
      const { horizontal, vertical } = placement;
      if (horizontal.kind !== "end" || vertical.kind !== "centre") {
        return [`${key}: the caret sits ${horizontal.kind} across and ${vertical.kind} down`];
      }
      return measured.flatMap((each) => {
        const sample = SAMPLES[each.sample];
        if (sample === undefined || sample.radius !== radius || sample.open !== open) {
          return [];
        }
        const figma = { end: horizontal.end, centre: vertical.offset, width: size.value, height: size.value };
        const fields = [
          "end",
          "centre",
          "width",
          "height",
        ] as const satisfies readonly (keyof typeof figma)[];
        return fields.flatMap((field) =>
          Math.abs(figma[field] - each[field]) <= TOLERANCE_PX
            ? []
            : [
                `${key} at ${String(sample.width)}px, ${sample.label}, ${each.mode}: ${field} ${String(figma[field])} in Figma, ${String(each[field])} in Chromium`,
              ]
        );
      });
    });
    expect(apart).toEqual([]);
  });

  it("turns the caret as Chromium does in every sample", () => {
    const apart = built.flatMap(({ key, radius, open, caret }) => {
      // Figma's rotation is counterclockwise, CSS's clockwise in its y-down space, so a Figma turn of
      // r degrees is the CSS matrix of -r: [cos r, -sin r, sin r, cos r].
      const radians = ((caret.rotation ?? 0) * Math.PI) / 180;
      const figma = [Math.cos(radians), -Math.sin(radians), Math.sin(radians), Math.cos(radians)];
      return measured.flatMap((each) => {
        const sample = SAMPLES[each.sample];
        if (sample === undefined || sample.radius !== radius || sample.open !== open) {
          return [];
        }
        const { turn } = each;
        const agrees =
          turn.kind === "read" &&
          figma.every(
            (entry, index) => Math.abs(entry - (turn.matrix[index] ?? Number.NaN)) <= TOLERANCE_MATRIX
          );
        return agrees
          ? []
          : [
              `${key} at ${String(sample.width)}px, ${sample.label}, ${each.mode}: ${JSON.stringify(figma)} in Figma, ${turn.kind === "read" ? JSON.stringify(turn.matrix) : turn.value} in Chromium`,
            ];
      });
    });
    expect(apart).toEqual([]);
  });

  it("paints the caret over the rest of the trigger in every sample, as its last layer does in Figma", () => {
    const unlayered = built.flatMap(({ key, last }) =>
      last ? [] : [`${key}: the caret is not the last layer`]
    );
    const covered = measured.flatMap((each) =>
      each.last && each.hit === "caret"
        ? []
        : [`sample ${String(each.sample)}, ${each.mode}: last child ${String(each.last)}, hit ${each.hit}`]
    );
    expect([...unlayered, ...covered]).toEqual([]);
  });
});
