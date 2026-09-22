import type { TokenContract } from "./contract";
import { DARK_DEFAULTS } from "./dark-defaults";

// User-supplied shadcn neutral dark base, 2026-09-15.
// Missing library roles use neutral surfaces or shared dark support colors.
// The supplied palette's sidebar-primary pair is dropped in favour of the sidebar-brand
// pointer; --sidebar-primary(-foreground) is deliberately dead with no replacement alias.
// Mapping decisions and contrast limits: PROVENANCE.md.
export const INTERNAL_DARK_PALETTE = {
  ...DARK_DEFAULTS,
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  "card-foreground": "oklch(0.985 0 0)",
  "card-soft": "oklch(0.269 0 0)",
  "card-soft-foreground": "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  "popover-foreground": "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  "primary-foreground": "oklch(0.205 0 0)",
  "primary-soft": "oklch(0.269 0 0)",
  "primary-soft-foreground": "oklch(0.985 0 0)",
  secondary: "oklch(0.269 0 0)",
  "secondary-foreground": "oklch(0.985 0 0)",
  "secondary-soft": "oklch(0.269 0 0)",
  "secondary-soft-foreground": "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  "muted-foreground": "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  "accent-foreground": "oklch(0.985 0 0)",
  feature: "oklch(0.205 0 0)",
  "feature-bright": "oklch(0.269 0 0)",
  "feature-foreground": "oklch(0.985 0 0)",
  // Keep destructive aliases tied to the library's error pair.
  error: "oklch(0.704 0.191 22.216)",
  "error-foreground": "oklch(0.145 0 0)",
  border: "oklch(1 0 0 / 10%)",
  // Raised from the supplied 15% to meet 3:1 on supported control surfaces.
  input: "oklch(1 0 0 / 40%)",
  ring: "oklch(0.556 0 0)",
  "chart-1": "oklch(0.845 0.143 164.978)",
  "chart-2": "oklch(0.696 0.17 162.48)",
  "chart-3": "oklch(0.596 0.145 163.225)",
  // Lift the two darkest greens while preserving their hue, chroma and ordering.
  "chart-4": "oklch(0.565 0.118 165.612)",
  "chart-5": "oklch(0.54 0.095 166.913)",
  sidebar: "oklch(0.205 0 0)",
  "sidebar-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.269 0 0)",
  "sidebar-accent-foreground": "oklch(0.985 0 0)",
  "sidebar-border": "oklch(1 0 0 / 10%)",
  // sidebar-ring remains the default alias to ring, rebound at each scope.
  "right-panel": "oklch(0.205 0 0)",
  "right-panel-foreground": "oklch(0.985 0 0)",
} as const satisfies Partial<TokenContract>;
