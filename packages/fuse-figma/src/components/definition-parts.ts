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
 * The `data-slot` a definition's root element carries in a cell: its `slot`, unless `element` names
 * the element, which carries the slot `elementSlot` gives the cell, or none.
 *
 * @param definition - A component.
 * @param cell - One of its cells.
 * @returns The slot, or undefined for a root element that carries none.
 */
export function rootSlotOf(definition: ComponentDefinition, cell: Cell): string | undefined {
  return definition.element === undefined ? definition.slot : definition.elementSlot?.(cell);
}

/**
 * Every `data-slot` the markup renders for a part and the elements inside it, in the cells given, as
 * the DOM holds them: a frame's own and those below it, and an instance's inner root's in each inner
 * cell the part shows and those its inner component renders, through its own instance parts in turn.
 * A definition the walk is already inside adds nothing again, so a cycle of instance parts ends.
 *
 * @param part - A frame or an instance part.
 * @param cells - The cells of the definition that holds the part.
 * @returns The slots, depth first.
 */
export function renderedSlots(
  part: PartDefinition | InstanceDefinition,
  cells: readonly Cell[]
): readonly string[] {
  return slotsBelow(part, cells, new Set());
}

function slotsBelow(
  part: PartDefinition | InstanceDefinition,
  cells: readonly Cell[],
  inside: ReadonlySet<BoxDefinition>
): readonly string[] {
  if (!("kind" in part)) {
    return [...(part.slot === undefined ? [] : [part.slot]), ...partSlots(part, cells, inside)];
  }
  const { of } = part;
  if (inside.has(of)) {
    return [];
  }
  const shown = cells.filter((cell) => part.shownIn(cell)).map((cell) => part.cell(cell));
  const roots = shown.flatMap((cell) => rootSlotOf(of, cell) ?? []);
  return [...new Set(roots), ...partSlots(of, shown, new Set([...inside, of]))];
}

function partSlots(
  box: BoxDefinition,
  cells: readonly Cell[],
  inside: ReadonlySet<BoxDefinition>
): readonly string[] {
  return (box.parts ?? []).flatMap((part) => slotsBelow(part, cells, inside));
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
