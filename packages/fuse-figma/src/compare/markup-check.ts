/**
 * The markup check: what a kit definition says its markup holds, its parts, icons, labels, styles
 * and images, against the markup its renderer gives. `checkMarkup` checks every preview cell of a
 * static set, and `checkMountedMarkup` the markup the
 * compare page mounted for a client cell, as `client-markup.ts` runs it. The suite's header states
 * the rules and their oracle.
 *
 * Each check returns its findings as {@link MarkupDiagnostic} values, so the compare CLI records them
 * in its report and loads no test runner. A rendering reports its first difference only: the checks
 * run in an order where a later one reads what an earlier one established, such as the one root,
 * the state taker or the element at a part's path, so the differences after the first are mostly its
 * echoes. Each check is a generator that yields its differences in that order, and a rendering takes
 * the first, which stops the generator before it reads past the difference.
 */
import { isDeepStrictEqual } from "node:util";

import { cn } from "@elmeragroup/fuse/recipe-catalog";

import { splitClasses } from "../components/cascade.ts";
import { splitClassName } from "../components/class-name.ts";
import { matrixCells, variantKey } from "../components/component-spec.ts";
import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "../components/component-spec.ts";
import {
  allPartsOf,
  framePartsOf,
  instanceRootSlotOf,
  partsOf,
  rootSlotOf,
} from "../components/definition-parts.ts";
import { labelCharacters } from "../components/label-layout.ts";
import { makeStateTable, withInPlaceFacts } from "../components/state-table.ts";
import { forcedAttributesFor, renderCellHtml } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";
import {
  ancestorIndexes,
  ancestorsOf,
  elementsNaming,
  iconsRenderedIn,
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
  NOT_ATTRIBUTES,
  GROUP_HAS_VARIANTS,
  GROUP_VARIANTS,
  HAS_VARIANTS,
  IN_VARIANTS,
  PARENT_VARIANTS,
  POSITION_VARIANTS,
  PEER_VARIANTS,
  REACT_ARIA_HOVER,
  TAG_VARIANTS,
} from "./markup-variants.ts";
import { elementsOf, selects } from "./static-markup.ts";
import type { MarkupElement } from "./static-markup.ts";

/**
 * One way a rendering of a cell differs from what its definition says the markup holds.
 *
 * `expected` and `found` are always data, as JSON text: the definition's value and the markup's
 * value of the one subject, never prose. A subject that asks whether the markup holds something,
 * such as a state attribute, compares booleans, and one that counts elements compares numbers, so
 * the subject carries the description and the values stay machine-readable.
 */
export type MarkupDiagnostic = {
  /** The rendering: the cell's variant key, and the BOOLEAN properties it turned on, if any. */
  readonly rendering: string;
  /** What the check compared, such as `the root's data-slot` or `the label on /icon`. */
  readonly subject: string;
  /** What the definition says, as JSON text, with `null` for no value. */
  readonly expected: string;
  /** What the markup holds, as JSON text, with `null` for no value, such as a missing attribute. */
  readonly found: string;
  /** The rendering, the subject, and what was expected and found, in one line. */
  readonly message: string;
};

/** A difference a check finds, before the rendering names it. */
type Difference = Pick<MarkupDiagnostic, "subject" | "expected" | "found">;

/** The differences a check finds, in order, and what it returns once it read the markup. */
type Differences<Returns = void> = Generator<Difference, Returns, undefined>;

/** A value as a diagnostic shows it: JSON text, where no value, such as a missing attribute, is `null`. */
function asText<T>(value: T): string {
  return JSON.stringify(value ?? null);
}

/**
 * A difference where the markup's value is not, as data, the one the definition says. The values
 * are named, so a call cannot swap what the definition says with what the markup holds.
 */
function* same<T>(
  subject: string,
  { expected, found }: { readonly expected: T; readonly found: T }
): Differences {
  if (!isDeepStrictEqual(found, expected)) {
    yield { subject, expected: asText(expected), found: asText(found) };
  }
}

/** Whether an element's own classes name a variant. */
function namesVariant(element: MarkupElement | undefined, variant: string): boolean {
  return splitClasses(element?.attributes.get("class") ?? "").some((className) =>
    splitClassName(className).variants.includes(variant)
  );
}

/**
 * The element of the part a definition's `statePart` names inside the measured element, or
 * undefined for a definition whose root takes its states. A missing part is a difference.
 */
