/**
 * Separators that span their popup. A menu popup pads its rows, and a separator between them cancels
 * the padding with negative margins, as `-mx-(--surface-pad-sm)` does, so it runs from edge to edge.
 * Figma has no negative margin, so the popup draws with no padding across, and each run of layers
 * between separators sits in a section frame that pads it. A popup that pads nothing across and
 * clips what overflows it draws the separator at its own width, so the margins drop there.
 * `box-mapping.ts` asks once a box's parts map, before it reads the box's padding.
 */
import type { LayerStyle } from "./cascade";
import type { CoverageOutcome } from "./coverage";
import {
  affineLength,
  describeNumber,
  evaluateLength,
  normalizeCss,
  readNumber,
  sameAffine,
  sumAffine,
  ZERO_AFFINE,
} from "./css-values";
import type { AffineLength, VariableIndex } from "./css-values";
import { NO_LIMITS, ZERO } from "./kit-spec";
import type { CounterAlignSpec, FrameLayerSpec, InstanceLayerSpec, NumberSpec } from "./kit-spec";
import type { Layout } from "./placement";

/** A part of the box, its style and the layer the mapping drew for it. */
type BleedPart = {
  readonly style: LayerStyle;
  readonly layer: FrameLayerSpec | InstanceLayerSpec;
};

/** The box whose separators can cancel its padding. */
type BleedBox = {
  readonly style: LayerStyle;
  readonly layout: Layout;
  /** Whether the box clips what overflows it. */
  readonly clips: boolean;
  /** Whether the box draws a label or an icon beside its parts, which no section could hold. */
  readonly drawsOthers: boolean;
};

/**
 * What {@link readBleed} made of a box: no separator that crosses its padding, or the padding the
 * box moves onto section frames around the runs of parts between its separators, and the key of the
 * section that holds each part by its place among the parts, which no separator has.
 */
export type Bleed =
  | { readonly kind: "none" }
  | {
      readonly kind: "sections";
      readonly paddingLeft: NumberSpec;
      readonly paddingRight: NumberSpec;
      readonly sectionOf: ReadonlyMap<number, string>;
    };

const NONE: Bleed = { kind: "none" };

const SIDES = ["margin-left", "margin-right"] as const;

/** How the coverage table names a separator's margins that cancel the popup's padding. */
const CANCELS =
  "cancels the popup's padding, so the separator spans the popup, which pads the layers between its separators in section frames";

/** How the coverage table names a separator's margins in a popup that pads nothing across and clips. */
const CLIPPED =
  "the popup pads nothing across and clips what overflows it, so the separator draws the popup's width";

/**
 * Read a column's separators: parts that fill the column across and set equal negative margins on
 * both sides. Where the column pads both sides with what the margins cancel, at every value of the
 * variables they read, its padding across moves onto section frames (CSS 2.1 §10.3.3, CSS Flexbox 1
 * §9.4: a stretched item is its container's content box wide less its margins). Where the column pads
 * nothing across and clips, the overshoot is clipped (CSS Overflow 3 §3), so the margins drop. Any
 * other column leaves the margins unread, so they land unmapped.
 *
 * @param box - The column.
 * @param parts - The column's parts as mapped, in order.
 * @param variables - The synced variables the padding can bind.
 * @returns The sections to draw, or none.
 */
export function readBleed(box: BleedBox, parts: readonly BleedPart[], variables: VariableIndex): Bleed {
  const { style, layout } = box;
  const column = layout.direction === "VERTICAL" && (layout.flex || layout.blocks);
  const separators = parts.flatMap(({ style: part, layer }, index) =>
    layer.sizing.horizontal.kind === "fill" && crossesBack(part) ? [index] : []
  );
  if (!column || separators.length === 0) {
    return NONE;
  }
  const mark = (outcome: CoverageOutcome, detail: string) => {
    for (const index of separators) {
      for (const side of SIDES) {
        parts[index]?.style.mark(side, outcome, detail, []);
      }
    }
  };
  const left = style.resolved("padding-left") ?? "0px";
  const right = style.resolved("padding-right") ?? "0px";
  if (evaluateLength(left) === 0 && evaluateLength(right) === 0) {
    if (box.clips) {
      mark("dropped", CLIPPED);
    }
    return NONE;
  }
  const cancels =
    !box.drawsOthers &&
    normalizeCss(left) === normalizeCss(right) &&
    separators.every((index) => cancelOut(left, parts[index]?.style.resolved("margin-left") ?? ""));
  if (!cancels) {
    return NONE;
  }
  mark("literal", CANCELS);
  const onSections = (property: "padding-left" | "padding-right"): NumberSpec =>
    style.read(
      property,
      (value) => readNumber(value, variables),
      (spec) => ({
        outcome: describeNumber(spec).outcome,
        detail: `${describeNumber(spec).detail}, on each section frame between the separators, which cancel the popup's padding`,
      }),
      style.feed(property === "padding-left" ? "paddingLeft" : "paddingRight")
    ) ?? ZERO;
  const paddingLeft = onSections("padding-left");
  const paddingRight = onSections("padding-right");
  return {
    kind: "sections",
    paddingLeft,
    paddingRight,
    sectionOf: sectionsOf(parts.length, new Set(separators)),
  };
}

