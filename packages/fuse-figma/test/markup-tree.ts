/**
 * Queries over the static markup a kit cell renders, which `markup-check.ts` reads: an element's
 * ancestors, the elements inside the measured root that name a variant, the elements with a
 * `data-slot` around the root, and the parts, icons, labels and images the markup holds, each found
 * as the markup check's rules in `src/compare/kit-markup.test.ts` place them.
 */
import { splitClasses } from "../src/components/cascade.ts";
import { splitClassName } from "../src/components/class-name.ts";
import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  ElementSelector,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "../src/components/component-spec.ts";
import { selects } from "./static-markup.ts";
import type { MarkupElement } from "./static-markup.ts";

/** The ancestors of an element, its parent first. */
export function ancestorsOf(elements: readonly MarkupElement[], index: number): readonly MarkupElement[] {
  const parent = elements[index]?.parent;
  const element = parent === undefined ? undefined : elements[parent];
  return parent === undefined || element === undefined ? [] : [element, ...ancestorsOf(elements, parent)];
}

/** The indexes of an element's ancestors, nearest first. */
export function ancestorIndexes(elements: readonly MarkupElement[], index: number): readonly number[] {
  const parent = elements[index]?.parent;
  return parent === undefined ? [] : [parent, ...ancestorIndexes(elements, parent)];
}

/** The siblings before an element, those of its parent's children that come first in the markup. */
export function siblingsBefore(elements: readonly MarkupElement[], index: number): readonly MarkupElement[] {
  const parent = elements[index]?.parent;
  return elements.slice(0, index).filter((element) => element.parent === parent);
}

/** Whether an element sits inside another, at any depth. */
export function inside(elements: readonly MarkupElement[], index: number, outer: number): boolean {
  const parent = elements[index]?.parent;
  return parent !== undefined && (parent === outer || inside(elements, parent, outer));
}

/** Whether an element is one of `instances` or sits inside one, whose markup the inner set owns. */
function ownedByInstance(
  elements: readonly MarkupElement[],
  index: number,
  instances: ReadonlySet<number>
): boolean {
  const parent = elements[index]?.parent;
  return instances.has(index) || (parent !== undefined && ownedByInstance(elements, parent, instances));
}

/**
 * The elements inside the measured element whose `class` holds a class with the variant, outside the
 * instance parts, whose markup the inner set's own renderer test owns.
 *
 * @param instances - The elements of the instance parts the cell renders.
 */
export function elementsNaming(
  elements: readonly MarkupElement[],
  measured: number,
  variant: string,
  instances: ReadonlySet<number> = new Set()
): readonly number[] {
  return elements.flatMap((element, index) =>
    inside(elements, index, measured) &&
    !ownedByInstance(elements, index, instances) &&
    splitClasses(element.attributes.get("class") ?? "").some((className) =>
      splitClassName(className).variants.includes(variant)
    )
      ? [index]
      : []
  );
}

/**
 * The elements with a `data-slot` around the measured element, from the outermost one whose slot a
 * definition names as an ancestor inward, each as its `data-slot` and `class`. An element outside
 * that one, such as Breadcrumb's root around its list, styles nothing the definition claims.
 *
 * @param slots - The `data-slot` of each ancestor the definition names in the cell.
 */
export function markupAncestors(
  elements: readonly MarkupElement[],
  measured: number,
  slots: ReadonlySet<string>
): readonly (readonly [string | undefined, string | undefined])[] {
  const slotted = ancestorsOf(elements, measured)
    .toReversed()
    .filter((element) => element.attributes.has("data-slot"));
  const outermost = slotted.findIndex((element) => slots.has(element.attributes.get("data-slot") ?? ""));
  return outermost === -1
    ? []
    : slotted
        .slice(outermost)
        .map((element) => [element.attributes.get("data-slot"), element.attributes.get("class")] as const);
}

/**
 * An icon as the markup holds it, in the terms of an icon slot, with the part that lists it:
 * its nearest ancestor that is the root or one of its parts, by its part path, `""` for the root.
 * `direct` means a child of that part.
 */
