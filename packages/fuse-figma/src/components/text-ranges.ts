/**
 * The runs of a label's characters that take a color, an underline or a link of their own, as Code's
 * highlighter colors each token through the inline `color` of a span, and the links demo of Timeline
 * list underlines an `<a>` inside a description. A Figma text holds a fill, a decoration and a link
 * per character (`setRangeFills`, `setRangeTextDecoration`, `setRangeHyperlink`), so each run of
 * characters that look alike becomes a range.
 *
 * A span styles its characters by its `color` and by a `text-decoration-line: underline`, whose
 * offset, thickness and color read as a label's own underline reads them. An underline in
 * `currentColor` keeps the color of the element that draws it under a span inside it that sets
 * another (CSS Text Decoration 3 §2.3). The characters inside an `<a>` link to its `href` where
 * `linkTarget` reads it as an absolute URL (`link-target.ts`), which the capture reads into the
 * run. A label that draws an underline or a strike of its own leaves a span's line unmapped, since
 * CSS then draws both lines and a Figma character holds one, and so does an underlined element
 * around the span. A label's own underline keeps the label's color under a span that sets another,
 * so such a span's characters take that color explicitly, as under an underlined element inside the
 * label. A text property a span sets that computes to what its parent
 * passes down, as preflight's `font-size: 1em` and mono `font-family` on Code's `<code>`, draws
 * nothing of its own, and so does one with no Figma form, as the user agent's `cursor: pointer` on
 * an `<a>`. One that computes otherwise, as a bolder link's `font-weight`, and any other declaration
 * it sets beyond the base layers', stays unmapped, so the set does not count as drawn. A span's `color` that reads
 * a custom property set nowhere, as sugar-high's `var(--sh-space)` on a space, is invalid at
 * computed-value time and computes as `unset` (CSS Variables 1 §3.1), which on the inherited `color`
 * takes the parent's.
 *
 * Figma paints a line break in the fill of the character before it. In a live probe on 2026-11-20
 * (NL1–NL4), coloring `;` in `ab;\ncd` red colored the break too, a fill written on the break alone
 * was dropped, and the character after the break kept its own. So the ranges give each break the
 * color of the character before it, which is what a Figma text holds and Plan reads back. No probe
 * wrote a fill on a break that starts the text, so such a break takes the label's color, a cautious
 * choice rather than a measured one.
 */
import type { TextRun } from "./box-cascade";
import { describeColor } from "./box-paint";
import { KitUnmappable } from "./build-errors";
import type { BuildContext } from "./component-spec";
import { normalizeCss, readColor } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { ColorSpec, TextRangeSpec, UnderlineSpec } from "./kit-spec";
import { inheritsProperty, noFigmaForm } from "./layer-style";
import type { LayerStyle } from "./layer-style";

/**
 * A span's color: a color it sets, its parent's where its `color` computes as `unset`, or one that
 * maps to no color, whose row the read leaves unmapped.
 */
type RunColor =
  | { readonly kind: "set"; readonly color: ColorSpec }
  | { readonly kind: "parent" }
  | { readonly kind: "unmapped" };

/** What a span gives its characters: its color, if it sets one, and its underline, if it draws one. */
type SpanLook = { readonly color: RunColor | undefined; readonly underline: UnderlineSpec | undefined };

/** A character's look, as a range holds it. */
type CharacterLook = {
  readonly color: ColorSpec;
  readonly underline: UnderlineSpec | undefined;
  readonly hyperlink: string | undefined;
};

/**
 * The underline over a run and the color of the element that draws it. CSS draws a decoration in
 * its decorating box's color across every descendant (CSS Text Decoration 3 §2.3), so a span inside
 * the link that sets another color keeps the link's underline color.
 */
type Decorating = {
  readonly underline: UnderlineSpec;
  /** The decorating element's color, or undefined where its own `color` maps to no color. */
  readonly color: ColorSpec | undefined;
};

