/**
 * A box's `::before` and `::after` as layers of their own. The cascade hands the mapping each
 * pseudo-element that paints and that the capture measured as an absolute box laid out against the
 * box (`BoxCascade.pseudoElements`), and the mapping draws it as a frame part of the box with no
 * parts, icons or label, keyed `::before` or `::after`, under the rules a real part maps by: a
 * `::before` before the box's other parts and an `::after` after them, the tree order CSS generates
 * them in (CSS Pseudo-Elements 4 §3.1), which `paint-order.ts` keeps among the box's placed layers.
 */
import type { BoxCascade } from "./box-cascade";
import type { PartDefinition } from "./component-spec";
import { normalizeCss } from "./css-values";
import { always } from "./popup-facts";

/** A pseudo-element the box draws, as the part definition the mapping draws it from. */
export type PseudoPart = {
  readonly pseudo: "before" | "after";
  readonly child: PartDefinition;
  readonly cascade: BoxCascade;
};

/** The `content` values that generate a box with no text in it. */
const EMPTY_CONTENT: ReadonlySet<string> = new Set(['""', "''"]);

/**
 * The pseudo-elements a box draws as layers, `::before` first. Each reads its `content`, which drops
 * where it is an empty string: it generates the box the layer draws, with no text in it. Other content
 * stays unread, so its row lands unmapped, since the layer draws no text.
 *
 * @param cascade - The box's cascade.
 * @returns The pseudo-elements, each with the part definition the mapping draws it from.
 */
export function pseudoParts(cascade: BoxCascade): readonly PseudoPart[] {
  return cascade.pseudoElements.map(({ pseudo, cascade: own }) => {
    own.style.read(
      "content",
      (value) => (EMPTY_CONTENT.has(normalizeCss(value)) ? value : undefined),
      () => ({
        outcome: "dropped",
        detail: "an empty string generates the box the layer draws, with no text",
      }),
      []
    );
    const key = `::${pseudo}`;
    const generated: PartDefinition = {
      key,
      slot: undefined,
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
    };
    // An `::after` follows the box's label and end icons, as a part whose `after` names the label does.
    const child: PartDefinition = pseudo === "after" ? { ...generated, after: "label" } : generated;
    return { pseudo, child, cascade: own };
  });
}
