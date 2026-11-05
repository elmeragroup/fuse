/**
 * The docs' one taxonomy of the theme contract and the font variables an app sets beside it: the
 * section each token is filed under, with the kind of value it holds. The theme studio's inspector
 * stacks its sections, and the palettes handbook page groups its color roles by them. The studio imports this module and this module
 * never imports the studio, so the studio stays removable through `src/studio/registration.ts`.
 */

import type {
  TokenKind as ThemeTokenKind,
  TokenName as ThemeTokenName,
} from "@elmeragroup/fuse/theme-catalog";

/**
 * The font variables Fuse applies, which the studio edits beside the theme tokens. Themes name no
 * fonts, so an app sets these, and the studio seeds and writes them as the docs app does.
 */
export const FONT_VARIABLES = ["font-sans", "font-heading"] as const;

/** A font variable the studio edits. */
export type FontVariable = (typeof FONT_VARIABLES)[number];

/** A name the table files: a theme token, or a font variable. */
export type TokenName = ThemeTokenName | FontVariable;

/** The kind of value a name holds: a theme token's kind, or a font stack. */
export type TokenKind = ThemeTokenKind | "fontFamily";

/** A section of the theme contract, such as the surfaces or the chart colors. */
export type SectionId =
  | "surfaces"
  | "actions"
  | "status"
  | "lines"
  | "shape"
  | "typography"
  | "variant"
  | "sidebar"
  | "charts"
  | "syntax"
  | "ramps";

/** The sections, in the order the studio inspector stacks them and the palettes page lists them. */
export const TOKEN_SECTIONS = [
  { id: "surfaces", title: "Surfaces" },
  { id: "actions", title: "Actions" },
  { id: "status", title: "Status" },
  { id: "lines", title: "Lines and focus" },
  { id: "shape", title: "Shape" },
  { id: "typography", title: "Typography" },
  { id: "variant", title: "Variant layer" },
  { id: "sidebar", title: "Sidebar" },
  { id: "charts", title: "Charts" },
  { id: "syntax", title: "Syntax" },
  { id: "ramps", title: "Brand ramps" },
] as const satisfies readonly { id: SectionId; title: string }[];

/** Where a token is filed, and the kind of value it holds. */
export type TokenRow = { readonly section: SectionId; readonly kind: TokenKind };

const color = (section: SectionId): TokenRow => ({ section, kind: "color" });

/**
 * Every contract token, keyed by name in the contract's order, then the font variables, with its
 * section and kind. The record type makes a name without a row a compile error; the studio tests
 * check the order and the kinds against the resolved catalog.
 */
