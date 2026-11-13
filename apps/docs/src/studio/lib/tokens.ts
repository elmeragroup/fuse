import type {
  TokenKind as ThemeTokenKind,
  TokenName as ThemeTokenName,
} from "@elmeragroup/fuse/theme-catalog";

/**
 * The font variables Fuse applies, which the editor edits beside the theme tokens. Themes name no
 * fonts, so an app sets these, and the studio seeds and writes them as the docs app does.
 */
export const FONT_VARIABLES = ["font-sans", "font-heading"] as const;

/** A font variable the editor edits. */
export type FontVariable = (typeof FONT_VARIABLES)[number];

const FONT_VARIABLE_NAMES: ReadonlySet<string> = new Set(FONT_VARIABLES);

/** Whether `name` is a font variable rather than a theme token. */
export function isFontVariable(name: string): name is FontVariable {
  return FONT_VARIABLE_NAMES.has(name);
}

/** A name the editor edits: a theme token, or a font variable. */
export type TokenName = ThemeTokenName | FontVariable;

/** The kind of value a knob edits: a theme token's kind, or a font stack. */
export type TokenKind = ThemeTokenKind | "fontFamily";

/** An inspector section of the token editor. */
export type SectionId =
  | "surfaces"
  | "actions"
  | "status"
  | "lines"
  | "shape"
  | "typography"
  | "identity"
  | "sidebar"
  | "ramps"
  | "charts"
  | "syntax";

/** The token editor's sections, in the order the inspector stacks them. */
export const STUDIO_SECTIONS = [
  { id: "surfaces", title: "Surfaces" },
  { id: "actions", title: "Actions" },
  { id: "status", title: "Status" },
  { id: "lines", title: "Lines and focus" },
  { id: "shape", title: "Shape" },
  { id: "typography", title: "Typography" },
  { id: "identity", title: "Identity layer" },
  { id: "sidebar", title: "Sidebar" },
  { id: "ramps", title: "Brand ramps" },
  { id: "charts", title: "Charts" },
  { id: "syntax", title: "Syntax" },
] as const satisfies readonly { id: SectionId; title: string }[];

/** Where the editor files a token, and the kind of value its knob edits. */
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
  panel: color("surfaces"),
  "panel-foreground": color("surfaces"),
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
  "card-border": color("identity"),
  "card-section-divider": color("identity"),
  "card-shadow": color("identity"),
  "button-outline": color("identity"),
  "selection-border": color("identity"),
  "selection-checked-border": color("identity"),
  "selection-divider": color("identity"),
  "selection-checked-divider": color("identity"),
  "selection-disabled-background": color("identity"),
  "selection-disabled-hatch": color("identity"),
  "selection-disabled-foreground": color("identity"),
  "toggle-pressed": color("identity"),
  "toggle-pressed-foreground": color("identity"),
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
  "brand-1-50": color("ramps"),
  "brand-1-100": color("ramps"),
  "brand-1-200": color("ramps"),
  "brand-1-300": color("ramps"),
  "brand-1-400": color("ramps"),
  "brand-1-500": color("ramps"),
  "brand-1-600": color("ramps"),
  "brand-1-700": color("ramps"),
  "brand-1-800": color("ramps"),
  "brand-1-900": color("ramps"),
  "brand-1-950": color("ramps"),
  "brand-2-50": color("ramps"),
  "brand-2-100": color("ramps"),
  "brand-2-200": color("ramps"),
  "brand-2-300": color("ramps"),
  "brand-2-400": color("ramps"),
  "brand-2-500": color("ramps"),
  "brand-2-600": color("ramps"),
  "brand-2-700": color("ramps"),
  "brand-2-800": color("ramps"),
  "brand-2-900": color("ramps"),
  "brand-2-950": color("ramps"),
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

/** Every contract token, in the contract's order, then the font variables. */
export const STUDIO_TOKEN_NAMES: readonly TokenName[] = Object.keys(TOKEN_TABLE).filter(
  (name): name is TokenName => Object.hasOwn(TOKEN_TABLE, name)
);

