/**
 * The frame that holds a flex row's layers after its first where an auto end margin on the first
 * takes the row's free space, as `readRestAtEnd` in `auto-margins.ts` reads Tour's footer: Skip at
 * the row's start by `me-auto`, Back and Next at its end. CSS gives the margin the free space before
 * `justify-content` (CSS Flexbox 1 §8.1), so the layers after the first end the row with the row's
 * gap between them. A Figma auto layout places all its layers one way, so the row holds the first
 * layer and this frame, which fills the rest of the row along it and packs its layers at its end with
 * the row's gap and the row's alignment across. The row packs the two at its start with its gap, so
 * the first layer starts the row and the last ends it, as in CSS.
 *
 * Across the row the frame takes the flex line's height, so its alignment across places its layers
 * as the row did and a layer that stretches fills the line (CSS Flexbox 1 §9.4). A row of a definite
 * height has one line as tall as its content box (§9.4 step 15), which the frame fills. A row that
 * hugs its height is as tall as its tallest item, and the frame hugs its own layers. That draws the
 * line only where none of them stretches, since a fill sizes against its parent's other layers (PF),
 * so `readRestAtEnd` refuses a hugging row whose parts set `align-self`.
 *
 * The frame paints nothing. Figma keeps an auto layout frame with no children at its last size (PE4,
 * and EF1–EF3 in #821). This frame fills along the row and holds every layer after the first, so it
 * is drawn only where it holds one.
 *
 * Its key is the first layer's with ` end` after it, so a Plan finds the same node on every run.
 */
import { NO_LIMITS, ZERO, outOfLayout } from "./kit-spec";
import type { ChildLayerSpec, CounterAlignSpec, FrameLayerSpec, NumberSpec, SizeSpec } from "./kit-spec";
import type { LayerStyle, SpecField } from "./layer-style";

/** The row's fields the frame repeats, so a read that fills one on the row fills it on the frame too. */
const REPEATED: ReadonlySet<SpecField> = new Set(["itemSpacing", "primaryAlign", "counterAlign"]);

/**
 * Draw a row's layers after its first in flow in a frame that fills the rest of the row and packs
 * them at its end, as the module comment says. Layers out of the row's layout keep their places. A
 * row whose parts draw no layer after the first keeps its layers as they are, packed at its start.
 *
 * @param row - The row's style, whose reads fill the fields the frame now holds.
 * @param children - The row's layers, as the box mapping laid them out.
 * @param spacing - The row's item spacing and its alignment across, which the frame keeps.
 * @param rowHeight - How the row sizes its height, which decides the frame's, as the module comment says.
 * @returns The row's layers: the first in flow, then the frame in the place of the second.
 */
export function drawRestAtEnd(
  row: LayerStyle,
  children: readonly ChildLayerSpec[],
  spacing: { readonly itemSpacing: NumberSpec; readonly counterAlign: CounterAlignSpec },
  rowHeight: SizeSpec
): readonly ChildLayerSpec[] {
  const [first, ...rest] = children.filter((child) => !outOfLayout(child));
  const [second] = rest;
  if (first === undefined || second === undefined) {
    return children;
  }
  const key = `${first.key} end`;
  moveIntoFrame(row, key, new Set(rest.map((layer) => layer.key)));
  const frame: FrameLayerSpec = {
    kind: "frame",
    key,
    name: key,
    direction: "HORIZONTAL",
    sizing: {
      horizontal: { kind: "fill" },
      vertical: { kind: rowHeight.kind === "hug" ? "hug" : "fill" },
    },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: spacing.itemSpacing,
    primaryAlign: "MAX",
    counterAlign: spacing.counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: rest,
  };
  const moved = new Set(rest);
  return children.flatMap((child) => (child === second ? [frame] : moved.has(child) ? [] : [child]));
}

/**
 * Move the fields the row's reads filled to where the frame draws them, so an instance part's
 * coverage tells which of them it carries: a field of a moved layer, or of a layer below one, moves
 * below the frame, and the row's spacing and alignments become the frame's too.
 *
 * @param row - The row's style.
 * @param frame - The frame's key.
 * @param moved - The keys of the layers the frame holds.
 */
function moveIntoFrame(row: LayerStyle, frame: string, moved: ReadonlySet<string>): void {
  const { path } = row;
  row.moveFeeds((feed) => {
    if (!path.every((key, index) => feed.path[index] === key)) {
      return [feed];
    }
    if (feed.path.length === path.length) {
      return REPEATED.has(feed.field) ? [feed, { path: [...path, frame], field: feed.field }] : [feed];
    }
    return moved.has(feed.path[path.length] ?? "")
      ? [{ ...feed, path: [...path, frame, ...feed.path.slice(path.length)] }]
      : [feed];
  });
}
