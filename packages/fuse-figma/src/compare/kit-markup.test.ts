/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one root part for the page to measure: the page measures, forces and crops the one element in
 * the slot whose `data-slot` is the definition's `slot`, or the one its `element` selects where the
 * root carries no `data-slot`, at any depth, so none or two would compare the wrong box. A radio
 * renders inside its `RadioGroup`, so its root is not at the top.
 *
 * Unit under test: each kit definition's attribute conditions, the cells where its state table
 * holds each variant of `ATTRIBUTE_VARIANTS`, the parts each cell shows, the icon slots the
 * root and each part the cell renders list in `iconsFor`, and the label text each box draws.
 * Oracle: the static markup the real Fuse component renders for every preview cell, through the
 * definition's compare renderer. A condition must hold in a cell exactly when the measured
 * element carries the attribute its variant selects, and a condition a part's own classes name
 * must hold exactly when that part's element carries it. A group variant must hold exactly where the
 * root or an element around it is the group in that state, a parent-context variant such as
 * `item-described:` exactly where the root holds what it reads for the parts below it, and a tag
 * variant such as `[a]:` exactly where the root is that element. The parts must match the measured
 * element's descendants that carry a part's `data-slot` or that its `element` selects, each below
 * its parent part, and any other part with no `data-slot` must be the one child element of its
 * parent part beside those parts and Base UI's hidden span. The slots must match the measured
 * element's `<svg>` descendants in order, each under the part that lists it, its nearest ancestor
 * among the root and the parts, as a child of that part or nested deeper, and with its `data-icon`.
 * A slot that names classes of its own must name the `<svg>`'s `class` attribute exactly. The root
 * and each part must hold their label's characters where the cell shows the label, as their own
 * text, after a space where the label says the markup holds one, or in the attribute the label
 * names, as an `<input>` holds its placeholder, or as the own text of the one bare child element
 * its `textElement` names, as Pagination's edge holds its copy, and no text where it does not, so
 * the compare page renders the text Figma draws. A box that shows an image must be an `<img>` whose `src` is a data
 * URI of the image's bytes, and a box that shows none carries no `src`, so the page draws the
 * picture Figma draws. A part's `style` attribute must hold exactly the declarations its
 * definition cascades above its classes, so a meter's fill is as wide in Figma as Base UI makes
 * it. The elements around the measured element must carry each ancestor its definition names,
 * outermost first, with its `data-slot` and exactly its classes, and no other element with a
 * `data-slot` may sit between the outermost of them and the root, so the page draws the root in the
 * type and color the build passes down. The pseudo-class variants, `enabled-hover:`, `hover:` and `focus-visible:`, stay out, since
 * static markup cannot show them, and so does the icon edge, which the slots check. On a React Aria
 * element marked `data-rac`, `hover:` and `enabled-hover:` read `data-hovered`, which React Aria
 * stamps only while a hydrated page is hovered, so the renderer names it in its forced attributes,
 * which the page writes on the measured element when it forces the cell's state. There both must
 * hold exactly where those attributes carry `data-hovered`.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chip, ICON } from "../../test/fixture-sets";
