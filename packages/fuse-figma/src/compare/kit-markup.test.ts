/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one root part for the page to measure: the page measures, forces and crops the one element in
 * the slot whose `data-slot` is the definition's `slot`, at any depth, so none or two would
 * compare the wrong box. A radio renders inside its `RadioGroup`, so its root is not at the top.
 *
 * Unit under test: each kit definition's attribute conditions, the cells where its state table
 * holds each variant of `ATTRIBUTE_VARIANTS`, and its icon slots from `iconsFor`. Oracle: the
 * static markup the real Fuse component renders for every preview cell, through the definition's
 * compare renderer. A condition must hold in a cell exactly when the measured element carries the
 * attribute its variant selects, and the slots must match the measured element's `<svg>`
 * descendants in order, each as direct or nested and with its `data-icon`. The pseudo-class
 * variants, `enabled-hover:` and `focus-visible:`, stay out, since static markup cannot show
 * them, and so does the icon edge, which the slots check.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { splitClassName } from "../components/class-name";
import { matrixCells, variantKey } from "../components/component-spec";
import type { IconSlot } from "../components/component-spec";
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

/** An icon as the markup holds it, in the terms of an icon slot. */
type MarkupIcon = Pick<IconSlot, "direct" | "dataIcon">;

function isDescendant(elements: readonly MarkupElement[], index: number, ancestor: number): boolean {
  const parent = elements[index]?.parent;
  return parent !== undefined && (parent === ancestor || isDescendant(elements, parent, ancestor));
}

/** The `<svg>` elements inside the measured element, with the `data-icon` they or their parent carry. */
function markupIcons(elements: readonly MarkupElement[], measured: number): readonly MarkupIcon[] {
  return elements.flatMap((element, index): MarkupIcon[] => {
    if (element.name !== "svg" || !isDescendant(elements, index, measured)) {
      return [];
    }
    const direct = element.parent === measured;
    const parent = element.parent === undefined ? undefined : elements[element.parent];
    const marker =
      element.attributes.get("data-icon") ?? (direct ? undefined : parent?.attributes.get("data-icon"));
    return [{ direct, dataIcon: marker === "inline-start" || marker === "inline-end" ? marker : undefined }];
  });
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

  it("renders one measured element per cell, holds each attribute condition exactly where it carries it, and places its icons", async () => {
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
          expect(
            definition.iconsFor(cell).map(({ direct, dataIcon }) => ({ direct, dataIcon })),
            key
          ).toEqual(markupIcons(elements, measured));
        }
      }
    }
  });
});
