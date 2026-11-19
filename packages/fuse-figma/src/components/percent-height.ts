/**
 * A percentage height, the basis it takes, and the chain of elements a root's percentage height
 * resolves through.
 *
 * A percentage height inside a parent whose height hugs, as the Navigation menu popup's viewport and
 * content are `100%` tall in a popup as tall as they are. CSS 2.1 §10.5: a percentage height whose
 * containing block's height depends on its content computes to `auto`, so the box is as tall as what
 * it holds, which a hug draws. The rule reads a parent that stacks its layers down, a column or a box
 * of blocks, where the box's own height decides nothing about its siblings'. In a row that hugs its
 * height, the row's stretch of the item is a further question, so the height stays unread there, and
 * across, a percentage of a width that hugs stays unread too (CSS Sizing 3 §5.2.1).
 */
import type { PreviewLength } from "./component-spec";
import { affineLength, evaluateLength, normalizeCss } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { SizeSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import type { Layout } from "./placement";
import type { PercentBasis } from "./sizing-value";

/** Why a percentage height in a parent that hugs its height draws as a hug. */
export const AUTO_HEIGHT =
  "the parent's height depends on its content, so a percentage height computes to auto, which hugs (CSS 2.1 §10.5)";

/** The basis of a percentage height that computes to `auto`. */
const AUTO_BASIS: PercentBasis = { kind: "auto" };

/**
 * The basis a part's percentage height takes in its parent where the parent stacks its layers down
 * and hugs its own height.
 *
 * @param layout - The parent's layout.
 * @param height - The parent's height sizing.
 * @returns The `auto` basis, or undefined where the rule does not decide the part's percentage.
 */
export function autoHeightBasis(layout: Layout, height: SizeSpec): PercentBasis | undefined {
  const stacksDown = (layout.flex || layout.blocks) && layout.direction === "VERTICAL";
  return stacksDown && height.kind === "hug" ? AUTO_BASIS : undefined;
}

/** Why a declaration around a root counts: the root's percentage height takes what it sets. */
const HEIGHT_AROUND =
  "the root's percentage height resolves against the content height this element sets around it";

/** The `display` values whose box a `height` sizes, as an inline box's does not (CSS 2.1 §10.5). */
const HEIGHTED_DISPLAYS: ReadonlySet<string> = new Set([
  "block",
  "flow-root",
  "list-item",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
]);

/** The `display` values of a block container, whose in-flow child's height its own does not change. */
const BLOCK_CONTAINERS: ReadonlySet<string> = new Set(["block", "flow-root", "list-item", "inline-block"]);

/**
 * Whether a box is in its parent's flow and takes its `height`: `position` static or relative, as
 * an absolute or fixed box resolves a percentage against its containing block's padding box (CSS 2.1
 * §10.1), and a `display` whose box a height sizes, as `contents` generates no box.
 */
function inFlowHeighted(style: LayerStyle): boolean {
  const position = normalizeCss(style.resolved("position") ?? "static");
  const display = normalizeCss(style.resolved("display") ?? "inline");
  return ["static", "relative"].includes(position) && HEIGHTED_DISPLAYS.has(display);
}

/**
 * Whether a container leaves its in-flow child's height as the child declares it. A block container
 * does (CSS 2.1 §10.6.3), and so does a flex row, where the height is the child's cross size and a
 * declared one is not stretched (CSS Flexbox 1 §9.4). A flex column makes the height the child's main
 * size, which it grows or shrinks unless both factors are 0 (§9.7), and which a basis other than
 * `auto` replaces (§9.2). The `flex` shorthand sets all three, so a child that declares it is never
 * taken to keep its height. A grid sizes its tracks first, so it is never taken to leave the height
 * alone.
 */
function keepsChildHeight(container: LayerStyle, child: LayerStyle): boolean {
  const display = normalizeCss(container.resolved("display") ?? "inline");
  if (BLOCK_CONTAINERS.has(display)) {
    return true;
  }
  if (display !== "flex" && display !== "inline-flex") {
    return false;
  }
  if (normalizeCss(container.resolved("flex-direction") ?? "row").startsWith("row")) {
    return true;
  }
  const factor = (property: string, initial: string) =>
    Number(normalizeCss(child.resolved(property) ?? initial));
  return (
    !child.has("flex") &&
    normalizeCss(child.resolved("flex-basis") ?? "auto") === "auto" &&
    factor("flex-grow", "0") === 0 &&
    factor("flex-shrink", "1") === 0
  );
}

/**
 * Whether a box's `min-height` or `max-height` can change its used height (CSS 2.1 §10.7).
 */
function constrainsHeight(style: LayerStyle): boolean {
  const minimum = normalizeCss(style.resolved("min-height") ?? "auto");
  const maximum = normalizeCss(style.resolved("max-height") ?? "none");
  return !["auto", "0", "0px"].includes(minimum) || maximum !== "none";
}

/** The edges a border-box element's height holds above and below its content box, and their side. */
const VERTICAL_EDGES = [
  ["padding-top", undefined],
  ["padding-bottom", undefined],
  ["border-top-width", "top"],
  ["border-bottom-width", "bottom"],
] as const;

/**
 * The value an edge takes room by: a padding as written, a border's width only where its style draws
 * a line, as `none` and `hidden` compute the width to 0 (CSS Backgrounds 3 §3.3).
 */
function edgeValue(style: LayerStyle, edge: string, side: "top" | "bottom" | undefined): string {
  if (side !== undefined) {
    const line = normalizeCss(style.resolved(`border-${side}-style`) ?? "none");
    if (line === "none" || line === "hidden") {
      return "0";
    }
  }
  return normalizeCss(style.resolved(edge) ?? "0");
}

/** A length in pixels with each synced variable it reads at its smallest, or undefined. */
function leastPixels(css: string, variables: VariableIndex): number | undefined {
  const length = affineLength(css);
  if (length === undefined) {
    return undefined;
  }
  let pixels = length.constant;
  for (const [name, coefficient] of length.coefficients) {
    const ref = variables.lookup(`var(${name})`);
    const least =
      ref === undefined ? undefined : coefficient >= 0 ? variables.minimum(ref) : variables.maximum(ref);
    if (least === undefined) {
      return undefined;
    }
    pixels += coefficient * least;
  }
  return pixels;
}

/**
 * The content height a root's `height: 100%` takes from the elements around it (CSS 2.1 §10.5),
 * where its used height provably is the declared one: from the root up, each box is in flow and takes
 * its height, sets no `min-height` or `max-height`, and sits in a container that leaves its height as
 * declared, as {@link keepsChildHeight} says; each `100%` takes its parent's content height, until an
 * element sets a length of its own. A `border-box` element's content height is its height less its
 * vertical padding and the borders it draws (CSS Box Sizing 3 §4), as Number field's group,
 * `h-[var(--field-h,var(--control-h-md))]` with a 1px border, leaves its stepper
 * `calc(var(--control-h-md) - 2px)`. The pixels are the least the length holds, each variable at its
 * smallest, the dense height the preview draws. The declarations it reads mark their rows so.
 *
 * Anything else stays unresolved, so the root's height stays unmapped rather than wrong: an absolute
 * or fixed root, whose percentage takes its containing block's padding box; a flex column's item,
 * which can grow or shrink from its declared height or take a basis in its place; a grid item; a
 * `display: contents` element; a length whose element sits outside the elements given, whose
 * container is not known; and edges that can outgrow a `border-box` height, whose content height
 * then floors at zero.
 *
 * @param chain - The styles of the component's elements around the root, outermost first, then the root's.
 * @param variables - The synced variables, with the values they hold in each mode.
 * @param measured - Whether the capture measured the element that sets the length as tall as that
 *   length in every mode (`basisAsDeclared`), which stands in for a container that does not leave
 *   its height as declared, as a flex column may grow or shrink it.
 * @returns The height, or undefined where the used height is not provably the declared one.
 */
export function percentHeightBasis(
  chain: readonly LayerStyle[],
  variables: VariableIndex,
  measured: { readonly lengthAsDeclared: boolean } = { lengthAsDeclared: false }
): PreviewLength | undefined {
  // The root's own limits leave the basis its percentage takes as it is, and its axis folds them in.
  const root = chain.at(-1);
  if (root === undefined || !inFlowHeighted(root)) {
    return undefined;
  }
  const read: { readonly style: LayerStyle; readonly property: string }[] = [];
  let pixels = 0;
  const terms: string[] = [];
  let child = root;
  for (let index = chain.length - 2; index >= 0; index -= 1) {
    const style = chain[index];
    if (style === undefined || !keepsChildHeight(style, child) || !inFlowHeighted(style)) {
      return undefined;
    }
    const height = normalizeCss(style.resolved("height") ?? "auto");
    // The element that sets the length, where the capture measured it that tall, kept it whatever its
    // limits are.
    const sets = height !== "100%";
    if (
      height === "auto" ||
      (height.includes("%") && sets) ||
      (constrainsHeight(style) && !(sets && measured.lengthAsDeclared))
    ) {
      return undefined;
    }
    if (normalizeCss(style.resolved("box-sizing") ?? "content-box") === "border-box") {
      for (const [edge, side] of VERTICAL_EDGES) {
        const value = edgeValue(style, edge, side);
        const length = evaluateLength(value);
        if (length === undefined && affineLength(value) === undefined) {
          return undefined;
        }
        if (length !== 0) {
          read.push({ style, property: edge });
          if (length === undefined) {
            terms.push(value);
          } else {
            pixels += length;
          }
        }
      }
      read.push({ style, property: "box-sizing" });
    }
    read.push({ style, property: "height" });
    if (height === "100%") {
      child = style;
      continue;
    }
    // The element's own container decides whether its declared length is its used height, or the
    // capture measured that it is, in every mode.
    const container = chain[index - 1];
    if (!measured.lengthAsDeclared && (container === undefined || !keepsChildHeight(container, style))) {
      return undefined;
    }
    const less = [...terms, ...(pixels === 0 ? [] : [`${String(pixels)}px`])];
    const css = less.length === 0 ? height : `calc(${height} - ${less.join(" - ")})`;
    const least = leastPixels(css, variables);
    if (least === undefined || least < 0) {
      return undefined;
    }
    for (const { style: marked, property } of read) {
      marked.mark(property, "literal", HEIGHT_AROUND, []);
    }
    return { pixels: least, css };
  }
  return undefined;
}

/** The `align-items` and `align-self` values that stretch a flex item across its line. */
const STRETCHING: ReadonlySet<string> = new Set(["normal", "stretch"]);

/** Whether a box's vertical padding and borders are all zero, so its content height is its height. */
function noVerticalEdges(style: LayerStyle): boolean {
  return VERTICAL_EDGES.every(([edge, side]) => evaluateLength(edgeValue(style, edge, side)) === 0);
}

/**
 * Whether a container stretches its in-flow child down to the container's content height: a flex
 * row on one line, whose line is then as tall as the container's content box where that is definite
 * (CSS Flexbox 1 §9.4 step 15), placing the child by `stretch` (step 11). The child sets no height,
 * minimum or maximum of its own, no `align-self` but `auto` or `stretch`, and no vertical margin,
 * which the stretch would leave out. The container sets no height, padding or border down, so its
 * content height is the height it takes from the row around it.
 */
function stretchesChild(container: LayerStyle, child: LayerStyle): boolean {
  const display = normalizeCss(container.resolved("display") ?? "inline");
  const value = (style: LayerStyle, property: string, initial: string) =>
    normalizeCss(style.resolved(property) ?? initial);
  return (
    (display === "flex" || display === "inline-flex") &&
    value(container, "flex-direction", "row") === "row" &&
    value(container, "flex-wrap", "nowrap") === "nowrap" &&
    STRETCHING.has(value(container, "align-items", "normal")) &&
    value(container, "height", "auto") === "auto" &&
    !constrainsHeight(container) &&
    noVerticalEdges(container) &&
    ["auto", ...STRETCHING].includes(value(child, "align-self", "auto")) &&
    value(child, "height", "auto") === "auto" &&
    !constrainsHeight(child) &&
    ["margin-top", "margin-bottom"].every((margin) => evaluateLength(value(child, margin, "0")) === 0) &&
    inFlowHeighted(child)
  );
}

/**
 * Whether the flex rows around a root of `auto` height stretch it to the height of the sample's host,
 * the outermost element around it, as List detail's pane stretches to its root's height and the root
 * to the docs demo's `h-80` row. Each row on one line stretches its child to its content height (CSS
 * Flexbox 1 §9.4 steps 11 and 15), as {@link stretchesChild} says, from the root up to the host. The
 * host's height is the one its manifest names as the preview height, which its renderer sets, and the
 * capture must measure the host as tall as that in every mode (`basisAsDeclared`), since the build
 * does not know the host's own container.
 *
 * Anything else leaves the root hugging its height: a row that wraps, aligns its items or pads them,
 * and a root or row that sets a height, minimum, maximum or margin down.
 *
 * @param chain - The styles of the component's elements around the root, outermost first, then the root's.
 * @param measured - Whether the capture measured the host as tall as its length in every mode.
 * @returns True where the rows provably stretch the root to the host's height.
 */
export function stretchedToHost(
  chain: readonly LayerStyle[],
  measured: { readonly lengthAsDeclared: boolean }
): boolean {
  const pairs = chain.slice(0, -1).map((container, index) => ({ container, child: chain[index + 1] }));
  return (
    measured.lengthAsDeclared &&
    pairs.length > 0 &&
    pairs.every(({ container, child }) => child !== undefined && stretchesChild(container, child))
  );
}
