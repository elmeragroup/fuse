/**
 * `checkMarkup`, the assertions `src/compare/kit-markup.test.ts` runs on every preview cell of a kit
 * definition against the static markup its renderer gives, and what a definition says that markup
 * holds: its parts, icons, labels, styles and images. The suite's header states the rules and their
 * oracle.
 */
import { expect } from "vitest";

import { forcedAttributesFor, renderCellHtml } from "../src/compare/cell-renderers.ts";
import type { CellRendering } from "../src/compare/cell-renderers.ts";
import { splitClasses } from "../src/components/cascade.ts";
import { splitClassName } from "../src/components/class-name.ts";
import { variantKey } from "../src/components/component-spec.ts";
import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  PartDefinition,
} from "../src/components/component-spec.ts";
import { labelCharacters } from "../src/components/label-layout.ts";
import { makeStateTable } from "../src/components/state-table.ts";
import {
  ancestorsOf,
  elementsNaming,
  inside,
  isRoot,
  labelHolder,
  markupAncestors,
  markupIcons,
  markupImage,
  markupLabel,
  markupParts,
  pathSegment,
  siblingsBefore,
} from "./markup-tree.ts";
import type { MarkupIcon, MarkupLabel } from "./markup-tree.ts";
import {
  ATTRIBUTE_VARIANTS,
  DESCENDANT_ATTRIBUTE_VARIANTS,
  GROUP_VARIANTS,
  PARENT_VARIANTS,
  PEER_VARIANTS,
  REACT_ARIA_HOVER,
  TAG_VARIANTS,
} from "./markup-variants.ts";
import { elementsOf } from "./static-markup.ts";
import type { MarkupElement } from "./static-markup.ts";

/**
 * The element of the part a definition's `statePart` names inside the measured element, or
 * undefined for a definition whose root takes its states. A missing part fails the check.
 */
function statePartOf(
  definition: ComponentDefinition,
  elements: readonly MarkupElement[],
  measured: number
): MarkupElement | undefined {
  if (definition.statePart === undefined) {
    return undefined;
  }
  const found = elements.filter(
    (element, index) =>
      element.attributes.get("data-slot") === definition.statePart && inside(elements, index, measured)
  );
  expect(found, `the ${definition.statePart} part that takes the states`).toHaveLength(1);
  return found[0];
}

/** Every box of a definition, the root or a part, by the name its layer takes. */
function boxNames(box: BoxDefinition, name: string): readonly string[] {
  return [name, ...(box.parts ?? []).flatMap((part) => boxNames(part, part.slot ?? part.key))];
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
 * Where a box draws its label in a cell: the label's characters as the box's own text, after a space
 * where the label's `leadingSpace` says the markup holds one, or in the attribute the label names,
 * with no text of its own, as an `<input>` holds its placeholder. A box that shows no label in the
 * cell holds no text.
 */
export function expectedLabel(box: BoxDefinition, cell: Cell): MarkupLabel {
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
 * The picture a box shows, as the markup would hold it: an `<img>` and its image's bytes, base64
 * encoded, or nothing for a box that shows none.
 */
function expectedImage(box: BoxDefinition): readonly [element: string, bytes: string] | undefined {
  return box.image === undefined ? undefined : ["img", Buffer.from(box.image()).toString("base64")];
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

/**
 * Check a definition against its renderer's markup for each cell: the cell renders one measured
 * element, each attribute condition holds exactly where its element carries the attribute, and the
 * parts, icons, labels, images and styles sit where the definition says.
 */
export function checkMarkup(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  renderer: CellRendering
): void {
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
      const stateTaker = statePartOf(definition, elements, measured) ?? root;
      for (const [variant, carries] of ATTRIBUTE_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(carries(stateTaker));
      }
      if (stateTaker !== root) {
        for (const variant of attributeConditions(definition, cell)) {
          expect(holdsIn(variant, cell), `${key}: ${variant} on the root`).toBe(
            ATTRIBUTE_VARIANTS.get(variant)?.(root) === true
          );
        }
      }
      if (stateTaker.attributes.has("data-rac")) {
        const hovered = Object.hasOwn(forcedAttributesFor(renderer, cell), "data-hovered");
        for (const variant of REACT_ARIA_HOVER) {
          expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(hovered);
        }
      }
      // A variant the root's own classes name selects the root below its group. One an element below
      // the root names selects that element below its group, which may be the root or a part between,
      // as Select's trigger is for its caret and Accordion's trigger for its own. A variant no element
      // names holds nowhere, unless the root or an element around it is its group in that state.
      const rootVariants = new Set(
        splitClasses(definition.classesFor(cell)).flatMap((className) => splitClassName(className).variants)
      );
      for (const [variant, matches] of GROUP_VARIANTS) {
        const ancestors = ancestorsOf(elements, measured);
        const namers = elementsNaming(elements, measured, variant);
        const holds = rootVariants.has(variant)
          ? ancestors.some(matches)
          : namers.length > 0
            ? namers.every((index) => ancestorsOf(elements, index).some(matches))
            : [root, ...ancestors].some(matches);
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(holds);
      }
      for (const [variant, holds] of PARENT_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(holds(elements, measured));
      }
      // An attribute variant an element below the root names on itself holds exactly where that
      // element carries the attribute, as a Navigation menu caret carries its Root's `data-side`.
      for (const [variant, carries] of DESCENDANT_ATTRIBUTE_VARIANTS) {
        for (const index of elementsNaming(elements, measured, variant)) {
          const element = elements[index];
          expect(holdsIn(variant, cell), `${key}: ${variant} on ${element?.name ?? ""}`).toBe(
            element !== undefined && carries(element)
          );
        }
      }
      // A peer variant holds exactly where a sibling before the root is the peer in that state, and
      // the sibling a definition's `statePeer` names, which the page forces, sits there once.
      const before = siblingsBefore(elements, measured);
      for (const [variant, matches] of PEER_VARIANTS) {
        expect(holdsIn(variant, cell), `${key}: ${variant}`).toBe(before.some(matches));
      }
      if (definition.statePeer !== undefined) {
        expect(
          before.filter((element) => element.attributes.get("data-slot") === definition.statePeer),
          `${key}: the ${definition.statePeer} before the root that takes the states`
        ).toHaveLength(1);
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
