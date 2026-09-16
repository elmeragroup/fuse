# External dark theme architecture research

> Superseded 2026-09-15: dark values shipped for both variants; internal themes use the shared neutral dark palette, the sheet has 23 rule bodies (15 light, 8 dark), and nested-scope coverage moved to the Chromium matrix (400 outer/inner pairs) when the unit cascade simulator was deleted. The body below records the pre-implementation research.

Research date: 2026-09-15. Sections below record the baseline inspected before implementation. They do not assess the supplied Figma files or establish dark color values. The user subsequently authorized implementation; results appear in the final section. The scope is external dark themes; internal dark palettes remain undecided.

## Findings

The library already resolves and persists light, dark, and system preferences and writes `data-theme="light"` or `data-theme="dark"` before paint. The CSS deliberately has no dark declarations. Dark implementation therefore needs token composition, CSS generation, scope isolation, documentation, and visual validation. It does not need a new theme provider. [Color-scheme contract](../../../packages/ui/src/theme/color-scheme.ts), [provider](../../../packages/ui/src/theme/theme-provider.tsx), [CSS generator](../../../packages/ui/src/theme/generate-css.ts), [theming specification §7.8](../../../docs/spec/theming.md#78-color-scheme-axis).

There are 10 legal external permutations and six distinct effective light palettes. The following table records current behavior, not an assumption that dark palettes should be identical. [Theme types and brand table](../../../packages/ui/src/theme/tokens/themes.ts), [external palettes](../../../packages/ui/src/theme/tokens/external-palettes.ts), [segment delta](../../../packages/ui/src/theme/tokens/segment-deltas.ts).

| Variant  | Brand | Display name        | Segment | Current palette source                    |
| -------- | ----- | ------------------- | ------- | ----------------------------------------- |
| external | fkas  | Fjordkraft          | private | fkas base                                 |
| external | fkas  | Fjordkraft          | company | fkas base plus company delta              |
| external | tkas  | TrøndelagKraft      | private | tkas base                                 |
| external | tkas  | TrøndelagKraft      | company | tkas base                                 |
| external | guen  | Gudbrandsdal Energi | private | guen base                                 |
| external | guen  | Gudbrandsdal Energi | company | guen base                                 |
| external | fkab  | Fjordkraft Företag  | company | fkas base, without the fkas company delta |
| external | fkse  | Telinet             | private | fkse base                                 |
| external | elma  | Elmera              | private | elma base                                 |
| external | elma  | Elmera              | company | elma base                                 |

`fkab-private` and `fkse-company` are illegal. `fkab` is a permanent visual alias of Fjordkraft, but today its value set is specifically the fkas base, not fkas company. A Figma file named Bedrift must not silently be treated as the source for fkab. Its role needs to be identified from the design evidence. [Domain glossary](../../../CONTEXT.md), [alias implementation](../../../packages/ui/src/theme/tokens/external-palettes.ts), [delta predicate](../../../packages/ui/src/theme/tokens/segment-deltas.ts).

## Token ownership and work size

The theming implementation lives in `packages/ui/src/theme/`. There is no `packages/theming` package. TypeScript owns the values; the build writes `dist/themes.css`. The committed CSS snapshot is the reviewable generated artifact. [Build](../../../packages/ui/scripts/build-css.ts), [generator](../../../packages/ui/src/theme/generate-css.ts), [snapshot](../../../packages/ui/src/theme/__snapshots__/themes.css).

| Contract area               | Current size | Consequence for dark                                                                                    |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Themable role tokens        | 77           | Review every role, including deliberate unchanged values                                                |
| Color-valued role tokens    | 73           | 77 minus two radii and two fonts; this includes aliases, charts, and syntax colors                      |
| Public primitives           | 23           | Eleven neutral steps plus six brand foreground/background pairs; primitives are invariant across themes |
| External reset keys         | 24           | Only these palette keys reach generated external rules today                                            |
| External must-override keys | 25           | Current light coverage requirements do not prove dark completeness                                      |
| Internal must-override keys | 2            | Brand and brand foreground                                                                              |
| Fjordkraft company delta    | 15           | A separate dark company delta must be checked against its own source                                    |
| Current contrast pairs      | 17           | All 20 light themes produce 340 pair measurements                                                       |

Counts derive from the literal tuples and objects in the [contract](../../../packages/ui/src/theme/tokens/contract.ts), [primitives](../../../packages/ui/src/theme/tokens/primitives.ts), [company delta](../../../packages/ui/src/theme/tokens/segment-deltas.ts), and [contrast implementation](../../../packages/ui/src/theme/contrast.ts).

The practical audit is 10 external rows × 77 roles, or 770 role cells. That is not 770 independently chosen colors: aliases, shared roles, segment fallbacks, shape, and fonts reduce the authored data considerably. A useful matrix labels each cell as directly sourced, mapped from a Figma role, inherited unchanged, shared dark value, or unresolved.

### Shared roles are part of the dark task

Current brand palettes override surfaces, primary/secondary roles, feature roles, lines, and shape. They leave popover, accent, all statuses, focus ring, sidebar, right panel, chart colors, and syntax colors in the defaults. Those defaults include white popovers, light panels, and light status fills. A dark background alone would leave visibly light overlays and controls. [Defaults](../../../packages/ui/src/theme/tokens/defaults.ts), [external palettes](../../../packages/ui/src/theme/tokens/external-palettes.ts).

`generateThemesCss()` emits external palette declarations by iterating `EXTERNAL_RESET_KEYS`, not every supplied palette key. Adding a dark popover or status value to a palette object without updating the generator/reset contract can therefore produce plausible TypeScript data that never appears in CSS. [Generator](../../../packages/ui/src/theme/generate-css.ts), [reset contract](../../../packages/ui/src/theme/tokens/contract.ts).

## Selector and nesting requirements

These four attributes retain separate meanings:

```html
<html
  data-theme="dark"
  data-theme-variant="external"
  data-theme-brand="fkas"
  data-theme-segment="company"></html>
```

The brand theme remains variant × brand × segment. `ThemeInput` and theme slugs have no color-scheme field. The provider owns the document scheme; `ThemeScope` writes only the other three attributes onto its own element. `ForceColorScheme` also forces the document rather than its own subtree. [Theme types](../../../packages/ui/src/theme/tokens/themes.ts), [attributes](../../../packages/ui/src/theme/theme-attributes.ts), [scope](../../../packages/ui/src/theme/theme-scope.tsx), [force component](../../../packages/ui/src/theme/force-color-scheme.tsx).

### A same-element dark selector is insufficient

This selector matches a document carrying all attributes:

```css
[data-theme="dark"][data-theme-variant="external"][data-theme-brand="fkas"]
```

It does not match an ordinary nested `ThemeScope`, because that scope has no `data-theme`. Every external scope explicitly re-declares all 24 reset keys. A child scope therefore replaces an inherited dark background with its own light value unless dark rules also match that scope. This follows directly from [scope markup](../../../packages/ui/src/theme/theme-scope.tsx) and [external rule generation](../../../packages/ui/src/theme/generate-css.ts).

For the existing document-owned scheme contract, generation needs both same-element intersections and matching external scopes under the dark document. Illustrative selector shapes are:

```css
[data-theme="dark"][data-theme-variant="external"][data-theme-brand="fkas"] {
  /* dark base */
}
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="fkas"] {
  /* dark base */
}

[data-theme="dark"][data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"] {
  /* dark company */
}
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"] {
  /* dark company */
}
```

These are implementation examples, not an approved extension to independently nested light/dark scopes. Supporting a local `data-theme="light"` under a dark ancestor needs an explicit nearest-scheme rule; a broad ancestor selector alone does not provide that behavior. The present React API deliberately has only document scheme state. Preserve that contract unless local scheme islands are part of the requested product behavior. [Theming specification §7.4 and §7.8](../../../docs/spec/theming.md).

### Internal scopes must stay light

Never emit an unrestricted `[data-theme="dark"] { --background: ... }` palette that also affects internal themes. Bind dark values to `data-theme-variant="external"`. Expand the reset set to include every role dark layers can change, and materialize the light reset on nested internal scopes. Otherwise an internal scope under external dark inherits dark popover/status/sidebar roles that its current 24-key reset never touches. Likewise, an external scope inside an internal scope under a dark document must still acquire its own dark values. [Current reset composition](../../../packages/ui/src/theme/compose-theme.ts), [current reset keys](../../../packages/ui/src/theme/tokens/contract.ts).

Aliases must be re-declared where their dependencies change. For example, root `--destructive: var(--error)` can already have resolved to the light error value before a nested dark scope overrides `--error`. The library already addresses this for sidebar brand aliases by declaring them on each branded element. Apply the same check to destructive aliases and sidebar ring when dark changes their dependencies. [Defaults](../../../packages/ui/src/theme/tokens/defaults.ts), [brand pointer emission](../../../packages/ui/src/theme/generate-css.ts), [sidebar browser tests](../../../packages/ui/src/theme/sidebar-brand.browser.test.tsx).

### Portals

Overlay components default to the nearest `ThemeScope` element, so they can inherit scoped dark tokens without new portal plumbing. An explicit outside container receives its container's theme. Browser validation should open dialogs, popovers, menus, selects, tooltips, and a React Aria date picker in nested dark scopes. [Scope container](../../../packages/ui/src/theme/theme-scope-container.ts), [scope tests](../../../packages/ui/src/theme/theme-scope-container.browser.test.tsx), [theme matrix example](../../../apps/docs/src/components/theme-matrix.tsx).

## Existing verification and gaps

| Existing check                            | What it proves now                                                                                                       | Dark extension needed                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Theme contract                            | 20 light permutations, 400 nested theme combinations, reset completeness, exact 15-rule stylesheet, no dark declarations | Scheme-aware composition and CSS assertions; preserve light and internal behavior                                 |
| CSS snapshot                              | Stable generated light values and selector ordering                                                                      | Review added external dark rules and any expanded reset declarations                                              |
| Contrast matrix                           | 17 paired roles across 20 light themes                                                                                   | Add 10 external dark rows and measure relevant popover, accent, sidebar, panel, focus, chart, and syntax contexts |
| Provider/runtime/bootstrap tests          | Preference, media, storage, force precedence, and document attributes                                                    | Preserve these; add visible external dark first paint and scheme-change assertions                                |
| Scope and portal browser tests            | Owned attributes and portal containment                                                                                  | Read actual dark computed colors in nested scopes and overlays                                                    |
| Docs theme catalog and Figma export tests | Twenty light theme entries, one export per slug                                                                          | Decide how scheme is represented while preserving current slug semantics                                          |
| Packed consumer and size checks           | Published CSS and package behavior                                                                                       | Check both raw CSS and standalone output with dark values                                                         |

Sources: [theme contract](../../../packages/ui/src/theme/theme-contract.test.ts), [contrast test](../../../packages/ui/src/theme/contrast-matrix.test.ts), [runtime tests](../../../packages/ui/src/theme/color-scheme-runtime.test.ts), [provider browser tests](../../../packages/ui/src/theme/theme-provider.browser.test.tsx), [static first-paint tests](../../../apps/static-theme/test/first-paint.browser.test.ts), [docs first-paint tests](../../../apps/docs/test/first-paint.browser.test.ts), [catalog builder](../../../apps/docs/scripts/lib/theme-catalog.ts), [Figma export builder](../../../apps/docs/scripts/lib/theme-catalog-figma.ts), [task graph](../../../turbo.json).

The current CSS test helper is a limited approximation. It matches variant/brand/segment attributes on one supplied theme, applies rules in file order, and does not model specificity, ancestry, or computed `var()` resolution. It explicitly rejects `data-theme` because that attribute is absent from its theme map. Extending only the color data leaves dark rules outside this verification. Real browser assertions are necessary for the new selector combinations. [CSS rule helper](../../../packages/ui/src/theme/css-rules.ts).

Current contrast checks exclude external muted foreground from the numeric threshold and classify feature foreground as decorative. They also omit popover, accent, sidebar, right panel, ring, charts, and syntax. Passing the existing test is not evidence of complete dark accessibility. Keep accepted light exceptions separate from newly sourced dark results. [Contrast pairs](../../../packages/ui/src/theme/contrast.ts), [accessibility specification §6](../../../docs/spec/accessibility.md#6-contrast).

The static and docs applications currently use an internal Elmera document theme. Their assertions that a dark marker still paints a light canvas should remain valid for an external-only rollout. Add an external first-paint fixture rather than globally rewriting those assertions. [Static document theme](../../../apps/static-theme/src/theme.ts), [docs document theme](../../../apps/docs/src/lib/theme.ts), [static first-paint tests](../../../apps/static-theme/test/first-paint.browser.test.ts).

### Baseline executed

The following targeted baseline passed on 2026-09-15: five files, 55 tests. No browser suite was run during this read-only research task.

```sh
pnpm --filter @elmeragroup/ui test \
  src/theme/theme-contract.test.ts \
  src/theme/contrast-matrix.test.ts \
  src/theme/theme-api.test.ts \
  src/theme/color-scheme-runtime.test.ts \
  src/theme/color-scheme-script.test.ts
```

For implementation, run the relevant unit and browser suites after building generated CSS, docs catalog/export tests if their representation changes, both app first-paint checks if touched, type-check and lint, then pack/package/size checks through the existing task graph. The recorded `themes.css` size is 2,274 gzip bytes with a 3,424-byte ceiling; the shipped sheet measures 4,443 gzip bytes, ceiling 6,416 (2026-09-15). [Package scripts](../../../packages/ui/package.json), [task graph](../../../turbo.json), [size budget](../../../packages/ui/scripts/size-budgets.ts).

## Reference material already present

The local external reference contains a `.guen-dark` block in `.ref/OrderModuleWeb/packages/ui/src/styles/brands.css`. It is gated by both a class and `prefers-color-scheme: dark`, supplies dark surface/action values in hex, and is explicitly classified as limited-quality reference input in the roadmap. It is not the published library's dark palette and must not override current Figma findings. [Dark roadmap item](../../../docs/spec/roadmap.md), [reference ownership](../../../docs/reference-sources.md).

The repository's `theme-catalog-figma.ts` creates Figma-importable token documents from code; it does not contain extracted evidence from the user's Figma source files. Its existing scheme-free model also means a dark export cannot simply replace a light file under the same slug. [Export builder](../../../apps/docs/scripts/lib/theme-catalog-figma.ts).

## Effort estimate

This is an engineering estimate based on the code paths above, not observed implementation time. Assume one engineer familiar with this library, complete agreed dark values for the six effective palettes, no redesigned components, and the existing document-owned scheme API.

| Work                                                                                        | Estimated engineer-days |
| ------------------------------------------------------------------------------------------- | ----------------------- |
| Translate approved source roles; represent shared dark values and brand/segment differences | 0.5 to 1                |
| Extend composition, generation, resets, aliases, and selector tests                         | 1 to 1.5                |
| Contrast review, actual computed-color browser tests, nested portals, external first paint  | 1 to 1.5                |
| Docs matrix/catalog integration, specification updates, package checks, final visual review | 0.5 to 1                |
| Total with approved palettes                                                                | 3 to 5                  |

Allow approximately 5 to 8 engineer-days when GUEN interpretation, missing shared roles, or contrast corrections require one or two design-review rounds. Time waiting for design decisions is additional. Independently nested light/dark islands or broader logo/chart redesign are separate scope and are not included.

## Confidence assessment

- High confidence in the architectural inventory. It comes from current source and a passing 55-test baseline.
- High confidence that no external dark palette is configured today. The generator emits no active dark selector, and a passing test requires that absence.
- No numerical source-accuracy claim is possible from this architecture audit. Figma extraction and role mapping must establish which dark values are directly supported.
- High implementation confidence is attainable with the existing runtime. The uncertainty sits in palette evidence, expanded reset behavior, aliases, and visual contrast. Percentage confidence should remain an explicitly subjective estimate until those checks run.

A final matrix should report source coverage separately from implementation correctness. For example, measure directly verified role cells divided by applicable role cells, show inferred cells explicitly, and report browser/contrast pass counts separately. A percentage describing successful checks does not imply the untested design decisions are correct.

## Implementation results

The implementation composes external dark overrides through `composeTheme(theme, "dark")`, keeping the default call light-compatible. It emits both same-element and descendant scope selectors. Internal themes still resolved light at this step; the internal palette noted above changes that. The sheet at this step contained 29 rules; the final sheet has 23 rule bodies (15 light, 8 dark). `THEME_RESET_KEYS` derives 72 reset roles from the original 24 light identity keys and the dark overrides, including aliases. Dark scopes materialize those roles; light scopes reset only their own palette keys. [Composition](../../../packages/ui/src/theme/compose-theme.ts), [reset derivation](../../../packages/ui/src/theme/tokens/reset-keys.ts), [generator](../../../packages/ui/src/theme/generate-css.ts).

Scoped CSS declares native `color-scheme: light` for internal and base external themes, and `color-scheme: dark` for matching dark themes in both variants. The provider and bootstrap still leave JavaScript `style.colorScheme` untouched. `fkab-company` retains the fkas-private dark palette. [Generator](../../../packages/ui/src/theme/generate-css.ts), [palette alias](../../../packages/ui/src/theme/tokens/external-dark-palettes.ts).

Verification completed on 2026-09-15:

- Five focused unit files passed, 60 tests. The token contract exercises all 77 roles in 40 document states and 800 nested cases, covering both document schemes.
- Four focused Chromium files passed, 38 tests. New browser coverage checks computed token values and native color scheme for every document permutation and all 400 nested theme combinations during light → dark → light changes. It also opens a dialog under an external/internal/external scope chain and checks its actual colors and aliases.
- Dark contrast passed 170 existing text pair checks, 50 additional shared-panel text pair checks at 4.5:1, and 60 input/focus-ring checks at 3:1 on background, card, and card-soft.
- The UI build, TypeScript check, strict lint for changed architecture/test files, formatting, and diff whitespace checks passed.

Sources: [contract tests](../../../packages/ui/src/theme/theme-contract.test.ts), [browser tests](../../../packages/ui/src/theme/dark-theme.browser.test.tsx), [contrast tests](../../../packages/ui/src/theme/contrast-matrix.test.ts), [dark contrast snapshot](../../../packages/ui/src/theme/__snapshots__/external-dark-contrast-matrix.json).

The generated `themes.css` measured 75,181 raw bytes and 4,524 gzip bytes at the external rollout, exceeding the previous 3,424-byte ceiling. The parent task recalibrated the budget to 6,786 bytes and passed fresh packed-consumer and size checks. The sheet's current state (2026-09-15, after the round-1 fixes narrowed light rules back to `EXTERNAL_RESET_KEYS`) is **41,861 raw bytes / 4,443 gzip bytes against a 6,416-byte ceiling** — see the baseline note above and the [final matrix and validation](external-dark-theme-matrix.md#final-validation) for the completed task results and updated effort estimate.
