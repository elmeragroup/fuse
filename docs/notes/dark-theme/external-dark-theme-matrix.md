# External dark-theme matrix

> This report records the external rollout. The subsequent [internal dark implementation](internal-dark-theme-matrix.md) replaces the internal-light-only limitation below. The external palette values and source audit are unchanged.

Dated 2026-09-15. Implemented in this worktree. This is a review snapshot; the TypeScript theme modules remain the runtime source of truth.

## Result and confidence

All ten legal external themes have dark palettes. This was an external-only rollout: internal themes remained light in a dark document until the later [internal dark implementation](internal-dark-theme-matrix.md). The implementation uses the existing `data-theme="dark"` marker alongside variant, brand and segment attributes. Fonts, radii, density, light palettes, brand primitives and legal theme slugs retain their existing values.

The directly sourced colors match Figma after conversion to the library's OKLCH format: **132 checked assignments, zero mismatches** across eight non-GE permutations. Four missing role assignments use documented fallbacks. This verifies transcription and conversion; it does not prove every inferred role matches the designer's intent.

I estimate **95% confidence in theme configuration**, based on CSS, browser, portal and contrast checks. Estimated visual fidelity is **90–95% for Fjordkraft, Bedrift, TrøndelagKraft, Elmera and the fkab alias**, **85–90% for Telinet**, and **60–70% for GE**. These are engineering judgments, not statistical measurements. GE, shared support roles and complete product screens have more uncertainty than the tested selector behavior.

[Rendered external matrix preview](../../../notes/external-dark-theme-preview.png) shows all ten implemented combinations. The docs handbook matrix also supports Light, Dark and System selection.

## Decisions confirmed for this work

- Implement the matrix and the external dark palettes now.
- Prefer custom brand color collections in Dark mode. Use suggested schematics for missing data.
- Implement GE provisionally from the supplied screenshots.
- Keep internal palettes light for this external-only rollout, until an internal dark palette was agreed.
- Preserve the existing `fkab` alias. Its company segment does not make it a Bedrift palette.

### Recommendation applied to missing roles

Keep status, chart and syntax defaults shared across brands. Consistent status meanings and syntax highlighting are useful across products; charts can use the same ordering when they represent the same categories. Brand-specific overrides should follow a concrete product need and design evidence. The shared warning pairs, chart ordering and syntax assignments remain provisional: surface contrast alone does not establish that chart series are distinguishable or that syntax roles read well together.

## Source register

Figma MCP read the supplied nodes, resolved custom variable aliases by the named Dark mode, and retrieved design context for the dark palette sheets. No Figma content was edited.

