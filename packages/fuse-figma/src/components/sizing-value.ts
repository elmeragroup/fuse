/**
 * A length a box's sizing reads from a written value: what `100%` stands for on an axis, and the
 * sizing a `width` or `height` takes against it. It reads values through `css-values.ts`.
 */
import { evaluateLengthOf, evaluatePercentage, inViewport, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex, Viewport } from "./css-values";
import type { NumberSpec, SizeSpec } from "./kit-spec";

/**
 * What a box's `100%` stands for on one axis.
 *
 * - `parent`: the box sits in an auto layout whose length on the axis is definite, fixed or itself
 *   filling a definite length, so `100%` fills that length.
 * - `length`: a length in pixels, such as the preview width a variant root takes, or the parent an
 *   absolute box takes as its containing block. `of` names it for the coverage table, such as
 *   `the preview`, which the axis's length follows.
 * - `hugging`: the box sits in a flex box or a box that stacks blocks whose length on the axis hugs
 *   its content, so a percentage is cyclic, as CSS Sizing 3 calls it. Figma shrinks a layer that
 *   fills a hugging frame, so it does not read. Where nothing bounds the width CSS gives the parent,
 *   it is at least as wide as each layer it holds, so a `max-width` of `100%` or more never limits
 *   the box.
 * - `auto`: the box sits in a parent that stacks its layers down and hugs its height, so a percentage
 *   height computes to `auto` (CSS 2.1 §10.5) and any share hugs, as `percent-height.ts` says.
 * - `unset`: the box is an in-flow variant root alone in its component set with no preview width, so
 *   its container gives it no width, and it is a block-level box with no margins, padding or border,
 *   whose unset width and `100%` are the same width (CSS 2.1 §10.3.3). The kit draws that unset
 *   width hugging, so `100%` hugs too. An absolute root's `100%` takes its containing block, while
 *   its unset width shrinks to fit (§10.3.7), so it takes `none`.
 * - `none`: no length the build knows, as for a root with no preview width of any other kind, or
 *   an absolute box whose containing block lies above its parent.
 */
export type PercentBasis =
  | {
      readonly kind: "parent";
      /**
       * The CSS of the parent's content length, where its length is fixed, which a `calc()` of
       * the whole of it reads; a whole `100%` fills the parent whatever it holds.
       */
      readonly css?: string | undefined;
    }
  | {
      readonly kind: "length";
      readonly value: number;
      readonly of: string;
      /** The viewport a fixed root's `dvh` and `dvw` take, where the length is that viewport's. */
      readonly viewport?: Viewport;
      /** The length's CSS, where it changes by mode, which a whole `100%` reads as its own value. */
      readonly css?: string | undefined;
    }
  /** A parent's auto layout that hugs the axis, `only` where the box is the one block it stacks. */
  | { readonly kind: "hugging"; readonly only: boolean }
  | { readonly kind: "auto" }
  | { readonly kind: "unset" }
  | { readonly kind: "none" };

/**
 * Read a `width` or `height` as the sizing of its axis. A length is fixed. `fit-content` is the size
 * of what the box holds where its container has room to spare, which a kit frame's default content
 * has, so it hugs, unless `readLength` in `box-sizing.ts` fills a text box's room. `max-content` is
 * the size of what the box holds laid out on one line whatever room it has (CSS Sizing 3 §5.1), which
 * a frame that hugs a hugging text draws, so it hugs. A percentage takes
 * the basis: against a length in pixels any share is that share of it, against a parent's auto
 * layout only the whole fills, since a fill takes no share, where the whole is the box's unset
 * width only the whole hugs, as that width does, and where it computes to `auto` any share hugs.
 * Against a declared viewport a `calc()`, `min()` or `max()` that mixes percentages with lengths
 * resolves too, as `calc(100% - 2rem)` or `min(28rem, 90%)` do, its `dvh` and `dvw` read against that
 * viewport; against the preview width such a length stays unread. Any other percentage stays unread, as {@link readNumber}
 * leaves it.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @param basis - What `100%` stands for on the axis.
 * @returns The sizing, or undefined for a value no sizing holds.
 */
export function readSize(written: string, index: VariableIndex, basis: PercentBasis): SizeSpec | undefined {
  if (["fit-content", "max-content"].includes(normalizeCss(written))) {
    return { kind: "hug" };
  }
  const value = basis.kind === "length" ? inViewport(written, basis.viewport) : written;
  const length = readNumber(value, index);
  if (length !== undefined) {
    return { kind: "fixed", length };
  }
  const share = evaluatePercentage(value);
  if (share === undefined) {
    const against =
      basis.kind === "length" || basis.kind === "parent" ? againstBasis(value, basis.css, index) : undefined;
    if (against !== undefined) {
      return { kind: "fixed", length: against };
    }
    // Only a declared viewport resolves a mixed length: against the preview width it stays unread.
    const resolved =
      basis.kind === "length" && basis.viewport !== undefined
        ? evaluateLengthOf(value, basis.value)
        : undefined;
    return resolved === undefined
      ? undefined
      : { kind: "fixed", length: { kind: "literal", value: resolved } };
  }
  switch (basis.kind) {
    case "parent":
      return share === 1 ? { kind: "fill" } : undefined;
    case "length":
      // The whole of a length that changes by mode is that length, bound as its CSS binds.
      return {
        kind: "fixed",
        length: (share === 1 && basis.css !== undefined ? readNumber(basis.css, index) : undefined) ?? {
          kind: "literal",
          value: share * basis.value,
        },
      };
    case "unset":
      return share === 1 ? { kind: "hug" } : undefined;
    case "auto":
      return { kind: "hug" };
    case "hugging":
    case "none":
      return undefined;
  }
}

/**
 * A `calc()` of the whole of a basis that changes by mode and lengths, as a Tabs trigger's
 * `calc(100% - 1px)` of its list's content height, `calc(var(--control-h-md) - 8px)`: the basis's
 * CSS in place of `100%`, bound to the synced variable whose formula is the same affine length. A
 * basis whose CSS no variable matches, a share other than the whole, and a basis with no CSS, as
 * the preview width, leave the length unread.
 *
 * @param value - The length, with Tailwind's own variables already substituted.
 * @param css - The CSS of what `100%` stands for, where it changes by mode, or undefined.
 * @param index - The synced variables.
 * @returns The bound length, or undefined.
 */
function againstBasis(value: string, css: string | undefined, index: VariableIndex): NumberSpec | undefined {
  const form = normalizeCss(value);
  if (css === undefined || !form.startsWith("calc(") || form.replaceAll("100%", "").includes("%")) {
    return undefined;
  }
  const bound = index.lookupAffine(form.replaceAll("100%", `(${css})`));
  return bound === undefined ? undefined : { kind: "variable", variable: bound };
}
