/**
 * The frame that holds a flex row's layers after its first where an auto end margin on the first
 * takes the row's free space, as `readRest` in `auto-margins.ts` reads Tour's footer: Skip at the
 * row's start by `me-auto`, Back and Next at its end. CSS gives the margin the free space before
 * `justify-content` (CSS Flexbox 1 §8.1), so the layers after the first end the row with the row's
 * gap between them. A Figma auto layout places all its layers one way, so the row holds the first
 * layer and this frame, which fills the rest of the row along it and packs its layers at its end with
 * the row's gap and the row's alignment across. The row packs the two at its start with its gap, so
 * the first layer starts the row and the last ends it, as in CSS.
 *
 * An auto start margin on the last layer, as a Date range picker's `ms-auto` trigger, takes the same
 * free space before it. The frame then holds the layers before the last, fills the row before it and
 * packs them at its start, and the row holds the frame and the last layer.
 *
 * Across the row the frame takes the flex line's height, so its alignment across places its layers
 * as the row did and a layer that stretches fills the line (CSS Flexbox 1 §9.4). A row of a definite
 * height has one line as tall as its content box (§9.4 step 15), which the frame fills. A row that
 * hugs its height is as tall as its tallest item, and the frame hugs its own layers. That draws the
 * line only where none of them stretches, since a fill sizes against its parent's other layers (PF),
 * so `readRest` refuses a hugging row whose parts set `align-self`.
 *
 * The frame paints nothing. Figma keeps an auto layout frame with no children at its last size (PE4,
 * and EF1–EF3 in #821). This frame fills along the row and holds every layer on its side, so it is
 * drawn only where it holds one.
 *
 * Its key is the first layer's with ` end` after it, or the last layer's with ` start` after it, so
 * a Plan finds the same node on every run.
 */
import { NO_LIMITS, ZERO, outOfLayout } from "./kit-spec";
import type { ChildLayerSpec, CounterAlignSpec, FrameLayerSpec, NumberSpec, SizeSpec } from "./kit-spec";
import type { LayerStyle, SpecField } from "./layer-style";
import type { RestSide } from "./placement";

/** The row's fields the frame repeats, so a read that fills one on the row fills it on the frame too. */
const REPEATED: ReadonlySet<SpecField> = new Set(["itemSpacing", "primaryAlign", "counterAlign"]);

/**
 * Draw a row's layers on the far side of its auto margin in a frame that fills the rest of the row
 * and packs them at the row's end or start, as the module comment says. Layers out of the row's
 * layout keep their places. A row whose parts draw no layer on that side keeps its layers as they
 * are, packed at its start.
 *
 * @param row - The row's style, whose reads fill the fields the frame now holds.
 * @param children - The row's layers, as the box mapping laid them out.
 * @param spacing - The row's item spacing and its alignment across, which the frame keeps.
 * @param rowHeight - How the row sizes its height, which decides the frame's, as the module comment says.
 * @param packs - `end` for the layers after the first, `start` for the layers before the last.
 * @returns The row's layers, the frame in the place of the first layer it holds.
 */
export function drawRest(
  row: LayerStyle,
  children: readonly ChildLayerSpec[],
  spacing: { readonly itemSpacing: NumberSpec; readonly counterAlign: CounterAlignSpec },
  rowHeight: SizeSpec,
  packs: RestSide
): readonly ChildLayerSpec[] {
  const flowing = children.filter((child) => !outOfLayout(child));
  const kept = packs === "end" ? flowing.at(0) : flowing.at(-1);
  const rest = packs === "end" ? flowing.slice(1) : flowing.slice(0, -1);
  const [held] = rest;
  if (kept === undefined || held === undefined) {
    return children;
  }
  const key = `${kept.key} ${packs}`;
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
    primaryAlign: packs === "end" ? "MAX" : "MIN",
    counterAlign: spacing.counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: rest,
  };
  const moved = new Set(rest);
  return children.flatMap((child) => (child === held ? [frame] : moved.has(child) ? [] : [child]));
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
