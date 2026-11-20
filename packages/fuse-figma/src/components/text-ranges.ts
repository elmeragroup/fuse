/**
 * The runs of a label's characters that take a color of their own, as Code's highlighter colors each
 * token through the inline `color` of a span. A Figma text holds one fill per character
 * (`setRangeFills`), so each run of characters in one color becomes a range in that color.
 *
 * A span colors its characters only by its `color`. A text property it sets that computes to what its
 * parent passes down, as preflight's `font-size: 1em` and mono `font-family` on Code's `<code>`,
 * draws nothing of its own. One that computes otherwise, and any other declaration it sets beyond
 * the base layers', stays unmapped, so the set does not count as drawn. A span's `color` that reads
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
import type { ColorSpec, TextRangeSpec } from "./kit-spec";
import { inheritsProperty } from "./layer-style";
import type { LayerStyle } from "./layer-style";

/** A span's color: a color it sets, or its parent's where its `color` computes as `unset`. */
type RunColor = { readonly kind: "set"; readonly color: ColorSpec } | { readonly kind: "parent" };

/** A `var()` of one custom property with no fallback. */
const LONE_VAR = /^var\(--[\w-]+\)$/u;

/** Why a span's `color` that reads a custom property set nowhere draws its parent's. */
const UNSET_COLOR =
  "it reads a custom property set nowhere, so the declaration computes as unset and the characters take their parent's color (CSS Variables 1 §3.1)";

/** Why a span's text property that computes to its parent's draws nothing of its own. */
const AS_PARENT =
  "it computes to the value the span's parent passes down, so the span's characters draw as the label's";

/**
 * Read a span once, however many runs it holds: its own `color`, and each other inherited property it
 * sets, which must compute to its parent's.
 *
 * @param parent - The style of the element around the span: the box, or the span outside it.
 * @returns The span's color, or undefined where it sets none, or sets one that maps to no color,
 *   whose row the read leaves unmapped.
 */
function readSpan(
  style: LayerStyle,
  parent: LayerStyle,
  scope: SpanScope,
  read: Map<LayerStyle, RunColor | undefined>
): RunColor | undefined {
  if (read.has(style)) {
    return read.get(style);
  }
  const feed = style.feed("ranges");
  for (const property of style.ownProperties()) {
    if (property === "color" || !inheritsProperty(property, scope.context)) {
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
    color = spec === undefined ? undefined : { kind: "set", color: spec };
  }
  read.set(style, color);
  return color;
}

/** What a span's reads take: the synced variables and the build's context. */
type SpanScope = { readonly variables: VariableIndex; readonly context: BuildContext };

/**
 * Read the ranges of a label's characters that take a color other than the label's.
 *
 * @param runs - The label's text, run by run, with the styles of the spans each sits in.
 * @param box - The style of the box the label sits in.
 * @param color - The label's own color.
 * @param characters - The characters the label shows.
 * @param scope - The synced variables and the build's context.
 * @param where - The variant's key and the keys of the layers down to the label, for the error.
 * @returns The ranges, in order and apart, each run of one color joined, or none where every
 *   character takes the label's color. A line break takes the color of the character before it.
 * @throws `KitUnmappable` where the runs' characters are not the label's as written, since a white
 *   space rule that collapses them leaves no index to place a range at.
 */
export function readRanges(
  runs: readonly TextRun[],
  box: LayerStyle,
  color: ColorSpec,
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
  const read = new Map<LayerStyle, RunColor | undefined>();
  const shown: ColorSpec[] = [];
  for (const run of runs) {
    let own = color;
    run.elements.forEach((style, index) => {
      const span = readSpan(style, run.elements[index - 1] ?? box, scope, read);
      own = span?.kind === "set" ? span.color : own;
    });
    // Indices count UTF-16 code units, as the label's `characters` and Figma's ranges do.
    for (let index = 0; index < run.text.length; index += 1) {
      shown.push(run.text[index] === "\n" ? (shown.at(-1) ?? color) : own);
    }
  }
  const same = (left: ColorSpec, right: ColorSpec): boolean => JSON.stringify(left) === JSON.stringify(right);
  const ranges: TextRangeSpec[] = [];
  shown.forEach((each, start) => {
    const last = ranges.at(-1);
    if (last?.end === start && same(last.color, each)) {
      ranges[ranges.length - 1] = { ...last, end: start + 1 };
    } else if (!same(each, color)) {
      ranges.push({ start, end: start + 1, color: each });
    }
  });
  return ranges;
}
