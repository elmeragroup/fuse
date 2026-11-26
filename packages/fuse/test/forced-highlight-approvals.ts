/**
 * The approved uses of CSS features above Fuse's browser floor that the `forced-highlight`
 * utility in `fuse.css` and the Sidebar parts beside a highlighted row write.
 * `src/styles/browser-floor.test.ts` reads them beside `BROWSER_FLOOR_APPROVALS`, and each entry
 * follows the rules that list's module gives.
 */
import type { FloorApproval } from "./browser-floor";
import { FORCED_COLORS } from "./browser-floor-approvals";

/**
 * The root rules of the `forced-highlight` utility, one per state variant a recipe pairs it with,
 * as the sheet writes each selector. Each opts its part out of forced colors. A variant missing
 * here fails the gate, which prints the selector to add.
 */
const FORCED_HIGHLIGHT_ROOTS = [
  '.aria-pressed\\:forced-highlight[aria-pressed="true"]',
  ".data-pressed\\:forced-highlight[data-pressed]",
  '.group-data-\\[variant\\=default\\]\\/tabs-list\\:data-active\\:forced-highlight:is(:where(.group\\/tabs-list)[data-variant="default"] *):where([data-state="active"]),.group-data-\\[variant\\=default\\]\\/tabs-list\\:data-active\\:forced-highlight:is(:where(.group\\/tabs-list)[data-variant="default"] *):where([data-active]:not([data-active="false"]))',
  '.aria-\\[current\\=page\\]\\:forced-highlight[aria-current="page"]',
  ".data-current\\:forced-highlight[data-current]",
  '.data-\\[armed\\=true\\]\\:forced-highlight[data-armed="true"]',
  '.data-checked\\:forced-highlight:where([data-state="checked"]),.data-checked\\:forced-highlight:where([data-checked]:not([data-checked="false"]))',
  '.data-active\\:forced-highlight:where([data-state="active"]),.data-active\\:forced-highlight:where([data-active]:not([data-active="false"]))',
  ':is(.data-active\\:not-disabled-state\\:forced-highlight:where([data-state="active"]),.data-active\\:not-disabled-state\\:forced-highlight:where([data-active]:not([data-active="false"]))):not(:where([data-disabled]:not([data-disabled="false"]),:disabled,[aria-disabled="true"]))',
] as const;

/**
 * The approval of one rule's `forced-color-adjust: none`.
 *
 * @param where - The rule's selector, as the sheet writes it.
 * @param value - The declaration's value, as the sheet writes it.
 */
function forcedColorAdjustApproval(where: string, value: "none" | "none !important"): FloorApproval {
  return {
    sheet: "styles.css",
    within: ["@media (forced-colors:active)"],
    where,
    property: "forced-color-adjust",
    value,
    features: ["css.properties.forced-color-adjust", "css.properties.forced-color-adjust.none"],
    fallback: { kind: "none" },
    reason: FORCED_COLORS,
  };
}

/** Each approved above-floor use of the forced highlight, with its fallback. */
export const FORCED_HIGHLIGHT_APPROVALS: readonly FloorApproval[] = [
  // A Sidebar.MenuAction or MenuBadge beside an enabled active row, on the row's Highlight fill.
  forcedColorAdjustApproval(
    '.forced-colors\\:peer-data-active\\/menu-button\\:peer-not-disabled-state\\/menu-button\\:forced-color-adjust-none:is(:is(:where(.peer\\/menu-button):where([data-state="active"]),:where(.peer\\/menu-button):where([data-active]:not([data-active="false"])))~*):is(:where(.peer\\/menu-button):not(:where([data-disabled]:not([data-disabled="false"]),:disabled,[aria-disabled="true"]))~*)',
    "none"
  ),
  ...FORCED_HIGHLIGHT_ROOTS.map((where) => forcedColorAdjustApproval(where, "none !important")),
];