function* statePartOf(
  definition: ComponentDefinition,
  elements: readonly MarkupElement[],
  measured: number
): Differences<MarkupElement | undefined> {
  const { statePart, statePartElement } = definition;
  if (statePart === undefined && statePartElement === undefined) {
    return undefined;
  }
  const found = elements.filter(
    (element, index) =>
      (statePartElement === undefined
        ? element.attributes.get("data-slot") === statePart
        : selects(statePartElement, element)) && inside(elements, index, measured)
  );
  yield* same(`the ${statePart ?? statePartElement?.tag ?? ""} part that takes the states`, {
    expected: 1,
    found: found.length,
  });
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
 * icons sit inside it, before the box's own, and a part whose `after` names the label holds its
 * icons after them. Each names its owner by the box's part path.
 */
function slotIcons(
  box: BoxDefinition,
  path: string,
  cell: Cell,
  turnedOn: ReadonlySet<string>
): readonly MarkupIcon[] {
  const partIcons = (after: boolean) =>
    framePartsOf(box)
      .filter((part) => rendersIn(part, cell, turnedOn) && (part.after === "label") === after)
      .flatMap((part) => slotIcons(part, `${path}/${pathSegment(part, box.parts ?? [])}`, cell, turnedOn));
  return [
    ...partIcons(false),
    ...iconsRenderedIn(box, cell, turnedOn).map(({ direct, dataIcon, classes }) => ({
      owner: path,
      direct,
      dataIcon,
      classes,
    })),
    ...partIcons(true),
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

/** What a measured declaration's value reads as in a comparison, which holds any value the markup writes. */
const MEASURED = "<measured>";

/**
 * A `style` attribute's declarations as property and value pairs, in order, as React writes them
 * (`a:b;c:d`) or a browser serializes them (`a: b; c: d;`), or undefined for no attribute.
 */
function declarationsOf(style: string | undefined): readonly (readonly [string, string])[] | undefined {
  return style
    ?.split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration !== "")
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const;
    });
}

/**
 * Check the `style` attribute a root's or a part's markup carries in a cell against its `styleFor`:
 * the same declarations in the same order. A declaration whose value the definition marks `measured`,
 * as Base UI writes a Tooltip arrow's `left` from the layout, holds with any value. A box without
 * `styleFor` carries none.
 */
