/**
 * The capture of a component set: what Chromium rendered for each cell of the set's matrix, as the
 * capture-backed cascade reads it. A capture holds the DOM below each cell's root, each element's
 * winning authored declarations with where they came from, and where each custom property a
 * declaration reads is set. It holds no measured box, so a capture taken on macOS and one taken on
 * Linux agree, and the repository keeps it as a reviewed input under `captures/`.
 */

import { Result, Schema } from "effect";

/** The format name a capture file carries. */
export const CAPTURE_FORMAT = "fuse-kit-capture";

/** The format version a capture file carries. */
export const CAPTURE_VERSION = 3;

/**
 * The value a capture records for Base UI's `--anchor-width` in place of the pixels it measured:
 * the anchor's width, which the build resolves from the spec of the anchor's instance.
 */
export const ANCHOR_WIDTH = "the anchor's width";

/**
 * The value a capture records for the inline `left` or `top` Base UI writes on a popup's arrow in
 * place of the pixels it measured: the offset that puts the arrow's centre on the anchor's centre,
 * which the build resolves from the popup's alignment.
 */
export const ANCHOR_CENTRE = "the anchor's centre";

/**
 * Where a declaration comes from: Fuse's stylesheet, Tailwind's preflight, the browser's default
 * style sheet, the host page around the cell, or the element's `style` attribute.
 */
const DeclarationSourceSchema = Schema.Literals(["fuse", "preflight", "user-agent", "page", "inline"]);

/** Where a declaration comes from, as {@link DeclarationSourceSchema} lists. */
export type DeclarationSource = typeof DeclarationSourceSchema.Type;

const CapturedDeclarationSchema = Schema.Struct({
  /** The property as the rule writes it, a shorthand such as `padding-inline` included. */
  property: Schema.String,
  /** The value as the rule writes it, without `!important`. */
  value: Schema.String,
  important: Schema.Boolean,
  /** The longhands the declaration wins on the element, or its own name for a longhand. */
  longhands: Schema.Array(Schema.String),
  source: DeclarationSourceSchema,
  /** The cascade layer that holds the rule, empty for an unlayered rule. */
  layer: Schema.String,
  /** The selector of the rule that matched, empty for the `style` attribute. */
  selector: Schema.String,
  /**
   * The class the rule selects through, as the element or an ancestor carries it, or a name for a
   * rule that selects through no class, such as `tailwind preflight`.
   */
  className: Schema.String,
  /** How many elements up the class sits: 0 for the element itself, 1 for its parent. */
  owner: Schema.Finite,
  /**
   * The value the browser's default style sheet gives the declaration's longhand on the element,
   * which a `revert` in the value rolls the cascade back to (CSS Cascade 4 §7.3.3), as a caption's
   * `text-align: var(--table-caption-align, revert)` takes Chromium's `-webkit-center`. Recorded
   * only where the value names `revert` and that style sheet sets the longhand.
   */
  revertsTo: Schema.optionalKey(Schema.String),
});

/** One winning declaration of an element. */
export type CapturedDeclaration = typeof CapturedDeclarationSchema.Type;

/**
 * Where the value of a custom property an element's declaration reads is set: on the element, on an
 * ancestor some elements up, by the theme the page loads, or nowhere.
 */
const VariableSourceSchema = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("element"), up: Schema.Finite }),
  Schema.Struct({ _tag: Schema.Literal("theme") }),
  Schema.Struct({ _tag: Schema.Literal("unset") }),
]);

/** Where a custom property's value is set, as {@link VariableSourceSchema} lists. */
export type VariableSource = typeof VariableSourceSchema.Type;

/**
 * What the capture measured of an element in its cell, as facts that hold on any platform, never as
 * a box: each is recorded only where it holds by a margin no font's metrics move.
 */
