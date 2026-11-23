/**
 * The one rule that draws a nested composite: a popup that opens beside a row of another popup, as
 * a submenu opens beside its sub trigger. Base UI's positioner opens the nested popup on the right of
 * its anchor row, `sideOffset` pixels from the row's end and `alignOffset` pixels down from its top.
 * Figma binds no variable to an absolute layer's `x` or `y`, so the composite is a row of the parent
 * popup and a column beside it. The row's gap is `sideOffset` less the parent popup's end padding,
 * which brings the column to the anchor row's end. The column pads its top as the parent popup does,
 * stacks a stand-in for each row above the anchor row, and puts the nested popup `alignOffset`
 * pixels below that stack.
 *
 * This module owns the boxes the rule adds: the column, the stack and the stand-ins. The build reads
 * their parts from {@link nestedComposite} and the capture cascade their elements from
 * {@link nestedLayout}, and both enumerate the rows above the anchor row through one function, so
 * the part tree and the element tree cannot drift apart.
 *
 * Both gaps may be negative, as the default submenu's are, `-4px` and `-3px`. CSS allows no negative
 * gap, but the rule stands for Base UI's positioner, not for a stylesheet. A Figma row with a
 * negative item spacing draws the later layer on top (probe N7), as the nested popup paints over its
 * parent; no probe has drawn a column's negative item spacing yet.
 */
import * as Result from "effect/Result";

