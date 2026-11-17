/**
 * The parts Dialog and Alert dialog share, as Fuse's Dialog renders both: a `Dialog.Content` popup
 * holding a title, a description and a footer row of actions.
 *
 * - The title is Base UI's `<h2>` and the description its `<p>`. The copy differs by cell, so no
 *   TEXT property sets either.
 */
import type { InstanceManifest, PartManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/**
 * The title, Base UI's `<h2>`, holding a cell's copy.
 *
 * @param charactersFor - The cell's title copy.
 * @returns The part.
 */
export function dialogTitleManifest(charactersFor: (cell: Cell) => string): PartManifest {
  return {
    key: "title",
    slot: "dialog-title",
    shownIn: always,
    label: { key: "text", name: "text", charactersFor, shownIn: always },
    iconsFor: () => [],
  };
}

/**
 * The description, Base UI's `<p>`, holding a cell's copy.
 *
 * @param charactersFor - The cell's description copy.
 * @returns The part.
 */
export function dialogDescriptionManifest(charactersFor: (cell: Cell) => string): PartManifest {
  return {
    key: "description",
    slot: "dialog-description",
    shownIn: always,
    label: { key: "text", name: "text", charactersFor, shownIn: always },
    iconsFor: () => [],
  };
}

/**
 * The footer row, holding the popup's actions.
 *
 * @param parts - The footer's parts, in DOM order.
 * @returns The part.
 */
export function dialogFooterManifest(parts: readonly (PartManifest | InstanceManifest)[]): PartManifest {
  return {
    key: "footer",
    slot: "dialog-footer",
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts,
  };
}