const MeasuredFactsSchema = Schema.Struct({
  /**
   * The root fills the element around it, whose content width its own text does not change, in CSS
   * pixels: the width a sample's host or a popup's own CSS gives it, as Select's `min-w-36` does.
   */
  containerWidth: Schema.optionalKey(Schema.Finite),
  /**
   * The element is the widest row of a root that hugs its rows: its text's own width, more than half
   * a pixel wider than any other row's, sets the root's width past its `min-width`.
   */
  widest: Schema.optionalKey(Schema.Literal(true)),
  /** The element's text, or a wrapping row's items, sits on one line under its `max-width`. */
  oneLine: Schema.optionalKey(Schema.Literal(true)),
  /**
   * On the root: how many of the elements around it, innermost first, lie exactly behind it, their
   * padding box its border box with none of the paint the capture checks between (issue #766),
   * whose background the root then shows.
   */
  coincidingAround: Schema.optionalKey(Schema.Finite),
  /**
   * The element ends its one line in an ellipsis, and its content box holds its first character and
   * the ellipsis by a pixel, so the browser draws the ellipsis where a Figma text's would sit.
   */
  ellipsisFits: Schema.optionalKey(Schema.Literal(true)),
  /** The element stays more than half a pixel under its `max-height`. */
  underMaxHeight: Schema.optionalKey(Schema.Literal(true)),
  /**
   * In every density and theme, the element is as wide with its `max-width` 24px lower, so the
   * maximum never narrows it.
   */
  underMaxWidth: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A flex line whose items hold auto margins along it, which in every density and theme leaves at
   * least 24px of free space for them, so they take room and push the items after them to its end.
   */
  freeAlongMain: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A flex line whose items hold auto margins along it, which in every density and theme fits its
   * items with a pixel to spare once those margins are zero, so none of them shrinks.
   */
  fitsAlongMain: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A flex row of two or more items that grow, each as wide as its own max-content width in every
   * density and theme, so none of them grows past its content.
   */
  itemsAtContent: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A root whose height is a percentage, where the first element above it whose height is a length
   * is as tall as that length in every density and theme, so the percentage resolves against it.
   */
  basisAsDeclared: Schema.optionalKey(Schema.Literal(true)),
  /**
   * An element with an aspect ratio and an `auto` height, whose border box is as tall as its width
   * times the ratio and keeps its width, height and ratio in every density and theme, so the ratio
   * sets its height. It holds the border box's width and height, in CSS pixels.
   */
  ratioHeight: Schema.optionalKey(Schema.Struct({ width: Schema.Finite, height: Schema.Finite })),
  /**
   * A table box whose rows, cells or one child tile its content box with no space between, in every
   * density and theme, so no column or row stretches a cell past what it holds.
   */
  tableTiles: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A table row whose table collapses its borders in every density and theme, so its borders sit on
   * the grid lines between the cells (CSS 2.1 §17.6.2) and take no room in its own box, and whose
   * bordered edges no other box that shares them sets a border on (CSS 2.1 §17.6.2.1).
   */
  bordersCollapse: Schema.optionalKey(Schema.Literal(true)),
  /**
   * An item of a flex row whose own display is `inline`, which the row blockifies, where in every
   * density and theme the row's items sit on its one line in source order, each one box with its
   * own text on one line.
   */
  inlineRow: Schema.optionalKey(Schema.Literal(true)),
  /**
   * The element's line box holds its one inline-level child with no height or baseline offset of
   * its own, by a margin of 1px above and below: its content box's top and bottom edges are the
   * child's margin box's at its line height and at 2px more.
   */
  lineFits: Schema.optionalKey(Schema.Literal(true)),
  /**
   * A grid with one column whose column is its content box's width, with its items' least widths
   * at least a pixel inside it, so an `auto` column stays as wide as the grid.
   */
  trackFits: Schema.optionalKey(Schema.Literal(true)),
  /**
   * On an anchored popup's root: the anchor beside it is more than half a pixel wider than the
   * popup's `min-width`, so Base UI widens the popup to the anchor.
   */
  anchorWiderThanMinimum: Schema.optionalKey(Schema.Literal(true)),
  /**
   * The element's `::before` and `::after` that paint and, in every density and theme, are absolute
   * boxes laid out against the element, its containing block, so the kit draws each as a layer.
   */
  pseudoBoxes: Schema.optionalKey(Schema.Array(Schema.Literals(["before", "after"]))),
  /**
   * On a grid of two or more columns: the columns, from 0, that in every density and theme are as
   * wide as their widest item at max-content, which a Figma HUG track draws.
   */
  gridHugs: Schema.optionalKey(Schema.Array(Schema.Finite)),
  /**
   * On a grid of two or more columns: the columns, from 0, that in every density and theme are wider
   * than each of their items at min-content by a clearance no platform's font moves, so an `auto`
   * floor under a flexible column binds nowhere.
   */
  gridHolds: Schema.optionalKey(Schema.Array(Schema.Finite)),
  /**
   * On a grid of two or more columns: for each column, the item, by its place among the grid's items,
   * that in every density and theme is at least as wide as every other item in the column, or -1.
   */
  gridWidest: Schema.optionalKey(Schema.Array(Schema.Finite)),
  /** The same for each row and the item at least as tall as every other item in it. */
  gridTallest: Schema.optionalKey(Schema.Array(Schema.Finite)),
  /** On such a grid, how many items it lays out, the same in every density and theme. */
  gridItems: Schema.optionalKey(Schema.Finite),
  /** On an item of such a grid, its place among the grid's items, from 0. */
  gridItem: Schema.optionalKey(Schema.Finite),
  /**
   * In every density and theme, the element generates no box and adds nothing to its parent's flow
   * but its children's boxes: `display: contents`, no text of its own and no `::before` or `::after`
   * in flow (CSS Display 3 §2.5).
   */
  noBox: Schema.optionalKey(Schema.Literal(true)),
  /**
   * On an absolute element below the root: in every density and theme, its static parent's border
   * box is the padding box of its containing block, an element above the parent, and stays so with
   * that block grown, so the kit places the element in the parent's frame.
   */
  parentSpansBlock: Schema.optionalKey(Schema.Literal(true)),
  /**
   * On an absolute element below the root: the axes along which its border box is one length, within
   * a 64th of a pixel, in every density and theme, so its place at its parent's end does not move as
   * a mode changes its length.
   */
  oneLength: Schema.optionalKey(Schema.Array(Schema.Literals(["horizontal", "vertical"]))),
});

