/**
 * Unit under test: the stylesheet order of `previewDocument`, and the host classes
 * `compileHostUtilities` compiles onto it. Oracle: the CSS cascade. Two rules of one layer with
 * equal specificity resolve by order of appearance, and layers rank in the order their first
 * declaration names them. Fuse's base rule, which gives every border the `border` role, must come
 * after preflight's `border: 0 solid` in the `base` layer, as in a Tailwind-source host, or the
 * outline Badge draws its border in the text color. The page must name the layers first, in the
 * order the built `styles.css` declares them, so loading preflight first does not reorder the
 * layers. A standalone-CSS host compiles its own classes in its own build, into the `utilities`
 * layer after Fuse's stylesheets. `data-horizontal:` is `fuse.css`'s
 * `:where([data-orientation="horizontal"])`, and `w-64` is 64 steps of the `--spacing: 0.25rem`
 * that `fuse.css` declares in its `@theme inline` block, which Tailwind writes out in place.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ElementSelector } from "../components/component-spec";
import { compileHostUtilities } from "../components/utility-css";
import {
  ASSET_PATHS,
  cellSelector,
  CLIENT_HIDDEN,
  fontSweepSelector,
  forcedSelector,
  measuredSelector,
  measuredSelectors,
  PAGE_LAYOUT,
  previewDocument,
} from "./preview-page";
import type { PageCell } from "./preview-page";

/** The layers the built `styles.css` names, in the order its `@layer` statements first name them. */
function declaredLayers(): readonly string[] {
  const css = readFileSync(new URL("../../../fuse/dist/styles.css", import.meta.url), "utf8");
  const statements = [...css.matchAll(/@layer ([\w-]+(?:\s*,\s*[\w-]+)*)\s*;/g)];
  return [...new Set(statements.flatMap(([, names = ""]) => names.split(",").map((name) => name.trim())))];
}

const STAMPS = {
  root: { "data-theme": "light", "data-density": "dense" },
  body: { "data-theme-variant": "internal", "data-theme-brand": "fkas", "data-theme-segment": "private" },
};

