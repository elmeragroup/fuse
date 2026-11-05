/**
 * Slack mrkdwn text: the units rendered notes are made of, and how each is written. Rendering and
 * section packing both work on these units, so no rendered text is parsed again.
 */

/**
 * Escapes the three characters Slack's mrkdwn reserves for its own markup.
 *
 * @param text - Plain text.
 * @returns The text, safe to put in mrkdwn.
 */
export function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A URL as a Slack link target. Markdown has already decoded the URL's entities, so it may hold
 * any character. Slack ends a link at `>` or `|` and reads `<` as the start of markup, and its
 * explicit `<!here>`, `<@U…>` and `<#C…>` syntax stays live even in verbatim text, so a target
 * holding `><!here>` would post a mention. Each of `<`, `>` and `|`, every whitespace and every
 * control character is therefore percent-encoded, which a browser decodes to the same URL, and
 * `&` is escaped as Slack expects.
 *
 * @param url - The URL, decoded.
 * @returns The target to write between `<` and `|`.
 */
export function linkTarget(url: string): string {
  return url.replaceAll("&", "&amp;").replaceAll(/[<>|\s\p{Cc}]/gu, (char) => encodeURIComponent(char));
}

/**
 * The text of an inline code span, escaped. Slack ends a code span at the next backtick and has no escape
 * for one inside it, so a code span such as ``` ``a`b`` ``` would end early and leave a stray
 * backtick. Each backtick in the code is shown as U+02CB MODIFIER LETTER GRAVE ACCENT (ˋ), which
 * looks like one and keeps the span whole.
 *
 * @param code - The code.
 * @returns The text to write between the span's backticks.
 */
export function codeText(code: string): string {
  return escapeText(code.replaceAll("`", "\u02CB"));
}

/**
 * One unit of rendered mrkdwn, built from the Markdown tree. Both rendering and section packing
 * work on these, so no rendered text is parsed again. Every kind but `text` and `space` is
 * indivisible when packed.
 */
export type Inline =
  /** Text without whitespace, escaped when rendered. It holds no markup, so it may be cut. */
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "space"; readonly text: string }
  /** Finished mrkdwn this script writes as is, such as a bullet or a quote marker. */
  | { readonly kind: "raw"; readonly text: string }
  | { readonly kind: "code"; readonly code: string }
  /** A link; an empty label renders the URL itself. */
  | { readonly kind: "link"; readonly url: string; readonly label: readonly Inline[] }
  /** Bold (`*`), italic (`_`) or strikethrough (`~`) around its children. */
  | { readonly kind: "span"; readonly mark: "*" | "_" | "~"; readonly children: readonly Inline[] };

/** A rendered line of notes, as its units. */
export type MrkdwnLine = readonly Inline[];

/**
 * Writes units as mrkdwn.
 *
 * @param units - The units.
 * @returns Their mrkdwn.
 */
export function render(units: readonly Inline[]): string {
  let text = "";
  for (const unit of units) text += renderUnit(unit);
  return text;
}

/**
 * Writes one unit as mrkdwn.
 *
 * @param unit - The unit.
 * @returns Its mrkdwn.
 */
export function renderUnit(unit: Inline): string {
  switch (unit.kind) {
    case "text":
      return escapeText(unit.text);
    case "space":
    case "raw":
      return unit.text;
    case "code":
      return `\`${codeText(unit.code)}\``;
    case "link":
      return unit.label.length === 0
        ? `<${linkTarget(unit.url)}>`
        : `<${linkTarget(unit.url)}|${render(unit.label)}>`;
    case "span":
      return `${unit.mark}${render(unit.children)}${unit.mark}`;
  }
}
