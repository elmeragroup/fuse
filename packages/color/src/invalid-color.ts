/**
 * The failure every color parser returns for text it rejects.
 */

/** A notation the parsers read. `css-color` is the parser that accepts any of them. */
export type ColorNotation = "css-color" | "hex" | "lab" | "oklch" | "rgb";

const EXPECTED = {
  "css-color": "an oklch(), lab(), rgb() or hex color",
  hex: "a #rrggbb hex color",
  lab: "a lab() color",
  oklch: "an oklch() color",
  rgb: "an rgb() color",
} as const satisfies Record<ColorNotation, string>;

// A server may parse colors that anyone sent it, so the error keeps no copy of the input and
// its message quotes at most this many characters of it.
const QUOTED_INPUT_LIMIT = 64;

/** Text that is not a color in the notation a parser reads. */
export class InvalidColor extends Error {
  /** The tag Effect's `catchTag` and a `switch` match on. */
  readonly _tag = "InvalidColor" as const;

  /** The notation the parser reads. */
  readonly notation: ColorNotation;

  /**
   * Build the error for text a parser rejects.
   *
   * @param notation - The notation the parser reads.
   * @param input - The rejected text. The message quotes a bounded prefix of it.
   */
  constructor(notation: ColorNotation, input: string) {
    const quoted =
      input.length > QUOTED_INPUT_LIMIT
        ? `${JSON.stringify(input.slice(0, QUOTED_INPUT_LIMIT))}…`
        : JSON.stringify(input);
    super(`Expected ${EXPECTED[notation]}, received ${quoted}`);
    this.name = "InvalidColor";
    this.notation = notation;
  }
}
