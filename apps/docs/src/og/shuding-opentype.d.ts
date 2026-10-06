/**
 * The slice of `@shuding/opentype.js` the OG card measures text with. The package ships no
 * types, and `@types/opentype.js` describes upstream opentype.js, not this fork Satori pins.
 */
declare module "@shuding/opentype.js" {
  /** A parsed font. */
  export type Font = {
    /**
     * The advance width of a run of text, as Satori measures it before wrapping.
     *
     * @param text - The text to measure.
     * @param fontSize - The font size in px.
     * @param options - `letterSpacing` as a fraction of the font size, such as `-0.01` for -0.01em.
     * @returns The width in px.
     */
    getAdvanceWidth(text: string, fontSize: number, options?: { readonly letterSpacing?: number }): number;
  };

  /**
   * Parse a TTF, OTF or WOFF file.
   *
   * @param buffer - The font file's bytes.
   * @returns The parsed font.
   */
  export function parse(buffer: ArrayBuffer): Font;
}
