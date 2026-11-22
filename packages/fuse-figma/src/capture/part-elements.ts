/**
 * The captured elements a box's parts, instance parts and icons stand for: found below the box's
 * element in the composite's markup, or taken from the inner set's own capture of an instance part,
 * and the classes the composite passes an instance part's inner root.
 */

import { KitUnmappable } from "../components/build-errors.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CapturedElement, SetCapture } from "./capture-format.ts";
import type { CellRead } from "./cell-read.ts";

/**
 * The elements from below a box down to the element at a place, an element-ordinal path such as
 * `field/1/0` from the nearest element above with that `data-slot`.
 */
export function elementsAtPlace(
  path: readonly { readonly element: CapturedElement }[],
  place: string
): readonly CapturedElement[] | undefined {
  const [slot, ...steps] = place.split("/");
  const from = path.findLast((placed) => placed.element.attributes["data-slot"] === slot)?.element;
  if (from === undefined) {
    return undefined;
  }
  const below: CapturedElement[] = [];
  let at = from;
  for (const step of steps) {
    const child = at.children[Number(step)];
    if (child === undefined) {
      return undefined;
    }
    below.push(child);
    at = child;
  }
  const box = path.at(-1)?.element;
  const boxAt = box === undefined ? -1 : below.indexOf(box);
  return boxAt >= 0 ? below.slice(boxAt + 1) : below;
}

/**
 * The elements from below a box down to the first one with a `data-slot` that no earlier part of the
 * box claimed, through elements without one, or undefined where none sits below. A direct child
 * comes first. Otherwise the search goes depth first into each child without a `data-slot`, in DOM
 * order, so a match deep in the first such child wins over a shallower one in the second. The box's
 * parts claim their elements in DOM order, so a popup's rows each find their own.
 */
export function elementsWithSlot(
  box: CapturedElement,
  slot: string,
  claimed: ReadonlySet<CapturedElement>
): readonly CapturedElement[] | undefined {
  const direct = box.children.find((child) => child.attributes["data-slot"] === slot && !claimed.has(child));
  if (direct !== undefined) {
    return [direct];
  }
  for (const child of box.children) {
    if (child.attributes["data-slot"] !== undefined) {
      continue;
    }
    const below = elementsWithSlot(child, slot, claimed);
    if (below !== undefined) {
      return [child, ...below];
    }
  }
  return undefined;
}

/**
 * What a composite's instance part takes from the inner set's own capture: the classes the composite
 * passes the inner root, those it carries in the composite's capture beyond the ones the inner set's
 * own capture shows on its root in the same inner cell, that root, and the inner cell's key.
 */
type InstanceClasses = {
  readonly passed: ReadonlySet<string>;
  readonly own: CapturedElement;
  readonly capture: SetCapture;
  readonly cell: string;
};

export function passedClasses(
  read: CellRead,
  root: CapturedElement,
  set: string,
  cell: Cell,
  part: string
): InstanceClasses {
  const capture = read.captureOf(set);
  const inner = capture?.cells.find((each) =>
    Object.entries(cell).every(([axis, value]) => each.cell[axis] === value)
  );
  const own = inner?.roots[0].root;
  if (own === undefined || inner === undefined || capture === undefined) {
    throw new KitUnmappable({
      message: `the instance part ${part} shows ${set}, whose kept capture lacks the cell ${JSON.stringify(cell)}, so the build cannot tell the classes the composite passes`,
    });
  }
  const ownClasses = new Set(own.classes);
  return {
    passed: new Set(root.classes.filter((className) => !ownClasses.has(className))),
    own,
    capture,
    cell: inner.key,
  };
}

/**
 * The icons of a box in DOM order, each as the elements from below the box down to its `<svg>`. The
 * walk enters an element without a `data-slot`, and one that marks an icon's side with `data-icon`,
 * as the span around a pending Button's spinner does, but no other part.
 */
export function iconPaths(box: CapturedElement | undefined): CapturedElement[][] {
  const found: CapturedElement[][] = [];
  const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
    for (const child of element.children) {
      const here = [...path, child];
      if (child.tag === "svg") {
        found.push(here);
      } else if (child.attributes["data-slot"] === undefined || child.attributes["data-icon"] !== undefined) {
        visit(child, here);
      }
    }
  };
  if (box !== undefined) {
    visit(box, []);
  }
  return found;
}

/**
 * An element of another set's capture, and the elements below it, with its declarations added to
 * the cell's, so their indexes name them there.
 */
export function adopted(
  read: CellRead,
  element: CapturedElement,
  from: SetCapture,
  added: Map<number, number> = new Map()
): CapturedElement {
  const index = (each: number): number => {
    const known = added.get(each);
    const declaration = from.declarations[each];
    if (known !== undefined || declaration === undefined) {
      return known ?? each;
    }
    read.declarations.push(declaration);
    added.set(each, read.declarations.length - 1);
    return read.declarations.length - 1;
  };
  return {
    ...element,
    declarations: element.declarations.map(index),
    initial: element.initial.map(index),
    pseudo: Object.fromEntries(Object.entries(element.pseudo).map(([name, list]) => [name, list.map(index)])),
    children: element.children.map((child) => adopted(read, child, from, added)),
  };
}