/** A `var()` of one custom property with no fallback. */
const LONE_VAR = /^var\(--[\w-]+\)$/u;

/** Why a span's `color` that reads a custom property set nowhere draws its parent's. */
const UNSET_COLOR =
  "it reads a custom property set nowhere, so the declaration computes as unset and the characters take their parent's color (CSS Variables 1 §3.1)";

/** Why a span's text property that computes to its parent's draws nothing of its own. */
const AS_PARENT =
  "it computes to the value the span's parent passes down, so the span's characters draw as the label's";

/**
 * Read a span once, however many runs it holds: its own `color` and underline, and each other
 * inherited property it sets, which must compute to its parent's.
 *
 * @param parent - The style of the element around the span: the box, or the span outside it.
 * @param decorating - The underline an element outside the span draws, or undefined for none. CSS
 *   then draws the span's own underline as well (CSS Text Decoration 3 §2.1), and a Figma character
 *   holds one, so the span's line stays unmapped, as a label's own line leaves it. A span's
 *   ancestors are the same in every run it holds, so its look reads once.
 * @returns The span's look. Its color is undefined where it sets none.
 */
function readSpan(
  style: LayerStyle,
  parent: LayerStyle,
  decorating: Decorating | undefined,
  scope: SpanScope,
  read: Map<LayerStyle, SpanLook>
): SpanLook {
  const known = read.get(style);
  if (known !== undefined) {
    return known;
  }
  const feed = style.feed("ranges");
  const underlines =
    scope.underline !== undefined &&
    decorating === undefined &&
    style.ownProperties().includes("text-decoration-line") &&
    normalizeCss(style.resolved("text-decoration-line") ?? "") === "underline";
  for (const property of style.ownProperties()) {
    const none = noFigmaForm(property);
    if (none !== undefined) {
      style.mark(property, "dropped", none, feed);
      continue;
    }
    // The underline's read below notes the offset it draws.
    const drawn = property === "color" || (underlines && property === "text-underline-offset");
    if (drawn || !inheritsProperty(property, scope.context)) {
      continue;
    }
    const same =
      normalizeCss(style.resolved(property) ?? "") === normalizeCss(parent.resolved(property) ?? "");
    style.mark(
      property,
      same ? "dropped" : "unmapped",
      same ? AS_PARENT : "the span sets its own, which a range of the label's text does not draw",
      feed
    );
  }
  const own = style.ownProperties().includes("color");
  const raw = normalizeCss(style.raw("color") ?? "");
  let color: RunColor | undefined;
  if (own && style.resolved("color") === undefined && LONE_VAR.test(raw)) {
    style.mark("color", "dropped", UNSET_COLOR, feed);
    color = { kind: "parent" };
  } else if (own) {
    const spec = style.read("color", (value) => readColor(value, scope.variables), describeColor, feed);
    color = spec === undefined ? { kind: "unmapped" } : { kind: "set", color: spec };
  }
  const look = { color, underline: underlines ? scope.underline(style) : undefined };
  read.set(style, look);
  return look;
}

/**
 * What a span's reads take: the synced variables, the build's context, and the reader of a span's
 * underline, which reads it as the label's own underline reads, or undefined for a label that draws
 * a line of its own.
 */
type SpanScope = {
  readonly variables: VariableIndex;
  readonly context: BuildContext;
  readonly underline: ((span: LayerStyle) => UnderlineSpec | undefined) | undefined;
};

/**
 * The underline a character shows under its decorating element. An underline in `currentColor`
 * takes the decorating element's color, which Figma's `AUTO` gives only to a character in that fill,
 * so a character in another fill takes the color explicitly. Where the decorating element's color
 * maps to no color, its `color` row is unmapped and the set does not count as drawn, so the
 * underline keeps `AUTO`.
 */
