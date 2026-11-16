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
  /** The element stays more than half a pixel under its `max-height`. */
  underMaxHeight: Schema.optionalKey(Schema.Literal(true)),
  /**
   * The element's line box holds its one inline-level child with no height or baseline offset of
   * its own, by a margin of 1px above and below: its content box's top and bottom edges are the
   * child's margin box's at its line height and at 2px more.
   */
  lineFits: Schema.optionalKey(Schema.Literal(true)),
  /**
   * On an anchored popup's root: the anchor beside it is more than half a pixel wider than the
   * popup's `min-width`, so Base UI widens the popup to the anchor.
   */
  anchorWiderThanMinimum: Schema.optionalKey(Schema.Literal(true)),
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
