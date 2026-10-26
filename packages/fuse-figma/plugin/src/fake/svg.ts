/**
 * Vectors drawn from SVG markup, and the flattening of drawn layers into one vector.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 6. `createNodeFromSvg` returns a frame the size of the markup's `width` and `height`, painted
 *    white and clipping, on the current page. Its children are the drawn elements, each a
 *    vector named after its `id`, or `Vector`, as a real run showed on 2026-10-20. The fake
 *    leaves out what `defs`, `clipPath` and `mask` hold and lifts the elements out of groups.
 *    It reads no geometry, so every vector covers the whole drawing.
 */

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";

import { storePaint } from "./paints.ts";
import { f32, WHITE, write } from "./state.ts";
import type { FileState, NodeState } from "./state.ts";
import { createNode, detach, insert, markRemoved, placeOnCurrentPage } from "./tree.ts";

/** One drawn element of an SVG: its layer name and its paints. */
type SvgElement = {
  readonly name: string;
  readonly fill: string;
  readonly stroke: string;
};

const SVG_ROOT = /<svg\b([^>]*)>/;

const UNDRAWN = /<(defs|clipPath|mask)\b[^>]*>[\s\S]*?<\/\1>/g;

const DRAWN = /<(path|circle|rect|ellipse|polygon|polyline|line)\b([^>]*?)\/?>/g;

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)?.[1];
}

const NAMED_COLORS = new Map([
  ["white", "#ffffff"],
  ["black", "#000000"],
]);

/** The paints an SVG paint attribute draws with: none, or one solid paint. */
function svgPaints(file: FileState, value: string): Paint[] {
  if (value === "none") {
    return [];
  }
  const hex = NAMED_COLORS.get(value.toLowerCase()) ?? value;
  const parsed = Hex.parse(hex);
  if (parsed._tag === "err") {
    throw new Error(`The fake Figma file reads SVG paints in six-digit hex, white or black, not ${value}.`);
  }
  const { r, g, b } = getOrThrow(parsed);
  return [
    storePaint(file, { type: "SOLID", color: { r, g, b }, opacity: 1, visible: true, blendMode: "NORMAL" }),
  ];
}

/** Rule 6: the frame `createNodeFromSvg` makes. */
export function drawSvg(file: FileState, svg: string): NodeState {
  const root = SVG_ROOT.exec(svg)?.[1];
  const width = Number(attribute(root ?? "", "width"));
  const height = Number(attribute(root ?? "", "height"));
  if (root === undefined || !(width > 0) || !(height > 0)) {
    throw new Error("The fake Figma file draws only an SVG whose root sets a width and a height.");
  }
  const fill = attribute(root, "fill") ?? "#000000";
  const stroke = attribute(root, "stroke") ?? "none";
  const elements: SvgElement[] = [...svg.replaceAll(UNDRAWN, "").matchAll(DRAWN)].map(
    ([, , attributes = ""]) => ({
      name: attribute(attributes, "id") ?? "Vector",
      fill: attribute(attributes, "fill") ?? fill,
      stroke: attribute(attributes, "stroke") ?? stroke,
    })
  );
  const frame = createNode(file, "FRAME", "svg");
  frame.width = f32(width);
  frame.height = f32(height);
  frame.clipsContent = true;
  frame.fills = [WHITE];
  frame.children = elements.map((element) => {
    const vector = createNode(file, "VECTOR", element.name);
    vector.width = frame.width;
    vector.height = frame.height;
    vector.fills = svgPaints(file, element.fill);
    vector.strokes = svgPaints(file, element.stroke);
    vector.parent = frame;
    return vector;
  });
  placeOnCurrentPage(file, frame);
  write(frame, "create from SVG");
  return frame;
}

export function flatten(
  file: FileState,
  nodes: readonly NodeState[],
  parent: NodeState,
  index: number | undefined
): NodeState {
  const [first] = nodes;
  if (first === undefined) {
    throw new Error("flatten needs at least one node.");
  }
  for (const node of nodes) {
    if (node.mirrorOf !== undefined) {
      throw new Error(`Cannot flatten ${node.id}, a layer inside an instance.`);
    }
  }
  const vector = createNode(file, "VECTOR", "Vector");
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  vector.x = left;
  vector.y = top;
  vector.width = f32(Math.max(...nodes.map((node) => node.x + node.width)) - left);
  vector.height = f32(Math.max(...nodes.map((node) => node.y + node.height)) - top);
  vector.fills = first.fills;
  vector.strokes = first.strokes;
  for (const node of nodes) {
    write(node, "flatten");
    detach(node);
    markRemoved(node);
  }
  insert(parent, vector, index);
  return vector;
}
