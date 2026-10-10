import { FOREGROUND_PAIRS, isTokenName, sectionTokens } from "./tokens";
import type { SectionId, TokenName } from "./tokens";

/**
 * Whether a pair's foreground carries text. A text-grade pair must reach 4.5:1 on its surface;
 * a decorative one, such as `feature-foreground` (CONTEXT.md, "Text-grade role"), never fails.
 */
export type PairGrade = "text" | "decorative";

/** A role and the `-foreground` color that sits on it. */
export type RolePair = {
  readonly role: TokenName;
  readonly foreground: TokenName;
  readonly grade: PairGrade;
};

/** One tile on the Color page: a role pair, with its soft form beside it when it has one. */
export type RoleTile = RolePair & { readonly soft?: RolePair };

const TEXT_GRADE: ReadonlySet<TokenName> = new Set(FOREGROUND_PAIRS.map((pair) => pair.surface));

function pairOf(role: TokenName, foreground: TokenName): RolePair {
  return { role, foreground, grade: TEXT_GRADE.has(role) ? "text" : "decorative" };
}

/** `name`'s foreground, `foreground` for `background`, if the contract has one. */
function foregroundOf(name: TokenName): TokenName | undefined {
  if (name === "background") {
    return "foreground";
  }
  const foreground = `${name}-foreground`;
  return isTokenName(foreground) ? foreground : undefined;
}

/**
 * The role tiles of one inspector section, in the contract's order: every role with a
 * foreground, its `-soft` form folded into its tile (CONTEXT.md, "Soft form").
 */
function tilesOf(section: SectionId): readonly RoleTile[] {
  return sectionTokens(section).flatMap((role): RoleTile[] => {
    const foreground = foregroundOf(role);
    if (foreground === undefined || role.endsWith("-soft")) {
      return [];
    }
    const softRole = `${role}-soft`;
    const softForeground = isTokenName(softRole) ? foregroundOf(softRole) : undefined;
    const soft =
      isTokenName(softRole) && softForeground !== undefined ? pairOf(softRole, softForeground) : undefined;
    return [soft === undefined ? pairOf(role, foreground) : { ...pairOf(role, foreground), soft }];
  });
}

/** The Color page's role tiles: surfaces and actions on the pairs artboard, status on its own. */
export const ROLE_TILES = {
  surfaces: tilesOf("surfaces"),
  actions: tilesOf("actions"),
  status: tilesOf("status"),
} as const;

/** WCAG AA for body text. */
const AA_RATIO = 4.5;

/** A pair's verdict, as a tile marks it. */
export type PairMark = {
  readonly state: "pass" | "fail" | "decorative" | "translucent";
  readonly label: string;
};

/**
 * The mark a pair tile shows for its contrast: AA or a failure for a text-grade pair, the ratio
 * alone for a decorative one, or a backdrop warning when the surface is translucent, since a
 * role surface can sit on any other surface.
 *
 * @param grade - Whether the pair carries text.
 * @param contrast - The WCAG ratio of the browser-resolved colors, or `translucent`.
 */
export function pairMark(grade: PairGrade, contrast: number | "translucent"): PairMark {
  if (contrast === "translucent") {
    return { state: "translucent", label: "Needs an opaque backdrop" };
  }
  const ratio = `${contrast.toFixed(2)}:1`;
  if (grade === "decorative") {
    return { state: "decorative", label: `Decorative ${ratio}` };
  }
  return contrast >= AA_RATIO
    ? { state: "pass", label: `AA ${ratio}` }
    : { state: "fail", label: `Fail ${ratio}` };
}

/** The Badge variant a mark wears: the status it reports, or a plain outline for a decorative pair. */
export function markVariant(state: PairMark["state"]) {
  switch (state) {
    case "pass":
      return "outline-success";
    case "fail":
      return "outline-destructive";
    case "decorative":
      return "outline";
    case "translucent":
      return "outline-warning";
  }
}
