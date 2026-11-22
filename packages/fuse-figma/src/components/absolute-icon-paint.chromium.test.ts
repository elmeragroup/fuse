/**
 * Unit under test: an absolute icon's place as the build reads it (`buildSetsInOrder`, through
 * `buildCaptured`) from the facts the capture's page function measures on markup in Chromium
 * (`measuredFacts`), under the capture's marked rule that stops every animation. The markup is the
 * shape of Accordion's `infodropdown` item: a 384px block root, a flex header, a `relative` flex row
 * that centres its items and holds the label and then a 16px `<svg>` at `right: 0`. Each fixture
 * writes the markup's styles as the classes and declarations the build reads, and leaves out what
 * the capture's default mode does not see: a rule of another mode or media, and a theme sheet's rule.
 * Oracles:
 *
 * - Chromium's own layout of the same markup, in the mode a row's rule names, for where the icon
 *   sits against its box (`iconPlace`), which the build must meet exactly;
 * - Chromium's computed `animation-name` with the stopping rule lifted, in the mode or under the
 *   reduced motion a row's rule names, for whether a consumer's page runs an animation (`still`).
 *
 * The caret places. An icon that reaches outside its box, changes size or inset in one mode, or sits
 * inside a border the build reads as none stays in the flow, and so does one any rule animates.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildCaptured, chip, ICON, part, rest } from "../../test/capture-fixtures.ts";
import type { FixtureElement, Written } from "../../test/capture-fixtures.ts";
import { measureMarkup } from "../../test/measured-markup.ts";
import type { MeasuredFacts } from "../capture/capture-format.ts";
import type { LabelManifest } from "../capture/manifest.ts";
import { STILL_ATTRIBUTE } from "../compare/preview-page.ts";
import { makeVariableIndex } from "./css-values.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
});

afterAll(async () => {
  await browser.close();
});

const CARET = { ...ICON, key: "caret", name: "caret", side: "end" as const };
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Shipping",
  textProperty: "Label",
  shownIn: () => true,
};
const FONT_SANS = { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" };

/** What a row changes from the caret's shape, in the markup and in the fixture alike. */
type Row = {
  /** Rules for the page's head, which the capture's default mode may not see. */
  readonly head?: string;
  /** Declarations after the box's own, in the markup's `style`. */
  readonly box?: string;
  /** Classes the fixture's box wins for them. */
  readonly boxClasses?: string;
  /** Declarations after the icon's own, in the markup's `style`. */
  readonly icon?: string;
  /** Classes the fixture's icon wins for them, in place of `right-0`. */
  readonly iconClasses?: string;
  /** Attributes on the icon, as a selector a row's rule names. */
  readonly iconAttributes?: string;
  /** Set where a 16px panel follows the header, `#panel`, as an open item's does. */
  readonly panel?: true;
  /** What the fixture's icon writes besides its classes. */
  readonly written?: readonly Written[];
  /** Set where the page holds no marked stopping rule, so the `still` read cannot lift one. */
  readonly unmarked?: true;
};

/** The markup of a row: the item, its header, its trigger and the caret. */
function markupOf(row: Row): string {
  const icon = `<svg id="icon" ${row.iconAttributes ?? ""} viewBox="0 0 16 16" style="position: absolute; right: 0; width: 16px; height: 16px; flex-shrink: 0; ${row.icon ?? ""}"><rect width="16" height="16"/></svg>`;
  const trigger = `<div id="trigger" style="position: relative; display: flex; flex: 1; align-items: center; gap: 8px; ${row.box ?? ""}">Shipping${icon}</div>`;
  const panel = row.panel === true ? '<div id="panel" style="height: 16px"></div>' : "";
  return `<div id="root" style="width: 384px; font: 16px/24px monospace"><div style="display: flex">${trigger}</div>${panel}</div>`;
}

/** The fixture of a row, its `<svg>` carrying the facts the page measured on it. */
function fixtureOf(row: Row, measured: MeasuredFacts): FixtureElement {
  const svg: FixtureElement = {
    tag: "svg",
    classes: `absolute ${row.iconClasses ?? "right-0"} size-4 shrink-0`,
    written: row.written ?? [],
    measured,
  };
  const trigger: FixtureElement = {
    slot: "trigger",
    classes: `relative flex flex-1 items-center gap-2 ${row.boxClasses ?? ""}`,
    text: "Shipping",
    textIndex: 0,
    children: [svg],
  };
  return {
    slot: "chip",
    classes: "block w-[384px] font-sans text-[16px] leading-[24px] text-[#000000]",
    children: [
      { slot: "header", classes: "flex", children: [trigger] },
      ...(row.panel === true ? [{ slot: "panel", classes: "h-[16px]" }] : []),
    ],
  };
}

