import type { TokenKind, TokenName } from "@elmeragroup/fuse/theme-catalog";

export type { TokenKind, TokenName };

/** An inspector section of the token editor. */
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
  | "syntax";

/** The token editor's sections, in the order the inspector stacks them. */
export const STUDIO_SECTIONS = [
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
] as const satisfies readonly { id: SectionId; title: string }[];

/** Where the editor files a token, and the kind of value its knob edits. */
export type TokenRow = { readonly section: SectionId; readonly kind: TokenKind };

const color = (section: SectionId): TokenRow => ({ section, kind: "color" });

/**
 * Every contract token, keyed by name in the contract's order, with its section and kind. The
 * record type makes a contract token without a row a compile error; the studio tests check the
 * order and the kinds against the resolved catalog.
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
  "button-outline": color("variant"),
  "selection-checked-border": color("variant"),
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
  "sh-identifier": color("syntax"),
  "sh-keyword": color("syntax"),
  "sh-string": color("syntax"),
  "sh-class": color("syntax"),
  "sh-property": color("syntax"),
  "sh-entity": color("syntax"),
  "sh-jsxliterals": color("syntax"),
  "sh-sign": color("syntax"),
  "sh-comment": color("syntax"),
  radius: { section: "shape", kind: "dimension" },
  "radius-button": { section: "shape", kind: "dimension" },
  "radius-field": { section: "shape", kind: "dimension" },
  "radius-step": { section: "shape", kind: "dimension" },
  "button-outline-width": { section: "shape", kind: "dimension" },
  "selection-title-weight": { section: "typography", kind: "fontWeight" },
  "font-sans": { section: "typography", kind: "fontFamily" },
  "font-heading": { section: "typography", kind: "fontFamily" },
} as const satisfies Record<TokenName, TokenRow>;

/** Every contract token, in the contract's order. */
export const STUDIO_TOKEN_NAMES: readonly TokenName[] = Object.keys(TOKEN_TABLE).filter(
  (name): name is TokenName => Object.hasOwn(TOKEN_TABLE, name)
);

const KNOWN_NAMES: ReadonlySet<string> = new Set(STUDIO_TOKEN_NAMES);

/** Whether `name` is a contract token. */
export function isTokenName(name: string): name is TokenName {
  return KNOWN_NAMES.has(name);
}

/** A section's tokens, in the contract's order. */
export function sectionTokens(section: SectionId): readonly TokenName[] {
  return STUDIO_TOKEN_NAMES.filter((name) => TOKEN_TABLE[name].section === section);
}

/**
 * The keys a dark palette keeps from light: geometry, the outline and selection border colors,
 * and the heading font. Fuse keeps this set private as `LIGHT_ONLY_KEYS` in
 * `packages/fuse/src/theme/tokens/contract.ts`; the studio tests check every one declares the
 * same value in both schemes of every theme. An edit to one applies to both schemes.
 */
export const LIGHT_ONLY_TOKENS: ReadonlySet<TokenName> = new Set<TokenName>([
  "button-outline",
  "selection-checked-border",
  "radius",
  "radius-button",
  "radius-field",
  "radius-step",
  "button-outline-width",
  "selection-title-weight",
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