function* checkStyle(
  box: Pick<ComponentDefinition, "styleFor">,
  cell: Cell,
  element: MarkupElement | undefined,
  where: string
): Differences {
  const declared = box.styleFor?.(cell);
  const measured = new Set(
    (declared ?? [])
      .filter((declaration) => declaration.measured !== undefined)
      .map(({ property }) => property)
  );
  const markup = declarationsOf(element?.attributes.get("style"))?.map(
    ([property, value]) => [property, measured.has(property) ? MEASURED : value] as const
  );
  yield* same(where, {
    expected: declared?.map(
      ({ property, value, measured: why }) => [property, why === undefined ? value : MEASURED] as const
    ),
    found: markup,
  });
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
 * @param where - How a difference names the element, or `""` for the root.
 * @returns The element that takes the states.
 */
function* checkAttributeStates(
  definition: ComponentDefinition,
  holds: { readonly cell: Cell; readonly variant: (variant: string) => boolean },
  elements: readonly MarkupElement[],
  measured: number,
  where: string
): Differences<MarkupElement | undefined> {
  const root = elements[measured];
  const stateTaker = (yield* statePartOf(definition, elements, measured)) ?? root;
  if (root === undefined || stateTaker === undefined) {
    return undefined;
  }
  for (const [variant, carries] of ATTRIBUTE_VARIANTS) {
    yield* same(on(where, variant), { expected: holds.variant(variant), found: carries(stateTaker) });
  }
  if (stateTaker !== root) {
    for (const variant of attributeConditions(definition, holds.cell)) {
      yield* same(on(where, `${variant} on the root`), {
        expected: holds.variant(variant),
        found: ATTRIBUTE_VARIANTS.get(variant)?.(root) === true,
      });
    }
  }
  return stateTaker;
}

/** A subject inside the element `where` names, or the subject alone where it names none. */
function on(where: string, subject: string): string {
  return where === "" ? subject : `${where}: ${subject}`;
}

/**
 * Whether a variant of a definition's state table holds in a cell, as a condition, with the facts an
 * instance part declares for the root in place where it declares any.
 */
function conditionHolds(
  definition: ComponentDefinition,
  cell: Cell,
  inPlace?: ReadonlyMap<string, (cell: Cell) => boolean>,
  stamps?: ReadonlySet<string>
): (variant: string) => boolean {
  const meaningOf =
    inPlace === undefined ? makeStateTable(definition) : withInPlaceFacts(definition, inPlace, stamps);
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
 * the element, or the inner set's state taker inside it, carries its attribute. The markup inside the element stays the inner set's.
 *
 * @param part - The instance part.
 * @param inner - The inner cell the part names.
 * @param elements - The outer cell's markup.
 * @param index - The index of the instance's element.
 * @param where - How a difference names the instance.
 */
function* checkInnerCell(
  part: InstanceDefinition,
  inner: Cell,
  elements: readonly MarkupElement[],
  index: number,
  where: string
): Differences {
  const { of } = part;
  const holds = conditionHolds(of, inner, part.facts, part.stamps);
  const stateTaker = yield* checkAttributeStates(of, { cell: inner, variant: holds }, elements, index, where);
  const element = elements[index];
  if (element === undefined || stateTaker === undefined) {
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
      yield* same(`${where}: ${variant}`, { expected: holds(variant), found: markup });
    }
  }
  // A fact the page forces, as `in-data-highlighted` on a highlighted Command row's shortcut, is
  // not in the markup the page mounts.
  for (const variant of [...(part.facts?.keys() ?? [])].filter((name) => !NOT_ATTRIBUTES.has(name))) {
    const carries = ATTRIBUTE_VARIANTS.get(variant) ?? NAMED_ATTRIBUTE_VARIANTS.get(variant);
    const has = HAS_VARIANTS.get(variant);
    const groupHas = GROUP_HAS_VARIANTS.get(variant);
    const within = IN_VARIANTS.get(variant);
    const group = GROUP_VARIANTS.get(variant);
    const position = POSITION_VARIANTS.get(variant);
    // An attribute holds where the inner set's state taker carries it, as `checkAttributeStates` reads
    // it, as the Command palette's Input group carries `data-pressed` on its control.
    const markup =
      carries?.(stateTaker) ??
      has?.(elements, index) ??
      position?.(elements, index) ??
      (within === undefined ? undefined : ancestorsOf(elements, index).some(within)) ??
      (group === undefined ? undefined : around.some(group)) ??
      (groupHas === undefined
        ? undefined
        : ancestorIndexes(elements, index).some((ancestor) => groupHas(elements, ancestor)));
    // A fact no variant table can read in the markup is a difference of its own: the markup cannot
    // show it, so its value below would read as false whatever the markup holds.
    yield* same(`${where}: whether the markup can show the in-place fact ${variant}`, {
      expected: true,
      found: markup !== undefined,
    });
    yield* same(`${where}: ${variant} in place`, { expected: holds(variant), found: markup === true });
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
function* checkInstance(
  part: InstanceDefinition,
  cell: Cell,
  elements: readonly MarkupElement[],
  index: number | undefined,
  where: string
): Differences {
  const element = index === undefined ? undefined : elements[index];
  const inner = part.cell(cell);
  const merged = cn(part.ownClassesFor?.(inner) ?? part.of.classesFor(inner), part.classesFor?.(cell) ?? "");
  yield* same(`${where}: the class`, {
    expected: splitClasses(merged).toSorted(),
    found: splitClasses(element?.attributes.get("class") ?? "").toSorted(),
  });
  yield* same(`${where}: the data-slot`, {
    expected: instanceRootSlotOf(part, inner),
    found: element?.attributes.get("data-slot"),
  });
  if (index !== undefined) {
    yield* checkInnerCell(part, inner, elements, index, where);
  }
  const root = instanceRoot(part, cell);
  const label = expectedLabel(root, inner);
  yield* same(`${where}: the label`, {
    expected: label,
    found: markupLabel(labelHolder(elements, index, root), label),
  });
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
 * @param where - How a difference names the box.
 */
function* checkElementChildren(
  box: BoxDefinition,
  cell: Cell,
  turnedOn: ReadonlySet<string>,
  elements: readonly MarkupElement[],
  index: number | undefined,
  where: string
): Differences {
  const undrawn = box.undrawnChildren?.(cell);
  if (undrawn === undefined || index === undefined) {
    return;
  }
  const labelElement = box.label?.shownIn(cell) === true && box.label.textElement !== undefined ? 1 : 0;
  const drawn =
    (box.parts ?? []).filter((part) => rendersIn(part, cell, turnedOn)).length +
    iconsRenderedIn(box, cell, turnedOn).length;
  yield* same(where, {
    expected: drawn + labelElement + undrawn,
    found: elements.filter((element) => element.parent === index).length,
  });
}

/**
 * The ways the markup check renders each cell: with every BOOLEAN property at its default, as the
 * previews show it, and, where a part or an icon hides behind a property that starts false, once more
 * with each such property turned on, so the check reaches the parts and icons they hide.
 */
function renderingsOf(definition: ComponentDefinition): readonly ReadonlySet<string>[] {
  const icons = [definition, ...partsOf(definition)].flatMap((box) =>
    matrixCells(definition.axes).flatMap((cell) => box.iconsFor(cell))
  );
  const startingFalse = new Set(
    [...allPartsOf(definition), ...icons].flatMap(({ optional }) =>
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
 *
 * @param definition - The definition.
 * @param cells - The cells to render.
 * @param renderer - The definition's renderer.
 * @returns The first difference of each rendering that has one, in cell order: none where the
 *   markup holds what the definition says.
 */
export function checkMarkup(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  renderer: CellRendering
): readonly MarkupDiagnostic[] {
  return cells.flatMap((cell) =>
    renderingsOf(definition).flatMap((turnedOn) =>
      firstDifference(
        definition,
        cell,
        turnedOn,
        renderCellHtml(renderer, cell, turnedOn),
        forcedAttributesFor(renderer, cell)
      )
    )
  );
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
 * @returns The first difference, as the static check reports one per rendering, or none.
 */
export function checkMountedMarkup(
  definition: ComponentDefinition,
  cell: Cell,
  html: string,
  forcedAttributes: Readonly<Record<string, string>>
): readonly MarkupDiagnostic[] {
  return firstDifference(definition, cell, new Set(), html, forcedAttributes);
}

/** The first difference of one rendering of a cell, named by the rendering, or none. */
function firstDifference(
  definition: ComponentDefinition,
  cell: Cell,
  turnedOn: ReadonlySet<string>,
  html: string,
  forcedAttributes: Readonly<Record<string, string>>
): readonly MarkupDiagnostic[] {
  const first = checkRendering(definition, cell, turnedOn, html, forcedAttributes).next();
  if (first.done === true) {
    return [];
  }
  const rendering =
    turnedOn.size === 0
      ? variantKey(definition, cell)
      : `${variantKey(definition, cell)} with ${[...turnedOn].join(", ")} on`;
  const { subject, expected, found } = first.value;
  return [
    {
      rendering,
      subject,
      expected,
      found,
      message: `${rendering}: ${subject}: expected ${expected}, found ${found}`,
    },
  ];
}

/**
 * Check one rendering of a cell, with the given BOOLEAN properties turned on, as {@link checkMarkup}
 * says.
 */
function* checkRendering(
  definition: ComponentDefinition,
  cell: Cell,
  turnedOn: ReadonlySet<string>,
  html: string,
  forcedAttributes: Readonly<Record<string, string>>
): Differences {
  const meaningOf = makeStateTable(definition);
  const holdsIn = conditionHolds(definition, cell);
  const elements = elementsOf(html);
  const roots = elements.flatMap((element, index) =>
    isRoot(definition, element) ? [{ root: element, measured: index }] : []
  );
  yield* same(`the ${definition.slot} parts`, { expected: 1, found: roots.length });
  // The one root part the line above checks.
  for (const { root, measured } of roots) {
    yield* same("the root's data-slot", {
      expected: rootSlotOf(definition, cell),
      found: root.attributes.get("data-slot"),
    });
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
      (yield* checkAttributeStates(definition, { cell, variant: holdsIn }, elements, measured, "")) ?? root;
    // A root whose definition names no `styleFor` makes no claim, as Base UI writes its own inline
    // styles on some roots, a stepper's `user-select: none` among them.
    if (definition.styleFor !== undefined) {
      yield* checkStyle(definition, cell, root, "the style on the root");
    }
    if (stateTaker.attributes.has("data-rac")) {
      const hovered = Object.hasOwn(forcedAttributes, "data-hovered");
      for (const variant of REACT_ARIA_HOVER) {
        yield* same(variant, { expected: holdsIn(variant), found: hovered });
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
      yield* same(variant, { expected: holdsIn(variant), found: holds });
    }
    for (const [variant, holds] of PARENT_VARIANTS) {
      yield* same(variant, { expected: holdsIn(variant), found: holds(elements, measured) });
    }
    // A `has-*` variant holds exactly where the element that names it holds what it reads, as an
    // Input group's root holds its own disabled control, its addon a button, and the Sidebar panel's
    // wrapper, an ancestor the definition names, an inset Root.
    const namedAncestors = new Set((definition.ancestorsFor?.(cell) ?? []).map(({ slot }) => slot));
    for (const [variant, has] of HAS_VARIANTS) {
      const namers = [
        ...ancestorIndexes(elements, measured).filter(
          (index) =>
            namedAncestors.has(elements[index]?.attributes.get("data-slot") ?? "") &&
            namesVariant(elements[index], variant)
        ),
        ...(rootVariants.has(variant) ? [measured] : []),
        ...elementsNaming(elements, measured, variant, instances),
      ];
      for (const index of namers) {
        yield* same(`${variant} on ${elements[index]?.name ?? ""}`, {
          expected: holdsIn(variant),
          found: has(elements, index),
        });
      }
    }
    // An attribute variant an element at or below the root, or around it as an ancestor the definition
    // names, names on itself holds exactly where that element carries the attribute, as a Navigation
    // menu caret carries its Root's `data-side`, and an open Select popup its `data-open` around a row.
    // A variant the definition omits draws in no cell, so it makes no claim about the markup, as the
    // `aria-expanded:` of a Button trigger drawn as a frame.
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
        yield* same(`${variant} on ${element?.name ?? ""}`, {
          expected: holdsIn(variant),
          found: element !== undefined && carries(element),
        });
      }
    }
    // A peer variant holds exactly where a sibling before the element that names it is the peer in
    // that state: the root, or a part below it, as a Radio row's content reads the radio before it.
    // Where no element below the root names it, the root's own siblings decide. The sibling a
    // definition's `statePeer` names, which the page forces, sits before the root once.
    const before = siblingsBefore(elements, measured);
    for (const [variant, matches] of PEER_VARIANTS) {
      const naming = elementsNaming(elements, measured, variant, instances);
      for (const index of naming.length === 0 ? [measured] : naming) {
        yield* same(variant, {
          expected: holdsIn(variant),
          found: siblingsBefore(elements, index).some(matches),
        });
      }
    }
    if (definition.statePeer !== undefined) {
      yield* same(`the ${definition.statePeer} before the root that takes the states`, {
        expected: 1,
        found: before.filter((element) => element.attributes.get("data-slot") === definition.statePeer)
          .length,
      });
    }
    for (const [variant, matches] of TAG_VARIANTS) {
      if (meaningOf(variant).kind === "condition") {
        yield* same(variant, { expected: holdsIn(variant), found: matches(root) });
      }
    }
    const ancestors = definition.ancestorsFor?.(cell) ?? [];
    yield* same("the ancestors", {
      expected: ancestors.map(({ slot, classes }) => [slot, classes] as const),
      found: markupAncestors(elements, measured, new Set(ancestors.map(({ slot }) => slot))),
    });
    const rootLabel = expectedLabel(definition, cell);
    yield* same("the label", {
      expected: rootLabel,
      found: markupLabel(labelHolder(elements, measured, definition), rootLabel),
    });
    yield* same("the image", { expected: expectedImage(definition), found: markupImage(root) });
    yield* checkElementChildren(
      definition,
      cell,
      turnedOn,
      elements,
      measured,
      "the element children of the root"
    );
    const renderedPaths = rendered.map(([path]) => path);
    yield* same("parts", {
      expected: shown.map(({ path }) => path).toSorted(),
      found: renderedPaths.toSorted(),
    });
    // One element per path, so the lookup below reads the only element at each path.
    yield* same("the parts rendered twice", {
      expected: [],
      found: renderedPaths.filter((path, index) => renderedPaths.indexOf(path) !== index),
    });
    const owners = new Map([
      [measured, ""],
      ...rendered.map(([path, index]): [number, string] => [index, path]),
    ]);
    const slots = slotIcons(definition, "", cell, turnedOn);
    yield* same("icons", {
      expected: slots,
      found: claimedIcons(slots, markupIcons(elements, owners, instances)),
    });
    for (const { path, part } of shown) {
      const index = elementAt.get(path);
      const element = index === undefined ? undefined : elements[index];
      if ("kind" in part) {
        yield* checkInstance(part, cell, elements, index, `the instance on ${path}`);
        continue;
      }
      const partLabel = expectedLabel(part, cell);
      yield* same(`the label on ${path}`, {
        expected: partLabel,
        found: markupLabel(labelHolder(elements, index, part), partLabel),
      });
      yield* same(`the image on ${path}`, { expected: expectedImage(part), found: markupImage(element) });
      yield* checkElementChildren(part, cell, turnedOn, elements, index, `the element children on ${path}`);
      yield* checkStyle(part, cell, element, `the style on ${path}`);
      // A part's own facts hold on its element, as a Sidebar separator's `data-orientation` does.
      const holdsOnPart = (variant: string) => part.facts?.get(variant)?.(cell) ?? holdsIn(variant);
      for (const variant of attributeConditions(part, cell)) {
        yield* same(`${variant} on ${path}`, {
          expected: holdsOnPart(variant),
          found: element !== undefined && ATTRIBUTE_VARIANTS.get(variant)?.(element) === true,
        });
      }
    }
  }
}
