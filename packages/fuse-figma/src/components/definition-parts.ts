/**
 * The parts below a definition's box: its frame parts, which the set draws as frames, and its
 * instance parts, which it draws as instances of other sets. An instance part's inner component holds
 * parts of its own, which belong to the inner set, so these walks stop at an instance.
 */
import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { matrixCells } from "./component-spec";

/**
 * The frame parts directly below a box.
 *
 * @param box - A definition's root or a part.
 * @returns The box's own frame parts, in DOM order.
 */
export function framePartsOf(box: BoxDefinition): readonly PartDefinition[] {
  return (box.parts ?? []).flatMap((part) => ("kind" in part ? [] : [part]));
}

/**
 * Every frame part below a box, depth first.
 *
 * @param box - A definition's root or a part.
 * @returns Each frame part, before the frame parts below it.
 */
export function partsOf(box: BoxDefinition): readonly PartDefinition[] {
  return framePartsOf(box).flatMap((part) => [part, ...partsOf(part)]);
}

/**
 * Every part below a box, depth first: the frame parts and the instance parts they hold, without the
 * parts an instance's inner component holds.
 *
 * @param box - A definition's root or a part.
 * @returns Each part, before the parts below it.
 */
export function allPartsOf(box: BoxDefinition): readonly (PartDefinition | InstanceDefinition)[] {
  return (box.parts ?? []).flatMap((part) => ("kind" in part ? [part] : [part, ...allPartsOf(part)]));
}

/**
 * The `data-slot` a definition's root element carries in a cell: the slot `elementSlot` gives the
 * cell, as a family stamps its own on a shared Menu separator, else its `slot`.
 *
 * @param definition - A component.
 * @param cell - One of its cells.
 * @returns The slot.
 */
export function rootSlotOf(definition: ComponentDefinition, cell: Cell): string {
  return definition.elementSlot?.(cell) ?? definition.slot;
}

/**
 * The `data-slot` an instance part's inner root carries in place: the slot the outer component stamps
 * on it, or the inner root's own in the inner cell.
 *
 * @param part - An instance part.
 * @param inner - The inner cell the part renders.
 * @returns The slot, or undefined for an inner root that carries none.
 */
export function instanceRootSlotOf(part: InstanceDefinition, inner: Cell): string | undefined {
  return part.slot ?? rootSlotOf(part.of, inner);
}

/**
 * Every instance part below a box, depth first, without those an instance's inner component holds.
 *
 * @param box - A definition's root or a part.
 * @returns The instance parts.
 */
export function instancePartsOf(box: BoxDefinition): readonly InstanceDefinition[] {
  return allPartsOf(box).flatMap((part) => ("kind" in part ? [part] : []));
}

/**
 * Every `data-slot` a definition's root carries where the markup renders it: its own in each of its
 * cells, as `elementSlot` gives a cell one of a family's, and the one each instance part that shows
 * it stamps on it in place, as an outer component renames a middle one's root.
 *
 * @param definition - The definition.
 * @param definitions - The kit's definitions, whose instance parts can show it.
 * @returns The slots.
 */
function renderedRootSlots(
  definition: ComponentDefinition,
  definitions: readonly ComponentDefinition[]
): ReadonlySet<string> {
  const own = matrixCells(definition.axes).map((cell) => rootSlotOf(definition, cell));
  const stamped = definitions.flatMap((outer) =>
    instancePartsOf(outer)
      .filter((part) => part.of.key === definition.key)
      .flatMap((part) =>
        matrixCells(outer.axes)
          .filter((cell) => part.shownIn(cell))
          .flatMap((cell) => instanceRootSlotOf(part, part.cell(cell)) ?? [])
      )
  );
  return new Set([definition.slot, ...own, ...stamped]);
}

/**
 * The root `data-slot`s of each set that holds another as an instance part, by the inner set's key,
 * as Select popup's manifest holds Select item's rows inside its `select-content` root. The
 * manifests' instance graph says which set composes which, so a set that holds none, as Sidebar,
 * is in no entry. A holder's root counts by every slot it carries where the markup renders it, as
 * {@link renderedRootSlots} lists them, so an outer component that renames it keeps the boundary.
 *
 * @param definitions - The kit's definitions, each from its manifest.
 * @returns The holders' root slots, by the key of the set they hold.
 */
export function instancingSlots(
  definitions: readonly ComponentDefinition[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const slots = new Map<string, Set<string>>();
  for (const definition of definitions) {
    const roots = renderedRootSlots(definition, definitions);
    for (const part of instancePartsOf(definition)) {
      slots.set(part.of.key, new Set([...(slots.get(part.of.key) ?? []), ...roots]));
    }
  }
  return slots;
}
