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
export const CAPTURE_VERSION = 1;

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

/** An element as the capture records it, with the elements below it. */
export type CapturedElement = {
  readonly tag: string;
  /** Every attribute but `class` and `style`, with Base UI's generated ids numbered per cell. */
  readonly attributes: { readonly [name: string]: string };
  readonly classes: readonly string[];
  /** The text of the element's own text nodes, joined, empty for none. */
  readonly text: string;
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
  readonly children: readonly CapturedElement[];
};

const CapturedElementSchema: Schema.Codec<CapturedElement> = Schema.Struct({
  tag: Schema.String,
  attributes: Schema.Record(Schema.String, Schema.String),
  classes: Schema.Array(Schema.String),
  text: Schema.String,
  declarations: Schema.Array(Schema.Finite),
  initial: Schema.Array(Schema.Finite),
  pseudo: Schema.Record(Schema.String, Schema.Array(Schema.Finite)),
  variables: Schema.Record(Schema.String, VariableSourceSchema),
  children: Schema.Array(Schema.suspend((): Schema.Codec<CapturedElement> => CapturedElementSchema)),
});

const CapturedCellSchema = Schema.Struct({
  /** The cell's variant key, as `variantKey` writes it. */
  key: Schema.String,
  cell: Schema.Record(Schema.String, Schema.String),
  /**
   * The elements of the component's own markup around the root, outermost first, from the page's
   * slot to the root's parent, each with no children, as a Field root around its label.
   */
  around: Schema.Array(CapturedElementSchema),
  /** The cell's root, the element the set measures. */
  root: CapturedElementSchema,
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
      ["declarations", JSON.stringify(element.declarations)],
      ["initial", JSON.stringify(element.initial)],
      ["pseudo", JSON.stringify(element.pseudo)],
      ["variables", JSON.stringify(element.variables)],
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
          "around",
          list(
            cell.around.map((element) => printElement(element, "      ")),
            "    "
          ),
        ],
        ["root", printElement(cell.root, "    ")],
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