import { elementsOf, selects } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { splitClasses } from "../components/cascade";
import { splitClassName } from "../components/class-name";
import { definitionClasses, variantKey } from "../components/component-spec";
import type {
  AncestorDefinition,
  BoxDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  PartDefinition,
} from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { labelCharacters } from "../components/label-layout";
import { makeStateTable } from "../components/state-table";
import { forcedAttributesFor, loadRenderers, renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";

/**
 * Whether an element matches each attribute variant, as Tailwind and fuse.css compile it:
 * `disabled:` is `:disabled`, which a `<button>` matches through its attribute, `aria-*:` matches
 * the value `true`, and `data-*:` matches the attribute's presence.
 */
const ATTRIBUTE_VARIANTS = new Map<string, (element: MarkupElement) => boolean>([
  ["disabled", (element) => element.attributes.has("disabled")],
  ["data-disabled", (element) => element.attributes.has("data-disabled")],
  ["aria-disabled", (element) => element.attributes.get("aria-disabled") === "true"],
  ["aria-pressed", (element) => element.attributes.get("aria-pressed") === "true"],
  ["data-pressed", (element) => element.attributes.has("data-pressed")],
  ["data-checked", (element) => element.attributes.has("data-checked")],
  ["data-unchecked", (element) => element.attributes.has("data-unchecked")],
  ["data-indeterminate", (element) => element.attributes.has("data-indeterminate")],
  // `aria-checked:` compiles to `[aria-checked="true"]`, which a mixed checkbox's
  // `aria-checked="mixed"` does not match.
  ["aria-checked", (element) => element.attributes.get("aria-checked") === "true"],
  ["aria-invalid", (element) => element.attributes.get("aria-invalid") === "true"],
  ["data-invalid", (element) => element.attributes.has("data-invalid")],
  ["data-[pending-indicator]", (element) => element.attributes.has("data-pending-indicator")],
  // `data-[armed=true]:` compiles to `[data-armed="true"]`, which ConfirmButton stamps while armed.
  ["data-[armed=true]", (element) => element.attributes.get("data-armed") === "true"],
  // fuse.css defines `data-horizontal:` and `data-vertical:` on `[data-orientation=…]`.
  ["data-horizontal", (element) => element.attributes.get("data-orientation") === "horizontal"],
  ["data-vertical", (element) => element.attributes.get("data-orientation") === "vertical"],
  // `placeholder:` styles `::placeholder`, which a control paints while it has a placeholder and no
  // value. React writes an input's `defaultValue` as the `value` attribute, and a textarea's as its
  // own text.
  [
    "placeholder",
    (element) =>
      element.attributes.has("placeholder") && (element.attributes.get("value") ?? element.text) === "",
  ],
  // The field box's read-only fill keys off the `readonly` attribute on an enabled control.
  [
    "[&[readonly]:not(:disabled)]",
    (element) => element.attributes.has("readonly") && !element.attributes.has("disabled"),
  ],
  // Base UI stamps `data-placeholder` on a Select trigger while nothing is selected.
  ["data-placeholder", (element) => element.attributes.has("data-placeholder")],
  // tailwindcss-react-aria-components compiles `invalid:` to `[data-invalid]` on an element marked
  // `data-rac`, and to `:invalid` on any other, a validity static markup does not hold, which no
  // set reads.
  ["invalid", (element) => element.attributes.has("data-rac") && element.attributes.has("data-invalid")],
]);

/**
 * The variants that read `data-hovered` on an element marked `data-rac`, which React Aria stamps
 * while the pointer is over it: tailwindcss-react-aria-components compiles `hover:` there to
 * `[data-hovered]`, and fuse.css's `enabled-hover:` reads `[data-rac][data-hovered]` on an element
 * that is not disabled.
 */
const REACT_ARIA_HOVER = ["hover", "enabled-hover"];

/** Whether an element carries a group marker, such as `group/field`, in its `class`. */
function marks(element: MarkupElement, marker: string): boolean {
  return (element.attributes.get("class") ?? "").split(/\s+/).includes(marker);
}

/**
 * Whether an ancestor matches each group variant, which selects the elements below it:
 * `group-data-disabled/field:` compiles to `:where(.group\/field)[data-disabled] *`, so it holds
 * below an element that carries the `group/field` marker and `data-disabled`, as a disabled
 * `Field.Root` does, and `group-data-[popup-open]/select-trigger:` holds below an open Select
 * trigger, as its caret is.
 */
const GROUP_VARIANTS = new Map<string, (ancestor: MarkupElement) => boolean>([
  [
    "group-data-disabled/field",
    (ancestor) => marks(ancestor, "group/field") && ancestor.attributes.has("data-disabled"),
  ],
  [
    "group-data-[popup-open]/select-trigger",
    (ancestor) => marks(ancestor, "group/select-trigger") && ancestor.attributes.has("data-popup-open"),
  ],
  // `group-data-[size=sm]/item:` holds below an Item row that carries `data-size="sm"`, as the image
  // media's `size-8` does.
  ...["default", "sm", "xs"].map((size): [string, (ancestor: MarkupElement) => boolean] => [
    `group-data-[size=${size}]/item`,
    (ancestor) => marks(ancestor, "group/item") && ancestor.attributes.get("data-size") === size,
  ]),
]);

/**
 * Whether the measured root holds what a parent-context variant reads, for each part directly below
 * it: fuse.css's `item-described:` compiles to
 * `:where(:has( > [data-slot="item-content"] > [data-slot="item-description"])) > &`, so it holds on
 * the children of a row whose content column holds a description.
 */
const PARENT_VARIANTS = new Map<string, (elements: readonly MarkupElement[], parent: number) => boolean>([
  [
    "item-described",
    (elements, parent) =>
      elements.some(
        (content, index) =>
          content.parent === parent &&
          content.attributes.get("data-slot") === "item-content" &&
          elements.some(
            (description) =>
              description.parent === index && description.attributes.get("data-slot") === "item-description"
          )
      ),
  ],
]);

/**
 * The variants that test the root's own tag: `[a]:` compiles to `:is(a)`. Each is checked on a set
 * whose definition gives it a meaning, since a link root of a set that never reads it, as React Aria's
 * Link, is an `<a>` too.
 */
const TAG_VARIANTS = new Map<string, (element: MarkupElement) => boolean>([
  ["[a]", (element) => element.name === "a"],
]);

/** The ancestors of an element, its parent first. */
function ancestorsOf(elements: readonly MarkupElement[], index: number): readonly MarkupElement[] {
  const parent = elements[index]?.parent;
  const element = parent === undefined ? undefined : elements[parent];
  return parent === undefined || element === undefined ? [] : [element, ...ancestorsOf(elements, parent)];
}

/**
 * The elements with a `data-slot` around the measured element, from the outermost one whose slot a
 * definition names as an ancestor inward, each as its `data-slot` and `class`. An element outside
 * that one, such as Breadcrumb's root around its list, styles nothing the definition claims.
 *
 * @param slots - The `data-slot` of each ancestor the definition names in the cell.
 */
function markupAncestors(
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
 * The condition variants static markup cannot check against the measured element's attributes:
 * the pseudo classes the page forces, the icon edge, which holds on a descendant, and the
 * breakpoints, which the page's viewport decides.
 */
const NOT_ATTRIBUTES = new Set([
  "enabled-hover",
  "hover",
  "focus-visible",
  "has-data-[icon=inline-start]",
  "has-data-[icon=inline-end]",
  "sm",
  "md",
]);

/**
 * An icon as the markup holds it, in the terms of an icon slot, with the part that lists it:
 * its nearest ancestor that is the root or one of its parts, by its part path, `""` for the root.
 * `direct` means a child of that part.
 */
type MarkupIcon = Pick<IconSlot, "direct" | "dataIcon"> & {
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
function markupIcons(
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

/** Every box of a definition, the root or a part, by the name its layer takes. */
function boxNames(box: BoxDefinition, name: string): readonly string[] {
  return [name, ...(box.parts ?? []).flatMap((part) => boxNames(part, part.slot ?? part.key))];
}

/** Whether an element is the definition's root: the one its `element` selects, or its `data-slot`'s. */
function isRoot(definition: ComponentDefinition, element: MarkupElement): boolean {
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
function pathSegment(part: PartDefinition): string {
  return part.slot ?? (part.element === undefined ? UNNAMED : `(${part.key})`);
}

/**
 * Each part a cell renders below a box, with its path, such as
 * `/radio-group-indicator/(no data-slot)`, each part named by its {@link pathSegment}.
 */
function slotParts(
  box: BoxDefinition,
  path: string,
  cell: Cell
): readonly { readonly path: string; readonly part: PartDefinition }[] {
  return (box.parts ?? [])
    .filter((part) => part.shownIn(cell))
    .flatMap((part) => {
      const partPath = `${path}/${pathSegment(part)}`;
      return [{ path: partPath, part }, ...slotParts(part, partPath, cell)];
    });
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
function markupParts(
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

/** The condition variants of `ATTRIBUTE_VARIANTS` that a box's own classes name in a cell. */
function attributeConditions(box: BoxDefinition, cell: Cell): ReadonlySet<string> {
  return new Set(
    splitClasses(box.classesFor(cell))
      .flatMap((className) => splitClassName(className).variants)
      .filter((variant) => ATTRIBUTE_VARIANTS.has(variant))
  );
}

/**
 * The icons a cell places in a box and the parts it renders below it, in DOM order: a part's
 * icons sit inside it, before the box's own. Each names its owner by the box's part path.
 */
function slotIcons(box: BoxDefinition, path: string, cell: Cell): readonly MarkupIcon[] {
  return [
    ...(box.parts ?? [])
      .filter((part) => part.shownIn(cell))
      .flatMap((part) => slotIcons(part, `${path}/${pathSegment(part)}`, cell)),
    ...box
      .iconsFor(cell)
      .map(({ direct, dataIcon, classes }) => ({ owner: path, direct, dataIcon, classes })),
  ];
}

/**
 * A box's label as its markup holds it: the box's own text, and the attribute the label names with
 * the value it holds there.
 */
type MarkupLabel = {
  readonly text: string;
  readonly attribute: readonly [name: string, value: string | undefined] | undefined;
};

/**
 * Where a box draws its label in a cell: the label's characters as the box's own text, after a space
 * where the label's `leadingSpace` says the markup holds one, or in the attribute the label names,
 * with no text of its own, as an `<input>` holds its placeholder. A box that shows no label in the
 * cell holds no text.
 */
function expectedLabel(box: BoxDefinition, cell: Cell): MarkupLabel {
  if (box.label?.shownIn(cell) !== true) {
    return { text: "", attribute: undefined };
  }
  const characters = labelCharacters(box.label, cell);
  const attribute = box.label.textAttribute?.(cell);
  const text = box.label.leadingSpace === true ? ` ${characters}` : characters;
  return attribute === undefined
    ? { text, attribute: undefined }
    : { text: "", attribute: [attribute, characters] };
}

/**
 * The `style` attribute a part's markup carries in a cell, as React writes it from a `style` prop:
 * each declaration as `property:value`, in order, joined by `;`. A part without `styleFor` carries
 * none.
 */
function expectedStyle(part: PartDefinition, cell: Cell): string | undefined {
  return part
    .styleFor?.(cell)
    .map(({ property, value }) => `${property}:${value}`)
    .join(";");
}

/**
 * The element whose own text holds a box's label: the box's element, or, where the label names a
 * `textElement`, the one child of it that the selector matches, while that child carries no `class`
 * or `style` and the box holds no text of its own beside it. Undefined where the markup breaks
 * that, so the label check fails.
 */
function labelHolder(
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
function markupLabel(element: MarkupElement | undefined, expected: MarkupLabel): MarkupLabel {
  const name = expected.attribute?.[0];
  return {
    text: element?.text ?? "",
    attribute: name === undefined ? undefined : [name, element?.attributes.get(name)],
  };
}

/**
 * The picture a box shows, as the markup would hold it: an `<img>` and its image's bytes, base64
 * encoded, or nothing for a box that shows none.
 */
function expectedImage(box: BoxDefinition): readonly [element: string, bytes: string] | undefined {
  return box.image === undefined ? undefined : ["img", Buffer.from(box.image()).toString("base64")];
}

/**
 * The picture an element shows: its name and the payload of the data URI in its `src`, or the whole
 * `src` where it is no base64 image data URI, or nothing for an element without one.
 */
function markupImage(
  element: MarkupElement | undefined
): readonly [element: string, bytes: string] | undefined {
  const src = element?.attributes.get("src");
  return element === undefined || src === undefined
    ? undefined
    : [element.name, src.replace(/^data:image\/(?:png|jpeg|gif);base64,/, "")];
}

/**
 * The markup's icons as the slots must list them: a slot that names no classes of its own makes
 * no claim about the `<svg>`'s, as Button's spinner leaves out its `animate-spin`.
 */
function claimedIcons(slots: readonly MarkupIcon[], markup: readonly MarkupIcon[]): readonly MarkupIcon[] {
  return markup.map((icon, index) =>
    slots[index]?.classes === undefined ? { ...icon, classes: undefined } : icon
  );
}

describe("each kit definition against the markup of its component", () => {
  it.each(KIT.map(({ definition }) => [definition.name, definition] as const))(
    "%s lists every attribute variant its facts, states and recipe conditions name",
    (_name, definition) => {
      const meaningOf = makeStateTable(definition);
      const recipeConditions = definitionClasses(definition)
        .flatMap((className) => splitClassName(className).variants)
        .filter((variant) => meaningOf(variant).kind === "condition");
      const named = new Set([
        ...definition.facts.keys(),
        ...Object.values(definition.states).flat(),
        ...recipeConditions,
      ]);
      const listed = [NOT_ATTRIBUTES, ATTRIBUTE_VARIANTS, GROUP_VARIANTS, PARENT_VARIANTS, TAG_VARIANTS];
      const unlisted = [...named].filter((variant) => !listed.some((list) => list.has(variant)));
      expect(unlisted).toEqual([]);
    }
  );

  it("renders one measured element per cell, holds each attribute condition exactly where it carries it, and places its parts, icons and label", async () => {
    const renderers = await loadRenderers();
    const checked = KIT.flatMap((entry) => {
      const renderer = renderers.get(entry.definition.key);
      return renderer === undefined ? [] : [{ ...entry, renderer }];
    });
    // No KIT key lacks a renderer.
    expect(checked.map(({ definition }) => definition.key)).toEqual(
      KIT.map(({ definition }) => definition.key)
    );
    for (const { definition, previewCells, renderer } of checked) {
      checkMarkup(definition, previewCells, renderer);
    }
  });
});

/**
 * Check a definition against its renderer's markup for each cell: the cell renders one measured
 * element, each attribute condition holds exactly where its element carries the attribute, and the
 * parts, icons, labels, images and styles sit where the definition says.
 */
function checkMarkup(definition: ComponentDefinition, cells: readonly Cell[], renderer: CellRendering): void {
  const meaningOf = makeStateTable(definition);
  const holdsIn = (variant: string, cell: Cell): boolean => {
    const meaning = meaningOf(variant);
    return meaning.kind === "condition" && meaning.holds(cell);
  };
  for (const cell of cells) {
    const key = variantKey(definition, cell);
    const elements = elementsOf(renderCellHtml(renderer, cell));
    const roots = elements.flatMap((element, index) =>
      isRoot(definition, element) ? [{ root: element, measured: index }] : []
    );
    expect(roots, `${key}: the ${definition.slot} parts`).toHaveLength(1);
    // The one root part the line above checks.
    for (const { root, measured } of roots) {
      for (const [variant, carries] of ATTRIBUTE_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(carries(root));
      }
      if (root.attributes.has("data-rac")) {
        const hovered = Object.hasOwn(forcedAttributesFor(renderer, cell), "data-hovered");
        for (const variant of REACT_ARIA_HOVER) {
          expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(hovered);
        }
      }
      // A variant the root's own classes name selects the root below its group, and any other one a
      // part or an icon below the root, so the root itself can be the group, as Select's trigger is
      // for its caret.
      const rootVariants = new Set(
        splitClasses(definition.classesFor(cell)).flatMap((className) => splitClassName(className).variants)
      );
      for (const [variant, matches] of GROUP_VARIANTS) {
        const ancestors = ancestorsOf(elements, measured);
        const groups = rootVariants.has(variant) ? ancestors : [root, ...ancestors];
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(groups.some(matches));
      }
      for (const [variant, holds] of PARENT_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(holds(elements, measured));
      }
      for (const [variant, matches] of TAG_VARIANTS) {
        if (meaningOf(variant).kind === "condition") {
          expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(matches(root));
        }
      }
      const ancestors = definition.ancestorsFor?.(cell) ?? [];
      expect(
        markupAncestors(elements, measured, new Set(ancestors.map(({ slot }) => slot))),
        `${key}: the ancestors`
      ).toEqual(ancestors.map(({ slot, classes }) => [slot, classes]));
      const rootLabel = expectedLabel(definition, cell);
      expect(
        markupLabel(labelHolder(elements, measured, definition), rootLabel),
        `${key}: the label`
      ).toEqual(rootLabel);
      expect(markupImage(root), `${key}: the image`).toEqual(expectedImage(definition));
      const names = new Set(boxNames(definition, definition.slot));
      const shown = slotParts(definition, "", cell);
      const rendered = markupParts(elements, measured, definition, names);
      const renderedPaths = rendered.map(([path]) => path);
      expect(shown.map(({ path }) => path).toSorted(), `${key}: parts`).toEqual(renderedPaths.toSorted());
      // One element per path, so the lookup below reads the only element at each path.
      expect(new Set(renderedPaths).size, `${key}: a part rendered twice`).toBe(renderedPaths.length);
      const elementAt = new Map(rendered);
      const owners = new Map([
        [measured, ""],
        ...rendered.map(([path, index]): [number, string] => [index, path]),
      ]);
      const slots = slotIcons(definition, "", cell);
      expect(slots, `${key}: icons`).toEqual(claimedIcons(slots, markupIcons(elements, owners)));
      for (const { path, part } of shown) {
        const index = elementAt.get(path);
        const element = index === undefined ? undefined : elements[index];
        const partLabel = expectedLabel(part, cell);
        expect(
          markupLabel(labelHolder(elements, index, part), partLabel),
          `${key}: the label on ${path}`
        ).toEqual(partLabel);
        expect(markupImage(element), `${key}: the image on ${path}`).toEqual(expectedImage(part));
        expect(element?.attributes.get("style"), `${key}: the style on ${path}`).toEqual(
          expectedStyle(part, cell)
        );
        for (const variant of attributeConditions(part, cell)) {
          expect(holdsIn(variant, cell), `${key}: ${variant} on ${path}`).toBe(
            element !== undefined && ATTRIBUTE_VARIANTS.get(variant)?.(element) === true
          );
        }
      }
    }
  }
}

// Unit under test: `checkMarkup` on a definition whose root and part name their elements, since the
// markup carries no `data-slot` there, as React Aria's Link renders an `<a data-rac>`. Oracle: the
// hand-written markup below, where exactly one `<a>` carries `data-rac` and `role="link"`, its one
// `aria-hidden` span is the part, and the `<svg>` child and the text `Chip` are the root's own. A
// second span sits beside the part, so the part cannot be found by its place.
describe("the markup check of a root without a data-slot", () => {
  const DOT: PartDefinition = {
    key: "dot",
    slot: undefined,
    element: { tag: "span", attributes: { "aria-hidden": "true" } },
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
  };
  const LINK = chip("", {
    element: { tag: "a", attributes: { "data-rac": true, role: "link" } },
    label: { key: "label", name: "label", characters: "Chip", textProperty: undefined, shownIn: () => true },
    iconsFor: () => [ICON],
    parts: [DOT],
  });
  const markup: CellRendering = {
    element: () =>
      createElement(
        "div",
        null,
        createElement(
          "a",
          { "data-rac": "", role: "link", href: "#" },
          createElement("span", { "aria-hidden": "true" }),
          createElement("span", { className: "sr-only" }, "opens a page"),
          createElement("svg"),
          "Chip"
        )
      ),
  };
  const CELLS = [{ state: "rest" }];

  it("places the root, its part and its icon by the elements they name", () => {
    expect(() => checkMarkup(LINK, CELLS, markup)).not.toThrow();
  });

  it("fails a root whose selector names an attribute value the markup does not hold", () => {
    const button: ComponentDefinition = {
      ...LINK,
      element: { tag: "a", attributes: { "data-rac": true, role: "button" } },
    };
    expect(() => checkMarkup(button, CELLS, markup)).toThrow("the chip parts");
  });
});

// Unit under test: `checkMarkup` on a React Aria root with a hover state. Oracle: React Aria stamps
// `data-hovered` on an element marked `data-rac` only while a hydrated page hovers it, which
// `hover:` reads there, so the renderer's forced attributes must carry it exactly in the cells where
// the state table holds `hover:`. The hand-written renderer stamps it on the hover cell where it
// passes, and nowhere where it fails.
describe("the markup check of a React Aria root's hover", () => {
  const DAY = chip("hover:bg-muted", {
    element: { tag: "div", attributes: { "data-rac": true } },
    axes: [{ name: "state", values: ["rest", "hover"] }],
  });
  const CELLS = [{ state: "rest" }, { state: "hover" }];
  const element = () => createElement("div", { "data-rac": "" });

  it("passes a renderer that names data-hovered for the hover cell", () => {
    const stamped: CellRendering = {
      element,
      forcedAttributes: (cell) => (cell.state === "hover" ? { "data-hovered": "true" } : {}),
    };
    expect(() => checkMarkup(DAY, CELLS, stamped)).not.toThrow();
  });

  it("fails a renderer that leaves the hover cell as static markup has it", () => {
    expect(() => checkMarkup(DAY, CELLS, { element })).toThrow("chip/state=hover: hover");
  });
});

/** A part with a `data-slot`, shown in every cell, holding the given parts. */
function slotted(slot: string, parts: readonly PartDefinition[]): PartDefinition {
  return {
    key: slot,
    slot,
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
    parts,
  };
}

/** A part with no `data-slot`, shown in every cell, that names its element as an `aria-hidden` span. */
function hiddenSpan(key: string, icons: readonly IconSlot[] = []): PartDefinition {
  return {
    key,
    slot: undefined,
    element: { tag: "span", attributes: { "aria-hidden": "true" } },
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => icons,
  };
}

/** Markup for a chip cell: a `data-slot="chip"` span around the given children. */
function chipMarkup(...children: readonly ReactElement[]): CellRendering {
  return { element: () => createElement("span", { "data-slot": "chip" }, ...children) };
}

/** The `aria-hidden` span `hiddenSpan` selects, around the given children. */
const hidden = (...children: readonly ReactElement[]): ReactElement =>
  createElement("span", { "aria-hidden": "true" }, ...children);

// Unit under test: `checkMarkup` on parts that name their elements below two slotted parents. Oracle:
// the README's rule that such a part matches the element its selector matches below its parent part,
// so the selector of the left parent's `leading` part says nothing about the right parent's span. The
// hand-written markup holds one `aria-hidden` span in each parent where it passes, and both in the
// left parent where it fails.
describe("the markup check of parts that share a selector under two parents", () => {
  const TWO_PARENTS = chip("", {
    parts: [slotted("chip-left", [hiddenSpan("leading")]), slotted("chip-right", [hiddenSpan("trailing")])],
  });
  const left = (...children: readonly ReactElement[]) =>
    createElement("span", { "data-slot": "chip-left" }, ...children);
  const right = (...children: readonly ReactElement[]) =>
    createElement("span", { "data-slot": "chip-right" }, ...children);
  const CELLS = [{ state: "rest" }];

  it("finds each span as the part its own parent names", () => {
    expect(() => checkMarkup(TWO_PARENTS, CELLS, chipMarkup(left(hidden()), right(hidden())))).not.toThrow();
  });

  it("fails markup that moves the right parent's span into the left parent", () => {
    expect(() => checkMarkup(TWO_PARENTS, CELLS, chipMarkup(left(hidden(), hidden()), right()))).toThrow(
      "chip/state=rest: parts"
    );
  });

  // Oracle: the icon slot `iconsFor` lists on the left parent's `content` part, an `<svg>` that is a
  // direct child of that part's element. The right parent's part has the same key and lists none.
  describe("with an icon on one of two same-keyed parts", () => {
    const ONE_ICON = chip("", {
      parts: [
        slotted("chip-left", [hiddenSpan("content", [ICON])]),
        slotted("chip-right", [hiddenSpan("content")]),
      ],
    });

    it("passes the icon in the part that lists it", () => {
      const markup = chipMarkup(left(hidden(createElement("svg"))), right(hidden()));
      expect(() => checkMarkup(ONE_ICON, CELLS, markup)).not.toThrow();
    });

    it("fails the icon moved to the other parent's part of that key", () => {
      const markup = chipMarkup(left(hidden()), right(hidden(createElement("svg"))));
      expect(() => checkMarkup(ONE_ICON, CELLS, markup)).toThrow("chip/state=rest: icons");
    });
  });
});

// Unit under test: `checkMarkup` on a definition that names the elements around its root. Oracle: the
// rule on `ComponentDefinition.ancestorsFor`, that the cell sits in those elements, outermost first,
// each carrying its `data-slot` and exactly its classes. The hand-written markup holds a trail, a list
// and an item around the chip where it passes, an element the definition does not name outside them,
// and breaks one rule where it fails.
describe("the markup check of the elements around a root", () => {
  const LIST: AncestorDefinition = { slot: "chip-list", classes: "flex gap-1", undrawn: "the list" };
  const ITEM: AncestorDefinition = { slot: "chip-item", classes: "inline-flex", undrawn: "the item" };
  const CELLS = [{ state: "rest" }];
  const around = (list: string, ...items: readonly string[]): CellRendering => ({
    element: () =>
      createElement(
        "nav",
        { "data-slot": "chip-trail" },
        createElement(
          "ol",
          { "data-slot": "chip-list", className: list },
          items.reduceRight<ReactElement>(
            (inner, item) => createElement("li", { "data-slot": "chip-item", className: item }, inner),
            createElement("span", { "data-slot": "chip" })
          )
        )
      ),
  });

  it("passes a root inside each element its definition names, in order and with exactly their classes", () => {
    expect(() =>
      checkMarkup(chip("", { ancestorsFor: () => [LIST, ITEM] }), CELLS, around("flex gap-1", "inline-flex"))
    ).not.toThrow();
  });

  it.each([
    ["drops the item", [LIST, ITEM], around("flex gap-1")],
    ["gives the list other classes", [LIST, ITEM], around("flex gap-2", "inline-flex")],
    [
      "puts an item the definition does not name around the root",
      [LIST],
      around("flex gap-1", "inline-flex"),
    ],
    ["nests the item twice", [LIST, ITEM], around("flex gap-1", "inline-flex", "inline-flex")],
  ])("fails markup that %s", (_case, ancestors, markup) => {
    expect(() => checkMarkup(chip("", { ancestorsFor: () => ancestors }), CELLS, markup)).toThrow(
      "chip/state=rest: the ancestors"
    );
  });
});

// Unit under test: where the label check reads a box's label, through `textAttribute`. Oracle: the
// markup React writes for a `<textarea>`, which holds a placeholder in its `placeholder` attribute
// and a value as its own text, so one label reads an attribute in some cells and own text in others.
describe("the label check of a box that holds its text in an attribute in some cells", () => {
  // React writes the `&` as `&amp;` in the attribute and in the text, and the check reads the
  // characters a label holds.
  const TEXT = "Tell us more & then some";
  const TEXTAREA: BoxDefinition = {
    classesFor: () => "",
    iconsFor: () => [],
    label: {
      key: "text",
      name: "text",
      characters: TEXT,
      textProperty: "Text",
      shownIn: () => true,
      textAttribute: (cell) => (cell.content === "placeholder" ? "placeholder" : undefined),
    },
  };
  const markup = (props: Readonly<Record<string, string>>) =>
    elementsOf(renderToStaticMarkup(createElement("textarea", props)))[0];
  const placeholder = expectedLabel(TEXTAREA, { content: "placeholder" });
  const value = expectedLabel(TEXTAREA, { content: "value" });

  it("reads a placeholder cell's attribute and a value cell's own text", () => {
    expect([placeholder, value]).toEqual([
      { text: "", attribute: ["placeholder", TEXT] },
      { text: TEXT, attribute: undefined },
    ]);
    expect(markupLabel(markup({ placeholder: TEXT }), placeholder)).toEqual(placeholder);
    expect(markupLabel(markup({ defaultValue: TEXT }), value)).toEqual(value);
  });

  it("fails a value cell whose markup holds the text as a placeholder", () => {
    expect(markupLabel(markup({ placeholder: TEXT }), value)).not.toEqual(value);
  });
});

// Unit under test: `checkMarkup` on a label its `textElement` places in a child element. Oracle: the
// rule on `LabelDefinition.textElement`, that the child holds the characters as its own text and
// carries no `class` or `style`, so it lays out as the text alone. The hand-written markup holds the
// icon and one bare `<span>` around `Chip` where it passes, and the same span with a class where it
// fails.
describe("the label check of a label held in a bare child element", () => {
  const WRAPPED = chip("", {
    label: {
      key: "label",
      name: "label",
      characters: "Chip",
      textProperty: undefined,
      shownIn: () => true,
      textElement: { tag: "span", attributes: {} },
    },
    iconsFor: () => [ICON],
  });
  const CELLS = [{ state: "rest" }];
  const wrapped = (props: Readonly<Record<string, string>>) =>
    chipMarkup(createElement("svg"), createElement("span", props, "Chip"));

  it("reads the label as the own text of the child it names", () => {
    expect(() => checkMarkup(WRAPPED, CELLS, wrapped({}))).not.toThrow();
  });

  it("fails a child that carries a class, which would lay it out by its own rules", () => {
    expect(() => checkMarkup(WRAPPED, CELLS, wrapped({ className: "font-bold" }))).toThrow(
      "chip/state=rest: the label"
    );
  });
});
