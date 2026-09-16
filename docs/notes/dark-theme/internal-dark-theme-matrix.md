# Internal dark-theme mapping

Implemented 2026-09-15 from the user-supplied shadcn neutral dark base. This extends the preceding [external dark rollout](external-dark-theme-matrix.md). Both variants now support the document's `data-theme="dark"` selection.

[Rendered matrix preview](../../../notes/internal-dark-theme-preview.png) records the original palette rollout with light docs chrome. The subsequent [docs theme audit](docs-theme-compliance.md) replaces that chrome with the library's internal Elmera light/dark theme.

[Input preview](../../../notes/internal-dark-input-preview.png) shows the actual library input with the approved 40% white border on its dark card surface.

## Is the supplied palette complete?

It supplies 31 declarations. Twenty-nine names match our 77-token contract; `sidebar-primary` and `sidebar-primary-foreground` are shadcn roles that our library does not consume. Its five chart slots also leave three library slots unassigned. The missing roles include soft surfaces/actions, feature colors, status pairs, destructive foreground, right-panel colors and nine syntax colors. Existing brand pointers, fonts and radii already supply the identity and non-color roles.

The [shadcn theming documentation](https://ui.shadcn.com/docs/theming) describes its smaller token set and the background/foreground pairing convention. This implementation uses the supplied values as its source, with the explicit decisions below, and keeps this library's existing selectors and role names.

## Decisions and exact changes

- Keep each brand's sidebar accent. The supplied blue `sidebar-primary` pair is not mapped onto `sidebar-brand`.
- Use one neutral dark palette for every internal brand and segment. Brand and sidebar-brand pointers still select the existing brand colors.
- Keep `destructive` and `destructive-foreground` as aliases to `error` and `error-foreground`. Apply the supplied destructive red to `error`, paired with `oklch(0.145 0 0)` text. White text on that red would not meet the library's 4.5:1 text floor.
- Reuse the shared dark status, syntax and remaining chart defaults. Internal error uses the supplied red; the other status and soft-status pairs retain shared values.
- Strengthen input and chart contrast with user approval. Decorative border and sidebar-border retain the supplied 10% white opacity.

| Role                 | Supplied                     | Implemented                        | Reason                                                    |
| -------------------- | ---------------------------- | ---------------------------------- | --------------------------------------------------------- |
| input                | `oklch(1 0 0 / 15%)`         | `oklch(1 0 0 / 40%)`               | At least 3:1 against the three supported control surfaces |
| chart-4              | `oklch(0.508 0.118 165.612)` | `oklch(0.565 0.118 165.612)`       | Lift the fourth green while retaining hue and chroma      |
| chart-5              | `oklch(0.432 0.095 166.913)` | `oklch(0.54 0.095 166.913)`        | Lift the darkest green while retaining hue and chroma     |
| sidebar-primary pair | Blue / near white            | Existing sidebar-brand aliases     | Preserve each brand's accent as requested                 |
| destructive          | `oklch(0.704 0.191 22.216)`  | Same rendered red via error alias  | Preserve the library's semantic alias contract            |
| sidebar-ring         | `oklch(0.556 0 0)`           | Same rendered value via ring alias | Rebind the alias at each scope                            |

## Missing-role matrix

| Library roles                                   | Mapping                                                      |
| ----------------------------------------------- | ------------------------------------------------------------ |
| card-soft pair                                  | `oklch(0.269 0 0)` / `oklch(0.985 0 0)`                      |
| primary-soft and secondary-soft pairs           | Same neutral soft pair                                       |
| feature / feature-bright / feature-foreground   | `oklch(0.205 0 0)` / `oklch(0.269 0 0)` / `oklch(0.985 0 0)` |
| error-foreground / destructive-foreground       | `oklch(0.145 0 0)`                                           |
| error-soft pair                                 | Shared dark error-soft pair                                  |
| info, success and warning, including soft pairs | Shared dark defaults                                         |
| chart-6, chart-7, chart-8                       | Shared yellow, pale amber and peach defaults                 |
| nine sh-* syntax roles                          | Shared dark syntax defaults                                  |
| right-panel pair                                | Card pair                                                    |
| brand and sidebar-brand pairs                   | Existing per-brand pointers                                  |
| radius, radius-button, font-sans, font-heading  | Existing internal values                                     |

The chart sequence keeps the supplied three brightest greens and lightens the final two. Slots 6–8 remain provisional fallback colors. Contrast against the panel does not establish distinction between adjacent series, and the green sequence should not be treated as a validated categorical palette. Charts still need labels, legends and context-specific review.

The [complete resolved export](../../../notes/internal-dark-theme-tokens.json) lists all 77 roles, selectors and measured contrast for each internal permutation.

## Permutations and selectors

| Brand | Private   | Company   | Sidebar accent            |
| ----- | --------- | --------- | ------------------------- |
| fkas  | Supported | Supported | Fjordkraft                |
| tkas  | Supported | Supported | TrøndelagKraft            |
| guen  | Supported | Supported | Gudbrandsdal Energi       |
| fkab  | Illegal   | Supported | Existing Fjordkraft alias |
| fkse  | Supported | Illegal   | Telinet                   |
| elma  | Supported | Supported | Elmera                    |

Every supported row uses the same internal dark colors. The only color differences are existing brand pointers. Fjordkraft's Bedrift distinction remains exclusive to the external company palette.

```css
[data-theme="dark"][data-theme-variant="internal"] {
  /* neutral dark roles */
}
[data-theme="dark"] [data-theme-variant="internal"] {
  /* nested neutral dark roles */
}
```

Brand and segment attributes retain their normal meaning. Light/dark remains document-owned, and `ThemeScope` owns variant, brand and segment. All 400 nested combinations are checked while switching light → dark → light. Each dark variant supplies its own reset values, including dependent aliases, so an external palette cannot leak into an internal scope or vice versa. Internal and external dark scopes declare native CSS `color-scheme: dark`.

The palette lives in [internal-dark-palette.ts](../../../packages/ui/src/theme/tokens/internal-dark-palette.ts). [Shared dark defaults](../../../packages/ui/src/theme/tokens/dark-defaults.ts), [composition](../../../packages/ui/src/theme/compose-theme.ts) and [CSS generation](../../../packages/ui/src/theme/generate-css.ts) remain the central implementation. The stylesheet has 23 emitted rule bodies: 15 light and 8 dark, each dark body carrying its direct and descendant selector in one list. Existing light-only catalog/Figma exports retain their API; the JSON linked above is the dark review export.

Docs chrome now consumes the internal Elmera palette, including its canvas and controls. The matrix and demo scopes show both internal and external palettes under the same document scheme. The static integration fixture demonstrates internal dark first paint before React mounts. See the [docs theme audit](docs-theme-compliance.md) for the follow-up implementation and checks.

## Contrast results

| Check                                     | Result               |
| ----------------------------------------- | -------------------- |
| Main foreground/background                | 18.96:1              |
| Card text                                 | 17.16:1              |
| Muted text on muted surface               | 5.83:1               |
| Primary button pair                       | 14.22:1              |
| Destructive button pair                   | 6.84:1               |
| Input against background/card/card-soft   | 3.77 / 3.82 / 3.66:1 |
| Ring against background/card/card-soft    | 4.18 / 3.79 / 3.19:1 |
| Chart-4 against background/card/card-soft | 4.61 / 4.17 / 3.52:1 |
| Chart-5 against background/card/card-soft | 4.11 / 3.72 / 3.14:1 |

All 17 paired text roles meet 4.5:1, with a 5.83:1 minimum. Additional panel/feature pairs and all syntax colors pass 4.5:1 on their tested backgrounds. All eight chart colors, input and ring pass 3:1 against background, card and card-soft. Decorative borders retain 10% white and are not the sole control boundary. Hover, disabled, focus-opacity and artwork behavior still need whole-screen review.

Adding percentage-alpha tokens exposed a measurement bug: alpha was being blended in linear light. The calculator now accepts percentage alpha and blends in sRGB before computing relative luminance. A known 50% white-on-black case verifies 5.2808:1. This changes measured light-muted ratios without changing their CSS values. Most light external muted pairs now measure 4.93–7.17:1; Telinet remains below the text floor at 4.35–4.41:1 and retains its documented exception. The light contrast snapshot is updated for this correction; the external dark snapshot is unchanged.

## Confidence and effort

Configuration confidence is approximately 95%, based on complete token, nested-scope, portal and first-paint checks. The supplied roles are deterministic, with three approved contrast adjustments and two deliberate sidebar omissions. Missing-role assignments and chart semantics remain engineering choices that need design review. This is not a whole-product accessibility claim.

The internal addition is roughly 4–8 engineering hours for an engineer familiar with this repository, including mapping, integration, verification and documentation. Allow 1–2 hours of design review for the added roles and chart sequence. The compiled theme stylesheet measured 4,813 gzip bytes, 289 bytes more than the external-only rollout, within the then-standing 6,786-byte ceiling. Re-measured 2026-09-15 after the round-1 fixes: 4,443 gzip bytes against a 6,416-byte ceiling.

## Validation

Completed for the original palette rollout on 2026-09-15. The [docs theme audit](docs-theme-compliance.md) records the later docs changes:

- Full UI unit suite: 88 files, 700 tests passed.
- Focused UI browser suites: 5 files, 45 tests passed, including all document permutations, 400 nested combinations across scheme changes, internal/external dialogs and sidebar aliases.
- Static integration first-paint browser suite: 12 tests passed, including stored/system dark and forced dark before React mounts.
- Docs browser suites: 15 tests passed, including light docs chrome, readable scheme controls and both dark matrix variants. The JavaScript-disabled test now waits for stylesheets before reading CSS values through CDP.
- Docs handbook/catalog/Figma export unit suites: 55 tests passed.
- UI, static integration and docs production builds passed. UI and docs TypeScript checks passed.
- Strict lint, formatting and diff whitespace checks passed.
- Fresh package validation and size limits passed. Packed `themes.css` matches the build byte-for-byte; the original rollout measured 4,813 gzip bytes, re-measured at 4,443 gzip bytes against a 6,416-byte ceiling after the round-1 fixes.
- Browser visual review confirmed the matrix and actual input demo. The input resolves a 40% white border and native dark controls.

The implementation is complete in the worktree. Design review of the inferred role assignments and chart semantics remains as described above.
