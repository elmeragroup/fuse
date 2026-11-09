/**
 * Measures a ghost, the real content rendered unseen with sample data, into bones: one rounded
 * bar per visual line of text and one block per block part. Ported from skullet's measuring
 * (https://github.com/lochie/skullet, MIT, Lochie Axon): text lines come from
 * `Range.getClientRects`, each bar runs from the font's ascender to its descender as canvas
 * `measureText` reports them, and a box that clips its overflow clips the bones inside it and
 * lends its rounded corners to a block that sits in one. Blocks come from the skeleton roles in
 * `theme/tokens/skeleton-roles.ts` instead of skullet's paint heuristic.
 */
import { isElement, isText, windowOf } from "../../internal/dom-node";
import { skeletonRoleOf } from "../../theme/tokens/skeleton-roles";
import type { SkeletonRole } from "../../theme/tokens/skeleton-roles";
import { scaleOf } from "./skeleton-geometry";
import { mergeLineFragments } from "./skeleton-lines";
import type { LineFragment } from "./skeleton-lines";

/** One bone to draw, in the bones layer's pixels. */
export type Bone = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * The computed font size of the text it stands for, in pixels: a bar's largest, a block's own.
   * The reveal times the bone by it as it times that text.
   */
  readonly fontSize: number;
  /** A block's own `border-radius`, or `bar` for a line of text, which takes the bar radius. */
  readonly corners: { readonly kind: "bar" } | { readonly kind: "block"; readonly radius: string };
};

/** What one measuring pass found. */
export type Measured = {
  readonly bones: readonly Bone[];
  /** The elements drawn as one block, whose own paint the ghost hides behind their bone. */
  readonly covered: ReadonlySet<Element>;
};

type Rect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

/** Corner radii in pixels: top left, top right, bottom right, bottom left. */
type Corners = readonly [number, number, number, number];

/** The box that clips what is inside it, with the corners it rounds, or null while nothing clips. */
type Clip = (Rect & { readonly corners: Corners }) | null;

type Point = readonly [number, number];

/** The font metrics a bar is drawn between, in pixels from the baseline. */
type Metrics = {
  /** The font's own box above and below the baseline, which the line box centres. */
  readonly ascent: number;
  readonly descent: number;
  /** The ink of b, d, h, l, and of g, p, y. */
  readonly ascender: number;
  readonly descender: number;
};

function intersect(clip: Clip, rect: Rect): Rect {
  if (clip === null) return rect;
  return {
    left: Math.max(clip.left, rect.left),
    right: Math.min(clip.right, rect.right),
    top: Math.max(clip.top, rect.top),
    bottom: Math.min(clip.bottom, rect.bottom),
  };
}

function cornersOf(rect: Rect): readonly [Point, Point, Point, Point] {
  return [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
  ];
}

function near(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;
}

function radiiOf(style: CSSStyleDeclaration, rect: Rect): Corners {
  const size = Math.min(rect.right - rect.left, rect.bottom - rect.top);
  const toPixels = (value: string): number =>
    value.endsWith("%") ? (Number.parseFloat(value) / 100) * size : Number.parseFloat(value) || 0;
  return [
    toPixels(style.borderTopLeftRadius),
    toPixels(style.borderTopRightRadius),
    toPixels(style.borderBottomRightRadius),
    toPixels(style.borderBottomLeftRadius),
  ];
}

/** A clip within a clip: each corner rounds as whichever box's corner it is. */
function clipWithin(clip: Clip, rect: Rect, style: CSSStyleDeclaration): Clip {
  const box = intersect(clip, rect);
  const own = radiiOf(style, rect);
  const ownCorners = cornersOf(rect);
  const outer = clip === null ? null : cornersOf(clip);
  const corner = (index: 0 | 1 | 2 | 3): number => {
    const point = cornersOf(box)[index];
    if (near(point, ownCorners[index])) return own[index];
    if (clip !== null && outer !== null && near(point, outer[index])) return clip.corners[index];
    return 0;
  };
  return {
    left: box.left,
    right: box.right,
    top: box.top,
    bottom: box.bottom,
    corners: [corner(0), corner(1), corner(2), corner(3)],
  };
}

