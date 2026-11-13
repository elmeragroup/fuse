import { NEUTRAL_CORNERS } from "../corners/corners";
import { GREY_RAMP_TOKENS } from "./brand-ramps";
import type { LayerTokens, TokenContract } from "./contract";
import { withDerivedTokens } from "./derived-tokens";
import { NEUTRAL_RING, WHITE } from "./primitives";

const NEUTRAL_FOREGROUND = "oklch(0.15 0.0041 49.31)";
const ERROR = "oklch(0.4526 0.17845 30.42)";
const INFO = "oklch(0.4 0.09979 263.74)";
const SUCCESS = "oklch(0.4277 0.13765 144.24)";
const WARNING = "oklch(0.468 0.10443 65.71)";
const NEUTRAL_LINE = "oklch(0.9219 0 0)";
const NEUTRAL_950 = "oklch(0.16 0 0)";
const CHART_ORANGE = "oklch(0.6358 0.1851 39.97)";
const CHART_AQUA = "oklch(0.6157 0.1051 184.92)";
const SEQ_2 = "oklch(0.6647 0.1497 255.01)";
const SEQ_4 = "oklch(0.5255 0.1496 254.78)";
const SEQ_6 = "oklch(0.3856 0.1167 254.88)";

/**
 * The shared defaults before derivation, which are the neutral light theme before its
 * brand pointer. Composition overlays the palette layers on these.
 */
