import type { LayerTokens, TokenContract } from "./contract";
import { withDerivedTokens } from "./derived-tokens";
import { WHITE } from "./primitives";

const INTERNAL_FOREGROUND = "oklch(0.15 0.0041 49.31)";
const ERROR = "oklch(0.4526 0.17845 30.42)";
const INFO = "oklch(0.4 0.09979 263.74)";
const SUCCESS = "oklch(0.4277 0.13765 144.24)";
const WARNING = "oklch(0.468 0.10443 65.71)";
const NEUTRAL_LINE = "oklch(0.9219 0 0)";
const NEUTRAL_950 = "oklch(0.16 0 0)";

/**
 * The shared defaults before derivation, which are the internal light theme before its
 * brand pointer. Composition overlays the palette layers on these.
 */
export const LAYER_DEFAULTS = {
  background: WHITE,
  foreground: INTERNAL_FOREGROUND,
  card: WHITE,
  "card-foreground": INTERNAL_FOREGROUND,
  "card-soft": "oklch(0.9702 0 0)",
  "card-soft-foreground": INTERNAL_FOREGROUND,
  popover: WHITE,
  "popover-foreground": INTERNAL_FOREGROUND,
  muted: "oklch(0.97 0.0013 106.42)",
  "muted-foreground": "oklch(0.5555 0 0)",
  accent: "oklch(0.96 0 0)",
  "accent-foreground": NEUTRAL_950,
  feature: "oklch(0.96 0 0)",
  "feature-bright": "oklch(0.98 0 0)",
  "feature-foreground": NEUTRAL_950,
  primary: NEUTRAL_950,
  "primary-foreground": WHITE,
  "primary-soft": "oklch(0.96 0 0)",
  "primary-soft-foreground": NEUTRAL_950,
  secondary: "oklch(0.97 0 0)",
  "secondary-foreground": "oklch(0.22 0 0)",
  "secondary-soft": NEUTRAL_LINE,
  "secondary-soft-foreground": NEUTRAL_950,
  brand: NEUTRAL_950,
  "brand-foreground": WHITE,
  error: ERROR,
  "error-foreground": WHITE,
  "error-soft": "oklch(0.9352 0.02195 14.08)",
  "error-soft-foreground": ERROR,
  info: INFO,
  "info-foreground": WHITE,
  "info-soft": "oklch(0.9315 0.02014 233.86)",
  "info-soft-foreground": INFO,
  success: SUCCESS,
  "success-foreground": WHITE,
  "success-soft": "oklch(0.9346 0.02761 150.41)",
  "success-soft-foreground": SUCCESS,
  warning: WARNING,
  "warning-foreground": WHITE,
  "warning-soft": "oklch(0.9349 0.04795 81.5)",
  "warning-soft-foreground": WARNING,
  destructive: "var(--error)",
  "destructive-foreground": "var(--error-foreground)",
  border: NEUTRAL_LINE,
  input: NEUTRAL_LINE,
  ring: "oklch(0.4844 0.20509 296.29)",
  sidebar: "oklch(0.9851 0 0)",
  "sidebar-foreground": NEUTRAL_950,
  "sidebar-accent": NEUTRAL_LINE,
  "sidebar-accent-foreground": NEUTRAL_950,
  "sidebar-border": NEUTRAL_LINE,
  "sidebar-ring": "var(--ring)",
  "sidebar-brand": "var(--brand)",
  "sidebar-brand-foreground": "var(--brand-foreground)",
  "right-panel": "oklch(0.9851 0 0)",
  "right-panel-foreground": "oklch(0.1448 0 0)",
  "chart-1": "oklch(0.289 0.0518 217.7)",
  "chart-2": "oklch(0.3629 0.0619 204.44)",
  "chart-3": "oklch(0.4322 0.0777 181.31)",
  "chart-4": "oklch(0.4933 0.1113 160.18)",
  "chart-5": "oklch(0.5623 0.139 143.03)",
  "chart-6": "oklch(0.6348 0.1494 124.51)",
  "chart-7": "oklch(0.714 0.1487 100.58)",
  "chart-8": "oklch(0.7945 0.1709 71.19)",
  "sh-identifier": "#5c6773",
  "sh-keyword": "#ff7733",
  "sh-string": "#86b300",
  "sh-class": "#a37acc",
  "sh-property": "#36a3d9",
  "sh-entity": "#f29718",
  "sh-jsxliterals": "#4cbf99",
  "sh-sign": "#ed9366",
  "sh-comment": "#abb0b6",
  radius: "0.375rem",
  // The internal variant rounds every element alike. Buttons alias the one radius, and a
  // zero step collapses the `rounded-*` scale in `fuse.css` onto it. The CSS emitter writes
  // this alias as `initial`, so `var(--radius-button, var(--radius))` reads the radius on
  // the button itself. External palettes set a brand button radius, and the external
  // variant layer sets the step.
  "radius-button": "var(--radius)",
  "radius-step": "0px",
  "font-sans": "Roboto, ui-sans-serif, system-ui, sans-serif",
  "font-heading": "var(--font-sans)",
} as const satisfies LayerTokens;

/**
 * The complete shared defaults, which are the internal light theme before its brand
 * pointer. The `:root` rule and the internal reset emit these values.
 */
export const DEFAULTS: TokenContract = withDerivedTokens(LAYER_DEFAULTS);