/** Measure a row's markup, then build its fixture, and read the caret's place and `position` row. */
async function placed(row: Row) {
  const markup = { head: row.head ?? "", body: markupOf(row), root: "#root", watched: "trigger" };
  const { facts, restored } = await measureMarkup(
    page,
    row.unmarked === true ? markup : { ...markup, still: true }
  );
  const measured = facts.get("0/0/0") ?? {};
  const manifest = chip({
    parts: [
      part({
        key: "header",
        slot: "header",
        parts: [part({ key: "trigger", slot: "trigger", label: LABEL, iconsFor: () => [CARET] })],
      }),
      ...(row.panel === true ? [part({ key: "panel", slot: "panel" })] : []),
    ],
  });
  const { variant, coverage } = await buildCaptured(manifest, rest(fixtureOf(row, measured)), {
    variables: makeVariableIndex([FONT_SANS]),
  });
  const [header] = variant?.root.children ?? [];
  const [trigger] = header?.kind === "frame" ? header.children : [];
  const caret =
    trigger?.kind === "frame" ? trigger.children.find((layer) => layer.key === "caret") : undefined;
  const position = coverage.find((each) => each.part === "caret" && each.property === "position");
  return {
    restored,
    placement: caret?.kind === "icon" ? caret.placement : "no caret",
    row: [position?.outcome, position?.detail],
  };
}

/**
 * Where Chromium puts the icon against its box in a mode, its `rotate` aside: the distance from the
 * box's right edge to the icon's, the offset of its centre below the box's, and its size.
 */
function layoutIn(mode: Readonly<Record<string, string>>) {
  return page.evaluate((stamps) => {
    for (const [name, value] of Object.entries(stamps)) {
      document.documentElement.setAttribute(name, value);
    }
    const box = document.getElementById("trigger")?.getBoundingClientRect();
    const icon = document.getElementById("icon")?.getBoundingClientRect();
    if (box === undefined || icon === undefined) {
      throw new Error("the markup lacks its box or its icon");
    }
    return {
      right: box.right - icon.right,
      down: icon.top + icon.height / 2 - (box.top + box.height / 2),
      size: [icon.width, icon.height],
      inside: icon.left >= box.left && icon.right <= box.right,
    };
  }, mode);
}