export const TOKEN_TABLE = {
  background: color("surfaces"),
  foreground: color("surfaces"),
  card: color("surfaces"),
  "card-foreground": color("surfaces"),
  "card-soft": color("surfaces"),
  "card-soft-foreground": color("surfaces"),
  popover: color("surfaces"),
  "popover-foreground": color("surfaces"),
  dialog: color("surfaces"),
  "dialog-foreground": color("surfaces"),
  muted: color("surfaces"),
  "muted-foreground": color("surfaces"),
  accent: color("surfaces"),
  "accent-foreground": color("surfaces"),
  feature: color("surfaces"),
  "feature-bright": color("surfaces"),
  "feature-foreground": color("surfaces"),
  primary: color("actions"),
  "primary-foreground": color("actions"),
  "primary-soft": color("actions"),
  "primary-soft-foreground": color("actions"),
  secondary: color("actions"),
  "secondary-foreground": color("actions"),
  "secondary-hover": color("actions"),
  "secondary-soft": color("actions"),
  "secondary-soft-foreground": color("actions"),
  brand: color("actions"),
  "brand-foreground": color("actions"),
  error: color("status"),
  "error-foreground": color("status"),
  "error-soft": color("status"),
  "error-soft-foreground": color("status"),
  info: color("status"),
  "info-foreground": color("status"),
  "info-soft": color("status"),
  "info-soft-foreground": color("status"),
  success: color("status"),
  "success-foreground": color("status"),
  "success-soft": color("status"),
  "success-soft-foreground": color("status"),
  warning: color("status"),
  "warning-foreground": color("status"),
  "warning-soft": color("status"),
  "warning-soft-foreground": color("status"),
  destructive: color("actions"),
  "destructive-foreground": color("actions"),
  border: color("lines"),
  input: color("lines"),
  ring: color("lines"),
  "card-border": color("variant"),
  "card-section-divider": color("variant"),
  "card-shadow": color("variant"),
  "button-outline": color("variant"),
  "selection-border": color("variant"),
  "selection-checked-border": color("variant"),
  "selection-divider": color("variant"),
  "selection-checked-divider": color("variant"),
  "selection-disabled-background": color("variant"),
  "selection-disabled-hatch": color("variant"),
  "selection-disabled-foreground": color("variant"),
  "toggle-pressed": color("variant"),
  "toggle-pressed-foreground": color("variant"),
  sidebar: color("sidebar"),
  "sidebar-foreground": color("sidebar"),
  "sidebar-accent": color("sidebar"),
  "sidebar-accent-foreground": color("sidebar"),
  "sidebar-border": color("sidebar"),
  "sidebar-ring": color("sidebar"),
  "sidebar-brand": color("sidebar"),
  "sidebar-brand-foreground": color("sidebar"),
  "right-panel": color("surfaces"),
  "right-panel-foreground": color("surfaces"),
  "chart-1": color("charts"),
  "chart-2": color("charts"),
  "chart-3": color("charts"),
  "chart-4": color("charts"),
  "chart-5": color("charts"),
  "chart-6": color("charts"),
  "chart-7": color("charts"),
  "chart-8": color("charts"),
  "chart-1-foreground": color("charts"),
  "chart-2-foreground": color("charts"),
  "chart-3-foreground": color("charts"),
  "chart-4-foreground": color("charts"),
  "chart-5-foreground": color("charts"),
  "chart-6-foreground": color("charts"),
  "chart-7-foreground": color("charts"),
  "chart-8-foreground": color("charts"),
  "chart-other": color("charts"),
  "chart-other-foreground": color("charts"),
  "chart-seq-1": color("charts"),
  "chart-seq-2": color("charts"),
  "chart-seq-3": color("charts"),
  "chart-seq-4": color("charts"),
  "chart-seq-5": color("charts"),
  "chart-seq-6": color("charts"),
  "chart-seq-7": color("charts"),
  "chart-diverging-1": color("charts"),
  "chart-diverging-2": color("charts"),
  "chart-diverging-3": color("charts"),
  "chart-diverging-4": color("charts"),
  "chart-diverging-5": color("charts"),
  "chart-diverging-6": color("charts"),
  "chart-diverging-7": color("charts"),
  "chart-sentiment-positive": color("charts"),
  "chart-sentiment-negative": color("charts"),
  "sh-identifier": color("syntax"),
  "sh-keyword": color("syntax"),
  "sh-string": color("syntax"),
  "sh-class": color("syntax"),
  "sh-property": color("syntax"),
  "sh-entity": color("syntax"),
  "sh-jsxliterals": color("syntax"),
  "sh-sign": color("syntax"),
  "sh-comment": color("syntax"),
  "brand-neutral-50": color("ramps"),
  "brand-neutral-100": color("ramps"),
  "brand-neutral-200": color("ramps"),
  "brand-neutral-300": color("ramps"),
  "brand-neutral-400": color("ramps"),
  "brand-neutral-500": color("ramps"),
  "brand-neutral-600": color("ramps"),
  "brand-neutral-700": color("ramps"),
  "brand-neutral-800": color("ramps"),
  "brand-neutral-900": color("ramps"),
  "brand-neutral-950": color("ramps"),
  "brand-shade-50": color("ramps"),
  "brand-shade-100": color("ramps"),
  "brand-shade-200": color("ramps"),
  "brand-shade-300": color("ramps"),
  "brand-shade-400": color("ramps"),
  "brand-shade-500": color("ramps"),
  "brand-shade-600": color("ramps"),
  "brand-shade-700": color("ramps"),
  "brand-shade-800": color("ramps"),
  "brand-shade-900": color("ramps"),
  "brand-shade-950": color("ramps"),
  radius: { section: "shape", kind: "dimension" },
  "radius-button": { section: "shape", kind: "dimension" },
  "radius-field": { section: "shape", kind: "dimension" },
  "radius-step": { section: "shape", kind: "dimension" },
  "button-outline-width": { section: "shape", kind: "dimension" },
  "selection-title-weight": { section: "typography", kind: "fontWeight" },
  "paragraph-leading-sm": { section: "typography", kind: "dimension" },
  "paragraph-leading-base": { section: "typography", kind: "dimension" },
  "paragraph-leading-lg": { section: "typography", kind: "dimension" },
  "heading-1-size": { section: "typography", kind: "dimension" },
  "heading-1-leading": { section: "typography", kind: "dimension" },
  "heading-1-weight": { section: "typography", kind: "fontWeight" },
  "heading-2-size": { section: "typography", kind: "dimension" },
  "heading-2-leading": { section: "typography", kind: "dimension" },
  "heading-2-weight": { section: "typography", kind: "fontWeight" },
  "heading-3-size": { section: "typography", kind: "dimension" },
  "heading-3-leading": { section: "typography", kind: "dimension" },
  "heading-3-weight": { section: "typography", kind: "fontWeight" },
  "font-sans": { section: "typography", kind: "fontFamily" },
  "font-heading": { section: "typography", kind: "fontFamily" },
} as const satisfies Record<TokenName, TokenRow>;
