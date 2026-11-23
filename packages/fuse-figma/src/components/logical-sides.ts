/**
 * Where a box's flow-relative border sides and corners lie. The capture records the physical side or
 * corner each logical declaration wins as on a horizontal, left-to-right page (`physicalLonghand` in
 * `winners.ts`), where `border-inline-start-width` is the left side's and
 * `border-start-start-radius` the top left corner's. A box that lays out right to left, or in vertical
 * lines, puts them on other sides (CSS Logical Properties 1 §4, §6.2), so there the build maps none
 * of the sides or corners the logical declarations take part in.
 */
import { flowRelativeEdges } from "../capture/winners";
import type { FlowRelativeEdges } from "../capture/winners";
import { normalizeCss } from "./css-values";
import type { LayerStyle } from "./layer-style";
import { horizontal } from "./subgrid-row";

/**
 * Where a box's logical corners, sides, or side widths or styles lie: on the physical ones of a horizontal,
 * left-to-right page, or elsewhere, with why the build leaves them unmapped.
 */
export type LogicalSides =
  | { readonly kind: "left-to-right" }
  | { readonly kind: "elsewhere"; readonly reason: string };

/**
 * What the capture measured of a box's flow: the edges it measured the box setting by their
 * flow-relative names where the box lays out otherwise in some mode (`otherFlow`), or `unmeasured`
 * for a box whose flow the capture does not read, as a pseudo-element's.
 */
export type MeasuredFlow = readonly FlowRelativeEdges[] | "unmeasured";

/** How the reasons below name each edge. */
const EDGE_NAMES = {
  corners: "corners",
  sides: "sides",
  widths: "side widths",
  styles: "side styles",
} as const satisfies Record<FlowRelativeEdges, string>;

/**
 * Where a box's logical edges lie. They lie elsewhere where the capture measured the box setting them
 * by their flow-relative names and laying out other than left to right in horizontal lines in some
 * mode (`otherFlow`), as a `dir` on an ancestor makes it. They lie elsewhere too where the box sets
 * one by a declaration of its own and either its own or inherited declarations set `direction: rtl`
 * or a vertical `writing-mode`, which a capture fixture states without measuring, or the capture
 * does not read the box's flow, since a `dir` it cannot see may then turn the box.
 *
 * @param reader - The box's style.
 * @param edges - The box's corners, its border sides, or their widths or styles.
 * @param flow - What the capture measured of the box's flow.
 * @returns Where the box's logical edges lie.
 */
export function logicalSidesOf(
  reader: LayerStyle,
  edges: FlowRelativeEdges,
  flow: MeasuredFlow
): LogicalSides {
  const declared = reader.ownProperties().some((property) => flowRelativeEdges(property).includes(edges));
  if (flow === "unmeasured") {
    return declared
      ? {
          kind: "elsewhere",
          reason: `the capture does not measure where the box lays out, as on a pseudo-element, so the build cannot tell where its logical ${EDGE_NAMES[edges]} lie`,
        }
      : { kind: "left-to-right" };
  }
  const turned = normalizeCss(reader.resolved("direction") ?? "") === "rtl" || !horizontal(reader);
  return flow.includes(edges) || (declared && turned)
    ? {
        kind: "elsewhere",
        reason: `the box lays out other than left to right in horizontal lines, which puts its logical ${EDGE_NAMES[edges]} elsewhere than the capture reads them`,
      }
    : { kind: "left-to-right" };
}
