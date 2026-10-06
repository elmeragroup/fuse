import type { TokenLayer } from "./contract";
import { DARK_DEFAULTS } from "./dark-defaults";
import { mixOklchLiteral } from "./derived-tokens";
import type { ExternalDarkSheet } from "./external-dark-sheet";
import { paletteBrand } from "./external-palettes";
import type { ExternalBrandCode } from "./external-palettes";
import { segmentSheet } from "./segment-sheets";
import type { BrandCode, ThemeSegment } from "./themes";

// Custom Figma color collections in Dark mode, read 2026-09-15.
// Exact sRGB colors are retained in comments; OKLCH is the library's color format.
const EXTERNAL_DARK_PALETTES = {
  // NSsyvuE7xs3CcbbJggoN1b, collection 4006:10608, mode 4006:8.
  fkas: {
    background: "oklch(0.1749487 0.003804 164.5613)", // #0F1110
    foreground: "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    card: "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "card-foreground": "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    "card-soft": "oklch(0.1749487 0.003804 164.5613)", // #0F1110
    "card-soft-foreground": "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    primary: "oklch(0.8009687 0.1043361 49.42)", // #F5AA81
    "primary-foreground": "oklch(0 0 0)", // #000000
    "primary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "primary-soft-foreground": "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    secondary: "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    "secondary-foreground": "oklch(0 0 0)", // #000000
    "secondary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "secondary-soft-foreground": "oklch(0.9604175 0.0214022 46.9889)", // #FFEEE6
    feature: "oklch(0.5786573 0.1938698 36.9577)", // #D33E00
    "feature-bright": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "feature-foreground": "oklch(0.38458 0.1365017 34.5224)", // #7C1A00
  },
  // EcXXxqai6Q52s68FEvhdN8, collection 4006:10608, mode 4006:8.
  tkas: {
    background: "oklch(0.1749487 0.003804 164.5613)", // #0F1110
    foreground: "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    card: "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "card-foreground": "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    "card-soft": "oklch(0.1749487 0.003804 164.5613)", // #0F1110
    "card-soft-foreground": "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    primary: "oklch(0.9017794 0.0939863 190.6188)", // #90F3ED
    "primary-foreground": "oklch(0 0 0)", // #000000
    "primary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "primary-soft-foreground": "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    secondary: "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    "secondary-foreground": "oklch(0 0 0)", // #000000
    "secondary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "secondary-soft-foreground": "oklch(0.9790218 0.0292767 188.8731)", // #E3FFFC
    feature: "oklch(0.5568796 0.0958536 191.0554)", // #008581
    "feature-bright": "oklch(0.2661671 0.0034366 164.8011)", // #242625
    "feature-foreground": "oklch(0.3892662 0.0671294 190.4195)", // #00504D
  },
  // Provisional: sampled from GE 115:35788, with 27:2 as visual evidence.
  guen: {
    background: "oklch(0.2029294 0.0334602 267.7195)", // #101626
    foreground: "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    card: "oklch(0.2717674 0.038702 268.9648)", // #1F263A
    "card-foreground": "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    "card-soft": "oklch(0.259775 0.0931218 272.2625)", // #161D50
    "card-soft-foreground": "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    primary: "oklch(0.758638 0.1768149 60.637)", // #FF9100
    "primary-foreground": "oklch(0.2029294 0.0334602 267.7195)", // #101626
    "primary-soft": "oklch(0.259775 0.0931218 272.2625)", // #161D50
    "primary-soft-foreground": "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    secondary: "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    "secondary-foreground": "oklch(0.2029294 0.0334602 267.7195)", // #101626
    "secondary-soft": "oklch(0.2717674 0.038702 268.9648)", // #1F263A
    "secondary-soft-foreground": "oklch(0.9592915 0.0326656 74.8018)", // #FFEFDA
    feature: "oklch(0.3648292 0.1832979 272.6095)", // #26269C
    "feature-bright": "oklch(0.4975851 0.2528095 273.0222)", // #403DEE
    "feature-foreground": "oklch(0.8351931 0.0850039 284.41)", // #C2C2FF
  },
  // D7lEoOkBR6wOOHhJig30WZ, collection 4006:10608, mode 4006:8.
  fkse: {
    background: "oklch(0.1842633 0.0454734 244.0362)", // #001425
    foreground: "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    card: "oklch(0.2250318 0.0601105 247.6754)", // #001D36
    "card-foreground": "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    "card-soft": "oklch(0.1842633 0.0454734 244.0362)", // #001425
    "card-soft-foreground": "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    primary: "oklch(0.9049169 0.0947745 206.4627)", // #8FF2FF
    "primary-foreground": "oklch(0 0 0)", // #000000
    "primary-soft": "oklch(0.2250318 0.0601105 247.6754)", // #001D36
    "primary-soft-foreground": "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    secondary: "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    "secondary-foreground": "oklch(0 0 0)", // #000000
    "secondary-soft": "oklch(0.2250318 0.0601105 247.6754)", // #001D36
    "secondary-soft-foreground": "oklch(0.9801435 0.0172884 210.1893)", // #ECFCFF
    feature: "oklch(0.5687297 0.0934354 229.3725)", // #2F81A3
    "feature-bright": "oklch(0.2250318 0.0601105 247.6754)", // #001D36
    "feature-foreground": "oklch(0.3106045 0.0851527 248.7497)", // #003259
  },
  // dWv89e4X0DXeCKMsJwD5zL, collection 4006:10608, mode 4006:8.
  elma: {
    background: "oklch(0.176932 0.0026206 247.9754)", // #101112
    foreground: "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    card: "oklch(0.2675764 0.0014668 197.0689)", // #252626
    "card-foreground": "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    "card-soft": "oklch(0.176932 0.0026206 247.9754)", // #101112
    "card-soft-foreground": "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    primary: "oklch(0.9094018 0.0466256 220.5572)", // #C0E9F7
    "primary-foreground": "oklch(0 0 0)", // #000000
    "primary-soft": "oklch(0.2675764 0.0014668 197.0689)", // #252626
    "primary-soft-foreground": "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    secondary: "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    "secondary-foreground": "oklch(0 0 0)", // #000000
    "secondary-soft": "oklch(0.2675764 0.0014668 197.0689)", // #252626
    "secondary-soft-foreground": "oklch(0.9817745 0.0118616 223.5201)", // #F1FBFF
    feature: "oklch(0.5646394 0.0481675 218.5356)", // #557D89
    "feature-bright": "oklch(0.2675764 0.0014668 197.0689)", // #252626
    "feature-foreground": "oklch(0.3923005 0.0500012 219.4304)", // #234C58
  },
  // q1sEYcZWmf1HUeuiaJFqm6, section 129:12419, NGE/sys/dark, read 2026-10-05. Material 3 roles
  // mapped by meaning.
  ngfi: {
    background: "oklch(0.1860912 0.0074341 164.0507906)", // #101412 surface
    foreground: "oklch(0.9126739 0.0051473 145.5332168)", // #E0E3E0 on-surface
    card: "oklch(0.2386117 0.0070183 164.349003)", // #1C201E surface-container
    "card-foreground": "oklch(0.9126739 0.0051473 145.5332168)", // #E0E3E0 on-surface
    "card-soft": "oklch(0.1860912 0.0074341 164.0507906)", // #101412 surface
    "card-soft-foreground": "oklch(0.9126739 0.0051473 145.5332168)", // #E0E3E0 on-surface
    primary: "oklch(0.8167409 0.088748 168.8259798)", // #87D6B9 primary
    "primary-foreground": "oklch(0.3030805 0.0598659 170.2072613)", // #00382A on-primary
    "primary-soft": "oklch(0.3646304 0.0383747 169.5507252)", // #29453B secondary-container
    "primary-soft-foreground": "oklch(0.8648169 0.0380643 166.4515995)", // #BCDBCD on-secondary-container
    secondary: "oklch(0.9126739 0.0051473 145.5332168)", // #E0E3E0 on-surface
    "secondary-foreground": "oklch(0.3071978 0.0389954 168.5666487)", // #1A362C on-secondary
    "secondary-soft": "oklch(0.3646304 0.0383747 169.5507252)", // #29453B secondary-container
    "secondary-soft-foreground": "oklch(0.9126739 0.0051473 145.5332168)", // #E0E3E0 on-surface
    feature: "oklch(0.4061032 0.080916 169.4114656)", // #005742 primary-container
    "feature-bright": "oklch(0.2386117 0.0070183 164.349003)", // #1C201E surface-container, the card tone
    "feature-foreground": "oklch(0.9218728 0.0894512 168.1399808)", // #A9F9DA on-primary-container
  },
} as const satisfies Record<ExternalBrandCode, ExternalDarkSheet>;