export type MarkupIcon = Pick<IconSlot, "direct" | "dataIcon"> & {
  readonly owner: string;
  /** A slot's own `classes`, or an `<svg>`'s `class` attribute. */
  readonly classes: string | undefined;
};

/**
 * The `<svg>` elements inside the measured element, each with its owning part and the
 * `data-icon` it or its parent carries. An icon inside an instance part belongs to the inner set.
 *
 * @param owners - The part path of the measured element, `""`, and of each part element the check
 *   found.
 * @param instances - The elements of the instance parts the check found, whose icons it skips.
 */
export function markupIcons(
  elements: readonly MarkupElement[],
  owners: ReadonlyMap<number, string>,
  instances: ReadonlySet<number> = new Set()
): readonly MarkupIcon[] {
  return elements.flatMap((element, index): MarkupIcon[] => {
    const owner = partOwner(elements, index, owners);
    const path = owner === undefined ? undefined : owners.get(owner);
    if (element.name !== "svg" || path === undefined || (owner !== undefined && instances.has(owner))) {
      return [];
    }
    const direct = element.parent === owner;
    const parent = element.parent === undefined ? undefined : elements[element.parent];
    const marker =
      element.attributes.get("data-icon") ?? (direct ? undefined : parent?.attributes.get("data-icon"));
    return [
      {
        owner: path,
        direct,
        dataIcon: marker === "inline-start" || marker === "inline-end" ? marker : undefined,
        classes: element.attributes.get("class"),
      },
    ];
  });
}

/** Whether an element is the definition's root: the one its `element` selects, or its `data-slot`'s. */
export function isRoot(definition: ComponentDefinition, element: MarkupElement): boolean {
  return definition.element === undefined
    ? element.attributes.get("data-slot") === definition.slot
    : selects(definition.element, element);
}

/** How a part path names a part with no `data-slot`, which the markup can only find by place. */
const UNNAMED = "(no data-slot)";

/**
 * How a part path names a part: by its `data-slot`, by its key in parentheses where it names its
 * element, or as {@link UNNAMED} where the markup can only find it by place. An instance part is named
 * by its key in parentheses, since two instances of one component share their inner root's slot, and
 * a part whose `data-slot` a sibling shares by its slot and its key, as a trail's items are.
 *
 * @param part - The part.
 * @param siblings - Every part of the part's parent, the part among them.
 * @returns The segment.
 */
export function pathSegment(
  part: PartDefinition | InstanceDefinition,
  siblings: readonly (PartDefinition | InstanceDefinition)[]
): string {
  if ("kind" in part) {
    return `(${part.key})`;
  }
  if (part.slot === undefined) {
    return part.element === undefined ? UNNAMED : `(${part.key})`;
  }
  const shared = siblings.some((other) => other !== part && !("kind" in other) && other.slot === part.slot);
  return shared ? `${part.slot}(${part.key})` : part.slot;
}

/** The `data-slot` of a part's element, undefined for an element that carries none. */
function partSlot(part: PartDefinition | InstanceDefinition): string | undefined {
  return "kind" in part ? (part.of.element === undefined ? part.of.slot : undefined) : part.slot;
}

/** The selector of a part's element, undefined for one its `data-slot` or its place names. */
function partElement(part: PartDefinition | InstanceDefinition): ElementSelector | undefined {
  return "kind" in part ? part.of.element : part.element;
}

/**
 * Whether an element is the visually hidden `<span role="presentation">` Base UI's `MeterRoot`
 * appends to the root, which the kit draws no layer for.
 */
function isHiddenPresentation(element: MarkupElement): boolean {
  return (
    element.name === "span" &&
    element.attributes.get("role") === "presentation" &&
    element.attributes.get("data-slot") === undefined &&
    (element.attributes.get("style") ?? "").includes("clip-path:inset(50%)")
  );
}

/** A part a parent holds: a frame, or an instance of another set. */
type AnyPart = PartDefinition | InstanceDefinition;

/**
 * Whether a cell renders a part with the given BOOLEAN properties, each of which starts false, turned
 * on: where the part's `shownIn` holds, and, behind a property, where the property starts true or is
 * among `turnedOn`.
 *
 * @param part - A frame or an instance part.
 * @param cell - The cell.
 * @param turnedOn - The BOOLEAN properties that start false which the rendering turns on.
 * @returns Whether the markup holds the part.
 */
