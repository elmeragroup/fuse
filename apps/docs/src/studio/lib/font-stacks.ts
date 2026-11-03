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

/** One family of a stack: a quoted name, or the text up to the next comma. */
const STACK_FAMILY = /"[^"]*"|'[^']*'|[^,]+/gu;

/**
 * A font stack as the docs preview draws it: each family the docs load, such as `Inter` or
 * `"Roboto"`, becomes the variable that holds its face, and every other family stays. The studio
 * stores and exports the stack itself, so only an artboard reads this.
 *
 * @param stack - A font stack that names families.
 * @returns The stack with the docs' loaded families read through their variables.
 */
export function previewFontStack(stack: string): string {
  return Array.from(stack.matchAll(STACK_FAMILY), ([family]) => {
    const name = family
      .trim()
      .replaceAll(/^["']|["']$/gu, "")
      .toLowerCase();
    const variable = PREVIEW_FACES.get(name);
    return variable === undefined ? family.trim() : `var(${variable})`;
  })
    .filter((family) => family !== "")
    .join(", ");
}
