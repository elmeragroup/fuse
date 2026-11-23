/**
 * Plain text as MDX. `create` and `slides add` write an author's title, subtitle and brief line into
 * a slide, where `{`, `<`, Markdown punctuation and a leading `import` or `export` would otherwise
 * become code, JSX or markup.
 */

/** Every ASCII punctuation character, each of which CommonMark lets a backslash escape. */
const PUNCTUATION = /[!-/:-@[-`{-~]/g;

/** A line MDX reads as an ESM statement. */
const ESM_KEYWORD = /^(?:import|export)\b/;

/**
 * Write plain text so MDX renders it as that text on one line.
 *
 * @param text - The text, as the author typed it.
 * @returns The text with line breaks as spaces, punctuation escaped, and a leading `import` or
 *   `export` written with a character reference.
 */
export function mdxText(text: string): string {
  const line = text.replace(/\r\n|\r|\n/g, " ").trim();
  const escaped = line.replace(PUNCTUATION, (character) => `\\${character}`);
  return ESM_KEYWORD.test(escaped) ? `&#${String(escaped.charCodeAt(0))};${escaped.slice(1)}` : escaped;
}