export const LAYER_DEFAULTS = {
  background: WHITE,
  foreground: NEUTRAL_FOREGROUND,
  card: WHITE,
  "card-foreground": NEUTRAL_FOREGROUND,
  "card-soft": "oklch(0.9702 0 0)",
  "card-soft-foreground": NEUTRAL_FOREGROUND,
  popover: WHITE,
  "popover-foreground": NEUTRAL_FOREGROUND,
  // The fill and text of the modal surfaces, Dialog (and AlertDialog through it) and Sheet.
  // Neutral themes keep the popover pair the anchored popups use, and the branded identity
  // layer fills light modals with the page tint, so card-coloured fields and selection rows
  // inside keep the separation they have on the page. Dark keeps the popover pair.
  dialog: "var(--popover)",
  "dialog-foreground": "var(--popover-foreground)",
  // The fill and text of the content panels a chart rests on: Frame panels, framed Table cells
  // the bordered VerticalTable box, the default Alert and the outline Item. Light panels are the card, white in every theme, so a panel and a
  // Card beside it match and chart cut-outs read as the same white. Dark keeps the page.
  panel: "var(--card)",
  "panel-foreground": "var(--card-foreground)",
  muted: "oklch(0.97 0.0013 106.42)",
  // The lightest grey, at three decimals, that measures at least 4.55:1 on `muted` and `card-soft`,
  // the darkest resting surfaces muted copy lands on (a highlighted `accent` row recolours its
  // descendants to `accent-foreground`), a margin over the 4.5:1 text floor.
  "muted-foreground": "oklch(0.544 0 0)",
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
  ring: NEUTRAL_RING,
  // The edge of a Card and of a `card` Accordion item. Neutral themes draw it in the border
  // role, and the branded identity layer makes it transparent. `CheckboxCard` and the TextField
  // `card` box keep `--border`.
  "card-border": "var(--border)",
  // The line between a Card's stacked sections. Neutral themes draw it in the border role, and
  // the branded identity layer draws it in the page tint, so each card reads as split in segments.
  "card-section-divider": "var(--border)",
  // The colour of a Card's `shadow-xs`, Tailwind's own 5% black. The branded identity layer
  // makes it transparent. `CheckboxCard` and the TextField `card` box keep the plain `shadow-xs`.
  "card-shadow": "oklch(0 0 0 / 0.05)",
  // The outline Button's border. Neutral themes draw it as a 1px hairline in the border
  // role, and the branded identity layer swaps both values for the reference's 2px ring
  // in the text color.
  "button-outline": "var(--border)",
  // The resting edge of a SelectionItem row (RadioItem, CheckboxItem), which also divides the
  // rows of a vertical group. Neutral themes draw it in the border role, and the branded
  // identity layer makes it transparent.
  "selection-border": "var(--border)",
  // The edge of a checked SelectionItem row. Neutral themes mark the checked row with the
  // primary role, and the branded identity layer keeps the resting edge, so the control alone
  // shows the selection.
  "selection-checked-border": "var(--primary)",
  // The line between two stacked rows of a vertical SelectionItem group: a row's bottom edge, and
  // a checked row's top and bottom edges. Neutral themes draw it as the row's own edge, so a
  // checked row stays boxed in the primary role, and the branded identity layer keeps the grey
  // border role here while the rows' outer edge goes transparent.
  "selection-divider": "var(--selection-border)",
  "selection-checked-divider": "var(--selection-checked-border)",
  // The fill of a disabled SelectionItem row, which wins over the checked row's muted tint.
  // Neutral themes fill it with the muted role, and the branded identity layer keeps the
  // card fill of an enabled row.
  "selection-disabled-background": "var(--muted)",
  // The stripe colour of the disabled row's 45° hatch, a black alpha that reads the same in
  // both schemes. The branded identity layer makes it transparent, which drops the stripes.
  "selection-disabled-hatch": "oklch(0 0 0 / 0.02)",
  // The label row text of a disabled SelectionItem row. A token value can't be `currentColor`,
  // so it names the foreground role rather than inheriting; neutral `foreground` equals
  // `card-foreground` in both schemes, so a neutral disabled title keeps its colour. The
  // branded identity layer greys it to the muted foreground. It is not a text-grade role.
  "selection-disabled-foreground": "var(--foreground)",
  // The fill and label of a pressed Toggle and ToggleGroup item. Neutral themes keep the quiet
  // muted face on the neutral page, and the branded identity layer fills with the primary
  // pair, since muted barely clears the tinted brand pages.
  "toggle-pressed": "var(--muted)",
  "toggle-pressed-foreground": "var(--foreground)",
  sidebar: "oklch(0.9851 0 0)",
  "sidebar-foreground": NEUTRAL_950,
  "sidebar-accent": NEUTRAL_LINE,
  "sidebar-accent-foreground": NEUTRAL_950,
  "sidebar-border": NEUTRAL_LINE,
  "sidebar-ring": "var(--ring)",
  "right-panel": "oklch(0.9851 0 0)",
  "right-panel-foreground": "oklch(0.1448 0 0)",
  // The categorical slots, one shared set in a fixed cyclic order: blue, orange, aqua, magenta,
  // green, violet, yellow and red. `chart-palette.test.ts` holds them to the palette gates on
  // every legal theme.
  "chart-1": "oklch(0.5609 0.1699 252.41)",
  "chart-2": CHART_ORANGE,
  "chart-3": CHART_AQUA,
  "chart-4": "oklch(0.4451 0.1601 350.07)",
  "chart-5": "oklch(0.51 0.1152 120.01)",
  "chart-6": "oklch(0.5605 0.1804 295.05)",
  "chart-7": "oklch(0.6346 0.1302 74.77)",
  "chart-8": "oklch(0.5443 0.1847 359.72)",
  // A neutral grey that keeps normal ΔE 10 from every slot and 3:1 on every surface.
  "chart-other": "oklch(0.6 0 0)",
  // The sequential ramp at hue 255, step 1 the least magnitude and nearest the surface.
  "chart-seq-1": "oklch(0.7351 0.1275 254.95)",
  "chart-seq-2": SEQ_2,
  "chart-seq-3": "oklch(0.5943 0.1496 255)",
  "chart-seq-4": SEQ_4,
  "chart-seq-5": "oklch(0.4562 0.1377 254.82)",
  "chart-seq-6": SEQ_6,
  "chart-seq-7": "oklch(0.3158 0.0963 255.07)",
  // The diverging scale, negative to positive. Steps 1 to 3 are ramp steps 6, 4 and 2, step 4 is
  // the neutral midpoint at zero, and steps 5 to 7 are an orange ramp at hue 50. The midpoint
  // paints every value near zero, so it is a mark and holds 3:1 on every chart surface. In both
  // schemes that sets it further from the surface than steps 3 and 5, so lightness alone no
  // longer orders the scale outward from zero. The grey midpoint stays apart from them by chroma.
  "chart-diverging-1": SEQ_6,
  "chart-diverging-2": SEQ_4,
  "chart-diverging-3": SEQ_2,
  "chart-diverging-4": "oklch(0.62 0 0)",
  "chart-diverging-5": "oklch(0.675 0.15 50.03)",
  "chart-diverging-6": "oklch(0.5302 0.1291 49.8)",
  "chart-diverging-7": "oklch(0.3872 0.0948 49.92)",
  // Favourable and unfavourable to the reader, such as a low and a high price, never the sign
  // of a value. Each is its own literal, so a host override of a slot leaves it alone.
  "chart-sentiment-positive": CHART_AQUA,
  "chart-sentiment-negative": CHART_ORANGE,
  "sh-identifier": "#5c6773",
  "sh-keyword": "#ff7733",
  "sh-string": "#86b300",
  "sh-class": "#a37acc",
  "sh-property": "#36a3d9",
  "sh-entity": "#f29718",
  "sh-jsxliterals": "#4cbf99",
  "sh-sign": "#ed9366",
  "sh-comment": "#abb0b6",
  // A scope without a brand reads an untinted grey at every ramp step, at the lightness every
  // brand's ramps share. Each brand rule declares its own tinted ramps.
  ...GREY_RAMP_TOKENS,
  // The root rounds as a neutral theme does: one radius, buttons and fields aliasing it, and a
  // zero step. The corner sets in `theme/corners/corners.ts` own every theme's corners, and
  // their rules restate them on each theme element.
  ...NEUTRAL_CORNERS,
  "button-outline-width": "1px",
  // The weight of a SelectionItem row's title (RadioItem, CheckboxItem). Neutral themes keep
  // the regular weight the neutral row was ported with, and the branded identity layer sets
  // the customer-facing radio card's medium title.
  "selection-title-weight": "400",
  // The line height of a Text at sm, default and lg size (`text-variants.ts`). Neutral themes
  // keep the relaxed ratio each size had before the roles, 1.625 × 14, 16 and 18px, and the
  // branded identity layer sets the customer-facing paragraph styles.
  "paragraph-leading-sm": "1.421875rem",
  "paragraph-leading-base": "1.625rem",
  "paragraph-leading-lg": "1.828125rem",
  // The size, line height and weight of a level 1 to 3 Heading without a size or font prop
  // (`heading.tsx`). Neutral themes keep the scale those levels had before the roles: h1
  // text-2xl, h2 text-lg and h3 text-base, each at the snug 1.375 ratio as a length, and the
  // medium weight. The branded identity layer sets the customer-facing heading styles.
  "heading-1-size": "1.5rem",
  "heading-1-leading": "2.0625rem",
  "heading-1-weight": "500",
  "heading-2-size": "1.125rem",
  "heading-2-leading": "1.546875rem",
  "heading-2-weight": "500",
  "heading-3-size": "1rem",
  "heading-3-leading": "1.375rem",
  "heading-3-weight": "500",
} as const satisfies LayerTokens;

/**
 * The complete shared defaults, which are the neutral light theme before its brand
 * pointer. The `:root` rule and the neutral reset emit these values.
 */
export const DEFAULTS: TokenContract = withDerivedTokens(LAYER_DEFAULTS);