export function rendersIn(part: AnyPart, cell: Cell, turnedOn: ReadonlySet<string>): boolean {
  const { optional } = part;
  return (
    part.shownIn(cell) && (optional === undefined || optional.defaultValue || turnedOn.has(optional.name))
  );
}

/** The part among a parent's own parts whose `element` selects an element. */
function selectedPart(parts: readonly AnyPart[], element: MarkupElement): AnyPart | undefined {
  return parts.find((part) => {
    const selector = partElement(part);
    return selector !== undefined && selects(selector, element);
  });
}

/**
 * The child element of a part that is a part with no `data-slot`: the one child left beside the
 * parts the definition names by `data-slot`, the parts the parent's own `parts` select, and Base
 * UI's hidden span, where it is no `<svg>`, which an icon slot checks, and carries no `data-slot`.
 */
function unnamedChild(
  elements: readonly MarkupElement[],
  parent: number,
  slots: ReadonlySet<string>,
  parts: readonly AnyPart[]
): number | undefined {
  const children = elements.flatMap((element, child) => {
    const slot = element.attributes.get("data-slot");
    const named = (slot !== undefined && slots.has(slot)) || selectedPart(parts, element) !== undefined;
    return element.parent === parent && !named && !isHiddenPresentation(element) ? [child] : [];
  });
  const [only] = children;
  const element = only === undefined ? undefined : elements[only];
  return children.length === 1 &&
    element?.name !== "svg" &&
    element?.attributes.get("data-slot") === undefined
    ? only
    : undefined;
}

/**
 * Whether an element is the bare child a box holds its label's text in, as Item's actions hold
 * theirs in a `<span>`, which is the label's and no part.
 */
function holdsLabel(box: BoxDefinition | undefined, element: MarkupElement): boolean {
  const selector = box?.label?.textElement;
  return selector !== undefined && selects(selector, element);
}

/** The nearest ancestor of an element among `found`: the measured element and the parts found so far. */
function partOwner(
  elements: readonly MarkupElement[],
  index: number,
  found: ReadonlyMap<number, unknown>
): number | undefined {
  const parent = elements[index]?.parent;
  return parent === undefined || found.has(parent) ? parent : partOwner(elements, parent, found);
}

/**
 * A box the check found in the markup: its part path, and the part whose own parts scope the elements
 * below it, undefined for an element that is no part of its parent, which the path check then fails.
 * An instance part's inner component owns the elements below it, so the check looks no further there.
 */
type FoundBox = { readonly path: string; readonly box: BoxDefinition | InstanceDefinition | undefined };

/**
 * The part an element takes among the parts of its parent that the cell renders and that name it:
 * the first for the first such element below the parent, the second for the second, in DOM order, as
 * two instances of one component sit side by side. An element past the last takes the last, so the
 * path check counts it twice.
 */
function inOrder(
  candidates: readonly AnyPart[],
  counts: Map<string, number>,
  key: string
): AnyPart | undefined {
  const seen = counts.get(key) ?? 0;
  counts.set(key, seen + 1);
  return candidates[Math.min(seen, candidates.length - 1)];
}

/**
 * Each part the markup renders inside the measured element: its path and its element, once per
 * element, so two elements at one path stay two entries.
 * An element whose `data-slot` names a box of the definition is a part, below its nearest part, and
 * so is an element that one of that part's own parts selects by its `element`. Parts of one parent
 * that the cell renders and that name the same elements take them in DOM order. An element with no
 * `data-slot` is a part when it is the {@link unnamedChild} of a part. That is where Radio's dot
 * sits, alone in the indicator, and Meter's header, beside the bar and the hidden span. An instance
 * part is found the same way, by its inner root's `data-slot` or element, and the elements below it
 * belong to the inner set, so none of them is a part.
 *
 * @param cell - The cell, which says which parts render.
 * @param turnedOn - The BOOLEAN properties that start false which the rendering turns on, whose parts
 *   render too.
 */