/** A block in a rounded corner of what clips it is cut by that corner, so it takes that radius. */
function roundedBy(clip: Clip, box: Rect, own: string, style: CSSStyleDeclaration): string {
  if (clip === null) return own;
  const clipCorners = cornersOf(clip);
  const boxCorners = cornersOf(box);
  const mine = radiiOf(style, box);
  const indices = [0, 1, 2, 3] as const;
  const touching = indices.map((i) => clip.corners[i] > 0 && near(boxCorners[i], clipCorners[i]));
  if (!touching.some(Boolean)) return own;
  return indices
    .map((i) => `${String(touching[i] ? Math.max(mine[i], clip.corners[i]) : mine[i])}px`)
    .join(" ");
}

/** The visible part of a rect, or null when a clip cuts it to a sliver, as for visually hidden text. */
function visiblePart(rect: Rect, clip: Clip): Rect | null {
  const box = intersect(clip, rect);
  return box.right - box.left >= 2 && box.bottom - box.top >= 2 ? box : null;
}

/** Font metrics by CSS font shorthand, read through one canvas. */
type FontMetricsReader = (style: CSSStyleDeclaration) => Metrics | null;

/**
 * A metrics reader for one measuring pass. Its cache lives only as long as the pass: a web font
 * that loads later keeps the same shorthand but changes the metrics, so a cache that outlived the
 * pass would keep drawing bars from the fallback face.
 */
function createFontMetricsReader(ownerDocument: Document): FontMetricsReader {
  const byFont = new Map<string, Metrics | null>();
  let context: CanvasRenderingContext2D | null | undefined;
  return (style) => {
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const cached = byFont.get(font);
    if (cached !== undefined) return cached;
    context ??= ownerDocument.createElement("canvas").getContext("2d");
    let metrics: Metrics | null = null;
    if (context !== null) {
      context.font = font;
      const box = context.measureText("H");
      metrics = {
        ascent: box.fontBoundingBoxAscent,
        descent: box.fontBoundingBoxDescent,
        ascender: context.measureText("bdfhkl").actualBoundingBoxAscent,
        descender: context.measureText("gjpqy").actualBoundingBoxDescent,
      };
    }
    byFont.set(font, metrics);
    return metrics;
  };
}

/**
 * Where the bar goes in a line box: ascender to descender about the baseline the line centres,
 * kept inside the line box. A face's ink can reach past its own ascent or descent, as a substitute
 * serif's descenders do on Linux, and a bar drawn to that ink would leave its line and reach into
 * the next one's; the bar stands in for its line, so the line box bounds it.
 */
function barOf(
  line: Rect,
  style: CSSStyleDeclaration,
  fontSize: number,
  metricsOf: FontMetricsReader
): Pick<LineFragment, "barTop" | "barBottom"> {
  const metrics = metricsOf(style);
  if (metrics === null) {
    // No canvas to read the type with: a bar centred in the line.
    const height = Math.min(fontSize * 0.72, line.bottom - line.top);
    const middle = (line.top + line.bottom) / 2;
    return { barTop: middle - height / 2, barBottom: middle + height / 2 };
  }
  const baseline =
    line.top + (line.bottom - line.top - metrics.ascent - metrics.descent) / 2 + metrics.ascent;
  return {
    barTop: Math.max(line.top, baseline - metrics.ascender),
    barBottom: Math.min(line.bottom, baseline + metrics.descender),
  };
}

function roleOf(element: Element): SkeletonRole | undefined {
  return skeletonRoleOf({
    hint: element.getAttribute("data-skeleton"),
    slot: element.getAttribute("data-slot"),
    tagName: element.localName,
  });
}

