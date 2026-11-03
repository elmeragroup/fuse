/**
 * The font stacks the font knobs offer, by key: stacks the docs can render. The docs load Inter and
 * Roboto through `next/font`, which names each face by a generated family and exposes it as a
 * variable, so `inter` and `roboto` reach the faces through `--font-inter` and `--font-roboto`.
 * They are the stacks the docs set for internal and external themes (`styles/globals.css`). `body`
 * points the heading font at the body font, so the font-sans knob does not offer it.
 */
export const FONT_STACKS = {
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  roboto: "var(--font-roboto), ui-sans-serif, system-ui, sans-serif",
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

/** The variables that hold the faces the docs load, which a stack may name as a family. */
export const LOADED_FONT_VARIABLES = ["--font-inter", "--font-roboto"] as const;

export function isFontStack(key: string | null): key is FontStack {
  return key !== null && Object.hasOwn(FONT_STACKS, key);
}
