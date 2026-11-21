/**
 * How the build maps a label whose text sits in spans that color it, as Code's highlighter wraps
 * each token in a span with an inline `color`. The unit under test is `buildSetsInOrder` on a
 * hand-built capture of a one-cell `chip` set (`test/capture-fixtures.ts`). Oracles:
 *
 * - A Figma text holds a fill per character (`setRangeFills` in the typings), so each run of
 *   characters a span colors becomes a range, counted in characters from the text's start, and
 *   characters in the label's own color take no range.
 * - `color` inherits (CSS Color 4 §3.1), and a `var()` of a custom property set nowhere, with no
 *   fallback, makes its declaration compute as `unset` (CSS Variables 1 §3.1), so such a span takes
 *   its parent's color.
 * - `font-size: 1em` is the parent's font size (CSS Fonts 4 §2.5), so it draws nothing of its own.
 * - Tailwind compiles preflight's `--theme(--name, fallback)` to `var(--name, fallback)`, which the
 *   capture page loads, and Fuse's theme sets `--default-mono-font-family` to `var(--font-mono)`.
 * - A TEXT write on an instance writes its characters, which on 2026-11-19 gave every character the
 *   first character's fill in a real file, so a label that links a TEXT property and colors runs
 *   stops the build.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, rest, textOf } from "../../test/capture-fixtures";
import type { FixtureElement, Written } from "../../test/capture-fixtures";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

/** The synced variables a case binds. */
const VARIABLES = makeVariableIndex(
  ["font-sans", "font-mono", "sh-keyword", "sh-identifier", "sh-string"].map((name) => ({
    ref: { collection: "Fuse tokens", name },
    webSyntax: `var(--${name})`,
  }))
);

/** A synced variable as a color field binds it. */
const bound = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;

/** A `style` attribute's `color`, as sugar-high writes it on a token. */
function inline(value: string): Written {
  return { className: "inline style", property: "color", value, source: "inline" };
}

/** A span holding text, which wins the given declarations. */
function span(text: string, ...written: readonly Written[]): FixtureElement {
  return { tag: "span", text, written };
}

/** A label that shows the given characters. */
function label(characters: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty: undefined, shownIn: () => true };
}

/** The classes of a root that keeps its white space and sets its type, as Code's `<pre>` does. */
const PRE = "whitespace-pre font-mono text-[12px] leading-[20px] text-[#000000]";

/** Build a chip whose root holds the given elements and node order, and shows `characters`. */
function build(characters: string, root: FixtureElement) {
  return buildCaptured(chip({ label: label(characters) }), rest({ slot: "chip", ...root }), {
    variables: VARIABLES,
  });
}

