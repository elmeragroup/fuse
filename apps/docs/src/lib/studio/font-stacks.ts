/**
 * The font stacks the font knobs offer, by key: stacks the docs can render. `body` points the
 * heading font at the body font, so the font-sans knob does not offer it.
 */
export const FONT_STACKS = {
  roboto: "Roboto, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  body: "var(--font-sans)",
} as const;

export type FontStack = keyof typeof FONT_STACKS;

export const FONT_STACK_LABELS = {
  roboto: "Roboto",
  system: "System sans",
  serif: "Serif",
  mono: "Monospace",
  body: "Body font",
} as const satisfies Record<FontStack, string>;

export function isFontStack(key: string | null): key is FontStack {
  return key !== null && Object.hasOwn(FONT_STACKS, key);
}
