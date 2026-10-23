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
  ComponentDefinition,
  IconSlot,
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

/** The elements inside the measured element whose `class` holds a class with the variant. */
export function elementsNaming(
  elements: readonly MarkupElement[],
  measured: number,
  variant: string
): readonly number[] {
  return elements.flatMap((element, index) =>
    inside(elements, index, measured) &&
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
 * `data-icon` it or its parent carries.
 *
 * @param owners - The part path of the measured element, `""`, and of each part element the check
 *   found.
 */
export function markupIcons(
  elements: readonly MarkupElement[],
  owners: ReadonlyMap<number, string>
): readonly MarkupIcon[] {
  return elements.flatMap((element, index): MarkupIcon[] => {
    const owner = partOwner(elements, index, owners);
    const path = owner === undefined ? undefined : owners.get(owner);
    if (element.name !== "svg" || path === undefined) {
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
 * element, or as {@link UNNAMED} where the markup can only find it by place.
 */
export function pathSegment(part: PartDefinition): string {
  return part.slot ?? (part.element === undefined ? UNNAMED : `(${part.key})`);
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

/** The part among a parent's own parts whose `element` selects an element. */
function selectedPart(parts: readonly PartDefinition[], element: MarkupElement): PartDefinition | undefined {
  return parts.find((part) => part.element !== undefined && selects(part.element, element));
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
  parts: readonly PartDefinition[]
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
 * A box the check found in the markup: its part path, and the definition whose own parts scope the
 * elements below it, undefined for an element that is no part of its parent, which the path check
 * then fails.
 */
type FoundBox = { readonly path: string; readonly box: BoxDefinition | undefined };

/**
 * Each part the markup renders inside the measured element: its path and its element, once per
 * element, so two elements at one path stay two entries.
 * An element whose `data-slot` names a box of the definition is a part, below its nearest part, and
 * so is an element that one of that part's own parts selects by its `element`. An element with no
 * `data-slot` is a part when it is the {@link unnamedChild} of a part. That is where Radio's dot
 * sits, alone in the indicator, and Meter's header, beside the bar and the hidden span.
 */
export function markupParts(
  elements: readonly MarkupElement[],
  measured: number,
  definition: ComponentDefinition,
  slots: ReadonlySet<string>
): readonly (readonly [string, number])[] {
  const found = new Map<number, FoundBox>([[measured, { path: "", box: definition }]]);
  // Elements come in document order, so a part is found before its descendants are visited.
  for (const [index, element] of elements.entries()) {
    const owner = partOwner(elements, index, found);
    const parent = owner === undefined ? undefined : found.get(owner);
    if (owner === undefined || parent === undefined || index === measured) {
      continue;
    }
    const parts = parent.box?.parts ?? [];
    const slot = element.attributes.get("data-slot");
    const selected = selectedPart(parts, element);
    if (slot !== undefined && slots.has(slot)) {
      found.set(index, { path: `${parent.path}/${slot}`, box: parts.find((part) => part.slot === slot) });
    } else if (selected !== undefined) {
      found.set(index, { path: `${parent.path}/${pathSegment(selected)}`, box: selected });
    } else if (
      element.parent === owner &&
      unnamedChild(elements, owner, slots, parts) === index &&
      !holdsLabel(parent.box, element)
    ) {
      const byPlace = parts.find((part) => part.slot === undefined && part.element === undefined);
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
