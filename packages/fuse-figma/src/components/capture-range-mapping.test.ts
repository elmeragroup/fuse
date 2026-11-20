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
