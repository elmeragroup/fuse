/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one root part for the page to measure: the page measures, forces and crops the one element in
 * the slot whose `data-slot` is the definition's `slot`, at any depth, so none or two would
 * compare the wrong box. A radio renders inside its `RadioGroup`, so its root is not at the top.
 *
 * Unit under test: each kit definition's attribute conditions, the cells where its state table
 * holds each variant of `ATTRIBUTE_VARIANTS`, the parts each cell shows, the icon slots the
 * root and each part the cell renders list in `iconsFor`, and the label text each box draws.
 * Oracle: the static markup the real Fuse component renders for every preview cell, through the
 * definition's compare renderer. A condition must hold in a cell exactly when the measured
 * element carries the attribute its variant selects, and a condition a part's own classes name
 * must hold exactly when that part's element carries it. The parts must match the measured
 * element's descendants that carry a part's `data-slot`, each below its parent part, and a part
 * with no `data-slot` must be the one child element of its parent part. The slots must match
 * the measured element's `<svg>` descendants in order, each under the part that lists it, as a
 * child of that part or nested deeper, and with its `data-icon`. A slot that names classes of its
 * own must name the `<svg>`'s `class` attribute exactly. The root and each part must hold their
 * label's characters where the cell shows the label, as their own text or in the attribute the label
 * names, as an `<input>` holds its placeholder, and no text where it does not, so the compare page
 * renders the text Figma draws. A box that shows an image must be an `<img>` whose `src` is a data
 * URI of the image's bytes, and a box that shows none carries no `src`, so the page draws the
 * picture Figma draws. The pseudo-class variants,
 * `enabled-hover:` and `focus-visible:`, stay out, since static markup cannot show them, and so
 * does the icon edge, which the slots check.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { splitClasses } from "../components/cascade";
import { splitClassName } from "../components/class-name";
import { definitionClasses, variantKey } from "../components/component-spec";
import type { BoxDefinition, Cell, IconSlot, PartDefinition } from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { labelCharacters } from "../components/label-layout";
import { makeStateTable } from "../components/state-table";
import { loadRenderers, renderCellHtml } from "./cell-renderers";

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
  "focus-visible",
  "has-data-[icon=inline-start]",
  "has-data-[icon=inline-end]",
]);

/**
 * An icon as the markup holds it, in the terms of an icon slot, with the part that lists it:
 * its nearest ancestor whose `data-slot` names the root or one of its parts. `direct` means a
 * child of that part.
 */
type MarkupIcon = Pick<IconSlot, "direct" | "dataIcon"> & {
  readonly owner: string;
  /** A slot's own `classes`, or an `<svg>`'s `class` attribute. */
  readonly classes: string | undefined;
};

function isDescendant(elements: readonly MarkupElement[], index: number, ancestor: number): boolean {
  const parent = elements[index]?.parent;
  return parent !== undefined && (parent === ancestor || isDescendant(elements, parent, ancestor));
}

/** The nearest ancestor of an element whose `data-slot` is one of `slots`. */
function ownerOf(
  elements: readonly MarkupElement[],
  index: number,
  slots: ReadonlySet<string>
): { readonly index: number; readonly slot: string } | undefined {
  const parent = elements[index]?.parent;
  if (parent === undefined) {
    return undefined;
  }
  const slot = elements[parent]?.attributes.get("data-slot");
  return slot !== undefined && slots.has(slot) ? { index: parent, slot } : ownerOf(elements, parent, slots);
}

/**
 * The `<svg>` elements inside the measured element, each with its owning part and the
 * `data-icon` it or its parent carries.
 */