/** The `<style>` block's lines, trimmed and without blanks. */
function styleLines(hostCss = "", cells: readonly PageCell[] = []): readonly string[] {
  const html = previewDocument(STAMPS, cells, PAGE_LAYOUT, hostCss);
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  return style
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

describe("the preview page's stylesheets", () => {
  it("names the layers in the order styles.css declares them, before any import", () => {
    const layers = declaredLayers();
    expect(layers).toContain("base");
    expect(styleLines()[0]).toBe(`@layer ${layers.join(", ")};`);
  });

  it("loads preflight into the base layer before Fuse's styles.css, so Fuse's base rule wins", () => {
    const lines = styleLines();
    const preflight = lines.indexOf(`@import url("${ASSET_PATHS.preflight}") layer(base);`);
    const styles = lines.indexOf(`@import url("${ASSET_PATHS.styles}");`);
    expect(preflight).toBeGreaterThan(-1);
    expect(styles).toBeGreaterThan(preflight);
  });

  it("puts the host's own classes in the utilities layer after Fuse's styles.css and themes.css", async () => {
    const lines = styleLines(await compileHostUtilities(["data-horizontal:w-64"]));
    const themes = lines.indexOf(`@import url("${ASSET_PATHS.themes}");`);
    const host = lines.indexOf("@layer utilities {");
    expect(themes).toBeGreaterThan(lines.indexOf(`@import url("${ASSET_PATHS.styles}");`));
    expect(host).toBeGreaterThan(themes);
    expect(lines.slice(host, host + 3)).toEqual([
      "@layer utilities {",
      String.raw`.data-horizontal\:w-64:where([data-orientation="horizontal"]){width:calc(0.25rem * 64);}`,
      "}",
    ]);
  });
});

// Unit under test: `measuredSelector`, the element the page measures, forces and crops in a cell's
// slot. Oracle: CSS attribute selectors (Selectors Level 4 §6), where `[name]` matches the attribute
// with any value, `[name="value"]` that exact value and `[name^="value"]` a value that starts with
// it, and CSSOM's "serialize a string" (§2.1),
// which escapes `"` and `\` with a backslash and a control character as its code point in hex and a
// space, since a raw newline ends a CSS string (CSS Syntax Level 3 §4.3.5).
describe("the element a cell measures", () => {
  it("is the one whose data-slot is the definition's slot", () => {
    expect(measuredSelector({ slot: "button" })).toBe('[data-slot="button"]');
  });

  it("is the one a root without a data-slot names by its tag and attributes", () => {
    const element: ElementSelector = {
      tag: "a",
      attributes: { "data-rac": true, "aria-label": String.raw`Say "hi" \ bye` },
    };
    expect(measuredSelector({ slot: "link", element })).toBe(
      String.raw`a[data-rac][aria-label="Say \"hi\" \\ bye"]`
    );
  });

  it("matches an attribute by the prefix of its value, as React Aria labels a day selected", () => {
    const element: ElementSelector = {
      tag: "div",
      attributes: { "data-rac": true },
      prefixes: { "aria-label": 'Tuesday, "July" 14' },
    };
    expect(measuredSelector({ slot: "calendar-cell", element })).toBe(
      String.raw`div[data-rac][aria-label^="Tuesday, \"July\" 14"]`
    );
  });

  it("matches an attribute by the suffix of its value, as two menu families name their group labels", () => {
    const element: ElementSelector = { tag: "div", attributes: {}, suffixes: { "data-slot": "-label" } };
    expect(measuredSelector({ slot: "menu-group-label", element })).toBe('div[data-slot$="-label"]');
  });

  it("escapes a newline, a tab and DEL in an attribute value as code points", () => {
    const element: ElementSelector = {
      tag: "div",
      attributes: { "aria-label": "Thursday,\nOctober\t15\u007F" },
    };
    expect(measuredSelector({ slot: "calendar-cell", element })).toBe(
      String.raw`div[aria-label="Thursday,\a October\9 15\7f "]`
    );
  });
});

// Unit under test: `forcedSelector`, the element the page forces hover and focus on in a cell's slot.
// Oracle: the rule on `ComponentDefinition.statePart`, that a part which takes the set's states takes
// the forced pseudo classes, and CSS's descendant combinator, which matches that part at any depth
// inside the measured element. A root that takes its states takes them itself.
describe("the element a cell forces its state on", () => {
  it("is the measured element of a root that takes its states", () => {
    expect(forcedSelector({ slot: "button" })).toBe('[data-slot="button"]');
  });

  it("is the part the definition's statePart names inside the measured element", () => {
    expect(forcedSelector({ slot: "accordion-item", statePart: "accordion-trigger" })).toBe(
      '[data-slot="accordion-item"] [data-slot="accordion-trigger"]'
    );
  });

  // Selectors 4 §4.5 and §16.4: `:has(~ x)` matches an element that some later sibling `x` follows,
  // which is the peer a `peer-*` variant of `x` reads.
  it("is the sibling before the measured element that the definition's statePeer names", () => {
    expect(forcedSelector({ slot: "sidebar-menu-badge", statePeer: "sidebar-menu-button" })).toBe(
      '[data-slot="sidebar-menu-button"]:has(~ [data-slot="sidebar-menu-badge"])'
    );
  });
});

// Selectors 4 §16.1: `a b` matches a `b` at any depth below an `a`, so the list reaches each cell's
// measured element, the box the page crops, and every element in it, and no element of the cell
// around it, such as the month heading of the Calendar a day cell sits in, which takes the theme's
// heading font.
describe("the elements the font check reads", () => {
  it("are each cell's measured element and everything in it", () => {
    expect(
      fontSweepSelector([
        { id: "day", measured: ["div[data-rac]"] },
        { id: "button", measured: ['[data-slot="button"]'] },
      ])
    ).toBe(
      '[data-compare-cell="day"] div[data-rac], [data-compare-cell="day"] div[data-rac] *, [data-compare-cell="button"] [data-slot="button"], [data-compare-cell="button"] [data-slot="button"] *'
    );
  });

  it("are both elements of a cell that measures a trigger and its popup", () => {
    expect(fontSweepSelector([{ id: "open", measured: ['[data-slot="t"]', '[data-slot="p"]'] }])).toBe(
      '[data-compare-cell="open"] [data-slot="t"], [data-compare-cell="open"] [data-slot="t"] *, [data-compare-cell="open"] [data-slot="p"], [data-compare-cell="open"] [data-slot="p"] *'
    );
  });

  it("are none for no cells", () => {
    expect(fontSweepSelector([])).toBe("");
  });
});

// Unit under test: `measuredSelectors`, the elements a cell's box spans. Oracle: the rule that a
// popup part measures its popup, its root as any other part, and an open composite measures the
// union of the trigger and the popup its renderer names by `data-slot`.
describe("the elements a cell's box spans", () => {
  it("are the root alone for a renderer that names no union", () => {
    expect(measuredSelectors({ slot: "popover-content" }, undefined)).toEqual([
      '[data-slot="popover-content"]',
    ]);
  });

  it("are the trigger and the popup an open composite's renderer names", () => {
    expect(measuredSelectors({ slot: "popover-open" }, ["popover-trigger", "popover-content"])).toEqual([
      '[data-slot="popover-trigger"]',
      '[data-slot="popover-content"]',
    ]);
  });
});

// Unit under test: the slot `previewDocument` writes for a client cell, which the page's bundle
// mounts. Oracle: the HTML attribute grammar, where `&quot;` in a double-quoted value is `"`, and
// the CSS cascade, where `visibility: visible` on a descendant overrides an inherited `hidden`.
describe("a client cell's slot", () => {
  const client: PageCell = {
    id: "c4",
    content: { _tag: "Client", set: "fixture-popover", cell: { content: "header", note: 'a "b" & c' } },
    measured: ['[data-slot="popover-content"]'],
  };
  const slotOf = (html: string) => /<div data-compare-cell="c4"[^>]*>(.*?)<\/div>/.exec(html);

  it("names the set and the cell for the bundle, and holds no markup of its own", () => {
    const html = previewDocument(STAMPS, [client], PAGE_LAYOUT, "");
    const slot = slotOf(html);
    expect(slot?.[1]).toBe("");
    expect(slot?.[0]).toContain(' data-compare-client="fixture-popover"');
    const props = /data-compare-props="([^"]*)"/.exec(slot?.[0] ?? "")?.[1] ?? "";
    expect(JSON.parse(props.replaceAll("&quot;", '"').replaceAll("&amp;", "&"))).toEqual({
      content: "header",
      note: 'a "b" & c',
    });
  });

  it("loads the client bundle after the slots, and a page of static cells loads none", () => {
    const html = previewDocument(STAMPS, [client], PAGE_LAYOUT, "");
    const script = `<script type="module" src="${ASSET_PATHS.client}"></script>`;
    expect(html.indexOf(script)).toBeGreaterThan(html.indexOf('data-compare-cell="c4"'));
    const staticCell: PageCell = { id: "c0", content: { _tag: "Static", html: "<b></b>" }, measured: ["b"] };
    expect(previewDocument(STAMPS, [staticCell], PAGE_LAYOUT, "")).not.toContain("<script");
  });

  // Oracle: CSS 2.1 §10.3.7, under which an absolute box with no width shrinks to fit the width of its
  // containing block, the slot that holds its portal: a slot as narrow as its trigger would hold a
  // Dropdown menu popup to its `min-w-32` where a page gives it room for its widest row.
  it("gives a client slot the slot's whole width, as the containing block its popup shrinks to fit", () => {
    expect(styleLines("", [client])).toContain(
      `${CLIENT_HIDDEN}{width:${String(PAGE_LAYOUT.slotWidth)}px;box-sizing:border-box}`
    );
  });

  // Oracle: CSS 2.1 §6.4.3, under which a `style` attribute beats the page's stylesheet, and the
  // two slots a 576px list spans, 1056px, where one slot's 528px would shrink it to 512px.
  it("gives a client slot that spans two slots their width, below the grid", () => {
    const html = previewDocument(STAMPS, [{ ...client, span: 2 }], PAGE_LAYOUT, "");
    expect(slotOf(html)?.[0]).toContain('style="left:0px;top:480px;width:1056px;box-sizing:border-box"');
  });

  it("hides everything in the slot but the measured elements, as the trigger a popup part anchors to", () => {
    const lines = styleLines("", [client]);
    expect(lines).toContain(`${CLIENT_HIDDEN}{visibility:hidden}`);
    expect(lines).toContain(`${cellSelector("c4", '[data-slot="popover-content"]')}{visibility:visible}`);
  });
});