export function markupParts(
  elements: readonly MarkupElement[],
  measured: number,
  definition: ComponentDefinition,
  slots: ReadonlySet<string>,
  cell: Cell,
  turnedOn: ReadonlySet<string>
): readonly (readonly [string, number])[] {
  const found = new Map<number, FoundBox>([[measured, { path: "", box: definition }]]);
  const counts = new Map<string, number>();
  // Elements come in document order, so a part is found before its descendants are visited.
  for (const [index, element] of elements.entries()) {
    const owner = partOwner(elements, index, found);
    const parent = owner === undefined ? undefined : found.get(owner);
    if (
      owner === undefined ||
      parent === undefined ||
      index === measured ||
      (parent.box !== undefined && "kind" in parent.box)
    ) {
      continue;
    }
    const parts = parent.box?.parts ?? [];
    const rendered = parts.filter((part) => rendersIn(part, cell, turnedOn));
    const slot = element.attributes.get("data-slot");
    const selected = selectedPart(parts, element);
    if (slot !== undefined && slots.has(slot)) {
      const part = inOrder(
        rendered.filter((candidate) => partSlot(candidate) === slot),
        counts,
        `${owner} [data-slot=${slot}]`
      );
      found.set(index, {
        path: `${parent.path}/${part === undefined ? slot : pathSegment(part, parts)}`,
        box: part ?? parts.find((candidate) => partSlot(candidate) === slot),
      });
    } else if (selected !== undefined) {
      const part =
        inOrder(
          rendered.filter((candidate) => {
            const selector = partElement(candidate);
            return selector !== undefined && selects(selector, element);
          }),
          counts,
          `${owner} ${pathSegment(selected, parts)}`
        ) ?? selected;
      found.set(index, { path: `${parent.path}/${pathSegment(part, parts)}`, box: part });
    } else if (
      element.parent === owner &&
      unnamedChild(elements, owner, slots, parts) === index &&
      !holdsLabel(parent.box, element)
    ) {
      const byPlace = parts.find((part) => partSlot(part) === undefined && partElement(part) === undefined);
      found.set(index, { path: `${parent.path}/${UNNAMED}`, box: byPlace });
    }
  }
  return [...found].flatMap(([index, { path }]): [string, number][] => (path === "" ? [] : [[path, index]]));
}

/**
 * A box's label as its markup holds it: the box's own text, and the attribute the label names with
 * the value it holds there.
 */
export type MarkupLabel = {
  readonly text: string;
  readonly attribute: readonly [name: string, value: string | undefined] | undefined;
};

/**
 * The element whose own text holds a box's label: the box's element, or, where the label names a
 * `textElement`, the one child of it that the selector matches, while that child carries no `class`
 * or `style` and the box holds no text of its own beside it. Undefined where the markup breaks
 * that, so the label check fails.
 */
export function labelHolder(
  elements: readonly MarkupElement[],
  index: number | undefined,
  box: BoxDefinition
): MarkupElement | undefined {
  const element = index === undefined ? undefined : elements[index];
  const selector = box.label?.textElement;
  if (selector === undefined || element === undefined) {
    return element;
  }
  const children = elements.filter((child) => child.parent === index && selects(selector, child));
  const [only] = children;
  const bare = only !== undefined && !only.attributes.has("class") && !only.attributes.has("style");
  return children.length === 1 && bare && element.text === "" ? only : undefined;
}

/** The label an element holds, read where `expected` says it sits. */
export function markupLabel(element: MarkupElement | undefined, expected: MarkupLabel): MarkupLabel {
  const name = expected.attribute?.[0];
  return {
    text: element?.text ?? "",
    attribute: name === undefined ? undefined : [name, element?.attributes.get(name)],
  };
}

/**
 * The picture an element shows: its name and the payload of the data URI in its `src`, or the whole
 * `src` where it is no base64 image data URI, or nothing for an element without one.
 */
export function markupImage(
  element: MarkupElement | undefined
): readonly [element: string, bytes: string] | undefined {
  const src = element?.attributes.get("src");
  return element === undefined || src === undefined
    ? undefined
    : [element.name, src.replace(/^data:image\/(?:png|jpeg|gif);base64,/, "")];
}