function markupIcons(
  elements: readonly MarkupElement[],
  measured: number,
  slots: ReadonlySet<string>
): readonly MarkupIcon[] {
  return elements.flatMap((element, index): MarkupIcon[] => {
    const owner = ownerOf(elements, index, slots);
    if (element.name !== "svg" || owner === undefined || !isDescendant(elements, index, measured)) {
      return [];
    }
    const direct = element.parent === owner.index;
    const parent = element.parent === undefined ? undefined : elements[element.parent];
    const marker =
      element.attributes.get("data-icon") ?? (direct ? undefined : parent?.attributes.get("data-icon"));
    return [
      {
        owner: owner.slot,
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

/** How a part path names a part with no `data-slot`, which the markup can only find by place. */
const UNNAMED = "(no data-slot)";

/**
 * Each part a cell renders below a box, with its path, such as
 * `/radio-group-indicator/(no data-slot)`, each part named by its `data-slot`.
 */
function slotParts(
  box: BoxDefinition,
  path: string,
  cell: Cell
): readonly { readonly path: string; readonly part: PartDefinition }[] {
  return (box.parts ?? [])
    .filter((part) => part.shownIn(cell))
    .flatMap((part) => {
      const partPath = `${path}/${part.slot ?? UNNAMED}`;
      return [{ path: partPath, part }, ...slotParts(part, partPath, cell)];
    });
}

/**
 * Each part the markup renders inside the measured element: its path and its element, once per
 * element, so two elements at one path stay two entries.
 * An element whose `data-slot` names a box of the definition is a part, below its nearest such
 * ancestor. An element with no `data-slot` is a part when it is the one child element of a part
 * and not an `<svg>`, which an icon slot checks. That is where Radio's dot sits, alone in the
 * indicator.
 */
function markupParts(
  elements: readonly MarkupElement[],
  measured: number,
  slots: ReadonlySet<string>
): readonly (readonly [string, number])[] {
  const paths = new Map<number, string>([[measured, ""]]);
  for (const [index, element] of elements.entries()) {
    const slot = element.attributes.get("data-slot");
    const owner = ownerOf(elements, index, slots);
    const ownerPath = owner === undefined ? undefined : paths.get(owner.index);
    if (slot !== undefined && slots.has(slot) && ownerPath !== undefined) {
      paths.set(index, `${ownerPath}/${slot}`);
    }
  }
  const unnamed = [...paths].flatMap(([index, path]): [string, number][] => {
    const children = elements.flatMap((element, child) => (element.parent === index ? [child] : []));
    const [only] = children;
    const element = only === undefined ? undefined : elements[only];
    return children.length === 1 &&
      only !== undefined &&
      element?.name !== "svg" &&
      element?.attributes.get("data-slot") === undefined
      ? [[`${path}/${UNNAMED}`, only]]
      : [];
  });
  const named = [...paths].flatMap(([index, path]): [string, number][] =>
    path === "" ? [] : [[path, index]]
  );
  return [...named, ...unnamed];
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
 * icons sit inside it, before the box's own.
 */
function slotIcons(box: BoxDefinition, name: string, cell: Cell): readonly MarkupIcon[] {
  return [
    ...(box.parts ?? [])
      .filter((part) => part.shownIn(cell))
      .flatMap((part) => slotIcons(part, part.slot ?? part.key, cell)),
    ...box
      .iconsFor(cell)
      .map(({ direct, dataIcon, classes }) => ({ owner: name, direct, dataIcon, classes })),
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
 * Where a box draws its label in a cell: the label's characters as the box's own text, or in the
 * attribute the label names, with no text of its own, as an `<input>` holds its placeholder. A box
 * that shows no label in the cell holds no text.
 */
function expectedLabel(box: BoxDefinition, cell: Cell): MarkupLabel {
  if (box.label?.shownIn(cell) !== true) {
    return { text: "", attribute: undefined };
  }
  const characters = labelCharacters(box.label, cell);
  const attribute = box.label.textAttribute?.(cell);
  return attribute === undefined
    ? { text: characters, attribute: undefined }
    : { text: "", attribute: [attribute, characters] };
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
      const meaningOf = makeStateTable(definition);
      const holdsIn = (variant: string, cell: Cell): boolean => {
        const meaning = meaningOf(variant);
        return meaning.kind === "condition" && meaning.holds(cell);
      };
      for (const cell of previewCells) {
        const key = variantKey(definition, cell);
        const elements = elementsOf(renderCellHtml(renderer, cell));
        const roots = elements.flatMap((element, index) =>
          element.attributes.get("data-slot") === definition.slot ? [{ root: element, measured: index }] : []
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
          const slots = slotIcons(definition, definition.slot, cell);
          expect(slots, key).toEqual(claimedIcons(slots, markupIcons(elements, measured, names)));
          const shown = slotParts(definition, "", cell);
          const rendered = markupParts(elements, measured, names);
          const renderedPaths = rendered.map(([path]) => path);
          expect(shown.map(({ path }) => path).toSorted(), `${key}: parts`).toEqual(renderedPaths.toSorted());
          // One element per path, so the lookup below reads the only element at each path.
          expect(new Set(renderedPaths).size, `${key}: a part rendered twice`).toBe(renderedPaths.length);
          const elementAt = new Map(rendered);
          for (const { path, part } of shown) {
            const element = elements[elementAt.get(path) ?? -1];
            const partLabel = expectedLabel(part, cell);
            expect(markupLabel(element, partLabel), `${key}: the label on ${path}`).toEqual(partLabel);
            expect(markupImage(element), `${key}: the image on ${path}`).toEqual(expectedImage(part));
            for (const variant of attributeConditions(part, cell)) {
              expect(holdsIn(variant, cell), `${key}: ${variant} on ${path}`).toBe(
                element !== undefined && ATTRIBUTE_VARIANTS.get(variant)?.(element) === true
              );
            }
          }
        }
      }
    }
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