const KNOWN_NAMES: ReadonlySet<string> = new Set(STUDIO_TOKEN_NAMES);

/** Whether `name` is a contract token or a font variable. */
export function isTokenName(name: string): name is TokenName {
  return KNOWN_NAMES.has(name);
}

/**
 * Whether a token filter's text finds `name`: a case-insensitive part of the name, with or without
 * its leading `--`.
 */
export function matchesTokenQuery(name: TokenName, query: string): boolean {
  return name.includes(query.trim().toLowerCase().replace(/^-+/u, ""));
}

/** A section's tokens, in the contract's order. */
export function sectionTokens(section: SectionId): readonly TokenName[] {
  return STUDIO_TOKEN_NAMES.filter((name) => TOKEN_TABLE[name].section === section);
}

/**
 * The keys a dark palette keeps from light: geometry, the card edge, section divider and shadow
 * colors, the outline and selection border and divider colors, the disabled selection row's fill,
 * stripe and text colors, the pressed Toggle's fill and text colors, the brand ramp steps, the
 * selection title weight, the paragraph line heights, the heading scale and the heading font. The
 * set is Fuse's private `LIGHT_ONLY_KEYS` (`packages/fuse/src/theme/tokens/contract.ts`), the tokens
 * of the ramps section, which hold one value per brand and segment in both schemes, plus `font-heading`, which the
 * studio seeds the same in both schemes. The studio tests check every one declares the same value in both schemes
 * of every theme. An edit to one applies to both schemes.
 */
export const LIGHT_ONLY_TOKENS: ReadonlySet<TokenName> = new Set<TokenName>([
  "card-border",
  "card-section-divider",
  "card-shadow",
  "button-outline",
  "selection-border",
  "selection-checked-border",
  "selection-divider",
  "selection-checked-divider",
  "selection-disabled-background",
  "selection-disabled-hatch",
  "selection-disabled-foreground",
  "toggle-pressed",
  "toggle-pressed-foreground",
  ...sectionTokens("ramps"),
  "radius",
  "radius-button",
  "radius-field",
  "radius-step",
  "button-outline-width",
  "selection-title-weight",
  "paragraph-leading-sm",
  "paragraph-leading-base",
  "paragraph-leading-lg",
  "heading-1-size",
  "heading-1-leading",
  "heading-1-weight",
  "heading-2-size",
  "heading-2-leading",
  "heading-2-weight",
  "heading-3-size",
  "heading-3-leading",
  "heading-3-weight",
  "font-heading",
]);

/** Whether an edit to `name` applies to both schemes. */
export function isLightOnly(name: TokenName): boolean {
  return LIGHT_ONLY_TOKENS.has(name);
}

/** A surface and the text color that sits on it. */
export type ForegroundPair = { readonly surface: TokenName; readonly foreground: TokenName };

/**
 * `feature-foreground` is decorative, not text-grade (CONTEXT.md, "Text-grade role"), so its
 * pair carries no contrast mark.
 */
const DECORATIVE_SURFACES: ReadonlySet<TokenName> = new Set<TokenName>(["feature"]);

/**
 * Every text-grade pair whose contrast the editor marks: `background` with `foreground`, then
 * each `X` with `X-foreground`, in the contract's order.
 */
export const FOREGROUND_PAIRS: readonly ForegroundPair[] = [
  { surface: "background", foreground: "foreground" },
  ...STUDIO_TOKEN_NAMES.flatMap((surface): ForegroundPair[] => {
    const foreground = `${surface}-foreground`;
    return isTokenName(foreground) && !DECORATIVE_SURFACES.has(surface) ? [{ surface, foreground }] : [];
  }),
];

/** The pair whose foreground row is `name`, if it is one. */
export function pairOfForeground(name: TokenName): ForegroundPair | undefined {
  return FOREGROUND_PAIRS.find((pair) => pair.foreground === name);
}
