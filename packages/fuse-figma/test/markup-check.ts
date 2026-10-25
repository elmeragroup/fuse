import { expect } from "vitest";

/**
 * `checkMarkup`, the assertions `src/compare/kit-markup.test.ts` runs on every preview cell of a kit
 * definition against the static markup its renderer gives, and what a definition says that markup
 * holds: its parts, icons, labels, styles and images. The suite's header states the rules and their
 * oracle.
 */
import { cn } from "@elmeragroup/fuse/recipe-catalog";

import { forcedAttributesFor, renderCellHtml } from "../src/compare/cell-renderers.ts";
import type { CellRendering } from "../src/compare/cell-renderers.ts";
import { splitClasses } from "../src/components/cascade.ts";
import { splitClassName } from "../src/components/class-name.ts";
import { variantKey } from "../src/components/component-spec.ts";
import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "../src/components/component-spec.ts";
import {
  allPartsOf,
  framePartsOf,
  instanceRootSlotOf,
  rootSlotOf,
} from "../src/components/definition-parts.ts";
import { labelCharacters } from "../src/components/label-layout.ts";
import { makeStateTable, withInPlaceFacts } from "../src/components/state-table.ts";
import {
  ancestorIndexes,
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
  rendersIn,
  siblingsBefore,
} from "./markup-tree.ts";
import type { MarkupIcon, MarkupLabel } from "./markup-tree.ts";
import {
  ATTRIBUTE_VARIANTS,
  NAMED_ATTRIBUTE_VARIANTS,
  GROUP_VARIANTS,
  PARENT_VARIANTS,
  PEER_VARIANTS,
  REACT_ARIA_HOVER,
  TAG_VARIANTS,
} from "./markup-variants.ts";
import { elementsOf } from "./static-markup.ts";
import type { MarkupElement } from "./static-markup.ts";

/** Whether an element's own classes name a variant. */
function namesVariant(element: MarkupElement | undefined, variant: string): boolean {
  return splitClasses(element?.attributes.get("class") ?? "").some((className) =>
    splitClassName(className).variants.includes(variant)
  );
}

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

/**
 * Every box of a definition, the root or a part, by the `data-slot` its element carries: an instance's
 * by the slot the outer component stamps on its inner root, or the inner root's own.
 */
function boxNames(box: BoxDefinition, name: string): readonly string[] {
  return [
    name,
    ...(box.parts ?? []).flatMap((part) =>
      "kind" in part ? [part.slot ?? part.of.slot] : boxNames(part, part.slot ?? part.key)
    ),
  ];
}

/**
 * Each part a cell renders below a box with the given BOOLEAN properties turned on, as
 * {@link rendersIn} says, with its path, such as `/radio-group-indicator/(no data-slot)`, each part
 * named by its {@link pathSegment}. The inner component of an instance part holds parts of its own set,
 * which the list leaves out.
 */