/** The `animation-name` Chromium computes on an element with the stopping rule lifted, in a mode. */
async function animationIn(
  id: string,
  mode: Readonly<Record<string, string>>,
  motion: "reduce" | "no-preference"
) {
  await page.emulateMedia({ reducedMotion: motion });
  const name = await page.evaluate(
    ({ element, stamps, selector }) => {
      for (const [attribute, value] of Object.entries(stamps)) {
        document.documentElement.setAttribute(attribute, value);
      }
      const sheet = document.querySelector(selector);
      if (!(sheet instanceof HTMLStyleElement)) {
        throw new Error("the page holds no stopping rule");
      }
      sheet.disabled = true;
      const target = document.getElementById(element);
      return target === null ? undefined : getComputedStyle(target).animationName;
    },
    { element: id, stamps: mode, selector: `style[${STILL_ATTRIBUTE}]` }
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return name;
}

const DENSE_LIGHT = { "data-theme": "light", "data-density": "dense" };
const PLACED = ["literal", "an absolute layer placed by its distances to its parent's edges"];
const UNPLACED =
  "the capture measured no one size for the absolute icon inside its box in every mode and as the box grows (`iconPlace`)";
const MOVING =
  "the capture did not read `animation-name: none` on every element of the captured root in every mode, without and with reduced motion (`still`), so a consumer's page can run an animation the capture's page stops";

describe("the caret's shape, measured in Chromium", () => {
  it("places the caret where Chromium lays it out, 0px inside its box's right edge and centred", async () => {
    const built = await placed({});
    expect([await layoutIn(DENSE_LIGHT), built]).toEqual([
      { right: 0, down: 0, size: [16, 16], inside: true },
      {
        restored: true,
        placement: {
          kind: "edges",
          within: "parent",
          horizontal: { kind: "end", end: 0 },
          vertical: { kind: "centre", offset: 0 },
        },
        row: PLACED,
      },
    ]);
  });
});

describe("an icon whose measured place the build cannot meet", () => {
  // `right: -80px` puts the icon past its box's right edge, where a later layer of a narrower row
  // can sit over it (outside-static, resize, holderresize, grow).
  it("refuses an icon that reaches outside its box", async () => {
    const row = { icon: "right: -80px", iconClasses: "right-[-80px]" };
    const built = await placed(row);
    expect([(await layoutIn(DENSE_LIGHT)).inside, built.row]).toEqual([false, ["unmapped", UNPLACED]]);
  });

  // A rule of one mode alone changes the icon's size or inset, which the default mode's declarations
  // do not show (mode-size, same-size-mode, mode-pos).
  it.each([
    [
      "a comfortable rule that halves its size",
      "html[data-density=comfortable] #icon { width: 8px !important; height: 8px !important }",
      { "data-theme": "light", "data-density": "comfortable" },
      { right: 0, down: 0, size: [8, 8], inside: true },
      UNPLACED,
    ],
    [
      "a dark rule that moves it 8px in",
      "html[data-theme=dark] #icon { right: 8px !important }",
      { "data-theme": "dark", "data-density": "dense" },
      { right: 8, down: 0, size: [16, 16], inside: true },
      "the build places the absolute icon's right edge 0px from its box's, where the capture measured no one length in every mode and as the box grows",
    ],
  ])("refuses an icon beside %s", async (_case, head, mode, layout, why) => {
    const built = await placed({ head });
    expect([await layoutIn(mode), built.row]).toEqual([layout, ["unmapped", why]]);
  });

  // A `border-style` with no width draws CSS's initial `medium`, 3px (CSS Backgrounds 3 §3.3), where
  // the build reads no width as none: Fuse's base `border-width: 0` is the reset the capture drops.
  it("refuses an icon in a box whose border style draws the initial width", async () => {
    const built = await placed({ box: "border-style: solid", boxClasses: "[border-style:solid]" });
    expect([await layoutIn(DENSE_LIGHT), built.row]).toEqual([
      { right: 3, down: 0, size: [16, 16], inside: true },
      [
        "unmapped",
        "the build places the absolute icon's right edge 0px from its box's, where the capture measured 3px",
      ],
    ]);
  });
});

describe("an icon beside an animation a consumer's page runs", () => {
  // Without the marked `<style>` the read has no stopping rule to lift, so it reads nothing.
  it("refuses an icon on a page whose stopping rule the read cannot find", async () => {
    const built = await placed({ unmarked: true });
    expect(built.row).toEqual(["unmapped", MOVING]);
  });

  const KEYFRAMES = "@keyframes pulse { from, to { opacity: 0.9 } }";
  const DARK = { "data-theme": "dark", "data-density": "dense" };
  // Each rule animates where the capture's default mode, light and dense with no reduced motion,
  // declares nothing, so the build sees only the read the page makes with the stopping rule lifted.
  it.each([
    [
      "a reduced-motion rule (reduce)",
      "@media (prefers-reduced-motion: reduce) { #icon { animation: pulse 1s infinite } }",
      "icon",
      DENSE_LIGHT,
      "reduce",
      {},
    ],
    [
      "a dark rule (mode-only)",
      "html[data-theme=dark] #icon { animation: pulse 1s infinite }",
      "icon",
      DARK,
      "no-preference",
      {},
    ],
    [
      "a dark rule in a media query (mode-shorthand)",
      "@media (min-width: 0) { html[data-theme=dark] #icon { animation: pulse 1s infinite } }",
      "icon",
      DARK,
      "no-preference",
      {},
    ],
    // A nested rule's `&` stands for its parent's selector (CSS Nesting 1 §3), here inside a quoted
    // attribute value too, which the selector matches literally.
    [
      "a nested dark rule (pseudo-selector, nested-selector-amp-attr)",
      '#root { html[data-theme=dark] & [data-test="&"] { animation: pulse 1s infinite } }',
      "icon",
      DARK,
      "no-preference",
      { iconAttributes: 'data-test="&"' },
    ],
    // `foo:before` is a class whose colon is escaped, not a pseudo-element (tailwind-selector).
    [
      "a dark rule nested in an escaped class (tailwind-selector)",
      ".foo\\:before { html[data-theme=dark] & { animation: pulse 1s infinite } }",
      "icon",
      DARK,
      "no-preference",
      { iconAttributes: 'class="foo:before"' },
    ],
    // The capture keeps no theme sheet's declaration, so the fixture holds none (theme, conditional-theme).
    [
      "a theme sheet's rule on its box (theme, conditional-theme)",
      "#trigger { animation: pulse 1s infinite }",
      "trigger",
      DENSE_LIGHT,
      "no-preference",
      {},
    ],
    // The open panel after the header, whose transform animation could move it over the caret.
    [
      "a dark rule on the panel after its header",
      "html[data-theme=dark] #panel { animation: pulse 1s infinite }",
      "panel",
      DARK,
      "no-preference",
      { panel: true },
    ],
  ] as const)("refuses an icon beside %s", async (_case, rule, animated, mode, motion, extra) => {
    const built = await placed({ head: `${KEYFRAMES} ${rule}`, ...extra });
    expect([await animationIn(animated, mode, motion), built.row]).toEqual(["pulse", ["unmapped", MOVING]]);
  });
});
