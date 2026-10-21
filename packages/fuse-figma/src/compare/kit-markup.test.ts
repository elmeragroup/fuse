/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one root part for the page to measure: the page measures, forces and crops the one element in
 * the slot whose `data-slot` is the definition's `slot`, at any depth, so none or two would
 * compare the wrong box. A radio renders inside its `RadioGroup`, so its root is not at the top.
 *
 * Unit under test: each kit definition's attribute conditions, the cells where its state table
 * holds each variant of `ATTRIBUTE_VARIANTS`, the parts each cell shows, and the icon slots the
 * root and each part the cell renders list in `iconsFor`. Oracle: the static markup the real Fuse
 * component renders for every preview cell, through the definition's compare renderer. A
 * condition must hold in a cell exactly when the measured element carries the attribute its
 * variant selects. The parts must match the measured element's descendants that carry a part's
 * `data-slot`, each below its parent part, and a part with no `data-slot` must be the one child
 * element of its parent part. The slots must match
 * the measured element's `<svg>` descendants in order, each under the part that lists it, as a
 * child of that part or nested deeper, and with its `data-icon`. The pseudo-class
 * variants, `enabled-hover:` and `focus-visible:`, stay out, since static markup cannot show
 * them, and so does the icon edge, which the slots check.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { splitClassName } from "../components/class-name";
import { matrixCells, variantKey } from "../components/component-spec";
import type { BoxDefinition, Cell, IconSlot } from "../components/component-spec";
import { KIT } from "../components/kit-registry";
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
  ["data-indeterminate", (element) => element.attributes.has("data-indeterminate")],
  // `aria-checked:` compiles to `[aria-checked="true"]`, which a mixed checkbox's
  // `aria-checked="mixed"` does not match.
  ["aria-checked", (element) => element.attributes.get("aria-checked") === "true"],
  ["aria-invalid", (element) => element.attributes.get("aria-invalid") === "true"],
  ["data-invalid", (element) => element.attributes.has("data-invalid")],
  ["data-[pending-indicator]", (element) => element.attributes.has("data-pending-indicator")],
]);

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
type MarkupIcon = Pick<IconSlot, "direct" | "dataIcon"> & { readonly owner: string };

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
 * The path of each part a cell renders below a box, such as
 * `/radio-group-indicator/(no data-slot)`, each part named by its `data-slot`.
 */
function slotParts(box: BoxDefinition, path: string, cell: Cell): readonly string[] {
  return (box.parts ?? [])
    .filter((part) => part.shownIn(cell))
    .flatMap((part) => {
      const partPath = `${path}/${part.slot ?? UNNAMED}`;
      return [partPath, ...slotParts(part, partPath, cell)];
    });
}

/**
 * The path of each part the markup renders inside the measured element. An element whose
 * `data-slot` names a box of the definition is a part, below its nearest such ancestor. An element
 * with no `data-slot` is a part when it is the one child element of a part and not an `<svg>`,
 * which an icon slot checks. That is where Radio's dot sits, alone in the indicator.
 */
function markupParts(
  elements: readonly MarkupElement[],
  measured: number,
  slots: ReadonlySet<string>
): readonly string[] {
  const paths = new Map<number, string>([[measured, ""]]);
  for (const [index, element] of elements.entries()) {
    const slot = element.attributes.get("data-slot");
    const owner = ownerOf(elements, index, slots);
    const ownerPath = owner === undefined ? undefined : paths.get(owner.index);
    if (slot !== undefined && slots.has(slot) && ownerPath !== undefined) {
      paths.set(index, `${ownerPath}/${slot}`);
    }
  }
  const unnamed = [...paths].flatMap(([index, path]) => {
    const children = elements.filter((element) => element.parent === index);
    const [only] = children;
    return children.length === 1 && only?.name !== "svg" && only?.attributes.get("data-slot") === undefined
      ? [`${path}/${UNNAMED}`]
      : [];
  });
  return [...[...paths.values()].filter((path) => path !== ""), ...unnamed].toSorted();
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
    ...box.iconsFor(cell).map(({ direct, dataIcon }) => ({ owner: name, direct, dataIcon })),
  ];
}

describe("each kit definition against the markup of its component", () => {
  it.each(KIT.map(({ definition }) => [definition.name, definition] as const))(
    "%s lists every attribute variant its facts, states and recipe conditions name",
    (_name, definition) => {
      const meaningOf = makeStateTable(definition);
      const recipeConditions = matrixCells(definition.axes).flatMap((cell) =>
        definition
          .classesFor(cell)
          .split(/\s+/)
          .flatMap((className) => (className === "" ? [] : splitClassName(className).variants))
          .filter((variant) => meaningOf(variant).kind === "condition")
      );
      const named = new Set([
        ...definition.facts.keys(),
        ...Object.values(definition.states).flat(),
        ...recipeConditions,
      ]);
      const unlisted = [...named].filter(
        (variant) => !NOT_ATTRIBUTES.has(variant) && !ATTRIBUTE_VARIANTS.has(variant)
      );
      expect(unlisted).toEqual([]);
    }
  );

  it("renders one measured element per cell, holds each attribute condition exactly where it carries it, and places its parts and icons", async () => {
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
            const meaning = meaningOf(variant);
            const holds = meaning.kind === "condition" && meaning.holds(cell);
            expect(holds, `${key}: ${variant}`).toBe(carries(root));
          }
          expect(slotIcons(definition, definition.slot, cell), key).toEqual(
            markupIcons(elements, measured, new Set(boxNames(definition, definition.slot)))
          );
          expect(slotParts(definition, "", cell).toSorted(), `${key}: parts`).toEqual(
            markupParts(elements, measured, new Set(boxNames(definition, definition.slot)))
          );
        }
      }
    }
  });
});