/** The share of foreground in the dark hover tint, matching internal dark's popover-to-accent step. */
const ACCENT_LIFT_PERCENT = 8;

/** The dark sheet for one brand and segment, preferring a segment sheet over the brand base. */
function darkSheet(brand: BrandCode, segment: ThemeSegment): ExternalDarkSheet {
  return segmentSheet(brand, segment)?.dark ?? EXTERNAL_DARK_PALETTES[paletteBrand(brand)];
}

/**
 * The dark palette layer for one external brand and segment. A segment sheet replaces its
 * brand's dark sheet; the roles the selected sheet does not name derive from it, and a
 * role a sheet does name is never clobbered. Internal themes compose
 * `INTERNAL_DARK_PALETTE` instead.
 */
export function externalDarkPalette(brand: BrandCode, segment: ThemeSegment): TokenLayer {
  const palette = darkSheet(brand, segment);
  const popover = palette.popover ?? palette.card;
  return {
    ...DARK_DEFAULTS,
    ...palette,
    // Carry the brand's dark surfaces into roles the Figma sheets do not name.
    popover,
    "popover-foreground": palette["popover-foreground"] ?? palette["card-foreground"],
    muted: palette.muted ?? palette.card,
    // Menus paint a highlighted row with `accent` over the popover. Most sheets set
    // `primary-soft` to their card, which is the popover, so the tint lifts the popover
    // toward the foreground instead: the step internal dark takes from popover to accent.
    accent: palette.accent ?? mixOklchLiteral(popover, palette.foreground, ACCENT_LIFT_PERCENT),
    "accent-foreground": palette["accent-foreground"] ?? palette["primary-soft-foreground"],
    sidebar: palette.sidebar ?? palette.background,
    "sidebar-foreground": palette["sidebar-foreground"] ?? palette.foreground,
    "sidebar-accent": palette["sidebar-accent"] ?? palette.card,
    "sidebar-accent-foreground": palette["sidebar-accent-foreground"] ?? palette["card-foreground"],
    "sidebar-border": palette["sidebar-border"] ?? DARK_DEFAULTS.border,
    "right-panel": palette["right-panel"] ?? palette.card,
    "right-panel-foreground": palette["right-panel-foreground"] ?? palette["card-foreground"],
  };
}