/** Each part's section key by its place: `section-<i>`, where `i` is the place of its run's first part. */
function sectionsOf(count: number, separators: ReadonlySet<number>): ReadonlyMap<number, string> {
  const sectionOf = new Map<number, string>();
  let start: number | undefined;
  for (let index = 0; index < count; index += 1) {
    if (separators.has(index)) {
      start = undefined;
    } else {
      start ??= index;
      sectionOf.set(index, `section-${start}`);
    }
  }
  return sectionOf;
}

/**
 * Move the fields the reads filled to where the sections draw them, so an instance part's coverage
 * tells which of them it carries: a field of a part, or of a layer below one, moves below the part's
 * section, and the column's side padding becomes each section's.
 *
 * @param column - The column's style.
 * @param sectionByKey - The section key of each part that moves, by the part's layer key.
 */
function moveIntoSections(column: LayerStyle, sectionByKey: ReadonlyMap<string, string>): void {
  const { path } = column;
  const sections = [...new Set(sectionByKey.values())];
  column.moveFeeds((feed) => {
    if (!path.every((key, index) => feed.path[index] === key)) {
      return [feed];
    }
    if (feed.path.length === path.length) {
      return feed.field === "paddingLeft" || feed.field === "paddingRight"
        ? sections.map((section) => ({ path: [...path, section], field: feed.field }))
        : [feed];
    }
    const section = sectionByKey.get(feed.path[path.length] ?? "");
    return section === undefined
      ? [feed]
      : [{ ...feed, path: [...path, section, ...feed.path.slice(path.length)] }];
  });
}

/**
 * Whether a part sets equal margins on both sides that are negative wherever their variables lie.
 * A synced variable holds a length of zero or more, so an affine margin is negative throughout where
 * its constant and every coefficient are zero or less, and one of them is below zero.
 */
function crossesBack(part: LayerStyle): boolean {
  const [left, right] = SIDES.map((side) => part.resolved(side));
  const margin = left === undefined ? undefined : affineLength(left);
  if (margin === undefined || right === undefined || normalizeCss(left ?? "") !== normalizeCss(right)) {
    return false;
  }
  const terms = [margin.constant, ...margin.coefficients.values()];
  return terms.every((term) => term <= 0) && terms.some((term) => term < 0);
}

/** Whether two lengths sum to zero wherever the variables they read take a value. */
function cancelOut(first: string, second: string): boolean {
  const lengths = [affineLength(first), affineLength(second)];
  const read = lengths.filter((length): length is AffineLength => length !== undefined);
  return read.length === 2 && sameAffine(sumAffine(read), ZERO_AFFINE);
}

/**
 * Draw a column's layers as {@link readBleed} decided: each run of layers between separators in a
 * section frame that fills the column across, pads the run with the column's padding across, and
 * lays it out with the column's gap and alignment across. The fields the column's reads filled move
 * with the layers, once every read of the column and its parts is done.
 *
 * @param style - The column's style.
 * @param layers - The column's part layers, in order.
 * @param bleed - The sections to draw.
 * @param column - The column's gap and alignment across.
 * @returns The layers, the runs in their sections.
 */
export function sectioned(
  style: LayerStyle,
  layers: readonly (FrameLayerSpec | InstanceLayerSpec)[],
  bleed: Extract<Bleed, { readonly kind: "sections" }>,
  column: {
    readonly itemSpacing: NumberSpec;
    readonly counterAlign: CounterAlignSpec;
    /** The keys of the layers that hug across, where a popup that hugs its rows names one. */
    readonly hugs?: ReadonlySet<string>;
  }
): readonly (FrameLayerSpec | InstanceLayerSpec)[] {
  moveIntoSections(
    style,
    new Map(
      [...bleed.sectionOf].flatMap(([index, section]) => {
        const key = layers[index]?.key;
        return key === undefined ? [] : [[key, section] as const];
      })
    )
  );
  const runs = new Map<string, (FrameLayerSpec | InstanceLayerSpec)[]>();
  for (const [index, layer] of layers.entries()) {
    const key = bleed.sectionOf.get(index);
    if (key !== undefined) {
      runs.set(key, [...(runs.get(key) ?? []), layer]);
    }
  }
  // Each section takes the place of its run's first layer.
  const drawn = new Set<string>();
  return layers.flatMap((layer, index) => {
    const key = bleed.sectionOf.get(index);
    if (key === undefined) {
      return [layer];
    }
    if (drawn.has(key)) {
      return [];
    }
    drawn.add(key);
    const run = runs.get(key) ?? [];
    // A section that holds the row a popup takes its width from hugs it, as the row does.
    const hugs = run.some((each) => column.hugs?.has(each.key) === true);
    return [section(key, run, bleed, column, hugs)];
  });
}

/** A section frame around a run of layers. */
function section(
  key: string,
  layers: readonly (FrameLayerSpec | InstanceLayerSpec)[],
  bleed: Extract<Bleed, { readonly kind: "sections" }>,
  column: { readonly itemSpacing: NumberSpec; readonly counterAlign: CounterAlignSpec },
  hugs: boolean
): FrameLayerSpec {
  return {
    kind: "frame",
    key,
    name: "section",
    direction: "VERTICAL",
    sizing: { horizontal: { kind: hugs ? "hug" : "fill" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: bleed.paddingRight,
    paddingBottom: ZERO,
    paddingLeft: bleed.paddingLeft,
    itemSpacing: column.itemSpacing,
    primaryAlign: "MIN",
    counterAlign: column.counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: layers,
  };
}