import { KitUnmappable } from "../components/build-errors.ts";
import { possibleCells } from "../components/component-spec.ts";
import type {
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "../components/component-spec.ts";
import { readNumber } from "../components/css-values.ts";
import type { VariableIndex } from "../components/css-values.ts";
import { instanceRootSlotOf } from "../components/definition-parts.ts";
import type {
  CapturedCell,
  CapturedDeclaration,
  CapturedElement,
  CapturedRoot,
  SetCapture,
} from "./capture-format.ts";

/**
 * A popup that opens beside a row of another popup: `anchor` is the row's `data-slot`, and
 * `sideOffset` and `alignOffset` are the nested popup's offsets from the row, as Base UI's
 * positioner applies them.
 */
export type NestedPlacement = {
  readonly _tag: "nested";
  readonly anchor: string;
  readonly sideOffset: number;
  readonly alignOffset: number;
};

/** The class name the nested rule's declarations carry on the composite and the boxes it adds. */
export const NESTED_PLACEMENT = "Base UI's nested placement";

/**
 * The `data-slot` of the column a nested popup sits in, beside its parent popup, and of the stack
 * at the column's top that stands for the rows above the anchor row.
 */
const COLUMN_SLOTS = { column: "nested-popup", offset: "nested-popup-offset" } as const;

/**
 * A stand-in's width. Live Figma probes (#821) found a frame with no layers that hugs keeps the size
 * it last had, so a stand-in is fixed on both axes. It is narrower than any popup, so it never
 * widens the column.
 */
const STAND_IN_WIDTH = "1px";

/** The elements the rule reads in a cell: the parent popup, the nested popup and the rows above the anchor. */
type NestedRoots = {
  readonly parent: CapturedRoot;
  readonly popup: CapturedRoot;
  readonly above: readonly CapturedElement[];
};

/**
 * The parent popup, the nested popup and the parent popup's rows above the anchor row in a cell, or
 * `KitUnmappable` where the cell does not measure one parent popup that holds the anchor row as a
 * child below its first row and one nested popup that opens on its right, aligned to its start.
 */
function nestedRoots(cell: CapturedCell, open: NestedPlacement): Result.Result<NestedRoots, KitUnmappable> {
  const holds = (element: CapturedElement): boolean =>
    element.attributes["data-slot"] === open.anchor || element.children.some(holds);
  const parents = cell.roots.filter(({ root }) => holds(root));
  const nested = cell.roots.filter(({ root }) => !holds(root));
  const [parent] = parents;
  const [popup] = nested;
  const anchorAt =
    parent?.root.children.findIndex((child) => child.attributes["data-slot"] === open.anchor) ?? -1;
  if (
    parent === undefined ||
    popup === undefined ||
    parents.length > 1 ||
    nested.length > 1 ||
    anchorAt < 0 ||
    popup.root.attributes["data-side"] !== "right" ||
    popup.root.attributes["data-align"] !== "start"
  ) {
    return Result.fail(
      new KitUnmappable({
        message: `${cell.key} measures no popup that opens on the right of ${open.anchor}, aligned to its start, beside one parent popup that holds it as a child`,
      })
    );
  }
  // A stack of no stand-ins would be an empty frame, which Figma does not size (#821).
  if (anchorAt === 0) {
    return Result.fail(
      new KitUnmappable({
        message: `${cell.key}: ${open.anchor} is the parent popup's first row, and the nested rule stands in only for rows above it`,
      })
    );
  }
  return Result.succeed({ parent, popup, above: parent.root.children.slice(0, anchorAt) });
}

/** Whether a resolved length is zero or unset. */
function isZero(value: string | undefined): boolean {
  return value === undefined || /^0(px)?$/.test(value.trim());
}

/** The key of the stand-in of the row at `index` above the anchor row. */
function standInKey(index: number): string {
  return `above-${String(index)}`;
}

/**
 * A nested composite's definition, with the nested popup's instance part in the column the rule
 * adds beside the parent popup, below the stand-in stack, as {@link nestedLayout} draws the elements.
 * The composite's manifest names the parent popup's and the nested popup's instance parts alone.
 *
 * @param definition - The composite's definition, as its manifest gives it.
 * @param capture - Its capture, whose cells name the rows above the anchor row.
 * @param open - The nested placement.
 * @returns The definition with its parts in drawn order, the parent popup and then the column, or
 *   `KitUnmappable` where a cell does not measure the two popups, where the cells hold different rows
 *   above the anchor row, or where the definition names other parts than one instance per popup.
 */
export function nestedComposite(
  definition: ComponentDefinition,
  capture: SetCapture,
  open: NestedPlacement
): Result.Result<ComponentDefinition, KitUnmappable> {
  return Result.flatMap(Result.all(capture.cells.map((cell) => nestedRoots(cell, open))), (layouts) =>
    columnParts(definition, layouts, open)
  );
}

/** {@link nestedComposite}'s definition from the rule's reads of each cell. */
function columnParts(
  definition: ComponentDefinition,
  layouts: readonly NestedRoots[],
  open: NestedPlacement
): Result.Result<ComponentDefinition, KitUnmappable> {
  const [first] = layouts;
  const [cell] = possibleCells(definition);
  if (first === undefined || cell === undefined) {
    return Result.fail(new KitUnmappable({ message: `${definition.name} captures no cell` }));
  }
  const rowSlots = (roots: NestedRoots): string =>
    roots.above.map((row) => row.attributes["data-slot"] ?? "").join(" ");
  if (layouts.some((each) => rowSlots(each) !== rowSlots(first))) {
    return Result.fail(
      new KitUnmappable({
        message: `${definition.name}: its cells hold different rows above ${open.anchor}, and the nested column stands in for one list`,
      })
    );
  }
  const instanceFor = (root: CapturedRoot): InstanceDefinition | undefined =>
    (definition.parts ?? []).find(
      (part): part is InstanceDefinition =>
        "kind" in part && instanceRootSlotOf(part, part.cell(cell)) === root.root.attributes["data-slot"]
    );
  const parent = instanceFor(first.parent);
  const popup = instanceFor(first.popup);
  if (parent === undefined || popup === undefined || (definition.parts ?? []).length !== 2) {
    return Result.fail(
      new KitUnmappable({
        message: `${definition.name} must name one instance part for each popup, and the nested rule adds the rest`,
      })
    );
  }
  const box = (
    key: string,
    slot: string,
    parts: readonly (PartDefinition | InstanceDefinition)[]
  ): PartDefinition => ({
    key,
    slot,
    shownIn: () => true,
    label: undefined,
    iconsFor: () => [],
    parts,
  });
  const standIns = first.above.map((_row, index): PartDefinition => ({
    key: standInKey(index),
    slot: undefined,
    place: `${COLUMN_SLOTS.offset}/${String(index)}`,
    shownIn: () => true,
    label: undefined,
    iconsFor: () => [],
  }));
  return Result.succeed({
    ...definition,
    parts: [
      parent,
      box("column", COLUMN_SLOTS.column, [box("offset", COLUMN_SLOTS.offset, standIns), popup]),
    ],
  });
}

/** A nested composite's drawn boxes: its roots and the row's children in drawn order. */
export type NestedLayout = {
  /** The parent popup and the nested popup, as the cell measures them. */
  readonly roots: readonly CapturedRoot[];
  /**
   * The composite row's children in drawn order: the parent popup's element, then the column beside
   * it, which holds the stand-in stack and the nested popup's element.
   */
  readonly children: readonly CapturedElement[];
  /** The declarations of the composite's row, which the cascade applies to the composite's root. */
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
};

/** What {@link nestedLayout} reads beside the cell. */
export type NestedLayoutInput = {
  /** The cell's declarations, which the rule appends the declarations of the boxes it adds to. */
  readonly declarations: CapturedDeclaration[];
  readonly variables: VariableIndex;
  /**
   * The cascaded style of a captured element, without the elements around it: `resolved` returns
   * a physical longhand's winning value, as a box shorthand such as `margin` splits into its sides.
   */
  readonly styleOf: (element: CapturedElement) => {
    readonly resolved: (property: string) => string | undefined;
  };
};

/** A declaration the nested rule adds, a longhand that wins on the box it is written on. */
function nestedDeclaration(property: string, value: string): CapturedDeclaration {
  return {
    property,
    value,
    important: false,
    longhands: [property],
    source: "page",
    layer: "",
    selector: "",
    className: NESTED_PLACEMENT,
    owner: 0,
  };
}

/** A box the nested rule adds, with its `data-slot`, its declarations and its children. */
function nestedBox(
  slot: string | undefined,
  declarations: readonly number[],
  children: readonly CapturedElement[]
): CapturedElement {
  return {
    tag: "div",
    attributes: slot === undefined ? {} : { "data-slot": slot },
    classes: [],
    text: "",
    declarations,
    initial: [],
    pseudo: {},
    variables: {},
    unmatched: [],
    children: [...children],
  };
}

/**
 * The declarations of a row's stand-in: a fixed width of {@link STAND_IN_WIDTH} and a fixed height,
 * the row's `height`, or its `min-height` where its height is `auto`, and the row's block margins. A
 * row whose height is `min-h-(--row-h)` binds `row-h`, so the column follows the rows' height in
 * every mode while each row holds one line. A row's own padding and border sit inside that height
 * only where it is `border-box`.
 *
 * @throws `KitUnmappable` where the row's height follows its content, or where its padding or border
 *   adds to its height.
 */
function standInDeclarations(
  cellKey: string,
  row: CapturedElement,
  input: NestedLayoutInput
): readonly CapturedDeclaration[] {
  const style = input.styleOf(row);
  const slot = row.attributes["data-slot"] ?? row.tag;
  const height = style.resolved("height")?.trim();
  const minimum = style.resolved("min-height")?.trim();
  const blockSize =
    height !== undefined && height !== "auto"
      ? height
      : minimum !== undefined && minimum !== "auto" && !isZero(minimum)
        ? minimum
        : undefined;
  if (blockSize === undefined) {
    throw new KitUnmappable({
      message: `${cellKey}: ${slot} above the anchor row takes its height from its content, which a fixed stand-in cannot follow`,
    });
  }
  const edges = ["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"].filter(
    (longhand) => !isZero(style.resolved(longhand))
  );
  if (style.resolved("box-sizing")?.trim() !== "border-box" && edges.length > 0) {
    throw new KitUnmappable({
      message: `${cellKey}: ${slot} above the anchor row adds its ${edges.join(" and ")} to its height, which its stand-in does not draw`,
    });
  }
  const margins = ["margin-top", "margin-bottom"].flatMap((longhand) => {
    const value = style.resolved(longhand);
    return value === undefined || isZero(value) ? [] : [nestedDeclaration(longhand, value)];
  });
  return [nestedDeclaration("width", STAND_IN_WIDTH), nestedDeclaration("height", blockSize), ...margins];
}

/**
 * The boxes a nested composite draws in a cell: the parent popup's element, and the column beside
 * it, which holds a stand-in stack and the nested popup's element. The row's gap is a literal, so
 * the parent popup's end padding must hold one length in every mode, as `surface-pad-sm` does.
 *
 * @param cell - The cell.
 * @param open - The nested placement.
 * @param input - The cell's declarations, its variables and its elements' cascaded styles.
 * @returns The roots, the row's children in drawn order and the row's declarations.
 * @throws `KitUnmappable` where {@link nestedComposite}'s reads fail, where the parent popup's top or
 *   end padding sits over a border, where its end padding takes more than one length across modes,
 *   or where a row above the anchor row has no height of its own.
 */
export function nestedLayout(
  cell: CapturedCell,
  open: NestedPlacement,
  input: NestedLayoutInput
): NestedLayout {
  const roots = nestedRoots(cell, open);
  if (Result.isFailure(roots)) {
    throw roots.failure;
  }
  const { parent, popup, above } = roots.success;
  const parentStyle = input.styleOf(parent.root);
  const padding = (side: "top" | "right"): string => {
    const value = parentStyle.resolved(`padding-${side}`)?.trim() ?? "0px";
    if (!isZero(parentStyle.resolved(`border-${side}-width`))) {
      throw new KitUnmappable({
        message: `${cell.key}: the parent popup's padding-${side} sits over a border, and the nested popup's column reads the padding alone`,
      });
    }
    return value;
  };
  const end = readNumber(padding("right"), input.variables);
  const endPadding =
    end?.kind === "literal"
      ? end.value
      : end !== undefined && input.variables.minimum(end.variable) === input.variables.maximum(end.variable)
        ? input.variables.minimum(end.variable)
        : undefined;
  if (endPadding === undefined) {
    throw new KitUnmappable({
      message: `${cell.key}: the parent popup's padding-right takes more than one length across modes, which the nested popup's literal offset cannot follow`,
    });
  }
  const added = (declarations: readonly CapturedDeclaration[]): readonly number[] =>
    declarations.map((declaration) => input.declarations.push(declaration) - 1);
  const standIns = above.map((row) =>
    nestedBox(undefined, added(standInDeclarations(cell.key, row, input)), [])
  );
  const offset = nestedBox(
    COLUMN_SLOTS.offset,
    added([
      nestedDeclaration("display", "flex"),
      nestedDeclaration("flex-direction", "column"),
      nestedDeclaration("align-items", "flex-start"),
    ]),
    standIns
  );
  const column = nestedBox(
    COLUMN_SLOTS.column,
    added([
      nestedDeclaration("display", "flex"),
      nestedDeclaration("flex-direction", "column"),
      nestedDeclaration("align-items", "flex-start"),
      nestedDeclaration("gap", `${String(open.alignOffset)}px`),
      nestedDeclaration("padding-top", padding("top")),
    ]),
    [offset, popup.root]
  );
  return {
    roots: [parent, popup],
    children: [parent.root, column],
    declarations: [
      { property: "display", value: "flex" },
      { property: "flex-direction", value: "row" },
      { property: "align-items", value: "flex-start" },
      { property: "gap", value: `${String(open.sideOffset - endPadding)}px` },
    ],
  };
}
