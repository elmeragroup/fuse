/**
 * The corner sets: the radius roles each theme identity rounds with. Corners are not a host
 * axis and not part of a palette. Each identity picks its set: neutral themes take
 * {@link NEUTRAL_CORNERS}, and branded themes take their brand's entry in {@link BRAND_CORNERS}.
 *
 * Corners do not depend on the color scheme. `themes.css` emits them in their own light-only
 * rules, one per identity and brand, which no dark rule restates, so a dark scope keeps the
 * corners of its theme and a host `--radius` override on the theme element holds in both
 * schemes. Each rule restates `--radius-field: var(--radius)`, so a field resolves against the
 * `--radius` of its own theme element rather than inheriting the root's resolved corner.
 *
 * The step switches the corner formulas in `styles/corner-radius.ts` between the two corner
 * families, which support no other value. `0px` collapses the `rounded-*` scale onto
 * `--radius`, so every neutral rung equals it; `2px` spreads the branded scale in 2px steps
 * around the brand radius, so `rounded-md` sits 2px inside `--radius` and `rounded-xl` 4px
 * outside it. Design keeps this derived scale rather than the Central design system's radius
 * variables.
 */

import { BRAND_CODES, themeAxisSelector } from "../theme-input";
import type { ThemeIdentity, ThemeInput } from "../theme-input";
import { paletteBrand } from "../tokens/brand-palettes";
import type { PaletteBrandCode } from "../tokens/brand-palettes";

/** The radius roles a corner set assigns, in `TOKEN_NAMES` order. */
export const CORNER_TOKEN_NAMES = ["radius", "radius-button", "radius-field", "radius-step"] as const;

/** The `--radius-step` values the corner formulas support: neutral `0px`, branded `2px`. */
export const CORNER_STEPS = ["0px", "2px"] as const;

/** A legal `--radius-step`. */
export type CornerStep = (typeof CORNER_STEPS)[number];

/** A full corner set: every radius role, with the field radius tied to `--radius`. */
export type Corners = {
  /** The theme radius: the corner of cards, selection rows and fields, which the rungs step around. */
  readonly radius: string;

  /** The corner of Button. */
  readonly "radius-button": string;

  /** The corner of a field box. It follows `--radius` in every set. */
  readonly "radius-field": "var(--radius)";

  /** The spacing of the radius rungs, which selects the corner formulas. */
  readonly "radius-step": CornerStep;
};

/**
 * The neutral corners. Every outer element but the Checkbox rounds with the one radius, and inner
 * corners follow outer − inset. Buttons and fields alias the radius, and each theme rule
 * resolves the aliases against its own element's `--radius`. Neutral fields read `--radius`
 * itself rather than the field alias, so they also follow a `--radius` override on a plain
 * wrapper (`styles/corner-radius.ts`).
 */
export const NEUTRAL_CORNERS = {
  radius: "0.5rem",
  "radius-button": "var(--radius)",
  "radius-field": "var(--radius)",
  "radius-step": "0px",
} as const satisfies Corners;

/**
 * Each brand's branded corners. Fields round with the brand radius, the corner of a card or
 * selection row, and buttons with the brand's own button radius, a pill for most brands.
 * `fkab` aliases `fkas`, as its palette does.
 */
export const BRAND_CORNERS = {
  fkas: {
    radius: "0.75rem",
    "radius-button": "1.8125rem",
    "radius-field": "var(--radius)",
    "radius-step": "2px",
  },
  tkas: { radius: "1rem", "radius-button": "1rem", "radius-field": "var(--radius)", "radius-step": "2px" },
  guen: {
    radius: "0.5rem",
    "radius-button": "0.5rem",
    "radius-field": "var(--radius)",
    "radius-step": "2px",
  },
  fkse: {
    radius: "0.75rem",
    "radius-button": "1.8125rem",
    "radius-field": "var(--radius)",
    "radius-step": "2px",
  },
  // Design has not specified the Elmera radius yet, so the set holds a 6px placeholder.
  elma: {
    radius: "0.375rem",
    "radius-button": "0.375rem",
    "radius-field": "var(--radius)",
    "radius-step": "2px",
  },
  // Design has not specified the Nordic Green Energy radius yet, so the set holds a 6px
  // placeholder, and the button takes the pill other brands use.
  ngfi: {
    radius: "0.375rem",
    "radius-button": "1.8125rem",
    "radius-field": "var(--radius)",
    "radius-step": "2px",
  },
} as const satisfies Record<PaletteBrandCode, Corners>;

/**
 * The private `--button-label-px-min` each identity declares: the least inline padding a
 * Button's label edge takes. A branded button rounds with the brand's `--radius-button`, often a
 * pill, and at dense density the control inset would set its label against the curve, so the
 * branded identity floors the label edges at 12px. Comfortable branded padding is 12px or more
 * already, so the floor changes only branded dense buttons. The neutral identity declares 0px,
 * so a neutral scope inside a branded page does not inherit the branded floor.
 */
const BUTTON_LABEL_PX_MIN = {
  neutral: "0px",
  branded: "0.75rem",
} as const satisfies Record<ThemeIdentity, string>;

/** The custom property, without its dashes, that carries {@link BUTTON_LABEL_PX_MIN}. */
const BUTTON_LABEL_PX_MIN_PROPERTY = "button-label-px-min";

/**
 * The corner set a theme rounds with.
 *
 * @param theme - A legal theme.
 * @returns The neutral set for a neutral theme, else its brand's set, with `fkab` resolved to `fkas`.
 */
export function cornersOf(theme: ThemeInput): Corners {
  return theme.identity === "neutral" ? NEUTRAL_CORNERS : BRAND_CORNERS[paletteBrand(theme.brand)];
}

/** One corner rule: the selector of the theme elements it matches and its custom properties. */
export type CornerRule = {
  /** The theme elements the rule matches, such as `[data-theme-identity="neutral"]`. */
  readonly selector: string;

  /** Each custom property, without its dashes, and its value, in emission order. */
  readonly declarations: readonly (readonly [string, string])[];
};

/** A rule for the theme elements of `selector`: the `corners` set and `identity`'s label floor. */
function cornerRule(selector: string, corners: Corners, identity: ThemeIdentity): CornerRule {
  return {
    selector,
    declarations: [
      ...CORNER_TOKEN_NAMES.map((name) => [name, corners[name]] as const),
      [BUTTON_LABEL_PX_MIN_PROPERTY, BUTTON_LABEL_PX_MIN[identity]],
    ],
  };
}

/**
 * The corner rules `themes.css` emits: one rule on every neutral theme element, whose corners no
 * brand changes, then one per brand on its branded theme elements. Each states the full corner
 * set and the identity's Button label floor, so a nested scope of either identity resets both.
 * They are light-only: no dark rule restates them, so a dark scope keeps its theme's corners and a
 * host `--radius` override on the theme element wins in both schemes.
 *
 * @returns The rules in emission order.
 */
export function cornerRules(): readonly CornerRule[] {
  return [
    cornerRule(themeAxisSelector("identity", "neutral"), NEUTRAL_CORNERS, "neutral"),
    ...BRAND_CODES.map((brand) =>
      cornerRule(
        `${themeAxisSelector("identity", "branded")}${themeAxisSelector("brand", brand)}`,
        BRAND_CORNERS[paletteBrand(brand)],
        "branded"
      )
    ),
  ];
}