| Source         | Supplied reference                                                                                                                                                                                               | Custom palette used                                                                                                | Evidence / caveat                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fjordkraft     | [Pages](https://www.figma.com/design/NSsyvuE7xs3CcbbJggoN1b/Fjordkraft?node-id=34-17555)                                                                                                                         | [Farger / Dark, 4351:35911](https://www.figma.com/design/NSsyvuE7xs3CcbbJggoN1b/Fjordkraft?node-id=4351-35911)     | Fjordkraft - Colors, collection 4006:10608, Dark mode 4006:8.                                                                                                              |
| Bedrift        | [Suggested schematics](https://www.figma.com/design/UF9t0CyeKAwPEypCW3S41m/Bedrift?node-id=129-12419)                                                                                                            | [Farger / Dark, 2106:18317](https://www.figma.com/design/UF9t0CyeKAwPEypCW3S41m/Bedrift?node-id=2106-18317)        | Business - Colors. Applies only to `fkas-company`.                                                                                                                         |
| TrøndelagKraft | [Suggested schematics](https://www.figma.com/design/EcXXxqai6Q52s68FEvhdN8/Trondelagkraft?node-id=129-12419)                                                                                                     | [Farger / Dark, 2106:18317](https://www.figma.com/design/EcXXxqai6Q52s68FEvhdN8/Trondelagkraft?node-id=2106-18317) | Trøndelagkraft - Colors. Same values for both segments.                                                                                                                    |
| Telinet        | [Suggested schematics](https://www.figma.com/design/D7lEoOkBR6wOOHhJig30WZ/Telinet?node-id=129-12419)                                                                                                            | Telinet - Tokens, collection 4006:10608, Dark mode 4006:8                                                          | The [older dark sheet](https://www.figma.com/design/D7lEoOkBR6wOOHhJig30WZ/Telinet?node-id=2106-18317) disagrees with live variables for surfaces. Live custom values win. |
| Elmera         | [Suggested schematics](https://www.figma.com/design/dWv89e4X0DXeCKMsJwD5zL/Elmera?node-id=129-12419)                                                                                                             | [Farger / Dark, 2106:18317](https://www.figma.com/design/dWv89e4X0DXeCKMsJwD5zL/Elmera?node-id=2106-18317)         | Elmera - Colors. Same values for both segments.                                                                                                                            |
| GE             | [Variant, 27:2](https://www.figma.com/design/NQXVCgZ9HVC6TVhUIXxw8h/GE-fargepalett?node-id=27-2) and [image 73, 115:35788](https://www.figma.com/design/NQXVCgZ9HVC6TVhUIXxw8h/GE-fargepalett?node-id=115-35788) | Sampled image palette                                                                                              | No local color variables or paint styles. The repeated 115:35788 URL is one source, not independent confirmation.                                                          |

[Captured Figma color data](../../../notes/external-dark-theme-figma.json) records custom light and dark values, page/node IDs and unresolved aliases. [Resolved implementation export](../../../notes/external-dark-theme-tokens.json) contains all 77 tokens, matching attributes and contrast ratios for every external permutation.

## Permutation matrix

Every row requires `data-theme-variant="external"` and resolves dark when the document has `data-theme="dark"`.

| Theme slug              | Brand | Segment | Palette                    | Estimated reference fidelity | Configuration confidence        |
| ----------------------- | ----- | ------- | -------------------------- | ---------------------------- | ------------------------------- |
| `external-fkas-private` | fkas  | private | Fjordkraft custom dark     | 90–95%                       | High, 95%                       |
| `external-fkas-company` | fkas  | company | Bedrift custom dark        | 90–95%                       | High, 95%                       |
| `external-tkas-private` | tkas  | private | TrøndelagKraft custom dark | 90–95%                       | High, 95%                       |
| `external-tkas-company` | tkas  | company | Same as private            | 90–95%                       | High, 95%                       |
| `external-guen-private` | guen  | private | Provisional GE             | 60–70%                       | High for CSS, medium for design |
| `external-guen-company` | guen  | company | Same provisional GE        | 60–70%                       | High for CSS, medium for design |
| `external-fkab-company` | fkab  | company | Fjordkraft private alias   | 90–95%                       | High, 95%                       |
| `external-fkse-private` | fkse  | private | Telinet live custom dark   | 85–90%                       | High, 95%                       |
| `external-elma-private` | elma  | private | Elmera custom dark         | 90–95%                       | High, 95%                       |
| `external-elma-company` | elma  | company | Same as private            | 90–95%                       | High, 95%                       |

`fkab-private` and `fkse-company` remain illegal. The ten internal themes still exist; in this external-only rollout, selecting dark did not invent an internal dark palette. Brand/segment policy comes from [theme metadata](../../../packages/ui/src/theme/tokens/themes.ts), [segment deltas](../../../packages/ui/src/theme/tokens/segment-deltas.ts) and [CONTEXT](../../../CONTEXT.md).

## Core color matrix

Hex values below are for review. Runtime values are OKLCH, converted without changing the source sRGB colors.

| Role                          | Fjordkraft private / fkab | Fjordkraft company | TrøndelagKraft | Telinet   | Elmera    | GE provisional |
| ----------------------------- | ------------------------- | ------------------ | -------------- | --------- | --------- | -------------- |
| `--background`                | `#0F1110`                 | `#0F1110`          | `#0F1110`      | `#001425` | `#101112` | `#101626`      |
| `--foreground`                | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--card`                      | `#242625`                 | `#242625`          | `#242625`      | `#001D36` | `#252626` | `#1F263A`      |
| `--card-foreground`           | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--card-soft`                 | `#0F1110`                 | `#0F1110`          | `#0F1110`      | `#001425` | `#101112` | `#161D50`      |
| `--card-soft-foreground`      | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--primary`                   | `#F5AA81`                 | `#B7EAFF`          | `#90F3ED`      | `#8FF2FF` | `#C0E9F7` | `#FF9100`      |
| `--primary-foreground`        | `#000000`                 | `#000000`          | `#000000`      | `#000000` | `#000000` | `#101626`      |
| `--primary-soft`              | `#242625`                 | `#242625`          | `#242625`      | `#001D36` | `#252626` | `#161D50`      |
| `--primary-soft-foreground`   | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--secondary`                 | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--secondary-foreground`      | `#000000`                 | `#000000`          | `#000000`      | `#000000` | `#000000` | `#101626`      |
| `--secondary-soft`            | `#242625`                 | `#242625`          | `#242625`      | `#001D36` | `#252626` | `#1F263A`      |
| `--secondary-soft-foreground` | `#FFEEE6`                 | `#EFFCFF`          | `#E3FFFC`      | `#ECFCFF` | `#F1FBFF` | `#FFEFDA`      |
| `--feature`                   | `#D33E00`                 | `#3E7E8E`          | `#008581`      | `#2F81A3` | `#557D89` | `#26269C`      |
| `--feature-bright`            | `#242625`                 | `#242625`          | `#242625`      | `#001D36` | `#252626` | `#403DEE`      |
| `--feature-foreground`        | `#7C1A00`                 | `#004E60`          | `#00504D`      | `#003259` | `#234C58` | `#C2C2FF`      |

### Mapping rules and exceptions

| Library role                           | Custom Figma role                                    | Confidence / exception                                                                                                   |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| background / foreground                | Surface / On Surface                                 | Direct for all non-GE palettes.                                                                                          |
| card / card-foreground                 | Primary Container / On Primary Container             | Same role recipe as the existing light themes.                                                                           |
| card-soft / card-soft-foreground       | Surface Bright / On Surface                          | Telinet has no Surface Bright alias, so uses its background.                                                             |
| primary / primary-foreground           | Primary / On Primary                                 | Direct; most dark action foregrounds are black.                                                                          |
| primary-soft / primary-soft-foreground | Secondary Container / On Primary Container           | Preserves the existing library recipe; dark container foregrounds agree.                                                 |
| secondary pairs                        | Secondary and Secondary Container pairs              | Direct.                                                                                                                  |
| feature / feature-foreground           | Surface Variant / On Surface Variant                 | Exact custom values. The foreground is decorative under the existing contract.                                           |
| feature-bright                         | Surface variant Bright                               | Direct for Fjordkraft, Bedrift and TrøndelagKraft. Elmera and Telinet use the card surface because that alias is absent. |
| GE roles                               | Screenshot palette plus inferred semantic assignment | Every role is provisional even where the sampled color is exact.                                                         |

The four fallback assignments in the source audit are Elmera feature-bright twice, plus Telinet card-soft and feature-bright. GE's 34 core assignments are excluded from that exact-variable audit. This gives 170 core assignments across ten permutations: 132 direct, 4 fallback, 34 inferred.

### Source conflicts that remain relevant

- Suggested schematics have different primaries and surfaces. For example, Elmera schematic dark primary is `#86D1E9`, while the custom collection uses `#C0E9F7`. The confirmed custom-source policy resolves this.
- Telinet's older sheet renders neutral `#0F1110` / `#242625` surfaces. Its live custom Dark mode resolves `#001425` / `#001D36`; those live values are implemented. This lowers visual-fidelity confidence until a designer confirms the revision.
- Elmera and TrøndelagKraft contain unresolved tertiary aliases. The current 77-token contract has no tertiary role, so these are not copied into runtime tokens.
- Several suggested schematic entries contain the misspelled `on-tertiary-fixed-varaint` and repeated `#633B48`. They are not authoritative for any implemented role.
- The custom dark `feature-bright` alias is a dark neutral in several brands. The implementation preserves it. The name should not be interpreted as a promise that it has higher luminance than `feature`.

## GE investigation

The larger source image includes an explicit horizontal strip with these colors. Sampling the unscaled 4096 × 2840 source avoids picking anti-aliased text or borders.

| Strip label | Sampled value | Use in this implementation    |
| ----------- | ------------- | ----------------------------- |
| 100         | `#FFFFFF`     | Reference only                |
| 98          | `#FFEFDA`     | Main foreground and secondary |
| 95          | `#FDD198`     | Shared warm reference color   |
| 90          | `#FF9100`     | Primary action                |
| 80          | `#FB8108`     | Reference only                |
| 70          | `#FF671F`     | Reference only                |
| 60          | `#9494F4`     | Reference only                |
| 50          | `#C2C2FF`     | Decorative feature foreground |
| 40          | `#3A3AEA`     | Reference only                |
| 30          | `#26269C`     | Feature surface               |
| 20          | `#222684`     | Reference only                |
| 10          | `#161D50`     | Soft card / primary-soft      |
| N-15        | `#1F263A`     | Card, popover and right panel |
| N-5         | `#101626`     | Background and sidebar        |
| 0           | `#000000`     | Reference only                |

The app references disagree slightly. The phone image at 27:5 has dominant surface pixels `#111627` and `#20263B`; image 73 includes `#101626` and `#1F263A`. The explicit strip wins over near-identical screenshot samples. Some consumption screens use a stronger navy background, `#161D50`, while benefit screens use N-5. I use N-5 for the library's page background and retain navy as a soft surface.

The `#403DEE` callout fill is sampled from the app reference and used for feature-bright. Orange actions are inferred from active navigation and accents. Neither a screenshot nor a tonal strip establishes hover, disabled, error, or company-specific behavior. Both GE segments therefore share one provisional palette.

## Support-role matrix

These assignments complete the library contract, so popovers, forms, sidebars and code samples do not inherit light colors. They are implementation mappings, not a claim that each role exists by that name in Figma.

| Role family                                    | Dark source                                           |
| ---------------------------------------------- | ----------------------------------------------------- |
| popover / popover-foreground                   | Current brand's card pair, stored as literal values   |
| muted                                          | Current brand's card                                  |
| accent / accent-foreground                     | Current brand's primary-soft pair                     |
| sidebar / sidebar-foreground                   | Current brand's background pair                       |
| sidebar-accent / sidebar-accent-foreground     | Current brand's card pair                             |
| sidebar-border                                 | Shared border                                         |
| right-panel / right-panel-foreground           | Current brand's card pair                             |
| destructive pair                               | Existing aliases to the error pair, rebound per scope |
| sidebar-ring                                   | Existing alias to ring, rebound per scope             |
| brand pair and sidebar-brand pair              | Existing brand pointers, unchanged                    |
| radius, radius-button, font-sans, font-heading | Existing light-theme identity values, unchanged       |

| Role                        | Dark value | Source / mapping                                        |
| --------------------------- | ---------- | ------------------------------------------------------- |
| `--muted-foreground`        | `#C6C7C4`  | Custom neutral ramp; inferred support role.             |
| `--error`                   | `#FFB4AB`  | Shared M3 error ramp; semantic assignment.              |
| `--error-foreground`        | `#690005`  | Shared M3 error ramp; semantic assignment.              |
| `--error-soft`              | `#93000A`  | Shared M3 error ramp; semantic assignment.              |
| `--error-soft-foreground`   | `#FFDAD6`  | Shared M3 error ramp; semantic assignment.              |
| `--info`                    | `#A1CAFD`  | Telinet schematic secondary pair; used for information. |
| `--info-foreground`         | `#003259`  | Telinet schematic secondary pair; used for information. |
| `--info-soft`               | `#1A4975`  | Telinet schematic secondary pair; used for information. |
| `--info-soft-foreground`    | `#D2E4FF`  | Telinet schematic secondary pair; used for information. |
| `--success`                 | `#96D5A7`  | Telinet schematic tertiary pair; used for success.      |
| `--success-foreground`      | `#00391C`  | Telinet schematic tertiary pair; used for success.      |
| `--success-soft`            | `#11512E`  | Telinet schematic tertiary pair; used for success.      |
| `--success-soft-foreground` | `#B1F1C1`  | Telinet schematic tertiary pair; used for success.      |
| `--warning`                 | `#FDD198`  | Inferred warm warning pair; contrast tested.            |
| `--warning-foreground`      | `#3F2D00`  | Inferred warm warning pair; contrast tested.            |
| `--warning-soft`            | `#574000`  | Inferred warm warning pair; contrast tested.            |
| `--warning-soft-foreground` | `#FFE0A6`  | Inferred warm warning pair; contrast tested.            |
| `--border`                  | `#454746`  | Custom neutral ramp; inferred support role.             |
| `--input`                   | `#8F918F`  | Custom neutral ramp; inferred support role.             |
| `--ring`                    | `#C0C4EB`  | Elmera schematic tertiary, kept violet across brands.   |
| `--chart-1`                 | `#A4CDDB`  | Provisional chart ordering of reference colors.         |
| `--chart-2`                 | `#86D1E9`  | Provisional chart ordering of reference colors.         |
| `--chart-3`                 | `#69D8D2`  | Provisional chart ordering of reference colors.         |
| `--chart-4`                 | `#96D5A7`  | Provisional chart ordering of reference colors.         |
| `--chart-5`                 | `#B1F1C1`  | Provisional chart ordering of reference colors.         |
| `--chart-6`                 | `#E3D900`  | Provisional chart ordering of reference colors.         |
| `--chart-7`                 | `#FDD198`  | Provisional chart ordering of reference colors.         |
| `--chart-8`                 | `#F5AA81`  | Provisional chart ordering of reference colors.         |
| `--sh-identifier`           | `#DEE3E6`  | Provisional syntax assignment of reference colors.      |
| `--sh-keyword`              | `#F5AA81`  | Provisional syntax assignment of reference colors.      |
| `--sh-string`               | `#B1F1C1`  | Provisional syntax assignment of reference colors.      |
| `--sh-class`                | `#C0C4EB`  | Provisional syntax assignment of reference colors.      |
| `--sh-property`             | `#86D1E9`  | Provisional syntax assignment of reference colors.      |
| `--sh-entity`               | `#FDD198`  | Provisional syntax assignment of reference colors.      |
| `--sh-jsxliterals`          | `#69D8D2`  | Provisional syntax assignment of reference colors.      |
| `--sh-sign`                 | `#CEE7EF`  | Provisional syntax assignment of reference colors.      |
| `--sh-comment`              | `#C6C7C4`  | Provisional syntax assignment of reference colors.      |

Chart colors are visible on the tested dark surfaces, but adjacent-series distinguishability and the eight-color ordering still need product review. Syntax roles also need review in complete code samples. These are separate from the measured text-pair checks.

## Selector and ownership matrix

| Document marker                      | Scope variant                  | Result                                       |
| ------------------------------------ | ------------------------------ | -------------------------------------------- |
| light or absent                      | external                       | Existing brand/segment light palette         |
| dark                                 | external                       | Brand/segment dark palette                   |
| light or absent                      | internal                       | Existing internal light palette              |
| dark                                 | internal                       | Internal dark palette (later implementation) |
| dark, outer internal                 | inner external                 | Inner external dark palette                  |
| dark, outer external                 | inner internal                 | Inner internal dark palette                  |
| dark, outer external brand/segment A | inner external brand/segment B | Inner B palette, without inherited A values  |

The selector family for Fjordkraft company is:

```css
[data-theme="dark"][data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"] {
  /* generated values */
}
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"] {
  /* generated values */
}
```

The direct form handles attributes on the same element. The descendant form handles `ThemeScope`, which stamps variant, brand and segment but does not own the document's color scheme. Local light/dark islands are not part of this API; `ForceColorScheme` changes the document scheme.

[Dark palettes](../../../packages/ui/src/theme/tokens/external-dark-palettes.ts) and [external dark defaults](../../../packages/ui/src/theme/tokens/dark-defaults.ts) own values. [Composition](../../../packages/ui/src/theme/compose-theme.ts) layers them over the existing external theme. [The generator](../../../packages/ui/src/theme/generate-css.ts) produces 23 rules (15 light, 8 dark). [Reset keys](../../../packages/ui/src/theme/tokens/reset-keys.ts) derive 72 reset roles from actual palette assignments and dependent aliases. Each external theme supplies 66 explicit dark overrides; the complete resolved contract still has 77 tokens.

Native controls follow scoped CSS `color-scheme: dark` for external dark surfaces and `color-scheme: light` for internal/base light surfaces. No new JavaScript color-scheme writer was introduced. Existing preference persistence, system detection, forced schemes and pre-paint bootstrap remain in use.

### Integration

```html
<html
  data-theme="dark"
  data-theme-variant="external"
  data-theme-brand="fkas"
  data-theme-segment="company"></html>
```

For React, keep the current `ThemeProvider` and `ColorSchemeScript` configuration; use `defaultColorScheme="dark"` for a dark default or the existing `useColorScheme().setColorScheme("dark")` setter for a user action. A forced first paint still requires the same `forcedColorScheme` on the bootstrap and provider. See [integration recipes](../../../docs/theming-integration.md).

The docs matrix now has Light, Dark and System controls. The existing `/api/themes` and Figma export routes remain light-token exports; the complete dark review export is linked above. Dark export API modes are a separate follow-up, not a second runtime palette.

## Validation and practical limits

- Source conversion audit: 132 directly sourced assignments match captured Figma values exactly after conversion back to six-digit sRGB hex.
- Corrected sRGB alpha compositing rewrote the light snapshot's external `muted-foreground` rows; the external dark snapshot was generated with the corrected measurement.
- Dark contrast snapshot covers 17 text pairs × 10 external themes. Minimum ratio is **7.22:1**. Main foreground/background ranges from 15.98:1 to 18.09:1; primary action pairs range from 7.99:1 to 16.31:1.
- Five additional panel pairs pass 4.5:1. Input boundaries and focus colors pass 3:1 against background, card and soft-card surfaces.
- Chromium checks all 77 roles across 40 document states and 400 nested combinations through light → dark → light. A real dialog verifies scoped portal colors and alias rebinding.
- Runtime values stay in the theme system; component styles remain token-driven.

The thresholds follow [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). These results do not establish whole-product WCAG conformance. The low-contrast decorative feature foreground, alpha-based hover states, disabled controls, logos, illustrations and chart series need context-specific visual review. Fixed-color artwork remains fixed.

## Effort estimate

These are equivalent engineering hours for a developer familiar with this repository, including verification and documentation. They estimate the work's size, not this agent's wall-clock time.

| Work                                                                              | Estimate                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------- |
| Inspect six Figma files, settle precedence, trace dark aliases and investigate GE | 5–8 hours                                 |
| Map dark brand and support roles, preserve segment/alias policies                 | 4–6 hours                                 |
| Extend composition, generated selectors and complete scope resets                 | 4–6 hours                                 |
| Browser, contrast, portal, type/build and packaging checks                        | 5–8 hours                                 |
| Docs matrix controls, source report and handoff                                   | 2–4 hours                                 |
| **Engineering total**                                                             | **20–32 hours, roughly 3–4 working days** |

The implementation above is complete in the worktree. Remaining design acceptance is about **4–8 hours** of designer/developer time: resolve GE surface/action roles, confirm Telinet's live collection, review shared status/chart/syntax mappings, and inspect representative customer journeys. Allow another **1–2 engineering days** if that review changes the palette strategy or exposes component-level state issues. Internal dark palette design and implementation are excluded.

## Final validation

Completed on 2026-09-15:

| Check                                                                  | Result                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Full UI unit suite                                                     | 88 files, 695 tests passed                                     |
| Focused UI Chromium suites                                             | 4 files, 38 tests passed                                       |
| Docs handbook, catalog and Figma export unit suites                    | 3 files, 55 tests passed                                       |
| Docs prose Chromium suite, including actual dark/light matrix controls | 5 tests passed                                                 |
| UI and docs production builds and TypeScript checks                    | Passed                                                         |
| Strict lint and formatting for changed code                            | Passed                                                         |
| Fresh package build, packed-consumer validation and size limits        | Passed                                                         |
| Direct source-color audit                                              | 132 assignments matched, zero mismatches                       |
| Browser visual inspection                                              | All ten external cells checked after theme transitions settled |

The external rollout's published `themes.css` payload measured **4,524 gzip bytes**, up 2,250 bytes from the recorded 2,274-byte baseline, and its ceiling was recalibrated to **6,786 bytes** under the existing measured-size × 1.5 policy. The round-1 fixes re-measured the sheet at **4,443 gzip bytes** and ratcheted the ceiling to **6,416 bytes** (2026-09-15). The freshly packed stylesheet was verified byte-for-byte against the generated build before package and size checks.

The implementation and validation are complete in the worktree. The remaining work is design acceptance of the provisional choices and review in representative product screens, as estimated above.