/** What the capture measured of an element, as {@link MeasuredFactsSchema} lists. */
export type MeasuredFacts = typeof MeasuredFactsSchema.Type;

/** An element as the capture records it, with the elements below it. */
export type CapturedElement = {
  readonly tag: string;
  /** Every attribute but `class` and `style`, with Base UI's generated ids numbered per cell. */
  readonly attributes: { readonly [name: string]: string };
  readonly classes: readonly string[];
  /** The text of the element's own text nodes, joined, empty for none. */
  readonly text: string;
  /**
   * How many element children precede the element's first own text node, where it has text: an
   * icon or part before its label sits below that index, and one after it at or above it.
   */
  readonly textIndex?: number;
  /**
   * The element's text nodes joined between its element children, as written, where `text` and
   * `textIndex` lose some of them: the text before each child, then the text after the last. A text
   * node of white space alone, which `text` trims away, or text on both sides of an element child
   * records them, as Code's line feeds between its line spans do.
   */
  readonly texts?: readonly string[];
  /** The element's winning declarations, as indexes into the capture's `declarations`. */
  readonly declarations: readonly number[];
  /**
   * The winning declarations that leave every longhand they win at its initial value, as the
   * browser computes it, such as the zero margin Fuse's base layer sets: a subset of `declarations`.
   */
  readonly initial: readonly number[];
  /** The winning declarations of each pseudo-element that has some, such as `placeholder`. */
  readonly pseudo: { readonly [name: string]: readonly number[] };
  /** Where each custom property the element's declarations read is set, by name. */
  readonly variables: { readonly [name: string]: VariableSource };
  /**
   * The classes the element carries that a rule of the page's stylesheets is written for, where no
   * rule written for the class matched this element or an element below it, such as
   * `read-only:bg-muted` on a trigger that is not read-only. A class matched in no cell of a set
   * styles a state no cell shows, which the build lists as unmapped.
   */
  readonly unmatched: readonly string[];
  /** What the capture measured of the element, absent where it recorded nothing. */
  readonly measured?: MeasuredFacts;
  readonly children: readonly CapturedElement[];
};

