/**
 * A translate across that every row of a column shares, as each Sidebar sub row's `-translate-x-px`
 * moves it 1px left over its sub menu's padding. A translate moves a box's painting and leaves the
 * layout alone (CSS Transforms 1 §6), so rows that all move `t` across paint where a column whose left
 * padding is `t` larger and whose right padding is `t` smaller lays them out, each at its own width and
 * alignment. Figma lays out no translate, so the column's paddings draw it, where both are literal and
 * stay 0 or more.
 *
 * A box that paints nothing and pads nothing across shows only what it holds, so where every row it
 * holds shares a translate, the box carries it to its own column, as a sub row's `<li>` carries its
 * link's. Any other translate stays unread, so it lands in the coverage table as unmapped.
 */
import type { LayerStyle } from "./cascade";
import { describeNumber, evaluateLength, normalizeCss, readNumber, splitTopLevel } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { NumberSpec } from "./kit-spec";

/** A box whose `translate` moves it: its style, and whether it is an instance's root built in place. */
type Carrier = { readonly style: LayerStyle; readonly instance: boolean };

/** A translate across in pixels, and the boxes whose `translate` declares it. */
export type CarriedTranslate = { readonly x: number; readonly carriers: readonly Carrier[] };

/** The translate each box that paints and pads nothing carries from the rows it holds, by its style. */
export type CarriedTranslates = WeakMap<LayerStyle, CarriedTranslate>;

/** The transforms beside `translate` that move a box some other way. */
const OTHER_TRANSFORMS = ["transform", "rotate", "scale"] as const;

/** The translate across a box's own `translate` declares, alone and in flow. */
function ownTranslate(carrier: Carrier): CarriedTranslate | undefined {
  const { style } = carrier;
  const value = style.resolved("translate");
  const position = normalizeCss(style.raw("position") ?? "static");
  const transformed = OTHER_TRANSFORMS.some((property) => {
    const other = style.resolved(property);
    return other !== undefined && normalizeCss(other) !== "none";
  });
  if (value === undefined || transformed || (position !== "static" && position !== "relative")) {
    return undefined;
  }
  // A translate with one length moves along x only.
  const [x = "", y = "0", ...z] = splitTopLevel(normalizeCss(value), " ");
  const moved = evaluateLength(x);
  return z.length > 0 || evaluateLength(y) !== 0 || moved === undefined || moved === 0
    ? undefined
    : { x: moved, carriers: [carrier] };
}

/**
 * The translate across every row of a box shares, each through its own `translate` or through what a
 * wrapper carries.
 *
 * @param rows - The box's parts in flow, each with whether it is an instance.
 * @param carried - What each wrapper carries.
 * @returns The shared translate, or undefined where a row sets none, sets another, or the box has no row.
 */
export function sharedTranslate(
  rows: readonly Carrier[],
  carried: CarriedTranslates
): CarriedTranslate | undefined {
  const each = rows.map((row) => ownTranslate(row) ?? carried.get(row.style));
  const [first] = each;
  if (first === undefined || each.some((moved) => moved?.x !== first.x)) {
    return undefined;
  }
  return { x: first.x, carriers: each.flatMap((moved) => moved?.carriers ?? []) };
}

/**
 * Fold a translate the rows of a column share into its paddings across, reading both paddings and each
 * row's `translate`, as the module comment says.
 *
 * @param style - The column's style.
 * @param shared - The translate its rows share.
 * @param variables - The synced variables a padding can bind, which leave it unfolded.
 * @returns The left and right paddings, or undefined where one is not literal or would go below 0.
 */
export function foldTranslate(
  style: LayerStyle,
  shared: CarriedTranslate,
  variables: VariableIndex
): { readonly left: NumberSpec; readonly right: NumberSpec } | undefined {
  const held = (property: string) => readNumber(style.resolved(property) ?? "0px", variables);
  const left = held("padding-left");
  const right = held("padding-right");
  if (left?.kind !== "literal" || right?.kind !== "literal") {
    return undefined;
  }
  const folded = {
    left: { kind: "literal", value: left.value + shared.x },
    right: { kind: "literal", value: right.value - shared.x },
  } as const;
  if (folded.left.value < 0 || folded.right.value < 0) {
    return undefined;
  }
  const way = shared.x < 0 ? "left" : "right";
  const amount = `${String(Math.abs(shared.x))}px`;
  for (const [property, spec, field, sign] of [
    ["padding-left", folded.left, "paddingLeft", shared.x < 0 ? "less" : "plus"],
    ["padding-right", folded.right, "paddingRight", shared.x < 0 ? "plus" : "less"],
  ] as const) {
    style.read(
      property,
      () => spec,
      () => ({
        outcome: "literal",
        detail: `${describeNumber(spec).detail}, this padding ${sign} the ${amount} its rows move ${way}`,
      }),
      style.feed(field)
    );
  }
  const [more, fewer] = shared.x < 0 ? ["less", "more"] : ["more", "less"];
  const detail = `the rows of its column all move ${amount} ${way}, which the column's paddings draw, ${amount} ${more} on the left and ${amount} ${fewer} on the right`;
  for (const { style: carrier, instance } of shared.carriers) {
    carrier.read(
      "translate",
      (value) => value,
      () => ({ outcome: "literal", detail }),
      // An instance's root moves inside the frame around it, which the column's paddings draw.
      instance
        ? carrier.feed("around")
        : [...carrier.feed("paddingLeft", style.path), ...carrier.feed("paddingRight", style.path)]
    );
  }
  return folded;
}