/** Media clipped by a rounded parent of its own size, like an avatar image, takes the parent's corners. */
function radiusOf(element: Element, style: CSSStyleDeclaration): string {
  const parent = element.parentElement;
  if (Number.parseFloat(style.borderRadius) || parent === null) return style.borderRadius || "0px";
  const parentStyle = windowOf(parent).getComputedStyle(parent);
  const own = element.getBoundingClientRect();
  const around = parent.getBoundingClientRect();
  const same = Math.abs(own.width - around.width) < 1 && Math.abs(own.height - around.height) < 1;
  return same && parentStyle.overflow !== "visible" ? parentStyle.borderRadius : style.borderRadius || "0px";
}

/**
 * Measures what `root` holds into bones relative to `layer`.
 *
 * @param root - The ghost: the content rendered unseen, laid out where it will appear.
 * @param layer - The absolutely positioned layer the bones are drawn in.
 * @returns The bones, blocks first and then one bar per line, and the elements drawn as blocks.
 */
export function measureGhost(root: Element, layer: HTMLElement): Measured {
  // The ghost's own window and document: a reveal rendered into a same-origin frame is measured
  // with the frame's styles and ranges, and its nodes are told apart by node type, not by this
  // window's constructors, which a frame's nodes are not instances of.
  const view = windowOf(root);
  const origin = layer.getBoundingClientRect();
  // Client rects are post-transform; the bones are drawn inside the same transform, at the
  // layer's fractional scale, so a 200.5px layer draws a 200.5px bone.
  const scale = scaleOf(layer);
  const local = (rect: Rect): Rect => ({
    left: (rect.left - origin.left) / scale.x,
    right: (rect.right - origin.left) / scale.x,
    top: (rect.top - origin.top) / scale.y,
    bottom: (rect.bottom - origin.top) / scale.y,
  });

  const blocks: Bone[] = [];
  const fragments: LineFragment[] = [];
  const covered = new Set<Element>();
  const range = root.ownerDocument.createRange();
  const metricsOf = createFontMetricsReader(root.ownerDocument);

  const addText = (node: Text, clip: Clip): void => {
    const parent = node.parentElement;
    const start = node.data.search(/\S/u);
    if (start < 0 || parent === null) return;
    range.setStart(node, start);
    range.setEnd(node, node.data.trimEnd().length);
    const style = view.getComputedStyle(parent);
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    for (const rect of range.getClientRects()) {
      const visible = visiblePart(rect, clip);
      if (visible === null) continue;
      const line = local(visible);
      fragments.push({ ...line, fontSize, ...barOf(line, style, fontSize, metricsOf) });
    }
  };

  const visit = (parent: Element, clip: Clip): void => {
    for (const node of parent.childNodes) {
      if (isText(node)) {
        addText(node, clip);
        continue;
      }
      if (!isElement(node)) continue;
      const style = view.getComputedStyle(node);
      if (style.display === "none") continue;
      const role = roleOf(node);
      if (role === "ignore") continue;
      if (role === "block") {
        const visible = visiblePart(node.getBoundingClientRect(), clip);
        if (visible !== null) {
          const box = local(visible);
          blocks.push({
            x: box.left,
            y: box.top,
            width: box.right - box.left,
            height: box.bottom - box.top,
            fontSize: Number.parseFloat(style.fontSize) || 16,
            corners: { kind: "block", radius: roundedBy(clip, visible, radiusOf(node, style), style) },
          });
        }
        covered.add(node);
        continue;
      }
      const clips = style.overflowX !== "visible" || style.overflowY !== "visible";
      visit(node, clips ? clipWithin(clip, node.getBoundingClientRect(), style) : clip);
    }
  };

  visit(root, null);
  const bars = mergeLineFragments(fragments).map((bar): Bone => ({ ...bar, corners: { kind: "bar" } }));
  return { bones: [...blocks, ...bars], covered };
}