const CapturedElementSchema: Schema.Codec<CapturedElement> = Schema.Struct({
  tag: Schema.String,
  attributes: Schema.Record(Schema.String, Schema.String),
  classes: Schema.Array(Schema.String),
  text: Schema.String,
  textIndex: Schema.optionalKey(Schema.Finite),
  texts: Schema.optionalKey(Schema.Array(Schema.String)),
  declarations: Schema.Array(Schema.Finite),
  initial: Schema.Array(Schema.Finite),
  pseudo: Schema.Record(Schema.String, Schema.Array(Schema.Finite)),
  variables: Schema.Record(Schema.String, VariableSourceSchema),
  unmatched: Schema.Array(Schema.String),
  measured: Schema.optionalKey(MeasuredFactsSchema),
  children: Schema.Array(Schema.suspend((): Schema.Codec<CapturedElement> => CapturedElementSchema)),
});

const CapturedRootSchema = Schema.Struct({
  /**
   * The elements of the component's own markup around the root, outermost first, from the page's
   * slot to the root's parent, each with no children, as a Field root around its label.
   */
  around: Schema.Array(CapturedElementSchema),
  /** The root, an element the set measures. */
  root: CapturedElementSchema,
});

/** One element a cell measures, with the elements around it. */
export type CapturedRoot = typeof CapturedRootSchema.Type;

const CapturedCellSchema = Schema.Struct({
  /** The cell's variant key, as `variantKey` writes it. */
  key: Schema.String,
  cell: Schema.Record(Schema.String, Schema.String),
  /**
   * The elements the cell measures, in the order its renderer names them: the set's root, or an
   * open composite's anchor and popup, or its backdrop and popup.
   */
  roots: Schema.NonEmptyArray(CapturedRootSchema),
  /**
   * Set on a state the page forced where no rule written for it matched this cell, while another
   * cell of the set reaches the same state: the component leaves the state unstyled here, so the
   * cell draws as its resting twin, as a selected calendar day's hover does.
   */
  drawsAsRest: Schema.optionalKey(Schema.Literal(true)),
});

/** One cell of a capture. */
export type CapturedCell = typeof CapturedCellSchema.Type;

const SetCaptureSchema = Schema.Struct({
  format: Schema.Literal(CAPTURE_FORMAT),
  version: Schema.Literal(CAPTURE_VERSION),
  set: Schema.String,
  /** The page the capture ran in, which the cache key and the drift check compare. */
  environment: Schema.Struct({
    chromium: Schema.String,
    theme: Schema.String,
    locale: Schema.String,
  }),
  /**
   * The page's elements around every cell, outermost first: `<html>`, `<body>` and the slot that
   * holds the cell, with no children and without the slot's `style` attribute, which places it.
   */
  page: Schema.Array(CapturedElementSchema),
  /** Every winning declaration of the capture once, in the order the cells first name them. */
  declarations: Schema.Array(CapturedDeclarationSchema),
  cells: Schema.Array(CapturedCellSchema),
});

/** The capture of one component set. */
export type SetCapture = typeof SetCaptureSchema.Type;

/** A capture file this version cannot read. */
export class CaptureUnreadable extends Error {
  readonly _tag = "CaptureUnreadable" as const;
}

const decode = Schema.decodeUnknownResult(Schema.fromJsonString(SetCaptureSchema));

const decodeValue = Schema.decodeUnknownResult(SetCaptureSchema);

/**
 * Parse a capture file that a JSON import already read.
 *
 * @param value - The file's value.
 * @returns The capture, or `CaptureUnreadable` with the schema's account of what is wrong.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSON import boundary: a kept capture's value has only the type TypeScript infers from its text, which the schema parses here
export function decodeCapture(value: unknown): Result.Result<SetCapture, CaptureUnreadable> {
  return Result.mapError(
    decodeValue(value),
    (error) =>
      new CaptureUnreadable(
        `not a ${CAPTURE_FORMAT} version ${String(CAPTURE_VERSION)} file: ${error.message}`
      )
  );
}

/**
 * Parse a capture file's text.
 *
 * @param text - The file's contents.
 * @returns The capture, or `CaptureUnreadable` with the schema's account of what is wrong.
 */