describe("a label whose text sits in spans that color it", () => {
  it("draws each run of a span's color as a range, joins runs of one color, and leaves its own color unranged", async () => {
    const lines = [
      {
        tag: "span",
        children: [
          span("let", inline("var(--sh-keyword)")),
          span(" "),
          span("a", inline("var(--sh-identifier)")),
        ],
      },
      {
        tag: "span",
        children: [
          span("b", inline("var(--sh-identifier)")),
          span("c", inline("var(--sh-identifier)")),
          span(";"),
        ],
      },
    ];
    const { variant } = await build("let a\nbc;", { classes: PRE, texts: ["", "\n", ""], children: lines });
    // The break after `a` takes `a`'s color, so it joins `a` and `bc` into one range.
    expect(textOf(variant?.root)?.ranges).toEqual([
      { start: 0, end: 3, color: bound("sh-keyword") },
      { start: 4, end: 8, color: bound("sh-identifier") },
    ]);
  });

  // Oracle: the live probe of 2026-11-20 (NL1–NL4), where Figma painted a line break in the fill of
  // the character before it and dropped a fill written on the break alone.
  it("gives a line break the color of the character before it, and one that starts the text the label's", async () => {
    const { variant } = await build("\na\nb\n", {
      classes: PRE,
      children: [
        span("\na", inline("var(--sh-keyword)")),
        span("\n"),
        span("b"),
        span("\n", inline("var(--sh-string)")),
      ],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([{ start: 1, end: 3, color: bound("sh-keyword") }]);
  });

  it("gives a span whose color reads a property set nowhere its parent's color", async () => {
    const outer: FixtureElement = {
      tag: "span",
      written: [inline("var(--sh-string)")],
      children: [span(" ", inline("var(--sh-space)"))],
    };
    const { variant, coverage } = await build(" ", { classes: PRE, children: [outer] });
    expect([
      textOf(variant?.root)?.ranges,
      coverage.find((row) => row.value === "var(--sh-space)")?.outcome,
    ]).toEqual([[{ start: 0, end: 1, color: bound("sh-string") }], "dropped"]);
  });

  // Oracle: CSS 2.1 §11.2. A `visibility: hidden` box paints nothing, so its text is in neither the
  // label's characters nor its runs.
  it("leaves a hidden span's text out of the runs, as out of the label's characters", async () => {
    const hidden: FixtureElement = { ...span("b", inline("var(--sh-string)")), classes: "invisible" };
    const { variant } = await build("a", {
      classes: PRE,
      children: [span("a", inline("var(--sh-keyword)")), hidden],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([{ start: 0, end: 1, color: bound("sh-keyword") }]);
  });

  // The label's own element, the span a class above styles as a Sidebar row's label, sets the
  // label's style, so only the span inside it colors a run.
  it("colors the runs of a span inside the element the box holds its label in", async () => {
    const truncate = "[&>span:last-child]:truncate";
    const { variant } = await build("ab", {
      classes: `flex w-[100px] ${PRE}`,
      carried: truncate,
      children: [
        {
          tag: "span",
          text: "a",
          textIndex: 0,
          fromParent: truncate,
          children: [span("b", inline("var(--sh-keyword)"))],
        },
      ],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([{ start: 1, end: 2, color: bound("sh-keyword") }]);
  });

  it("drops a span's font size of 1em, and leaves one of 2em or a weight of its own unmapped", async () => {
    const own = (property: string, value: string): Written => ({
      className: "preflight",
      property,
      value,
      source: "preflight",
    });
    const { coverage } = await build("abc", {
      classes: PRE,
      children: [
        span("a", inline("var(--sh-keyword)"), own("font-size", "1em")),
        span("b", inline("var(--sh-keyword)"), own("font-size", "2em")),
        span("c", inline("var(--sh-keyword)"), {
          className: "font-bold",
          property: "font-weight",
          value: "700",
        }),
      ],
    });
    const outcome = (property: string, value: string) =>
      coverage.find((row) => row.property === property && row.value === value)?.outcome;
    expect([outcome("font-size", "1em"), outcome("font-size", "2em"), outcome("font-weight", "700")]).toEqual(
      ["dropped", "unmapped", "unmapped"]
    );
  });

  it("stops where the label links a TEXT property, whose writes collapse the ranges", async () => {
    const linked: LabelManifest = { ...label("ab"), textProperty: "Code" };
    await expect(
      buildCaptured(
        chip({ label: linked }),
        rest({ slot: "chip", classes: PRE, children: [span("a", inline("var(--sh-keyword)")), span("b")] }),
        { variables: VARIABLES }
      )
    ).rejects.toThrow("links the Code property");
  });

  it("stops where the label's white space collapses the spans' text, which leaves no index for a range", async () => {
    await expect(
      build("a b", {
        classes: "font-mono text-[12px] leading-[20px] text-[#000000]",
        children: [span("a  ", inline("var(--sh-keyword)")), span("b")],
      })
    ).rejects.toThrow("so no index places their colors");
  });
});

// Oracles: an `<a>` with `text-decoration-line: underline` decorates its text (CSS Text Decoration 3
// §2.1), in its own `currentColor` across every descendant, whatever color a span inside it sets
// (§2.3, the decorating box's color). Figma links a range only to an absolute `http` or `https` URL:
// on 2026-11-21 `setRangeHyperlink` stored `https://example.com/pay?id=4821` and refused
// `#invoice-4821` and `/invoices/1042` (live probe RH1, RH2).
describe("a label whose text holds a link", () => {
  /** The classes of a root that sets its type and color, as a Timeline list description does. */
  const BODY = "font-sans text-[14px] leading-[20px] text-[#000000]";
  const black = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  const blue = { kind: "literal", color: { r: 0, g: 0, b: 1, a: 1 } } as const;
  const auto = { offset: undefined, thickness: undefined, color: undefined };

  it("links the range of an anchor to its absolute URL", async () => {
    const { variant } = await build("Open. Pay", {
      classes: BODY,
      texts: ["Open. ", ""],
      children: [{ tag: "a", href: "https://example.com/pay?id=4821", classes: "underline", text: "Pay" }],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([
      { start: 6, end: 9, color: black, underline: auto, hyperlink: "https://example.com/pay?id=4821" },
    ]);
  });

  it("links an anchor that styles nothing beyond the base layers", async () => {
    const { variant } = await build("Open. Pay", {
      classes: BODY,
      texts: ["Open. ", ""],
      children: [{ tag: "a", href: "https://example.com/pay", text: "Pay" }],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([
      { start: 6, end: 9, color: black, hyperlink: "https://example.com/pay" },
    ]);
  });

  it("leaves the range of an anchor whose href names a fragment or a path unlinked", async () => {
    const { variant } = await build("ab", {
      classes: BODY,
      children: [
        { tag: "a", href: "#invoice-4821", classes: "underline", text: "a" },
        { tag: "a", href: "/invoices/1042", classes: "underline", text: "b" },
      ],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([{ start: 0, end: 2, color: black, underline: auto }]);
  });

  // An ancestor's rule underlines the anchor, so the anchor's text alone draws the line.
  it("links and underlines an anchor its parent underlines, beside the parent's own text", async () => {
    const underline = "[&>a]:underline";
    const { variant } = await build("Open. Pay", {
      classes: BODY,
      carried: underline,
      texts: ["Open. ", ""],
      children: [
        { tag: "a", href: "https://example.com/pay", fromParent: underline, textIndex: 0, text: "Pay" },
      ],
    });
    const text = textOf(variant?.root);
    expect([text?.underline, text?.ranges]).toEqual([
      undefined,
      [{ start: 6, end: 9, color: black, underline: auto, hyperlink: "https://example.com/pay" }],
    ]);
  });

  // The anchor holds the whole label, so it is the label's own element and links every character.
  // The kit draws no underline of a label's own element yet, so that row stays unmapped.
  it("links every character of a label its parent underlines through the anchor that holds it", async () => {
    const underline = "[&>a]:underline";
    const { variant, coverage } = await build("Pay", {
      classes: BODY,
      carried: underline,
      children: [
        { tag: "a", href: "https://example.com/pay", fromParent: underline, textIndex: 0, text: "Pay" },
      ],
    });
    expect([
      textOf(variant?.root)?.ranges,
      coverage.find((row) => row.property === "text-decoration-line")?.outcome,
    ]).toEqual([[{ start: 0, end: 3, color: black, hyperlink: "https://example.com/pay" }], "unmapped"]);
  });

  // CSS draws both lines (CSS Text Decoration 3 §2.1), and a Figma character holds one, so the
  // span's own line maps to nothing.
  it("leaves the underline of a span inside an underlined anchor unmapped", async () => {
    const { coverage } = await build("Pay now", {
      classes: BODY,
      children: [
        {
          tag: "a",
          classes: "underline decoration-[#0000ff] underline-offset-[2px]",
          texts: ["Pay ", ""],
          children: [
            { tag: "span", classes: "underline decoration-[#ff0000] underline-offset-[5px]", text: "now" },
          ],
        },
      ],
    });
    const outcomes = (property: string) =>
      coverage.filter((row) => row.property === property).map((row) => `${row.value}|${row.outcome}`);
    expect([
      outcomes("text-decoration-line"),
      outcomes("text-decoration-color"),
      outcomes("text-underline-offset"),
    ]).toEqual([
      ["underline|literal", "underline|unmapped"],
      ["#0000ff|literal", "#ff0000|unmapped"],
      ["2px|literal", "5px|unmapped"],
    ]);
  });

  it("draws a blue anchor's underline blue under a red span inside it", async () => {
    const { variant } = await build("Pay now", {
      classes: BODY,
      children: [
        {
          tag: "a",
          classes: "underline text-[#0000ff]",
          texts: ["Pay ", ""],
          children: [{ tag: "span", classes: "text-[#ff0000]", text: "now" }],
        },
      ],
    });
    expect(textOf(variant?.root)?.ranges).toEqual([
      { start: 0, end: 4, color: blue, underline: auto },
      {
        start: 4,
        end: 7,
        color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
        underline: { ...auto, color: blue },
      },
    ]);
  });
  // The label draws the underline, so it keeps the label's color under the anchor's red text (CSS
  // Text Decoration 3 §2.3), where Figma's AUTO would draw it red.
  it("draws an underlined label's black underline under a red anchor inside it", async () => {
    const { variant } = await build("Open. Pay", {
      classes: `${BODY} underline`,
      texts: ["Open. ", ""],
      children: [{ tag: "a", href: "https://example.com/pay", classes: "text-[#ff0000]", text: "Pay" }],
    });
    const text = textOf(variant?.root);
    expect([text?.underline, text?.ranges]).toEqual([
      auto,
      [
        {
          start: 6,
          end: 9,
          color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
          underline: { ...auto, color: black },
          hyperlink: "https://example.com/pay",
        },
      ],
    ]);
  });
});

describe("a label whose family is preflight's mono stack", () => {
  it("binds font-mono through the theme's --default-mono-font-family", async () => {
    const family: Written = {
      className: "tailwind preflight",
      property: "font-family",
      value: "var(--default-mono-font-family, ui-monospace, monospace)",
      source: "preflight",
    };
    const { variant } = await build("a", {
      classes: "text-[12px] leading-[20px] text-[#000000]",
      written: [family],
      text: "a",
    });
    expect(textOf(variant?.root)?.fontFamily).toEqual(bound("font-mono"));
  });
});
