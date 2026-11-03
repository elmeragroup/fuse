/**
 * The font stacks the font knobs offer, by key. They name families, as an app's CSS does, so a
 * stored or exported edit works in any app that loads the family. `inter` and `roboto` are the
 * stacks the docs set for internal and external themes. `body` points the heading font at the body
 * font, so the font-sans knob does not offer it.
 */
export const FONT_STACKS = {
  inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  roboto: "Roboto, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  body: "var(--font-sans)",
} as const;

export type FontStack = keyof typeof FONT_STACKS;

export const FONT_STACK_LABELS = {
  inter: "Inter",
  roboto: "Roboto",
  system: "System sans",
  serif: "Serif",
  mono: "Monospace",
  body: "Body font",
} as const satisfies Record<FontStack, string>;

export function isFontStack(key: string | null): key is FontStack {
  return key !== null && Object.hasOwn(FONT_STACKS, key);
}

/**
 * The families the docs load, by the variable that holds each face (`components/site-fonts.ts`).
 * `next/font` gives a face a generated family, so the docs reach it only through its variable.
 */
const PREVIEW_FACES: ReadonlyMap<string, string> = new Map([
  ["inter", "--font-inter"],
  ["roboto", "--font-roboto"],
]);

/**
 * A font stack as the docs preview draws it: each family the docs load, such as `Inter` or
 * `"Roboto"`, becomes the variable that holds its face, and every other family stays. A value that
 * is no font stack, such as `var(--font-sans)`, stays as it is. The studio stores and exports the
 * stack itself, so only an artboard reads this.
 *
 * @param stack - A font token's value.
 * @returns The value with the docs' loaded families read through their variables.
 */
export function previewFontStack(stack: string): string {
  const families = fontStackFamilies(stack);
  if (families === undefined) {
    return stack;
  }
  return families
    .map((family) => {
      const variable = PREVIEW_FACES.get(family.replaceAll(/^["']|["']$/gu, "").toLowerCase());
      return variable === undefined ? family : `var(${variable})`;
    })
    .join(", ");
}

/** A CSS identifier without escapes, such as `Segoe` or `-apple-system`; never `123`. */
const IDENTIFIER = String.raw`(?:--|-?[\p{L}_])[\p{L}\p{N}_-]*`;

/**
 * One family: a quoted name of free text without quotes or backslashes, or identifiers between
 * spaces, such as `Segoe UI` or `ui-sans-serif`.
 */
const FAMILY = String.raw`(?:"[^"'\\]+"|'[^"'\\]+'|${IDENTIFIER}(?:\s+${IDENTIFIER})*)`;

const FONT_STACK = new RegExp(`^${FAMILY}(?:\\s*,\\s*${FAMILY})*$`, "u");

/**
 * Whether a value is a font stack: families between commas, each a quoted name or plain
 * identifiers. The font knob's reading and the preview share this one grammar.
 *
 * @param css - A trimmed token value.
 * @returns True when the value is a font stack.
 */
export function isFontStackText(css: string): boolean {
  return FONT_STACK.test(css);
}

const STACK_FAMILY = new RegExp(FAMILY, "gu");

/**
 * The families of a font stack, in order and as written. A quoted name stays whole even when it
 * holds a comma.
 *
 * @param css - A token value.
 * @returns The families, or `undefined` when the value is no font stack, such as `var(--font-sans)`.
 */
export function fontStackFamilies(css: string): readonly string[] | undefined {
  const stack = css.trim();
  return FONT_STACK.test(stack) ? Array.from(stack.matchAll(STACK_FAMILY), ([family]) => family) : undefined;
}