export function parseCapture(text: string): Result.Result<SetCapture, CaptureUnreadable> {
  return Result.mapError(
    decode(text),
    (error) =>
      new CaptureUnreadable(
        `not a ${CAPTURE_FORMAT} version ${String(CAPTURE_VERSION)} file: ${error.message}`
      )
  );
}

/** Items as a JSON list, one per line at `indent` plus two spaces, or `[]` for none. */
function list(items: readonly string[], indent: string): string {
  return items.length === 0
    ? "[]"
    : `[\n${items.map((item) => `${indent}  ${item}`).join(",\n")}\n${indent}]`;
}

/** Fields as a JSON object, one per line at `indent` plus two spaces. */
function fields(entries: readonly (readonly [string, string])[], indent: string): string {
  return `{\n${entries.map(([key, value]) => `${indent}  ${JSON.stringify(key)}: ${value}`).join(",\n")}\n${indent}}`;
}

/** An element, each field on a line, its lists of names and indexes on one. */
function printElement(element: CapturedElement, indent: string): string {
  const inner = `${indent}  `;
  return fields(
    [
      ["tag", JSON.stringify(element.tag)],
      ["attributes", JSON.stringify(element.attributes)],
      ["classes", JSON.stringify(element.classes)],
      ["text", JSON.stringify(element.text)],
      ...(element.textIndex === undefined ? [] : [["textIndex", JSON.stringify(element.textIndex)] as const]),
      ...(element.texts === undefined ? [] : [["texts", JSON.stringify(element.texts)] as const]),
      ["declarations", JSON.stringify(element.declarations)],
      ["initial", JSON.stringify(element.initial)],
      ["pseudo", JSON.stringify(element.pseudo)],
      ["variables", JSON.stringify(element.variables)],
      ["unmatched", JSON.stringify(element.unmatched)],
      ...(element.measured === undefined ? [] : [["measured", JSON.stringify(element.measured)] as const]),
      [
        "children",
        list(
          element.children.map((child) => printElement(child, `${inner}  `)),
          inner
        ),
      ],
    ],
    indent
  );
}

/**
 * Write a capture as the repository keeps it: JSON two spaces per level, each declaration and each
 * element's field on one line, in the order the capture built them, so two captures of the same page
 * write the same bytes, and a review reads one declaration per line.
 *
 * @param capture - The capture.
 * @returns The file's text.
 */
export function formatCapture(capture: SetCapture): string {
  const cells = capture.cells.map((cell) =>
    fields(
      [
        ["key", JSON.stringify(cell.key)],
        ["cell", JSON.stringify(cell.cell)],
        ...(cell.drawsAsRest === true ? ([["drawsAsRest", "true"]] as const) : []),
        [
          "roots",
          list(
            cell.roots.map(({ around, root }) =>
              fields(
                [
                  [
                    "around",
                    list(
                      around.map((element) => printElement(element, "          ")),
                      "        "
                    ),
                  ],
                  ["root", printElement(root, "        ")],
                ],
                "      "
              )
            ),
            "    "
          ),
        ],
      ],
      "  "
    )
  );
  const file = fields(
    [
      ["format", JSON.stringify(capture.format)],
      ["version", JSON.stringify(capture.version)],
      ["set", JSON.stringify(capture.set)],
      ["environment", JSON.stringify(capture.environment)],
      [
        "page",
        list(
          capture.page.map((element) => printElement(element, "    ")),
          "  "
        ),
      ],
      [
        "declarations",
        list(
          capture.declarations.map((declaration) => JSON.stringify(declaration)),
          "  "
        ),
      ],
      ["cells", list(cells, "  ")],
    ],
    ""
  );
  return `${file}\n`;
}