function decorationOver(decorating: Decorating | undefined, fill: ColorSpec): UnderlineSpec | undefined {
  if (decorating === undefined) {
    return undefined;
  }
  const { underline, color } = decorating;
  return underline.color !== undefined ||
    color === undefined ||
    JSON.stringify(color) === JSON.stringify(fill)
    ? underline
    : { ...underline, color };
}

/**
 * Read the ranges of a label's characters that take a color other than the label's, an underline or
 * a link.
 *
 * @param runs - The label's text, run by run, with the styles of the spans each sits in.
 * @param box - The style of the box the label sits in.
 * @param color - The label's own color.
 * @param own - The label's own underline, or undefined where it draws none.
 * @param characters - The characters the label shows.
 * @param scope - The synced variables, the build's context and the reader of a span's underline.
 * @param where - The variant's key and the keys of the layers down to the label, for the error.
 * @returns The ranges, in order and apart, each run of one look joined, or none where every
 *   character takes the label's color, no underline and no link. A line break takes the color of the
 *   character before it.
 * @throws `KitUnmappable` where the runs' characters are not the label's as written, since a white
 *   space rule that collapses them leaves no index to place a range at.
 */
export function readRanges(
  runs: readonly TextRun[],
  box: LayerStyle,
  color: ColorSpec,
  own: UnderlineSpec | undefined,
  characters: string,
  scope: SpanScope,
  where: { readonly variant: string; readonly path: readonly string[] }
): readonly TextRangeSpec[] {
  const joined = runs.map((run) => run.text).join("");
  if (joined !== characters) {
    throw new KitUnmappable({
      message: `${where.variant}: the label ${where.path.join("/")} colors its text through elements below its box, whose text ${JSON.stringify(joined)} renders as ${JSON.stringify(characters)}, so no index places their colors`,
    });
  }
  const read = new Map<LayerStyle, SpanLook>();
  const shown: CharacterLook[] = [];
  const label: Decorating | undefined = own === undefined ? undefined : { underline: own, color };
  for (const run of runs) {
    let fillOfRun = color;
    let decorating = label;
    run.elements.forEach((style, index) => {
      const span = readSpan(style, run.elements[index - 1] ?? box, decorating, scope, read);
      fillOfRun = span.color?.kind === "set" ? span.color.color : fillOfRun;
      // A span whose color maps to no color left its row unmapped and draws in its parent's.
      const mapped = span.color?.kind !== "unmapped";
      decorating =
        span.underline === undefined
          ? decorating
          : { underline: span.underline, color: mapped ? fillOfRun : undefined };
    });
    const { hyperlink } = run;
    // Indices count UTF-16 code units, as the label's `characters` and Figma's ranges do.
    for (let index = 0; index < run.text.length; index += 1) {
      const fill = run.text[index] === "\n" ? (shown.at(-1)?.color ?? color) : fillOfRun;
      const underline = decorationOver(decorating, fill);
      // The label's whole underline draws a character in its own color, so it takes no range.
      shown.push({ color: fill, underline: underline === own ? undefined : underline, hyperlink });
    }
  }
  const sameColor = (left: ColorSpec, right: ColorSpec): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  const ranges: TextRangeSpec[] = [];
  shown.forEach((each, start) => {
    const last = ranges.at(-1);
    if (
      last?.end === start &&
      sameColor(last.color, each.color) &&
      JSON.stringify(last.underline) === JSON.stringify(each.underline) &&
      last.hyperlink === each.hyperlink
    ) {
      ranges[ranges.length - 1] = { ...last, end: start + 1 };
    } else if (
      each.underline !== undefined ||
      each.hyperlink !== undefined ||
      !sameColor(each.color, color)
    ) {
      let range: TextRangeSpec = { start, end: start + 1, color: each.color };
      if (each.underline !== undefined) {
        range = { ...range, underline: each.underline };
      }
      if (each.hyperlink !== undefined) {
        range = { ...range, hyperlink: each.hyperlink };
      }
      ranges.push(range);
    }
  });
  return ranges;
}
