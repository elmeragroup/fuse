import { FONT_VARIABLES, TOKEN_TABLE, isFontVariable } from "../../lib/token-sections";
import type { FontVariable, SectionId, TokenKind, TokenName } from "../../lib/token-sections";

export { FONT_VARIABLES, isFontVariable };
export type { FontVariable, TokenKind, TokenName };

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
 * The keys a dark palette keeps from light: the brand ramps, which hold one value per brand and
 * segment in both schemes, geometry, the card edge, section divider and shadow
 * colors, the outline and selection border and divider colors, the disabled selection row's fill,
 * stripe and text colors, the pressed Toggle's fill and text colors, the selection title weight, the paragraph line heights, the heading
 * scale and the heading font. The set is Fuse's private `LIGHT_ONLY_KEYS`
 * (`packages/fuse/src/theme/tokens/contract.ts`) plus `font-heading`, which the studio seeds the
 * same in both schemes. The studio tests check every one declares the same value in both schemes
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
  "brand-neutral-50",
  "brand-neutral-100",
  "brand-neutral-200",
  "brand-neutral-300",
  "brand-neutral-400",
  "brand-neutral-500",
  "brand-neutral-600",
  "brand-neutral-700",
  "brand-neutral-800",
  "brand-neutral-900",
  "brand-neutral-950",
  "brand-shade-50",
  "brand-shade-100",
  "brand-shade-200",
  "brand-shade-300",
  "brand-shade-400",
  "brand-shade-500",
  "brand-shade-600",
  "brand-shade-700",
  "brand-shade-800",
  "brand-shade-900",
  "brand-shade-950",
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
