/**
 * A part whose element generates no box: `display: contents`, as Selection item's `<label>` around
 * its control and its text sets. Such an element's children and pseudo-elements take its place in its
 * parent's flow (CSS Display 3 §2.5), so the kit draws no layer for it and lays its parts out in its
 * parent, each keyed under the wrapper's key, `label/control` for the wrapper `label`'s `control`, so
 * the lifted keys stay apart from the parent's own. The capture's `noBox` fact proves the element
 * generates no box in every mode and adds nothing else to the flow: no text of its own and no
 * `::before` or `::after` in flow, which would be boxes beside its parts (`capture/no-box.ts`). Its
 * cascade keeps its parent's path, and its declarations reach its parts as CSS inherits them. Its
 * `display` reads as the lift. Each of its own declarations that no layer reads and that does not
 * inherit sets nothing, since it has no box, and drops; one that inherits and that no part reads stays
 * to the coverage table's other reasons, unmapped where none applies. A non-painting pseudo-element
 * of its own reads as any box's does. A wrapper with a label, icons, or a pseudo-element the kit would
 * draw as a layer has nowhere to put them, so it stops the build, and so does one whose element the
 * capture records with text of its own, white space included, which would lay out as an anonymous
 * box beside its parts.
 */
import type { BoxCascade } from "./box-cascade";
import { KitUnmappable } from "./build-errors";
import type { Cell, InstanceDefinition, PartDefinition } from "./component-spec";
import { normalizeCss } from "./css-values";

/** How the coverage table names a wrapper's `display`. */
const LIFTED =
  "the element generates no box (display: contents), so the kit lays its parts out in its parent's flow";

/**
 * The parts of a wrapper that generates no box, keyed under its key, for its parent to lay out in its
 * own flow, and the wrapper's `display` read as that lift.
 *
 * @param wrapper - The wrapper part.
 * @param cascade - The wrapper's cascade, whose path is its parent's.
 * @param cell - The cell.
 * @returns The wrapper's parts, keyed under its key.
 */
export function liftParts(
  wrapper: PartDefinition,
  cascade: BoxCascade,
  cell: Cell
): readonly (PartDefinition | InstanceDefinition)[] {
  const why =
    wrapper.label !== undefined
      ? "shows a label"
      : wrapper.iconsFor(cell).length > 0
        ? "shows icons"
        : cascade.pseudoElements.length > 0
          ? "paints a pseudo-element of its own"
          : (cascade.elementText ?? "") !== ""
            ? "holds text of its own"
            : undefined;
  if (why !== undefined) {
    throw new KitUnmappable({
      message: `the part ${wrapper.key} generates no box and ${why}, which its parent has no layer for`,
    });
  }
  cascade.style.read(
    "display",
    (value) => (normalizeCss(value) === "contents" ? value : undefined),
    () => ({ outcome: "literal", detail: LIFTED }),
    []
  );
  return (wrapper.parts ?? []).map((part) => ({ ...part, key: `${wrapper.key}/${part.key}` }));
}
