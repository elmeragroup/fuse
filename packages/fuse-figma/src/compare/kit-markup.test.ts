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
 * must hold exactly when that part's element carries it. The parts must match the measured
 * element's descendants that carry a part's `data-slot` or that its `element` selects, each below
 * its parent part, and any other part with no `data-slot` must be the one child element of its
 * parent part beside those parts and Base UI's hidden span. The slots must match the measured
 * element's `<svg>` descendants in order, each under the part that lists it, its nearest ancestor
 * among the root and the parts, as a child of that part or nested deeper, and with its `data-icon`.
 * A slot that names classes of its own must name the `<svg>`'s `class` attribute exactly. The root
 * and each part must hold their
 * label's characters where the cell shows the label, as their own text, after a space where the
 * label says the markup holds one, or in the attribute the label
 * names, as an `<input>` holds its placeholder, and no text where it does not, so the compare page
 * renders the text Figma draws. A box that shows an image must be an `<img>` whose `src` is a data
 * URI of the image's bytes, and a box that shows none carries no `src`, so the page draws the
 * picture Figma draws. A part's `style` attribute must hold exactly the declarations its
 * definition cascades above its classes, so a meter's fill is as wide in Figma as Base UI makes
 * it. The pseudo-class variants, `enabled-hover:`, `hover:` and `focus-visible:`, stay out, since
 * static markup cannot show them, and so does the icon edge, which the slots check. On a React Aria
 * element `hover:` reads `data-hovered`, which React Aria stamps only while a hydrated page is hovered.
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
  BoxDefinition,
  Cell,
  ComponentDefinition,
  IconSlot,
  PartDefinition,
} from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { labelCharacters } from "../components/label-layout";
import { makeStateTable } from "../components/state-table";
import { loadRenderers, renderCellHtml } from "./cell-renderers";
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
]);

/**
 * Whether an ancestor matches each group variant, which selects the measured element below it:
 * `group-data-disabled/field:` compiles to `:where(.group\/field)[data-disabled] *`, so it holds
 * below an element that carries the `group/field` marker and `data-disabled`, as a disabled
 * `Field.Root` does.
 */
const GROUP_VARIANTS = new Map<string, (ancestor: MarkupElement) => boolean>([
  [
    "group-data-disabled/field",
    (ancestor) =>
      (ancestor.attributes.get("class") ?? "").split(/\s+/).includes("group/field") &&
      ancestor.attributes.has("data-disabled"),
  ],
]);

/** The ancestors of an element, its parent first. */
function ancestorsOf(elements: readonly MarkupElement[], index: number): readonly MarkupElement[] {
  const parent = elements[index]?.parent;
  const element = parent === undefined ? undefined : elements[parent];
  return parent === undefined || element === undefined ? [] : [element, ...ancestorsOf(elements, parent)];
}

/**
 * The condition variants static markup cannot check against the measured element's attributes:
 * the pseudo classes the page forces, and the icon edge, which holds on a descendant.
 */
const NOT_ATTRIBUTES = new Set([
  "enabled-hover",
  "hover",
  "focus-visible",
  "has-data-[icon=inline-start]",
  "has-data-[icon=inline-end]",
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
    } else if (element.parent === owner && unnamedChild(elements, owner, slots, parts) === index) {
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
      const unlisted = [...named].filter(
        (variant) =>
          !NOT_ATTRIBUTES.has(variant) && !ATTRIBUTE_VARIANTS.has(variant) && !GROUP_VARIANTS.has(variant)
      );
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
      for (const [variant, matches] of GROUP_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(
          ancestorsOf(elements, measured).some(matches)
        );
      }
      const rootLabel = expectedLabel(definition, cell);
      expect(markupLabel(root, rootLabel), `${key}: the label`).toEqual(rootLabel);
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
        const element = elements[elementAt.get(path) ?? -1];
        const partLabel = expectedLabel(part, cell);
        expect(markupLabel(element, partLabel), `${key}: the label on ${path}`).toEqual(partLabel);
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