function slotParts(
  box: BoxDefinition,
  path: string,
  cell: Cell,
  turnedOn: ReadonlySet<string>
): readonly { readonly path: string; readonly part: PartDefinition | InstanceDefinition }[] {
  return (box.parts ?? [])
    .filter((part) => rendersIn(part, cell, turnedOn))
    .flatMap((part) => {
      const partPath = `${path}/${pathSegment(part, box.parts ?? [])}`;
      return [{ path: partPath, part }, ...("kind" in part ? [] : slotParts(part, partPath, cell, turnedOn))];
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
function slotIcons(
  box: BoxDefinition,
  path: string,
  cell: Cell,
  turnedOn: ReadonlySet<string>
): readonly MarkupIcon[] {
  return [
    ...framePartsOf(box)
      .filter((part) => rendersIn(part, cell, turnedOn))
      .flatMap((part) => slotIcons(part, `${path}/${pathSegment(part, box.parts ?? [])}`, cell, turnedOn)),
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
 * The inner root as an instance part renders it in an outer cell: its label shows the characters the
 * outer cell gives its TEXT property, where it gives one.
 */
function instanceRoot(part: InstanceDefinition, cell: Cell): ComponentDefinition {
  const { label } = part.of;
  if (label?.textProperty === undefined) {
    return part.of;
  }
  const characters = part.properties?.(cell).text?.[label.textProperty];
  return characters === undefined ? part.of : { ...part.of, label: { ...label, characters } };
}

/**
 * Check that each attribute condition of a definition's state table holds in a cell exactly where
 * the element that takes the states carries its attribute: the root, or the part `statePart` names
 * inside it, and then each attribute condition the root's own classes name on the root itself.
 *
 * @param definition - The definition.
 * @param holds - Whether a variant holds in the cell, as the definition's state table says.
 * @param elements - The cell's markup.
 * @param measured - The index of the root's element.
 * @param where - How a failure names the cell and the element.
 * @returns The element that takes the states.
 */
function checkAttributeStates(
  definition: ComponentDefinition,
  holds: { readonly cell: Cell; readonly variant: (variant: string) => boolean },
  elements: readonly MarkupElement[],
  measured: number,
  where: string
): MarkupElement | undefined {
  const root = elements[measured];
  const stateTaker = statePartOf(definition, elements, measured) ?? root;
  if (root === undefined || stateTaker === undefined) {
    return undefined;
  }
  for (const [variant, carries] of ATTRIBUTE_VARIANTS) {
    expect(holds.variant(variant), `${where}: ${variant}`).toBe(carries(stateTaker));
  }
  if (stateTaker !== root) {
    for (const variant of attributeConditions(definition, holds.cell)) {
      expect(holds.variant(variant), `${where}: ${variant} on the root`).toBe(
        ATTRIBUTE_VARIANTS.get(variant)?.(root) === true
      );
    }
  }
  return stateTaker;
}

/**
 * Whether a variant of a definition's state table holds in a cell, as a condition, with the facts an
 * instance part declares for the root in place where it declares any.
 */
function conditionHolds(
  definition: ComponentDefinition,
  cell: Cell,
  inPlace?: ReadonlyMap<string, (cell: Cell) => boolean>
): (variant: string) => boolean {
  const own = makeStateTable(definition);
  const meaningOf = inPlace === undefined ? own : withInPlaceFacts(own, inPlace, definition.name);
  return (variant) => {
    const meaning = meaningOf(variant);
    return meaning.kind === "condition" && meaning.holds(cell);
  };
}

/**
 * Check that an instance's element shows the inner cell the part names: its attribute conditions, as
 * {@link checkAttributeStates} checks a root's, and each fact the inner definition declares that the
 * markup at and around the element shows. A group variant holds where the element or one around it is
 * the group in that state, a peer variant where a sibling before it is the peer, and a tag variant
 * on the element itself. Each fact the part declares for the inner root in place holds exactly where
 * the element carries its attribute. The markup inside the element stays the inner set's.
 *
 * @param part - The instance part.
 * @param inner - The inner cell the part names.
 * @param elements - The outer cell's markup.
 * @param index - The index of the instance's element.
 * @param where - How a failure names the cell and the instance.
 */
function checkInnerCell(
  part: InstanceDefinition,
  inner: Cell,
  elements: readonly MarkupElement[],
  index: number,
  where: string
): void {
  const { of } = part;
  const holds = conditionHolds(of, inner, part.facts);
  checkAttributeStates(of, { cell: inner, variant: holds }, elements, index, where);
  const element = elements[index];
  if (element === undefined) {
    return;
  }
  const around = [element, ...ancestorsOf(elements, index)];
  const before = siblingsBefore(elements, index);
  const shown = (variant: string): boolean | undefined => {
    const group = GROUP_VARIANTS.get(variant);
    if (group !== undefined) {
      return around.some(group);
    }
    const peer = PEER_VARIANTS.get(variant);
    if (peer !== undefined) {
      return before.some(peer);
    }
    return TAG_VARIANTS.get(variant)?.(element);
  };
  for (const variant of of.facts.keys()) {
    const markup = shown(variant);
    if (markup !== undefined) {
      expect(holds(variant), `${where}: ${variant}`).toBe(markup);
    }
  }
  for (const variant of part.facts?.keys() ?? []) {
    const carries = ATTRIBUTE_VARIANTS.get(variant) ?? NAMED_ATTRIBUTE_VARIANTS.get(variant);
    expect(carries, `${where}: an attribute for the in-place fact ${variant}`).toBeDefined();
    expect(holds(variant), `${where}: ${variant} in place`).toBe(carries?.(element) === true);
  }
}

/**
 * Check an instance part's element, and stop there, since the inner set's own renderer test owns
 * the markup inside it: its `class` holds the inner definition's classes for the inner cell with the
 * classes the outer component passes merged after them by `cn`, in any order, it carries the
 * `data-slot` the inner definition says its root carries in the inner cell, it shows the inner cell
 * the part names, as {@link checkInnerCell} says, and it holds the inner root's label characters, or
 * those the outer cell gives the label's TEXT property.
 */
function checkInstance(
  part: InstanceDefinition,
  cell: Cell,
  elements: readonly MarkupElement[],
  index: number | undefined,
  where: string
): void {
  const element = index === undefined ? undefined : elements[index];
  const inner = part.cell(cell);
  const merged = cn(part.of.classesFor(inner), part.classesFor?.(cell) ?? "");
  expect(splitClasses(element?.attributes.get("class") ?? "").toSorted(), `${where}: the class`).toEqual(
    splitClasses(merged).toSorted()
  );
  expect(element?.attributes.get("data-slot"), `${where}: the data-slot`).toBe(
    instanceRootSlotOf(part, inner)
  );
  if (index !== undefined) {
    checkInnerCell(part, inner, elements, index, where);
  }
  const root = instanceRoot(part, cell);
  const label = expectedLabel(root, inner);
  expect(markupLabel(labelHolder(elements, index, root), label), `${where}: the label`).toEqual(label);
}

/**
 * Check that a box whose definition counts the element children it draws no layer for holds exactly
 * as many element children in a cell as the definition says: its parts, its icons, the element of
 * its label and the undrawn ones. A box that counts none makes no claim.
 *
 * @param box - The root's or the part's definition.
 * @param cell - The cell.
 * @param turnedOn - The BOOLEAN properties that start false which the rendering turns on.
 * @param elements - The cell's markup.
 * @param index - The index of the box's element, undefined where the markup lacks it.
 * @param where - How a failure names the cell and the box.
 */
function checkElementChildren(
  box: BoxDefinition,
  cell: Cell,
  turnedOn: ReadonlySet<string>,
  elements: readonly MarkupElement[],
  index: number | undefined,
  where: string
): void {
  const undrawn = box.undrawnChildren?.(cell);
  if (undrawn === undefined || index === undefined) {
    return;
  }
  const labelElement = box.label?.shownIn(cell) === true && box.label.textElement !== undefined ? 1 : 0;
  const drawn =
    (box.parts ?? []).filter((part) => rendersIn(part, cell, turnedOn)).length + box.iconsFor(cell).length;
  expect(
    elements.filter((element) => element.parent === index),
    where
  ).toHaveLength(drawn + labelElement + undrawn);
}

/**
 * The ways the markup check renders each cell: with every BOOLEAN property at its default, as the
 * previews show it, and, where a part hides behind a property that starts false, once more with each
 * such property turned on, so the check reaches the parts they hide.
 */
function renderingsOf(definition: ComponentDefinition): readonly ReadonlySet<string>[] {
  const startingFalse = new Set(
    allPartsOf(definition).flatMap(({ optional }) =>
      optional === undefined || optional.defaultValue ? [] : [optional.name]
    )
  );
  return startingFalse.size === 0 ? [new Set()] : [new Set(), startingFalse];
}

/**
 * Check a definition against its renderer's markup for each cell, as {@link renderingsOf} renders it:
 * the cell renders one measured element, which carries the `data-slot` the definition says its root
 * carries in the cell, each attribute condition holds exactly where its element carries the
 * attribute, and the parts, icons, labels, images and styles sit where the definition says. An
 * instance part is checked as {@link checkInstance} says.
 */
export function checkMarkup(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  renderer: CellRendering
): void {
  for (const cell of cells) {
    for (const turnedOn of renderingsOf(definition)) {
      checkRendering(
        definition,
        cell,
        turnedOn,
        renderCellHtml(renderer, cell, turnedOn),
        forcedAttributesFor(renderer, cell)
      );
    }
  }
}

/**
 * Check the markup the compare page mounted for a client cell, as {@link checkMarkup} checks a static
 * cell's: a popup part or a row in its slot's HTML, and an open composite as its measured elements
 * under one root that carries the composite's slot. The page mounts each cell with every BOOLEAN
 * property at its default, as the previews show it.
 *
 * @param definition - The cell's definition.
 * @param cell - The parsed cell.
 * @param html - The mounted markup, read before the page forces any state.
 * @param forcedAttributes - The attributes the page writes on the cell's forced element.
 * @throws An assertion error naming the first difference, as the static check does.
 */
export function checkMountedMarkup(
  definition: ComponentDefinition,
  cell: Cell,
  html: string,
  forcedAttributes: Readonly<Record<string, string>>
): void {
  checkRendering(definition, cell, new Set(), html, forcedAttributes);
}

/** Check one rendering of a cell, with the given BOOLEAN properties turned on, as {@link checkMarkup} says. */
function checkRendering(
  definition: ComponentDefinition,
  cell: Cell,
  turnedOn: ReadonlySet<string>,
  html: string,
  forcedAttributes: Readonly<Record<string, string>>
): void {
  const meaningOf = makeStateTable(definition);
  const holdsIn = conditionHolds(definition, cell);
  const key =
    turnedOn.size === 0
      ? variantKey(definition, cell)
      : `${variantKey(definition, cell)} with ${[...turnedOn].join(", ")} on`;
  const elements = elementsOf(html);
  const roots = elements.flatMap((element, index) =>
    isRoot(definition, element) ? [{ root: element, measured: index }] : []
  );
  expect(roots, `${key}: the ${definition.slot} parts`).toHaveLength(1);
  // The one root part the line above checks.
  for (const { root, measured } of roots) {
    expect(root.attributes.get("data-slot"), `${key}: the root's data-slot`).toBe(
      rootSlotOf(definition, cell)
    );
    // The instance parts come first, since the inner set owns the markup inside each, which the
    // variant checks below leave alone.
    const names = new Set(boxNames(definition, definition.slot));
    const shown = slotParts(definition, "", cell, turnedOn);
    const rendered = markupParts(elements, measured, definition, names, cell, turnedOn);
    const elementAt = new Map(rendered);
    const instances = new Set(
      shown.flatMap(({ path, part }) => {
        const index = elementAt.get(path);
        return "kind" in part && index !== undefined ? [index] : [];
      })
    );
    const stateTaker =
      checkAttributeStates(definition, { cell, variant: holdsIn }, elements, measured, key) ?? root;
    if (stateTaker.attributes.has("data-rac")) {
      const hovered = Object.hasOwn(forcedAttributes, "data-hovered");
      for (const variant of REACT_ARIA_HOVER) {
        expect(holdsIn(variant), `${key}: ${variant}`).toBe(hovered);
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
      const namers = elementsNaming(elements, measured, variant, instances);
      const holds = rootVariants.has(variant)
        ? ancestors.some(matches)
        : namers.length > 0
          ? namers.every((index) => ancestorsOf(elements, index).some(matches))
          : [root, ...ancestors].some(matches);
      expect(holdsIn(variant), `${key}: ${variant}`).toBe(holds);
    }
    for (const [variant, holds] of PARENT_VARIANTS) {
      expect(holdsIn(variant), `${key}: ${variant}`).toBe(holds(elements, measured));
    }
    // An attribute variant an element at or below the root, or around it as an ancestor the definition
    // names, names on itself holds exactly where that element carries the attribute, as a Navigation
    // menu caret carries its Root's `data-side`, and an open Select popup its `data-open` around a row.
    // A variant the definition omits draws in no cell, so it makes no claim about the markup, as the
    // `aria-expanded:` of a Button trigger drawn as a frame.
    const namedAncestors = new Set((definition.ancestorsFor?.(cell) ?? []).map(({ slot }) => slot));
    const omits = (variant: string) => ["omitted", "omitted-for"].includes(meaningOf(variant).kind);
    for (const [variant, carries] of [...NAMED_ATTRIBUTE_VARIANTS].filter(([variant]) => !omits(variant))) {
      const around = [
        measured,
        ...ancestorIndexes(elements, measured).filter((index) =>
          namedAncestors.has(elements[index]?.attributes.get("data-slot") ?? "")
        ),
      ].filter((index) => namesVariant(elements[index], variant));
      for (const index of [...around, ...elementsNaming(elements, measured, variant, instances)]) {
        const element = elements[index];
        expect(holdsIn(variant), `${key}: ${variant} on ${element?.name ?? ""}`).toBe(
          element !== undefined && carries(element)
        );
      }
    }
    // A peer variant holds exactly where a sibling before the root is the peer in that state, and
    // the sibling a definition's `statePeer` names, which the page forces, sits there once.
    const before = siblingsBefore(elements, measured);
    for (const [variant, matches] of PEER_VARIANTS) {
      expect(holdsIn(variant), `${key}: ${variant}`).toBe(before.some(matches));
    }
    if (definition.statePeer !== undefined) {
      expect(
        before.filter((element) => element.attributes.get("data-slot") === definition.statePeer),
        `${key}: the ${definition.statePeer} before the root that takes the states`
      ).toHaveLength(1);
    }
    for (const [variant, matches] of TAG_VARIANTS) {
      if (meaningOf(variant).kind === "condition") {
        expect(holdsIn(variant), `${key}: ${variant}`).toBe(matches(root));
      }
    }
    const ancestors = definition.ancestorsFor?.(cell) ?? [];
    expect(
      markupAncestors(elements, measured, new Set(ancestors.map(({ slot }) => slot))),
      `${key}: the ancestors`
    ).toEqual(ancestors.map(({ slot, classes }) => [slot, classes]));
    const rootLabel = expectedLabel(definition, cell);
    expect(markupLabel(labelHolder(elements, measured, definition), rootLabel), `${key}: the label`).toEqual(
      rootLabel
    );
    expect(markupImage(root), `${key}: the image`).toEqual(expectedImage(definition));
    checkElementChildren(
      definition,
      cell,
      turnedOn,
      elements,
      measured,
      `${key}: the element children of the root`
    );
    const renderedPaths = rendered.map(([path]) => path);
    expect(shown.map(({ path }) => path).toSorted(), `${key}: parts`).toEqual(renderedPaths.toSorted());
    // One element per path, so the lookup below reads the only element at each path.
    expect(new Set(renderedPaths).size, `${key}: a part rendered twice`).toBe(renderedPaths.length);
    const owners = new Map([
      [measured, ""],
      ...rendered.map(([path, index]): [number, string] => [index, path]),
    ]);
    const slots = slotIcons(definition, "", cell, turnedOn);
    expect(slots, `${key}: icons`).toEqual(claimedIcons(slots, markupIcons(elements, owners, instances)));
    for (const { path, part } of shown) {
      const index = elementAt.get(path);
      const element = index === undefined ? undefined : elements[index];
      if ("kind" in part) {
        checkInstance(part, cell, elements, index, `${key}: the instance on ${path}`);
        continue;
      }
      const partLabel = expectedLabel(part, cell);
      expect(
        markupLabel(labelHolder(elements, index, part), partLabel),
        `${key}: the label on ${path}`
      ).toEqual(partLabel);
      expect(markupImage(element), `${key}: the image on ${path}`).toEqual(expectedImage(part));
      checkElementChildren(part, cell, turnedOn, elements, index, `${key}: the element children on ${path}`);
      expect(element?.attributes.get("style"), `${key}: the style on ${path}`).toEqual(
        expectedStyle(part, cell)
      );
      for (const variant of attributeConditions(part, cell)) {
        expect(holdsIn(variant), `${key}: ${variant} on ${path}`).toBe(
          element !== undefined && ATTRIBUTE_VARIANTS.get(variant)?.(element) === true
        );
      }
    }
  }
}
