/**
 * Layers a flex column draws flush against the layer before them: a part whose negative top margin
 * is exactly the column's gap, which cancels the gap above it (CSS Box Alignment 3 §8, CSS Flexbox 1
 * §4.2, where a flex item's margins add to the gap and never collapse), as FieldFrame's legend-mode
 * description sits right under its legend. A Figma auto layout spaces every layer by one gap, so the
 * column draws the layer and the one before it in a frame with no gap, which takes their place. A
 * real file drew the description flush under the legend and the next layer one `surface-gap-md`
 * below the frame, 12px at Dense and 16px at Comfortable (W5-P5).
 */
import type { LayerStyle } from "./cascade";
import { affineLength, constantOf, sumAffine } from "./css-values";
import { NO_LIMITS, ZERO } from "./kit-spec";
import type { ChildLayerSpec, CounterAlignSpec, FrameLayerSpec } from "./kit-spec";
import type { Layout } from "./placement";

/** What became of the margin that cancels the gap. */
const FLUSH =
  "cancels the column's gap above the layer, so it sits flush under the layer before it, which a frame around both with no gap draws";

/** A part in the column's flow, by the key its layer takes. */
type FlowPart = { readonly key: string; readonly style: LayerStyle };

/**
 * Join each layer of a flex column whose top margin cancels the column's gap to the layer before it,
 * in a frame with no gap that takes their place, and record the margin as read.
 *
 * @param column - The column's style.
 * @param layout - The column's layout.
 * @param parts - The column's parts in flow, in order, each with its layer's key.
 * @param children - The column's layers.
 * @param counterAlign - How the column aligns its layers across, which the frame repeats.
 * @returns The layers, with each flush run in its frame.
 */
export function joinFlushLayers(
  column: LayerStyle,
  layout: Layout,
  parts: readonly FlowPart[],
  children: readonly ChildLayerSpec[],
  counterAlign: CounterAlignSpec
): readonly ChildLayerSpec[] {
  if (!layout.flex || layout.direction !== "VERTICAL") {
    return children;
  }
  const gap = affineLength(column.resolved("gap") ?? column.resolved("row-gap") ?? "");
  // A zero gap leaves nothing to cancel, though a zero margin sums with it to zero.
  if (gap === undefined || constantOf(gap) === 0) {
    return children;
  }
  // The margin cancels the gap where the two sum to zero wherever their variables take a value.
  const cancels = (style: LayerStyle): boolean => {
    const margin = affineLength(style.resolved("margin-top") ?? "");
    return margin !== undefined && constantOf(sumAffine([margin, gap])) === 0;
  };
  const flush = new Set(
    parts
      .slice(1)
      .filter(({ style }) => cancels(style))
      .map(({ key }) => key)
  );
  if (flush.size === 0) {
    return children;
  }
  for (const { key, style } of parts) {
    if (flush.has(key)) {
      style.read(
        "margin-top",
        (value) => value,
        () => ({ outcome: "literal", detail: FLUSH }),
        []
      );
    }
  }
  const joined: ChildLayerSpec[] = [];
  const moved = new Map<string, string>();
  // The frame this call made for the run the last layer belongs to. A layer's name is its part's
  // slot, so only identity tells the frame from a part's own.
  let wrapper: FrameLayerSpec | undefined;
  for (const child of children) {
    const previous = joined.at(-1);
    if (!flush.has(child.key) || previous === undefined) {
      joined.push(child);
      wrapper = undefined;
      continue;
    }
    const frame = previous === wrapper ? wrapper : flushFrame(previous, counterAlign);
    if (frame !== previous) {
      moved.set(previous.key, frame.key);
    }
    moved.set(child.key, frame.key);
    const members = [...frame.children, child];
    wrapper = { ...frame, sizing: { ...frame.sizing, horizontal: widthAround(members) }, children: members };
    joined[joined.length - 1] = wrapper;
  }
  moveIntoFrames(column, moved);
  return joined;
}

/** A frame with no gap around a layer, which the layers flush under it join. */
function flushFrame(first: ChildLayerSpec, counterAlign: CounterAlignSpec): FrameLayerSpec {
  return {
    kind: "frame",
    key: `${first.key}-flush`,
    name: "flush",
    direction: "VERTICAL",
    sizing: { horizontal: widthAround([first]), vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MIN",
    counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [first],
  };
}

/** The frame fills the column's width where a layer it holds fills it, and hugs them otherwise. */
function widthAround(layers: readonly ChildLayerSpec[]): FrameLayerSpec["sizing"]["horizontal"] {
  return layers.some((layer) => layer.kind !== "icon" && layer.sizing.horizontal.kind === "fill")
    ? { kind: "fill" }
    : { kind: "hug" };
}

/** Move the fields the column's reads filled on a joined layer to its place inside the frame. */
function moveIntoFrames(column: LayerStyle, frameOf: ReadonlyMap<string, string>): void {
  const { path } = column;
  column.moveFeeds((feed) => {
    const frame = frameOf.get(feed.path[path.length] ?? "");
    return frame === undefined || !path.every((key, index) => feed.path[index] === key)
      ? [feed]
      : [{ ...feed, path: [...path, frame, ...feed.path.slice(path.length)] }];
  });
}
