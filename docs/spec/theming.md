# Theming

Current token, cascade, provider, and scope contracts for `@elmeragroup/ui`. Token data lives in code; integration recipes live in [theme integration](../theming-integration.md). Rationale lives in ADRs [0001](../adr/0001-canonical-token-contract.md), [0002](../adr/0002-theme-attributes.md), and [0003](../adr/0003-data-only-theme-provider.md).

Cross-links: package layout, exports, and where `themes.css` ships → [architecture](architecture.md). Contrast obligations of token pairings (text-grade roles, documented deviations, contrast-matrix snapshot) → [accessibility](accessibility.md) §6. CSS size budget for the emitted theme stylesheet → [performance](performance.md).

## 1 Axes, themes, slugs

- A **theme** is a concrete permutation of three axes:
  - **Variant** — audience axis: `internal` (grayscale theme for internal tools; brand appears only in accents/logos) or `external` (full brand look-and-feel for customer-facing apps).
  - **Brand** — a visual-identity code: the five consumer-facing energy brands plus corporate Elmera, with fixed four-character codes: Fjordkraft (`fkas`), TrøndelagKraft (`tkas`), Gudbrandsdal Energi (`guen`), Fjordkraft Företag (`fkab`), Fjordkraft Konsument (`fkse`), Elmera (`elma`). `fkse` renders under the consumer-facing trade name **Telinet** (logo and palette) while keeping the `fkse` code everywhere in code, slugs, attributes, and types; brand metadata carries `displayName: "Telinet"` (§7.5). `elma` carries `displayName: "Elmera"`. Steddi, NGE, and Trumf remain outside this theme set.
  - **Segment** — customer class: `private` (B2C) or `company` (B2B).
- **Pinned brands**: `fkab` is pinned to `company`; `fkse` is pinned to `private`. The other four brands span both segments. This yields **20 legal themes** at v1 (10 internal, 10 external). Illegal permutations (`*-fkab-private`, `*-fkse-company`) are handled per §6.
- **Theme slug**: the canonical string name of a theme, `<variant>-<brand>-<segment>` — e.g. `internal-fkas-company`, `external-tkas-private`. Slugs are derived, never authoritative: the decomposed axes are the primary representation (§7.1).
- **Dark is not an axis of the theme.** Color scheme (light/dark) is an orthogonal, layered axis reserved on the `data-theme` attribute (§3.6, §7.8). No dark values are specced at v1; the machinery ships functional and valueless.

## 2 Token contract

The contract is the fixed set of CSS custom-property names every component consumes. **Themes vary values, never names.** All color values are **oklch**. Two public tiers exist.

### 2.1 Grammar

- **shadcn grammar**: `--x` / `--x-foreground` pairs, extended with a **soft form** `--x-soft` / `--x-soft-foreground` — the tinted-background companion of a role (the contract's rename of Material-3's `-container` concept). The soft form applies to the four statuses, `primary`, `secondary`, and `card`.
- **Role token**: semantic, themable, named for its job (`--primary`, `--card`, `--error`).
- **Primitive token**: public but non-themed — raw palette values with the same value in every theme. Stable API (internal tools legitimately render other brands' accents).
- **`--popover` is never `var(--card)`** — the legacy eager-binding footgun is shed; popover carries independent literals.
- **Feature role**: `--feature` / `--feature-bright` / `--feature-foreground` is the strong brand-colored promo/hero panel role, deliberately distinct from `--accent`, which stays a subtle hover tint. `feature-foreground` is **not text-grade** — accent/decorative only; body text on feature panels is white ([accessibility](accessibility.md) §6).

### 2.2 Themable role tokens (77)

| Family      | Tokens                                                                                                                                                                        | Count |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Surfaces    | `--background`, `--foreground`                                                                                                                                                | 2     |
|             | `--card`, `--card-foreground`, `--card-soft`, `--card-soft-foreground`                                                                                                        | 4     |
|             | `--popover`, `--popover-foreground`                                                                                                                                           | 2     |
|             | `--muted`, `--muted-foreground`                                                                                                                                               | 2     |
|             | `--accent`, `--accent-foreground`                                                                                                                                             | 2     |
|             | `--feature`, `--feature-bright`, `--feature-foreground`                                                                                                                       | 3     |
| Interactive | `--primary`, `--primary-foreground`, `--primary-soft`, `--primary-soft-foreground`                                                                                            | 4     |
|             | `--secondary`, `--secondary-foreground`, `--secondary-soft`, `--secondary-soft-foreground`                                                                                    | 4     |
| Brand       | `--brand`, `--brand-foreground`                                                                                                                                               | 2     |
| Status      | `--error`, `--info`, `--success`, `--warning`, each × `-foreground`, `-soft`, `-soft-foreground`                                                                              | 16    |
|             | `--destructive`, `--destructive-foreground` — **shipped aliases** of `--error`/`--error-foreground` (sole shadcn-snippet compat concession)                                   | 2     |
| Lines/focus | `--border`, `--input`, `--ring`                                                                                                                                               | 3     |
| Sidebar     | `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`, `--sidebar-brand`, `--sidebar-brand-foreground` | 8     |
| Right panel | `--right-panel`, `--right-panel-foreground`                                                                                                                                   | 2     |
| Charts      | `--chart-1` … `--chart-8`                                                                                                                                                     | 8     |
| Syntax      | `--sh-identifier`, `--sh-keyword`, `--sh-string`, `--sh-class`, `--sh-property`, `--sh-entity`, `--sh-jsxliterals`, `--sh-sign`, `--sh-comment`                               | 9     |
| Shape       | `--radius`, `--radius-button`                                                                                                                                                 | 2     |
| Type        | `--font-sans`, `--font-heading`                                                                                                                                               | 2     |

`--brand`/`--brand-foreground` are first-class in every theme: the brand-pointer layer selects the globally available brand accent in both variants. External `--primary` remains the brand palette's action/surface color and can differ from that accent; internal themes keep `--primary` neutral and express brand identity only in `--brand` (and `--sidebar-brand`). The variant axis lives entirely in **values**, never in names — no internal-only tokens exist.

### 2.3 Public primitives

- **Neutral ramp** `--neutral-50` … `--neutral-950` — Tailwind convention (50 lightest → 950 darkest), pure gray (chroma 0). Pure white is `--background`, not a ramp member. The legacy inverted ramp (0 = black) and its warm hue on steps 70–95 are retired.
- **Brand accents** `--brand-<code>` / `--brand-<code>-foreground` for all six visual-identity codes, defined globally at `:root` and never re-themed. Every accent `-foreground` is white `oklch(1 0 0)`.

Value owners are linked in §4.

### 2.4 Locked (library-fixed, not themable)

Themes cannot override these values and the theme generator does not accept them:

| Token              | Value                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--radius-xs`      | `calc(var(--radius) - 6px)`                                                                                                                                                        |
| `--radius-sm`      | `calc(var(--radius) - 4px)`                                                                                                                                                        |
| `--radius-md`      | `calc(var(--radius) - 2px)`                                                                                                                                                        |
| `--radius-lg`      | `var(--radius)`                                                                                                                                                                    |
| `--radius-xl`      | `calc(var(--radius) + 4px)`                                                                                                                                                        |
| `--radius-popover` | `calc(var(--radius) - 8px)`                                                                                                                                                        |
| `--breakpoint-xs`  | `574px`                                                                                                                                                                            |
| `--breakpoint-lg`  | `60rem`                                                                                                                                                                            |
| `--breakpoint-3xl` | `1920px`                                                                                                                                                                           |
| `--spacing`        | `0.25rem`                                                                                                                                                                          |
| `--font-mono`      | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`                                                                               |
| `--ease-overshoot` | the exact `linear(0, 0.402 7.4%, 0.711 15.3%, 0.929 23.7%, 1.008 28.2%, 1.067 33%, 1.099 36.9%, 1.12 41%, 1.13 45.4%, 1.13 50.1%, 1.111 58.5%, 1.019 83.2%, 1.004 91.3%, 1)` curve |

### 2.5 Defaults + must-override model

The library ships a **complete neutral default layer at `:root`** — every contract token has a value before any theme marker exists. A theme overrides a subset. Brand-defining tokens are **must-override**:

- **External themes must supply**, across their composed non-default layers: `--background`, `--foreground`, the complete card, muted, primary, and secondary families; the feature triple; `--border`, `--input`; `--radius`, `--radius-button`; and `--brand`, `--brand-foreground`. Typography is optional in the source palette: all brands use the default `--font-sans`, and only fkas overrides `--font-heading`. The generator still materializes the default heading value in every other emitted external rule so a nested scope cannot inherit an outer fkas font (§3.2).
- **Internal themes must supply**: `--brand` and `--brand-foreground`, satisfied by the brand-pointer layer. `--sidebar-brand` and `--sidebar-brand-foreground` are complete defaults that resolve through that pair and therefore are not separate coverage obligations.
- Statuses, ring, charts, and syntax colors stay shared-by-default; themes _may_ override them but none does at v1.

Must-override is a **theme-level** obligation, not a per-module one. Individual layer modules are `Partial<TokenContract>` and never have to carry the full set themselves (internal themes, for instance, satisfy their brand-pair obligation via the brand-pointer layer). Enforcement happens at **compose time** in the token pipeline — each of the 20 themes is resolved through its layers and the build fails if a resolved theme lacks any must-override token (§8) — and is re-checked at the CSS level by the theme-contract test.

### 2.6 Legacy bridging: clean break

No HSL-triplet wrappers, no bridge layer. This table is the complete semantic rename guide for lifting reference styles; it is documentation only and does not create aliases:

| Reference token/concept                                                   | Canonical token                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--surface` / `--on-surface`                                              | `--background` / `--foreground`                                                  |
| `--primary-container` / `--on-primary-container`                          | `--card` / `--card-foreground`                                                   |
| `--surface-bright`                                                        | `--card-soft` (foreground uses `--card-soft-foreground`)                         |
| `--surface-variant` / `--surface-variant-bright` / `--on-surface-variant` | `--feature` / `--feature-bright` / `--feature-foreground`                        |
| `--on-surface-muted`                                                      | `--muted-foreground`                                                             |
| `--primary` / `--on-primary`                                              | `--primary` / `--primary-foreground`                                             |
| `--secondary` / `--on-secondary`                                          | `--secondary` / `--secondary-foreground`                                         |
| `--secondary-container` / `--on-secondary-container`                      | `--secondary-soft` / `--secondary-soft-foreground`                               |
| `--<status>` / `--on-<status>`                                            | `--<status>` / `--<status>-foreground` for `error`, `info`, `success`, `warning` |
| `--<status>-container` / `--on-<status>-container`                        | `--<status>-soft` / `--<status>-soft-foreground`                                 |
| legacy per-brand accent selected for the current brand                    | `--brand` / `--brand-foreground` (primitives remain `--brand-<code>` pairs)      |
| internal inverted neutral ramp                                            | `--neutral-50..950`, renumbered light-to-dark and normalized to chroma 0 (§4)    |

New roles with no faithful legacy alias are `--popover(-foreground)`, `--primary-soft(-foreground)`, and the trimmed sidebar contract; ports choose them by the component semantics documented in §5 and each component's consumed-token section. Deliberately dead with **no replacement alias**: `--surface-text`, `--tertiary*` (all forms), `--secondary-variant`, `--inactive`, `--primary-light`, `--sidebar-background`, `--sidebar-primary(-foreground)`, per-brand `--destructive` triplets, `--on-primary-container-muted` (use opacity utilities), and the `.ngeas` block. The `--destructive` alias pair is the only runtime compatibility concession.

### 2.7 Library-owned implementation variables (density)

A third classification exists **outside** the two public contract tiers. Density control metrics are library-owned implementation variables shared by library component recipes. They are not role tokens, not public primitives, and not locked theme-contract keys.

They must not enter `TOKEN_NAMES` or `EXTERNAL_RESET_KEYS`. The generator, the 20-theme matrix, nested-scope isolation, and the contrast matrix do not mention them. Brand themes do not override them. Direct consumer override is unsupported.

Names and values live in the non-generated portion of `ui.css` as `:root` (dense) and `:root[data-density="comfortable"]` (comfortable) declarations. The density attribute is `data-density`, not a `data-theme-*` key (ADR [0002](../adr/0002-theme-attributes.md)). See ADR [0001](../adr/0001-canonical-token-contract.md) amendment 2026-08-20. Hosts stamp the attribute with `densityAttributes` after resolving `defaultDensityForVariant(theme.variant)`.

Wave 1 is deployment-fixed density only. User preference, persistence, cross-tab sync, a pre-paint density bootstrap, and a public density hook are deferred ([roadmap](roadmap.md) §10). The host seam for a later override is `densityAttributes(preference ?? defaultDensityForVariant(theme.variant))`. `ThemeProvider` does not grow a `density` prop in Wave 1. Table row density is outside this axis.

## 3 Cascade mechanism

### 3.1 Three data attributes

Theme markers are three data attributes, **placeable on any element** — no selector anchors to `<html>`:

```html
<html data-theme-variant="external" data-theme-brand="fkas" data-theme-segment="company"></html>
```

- `data-theme-variant`: `internal` | `external`
- `data-theme-brand`: `fkas` | `tkas` | `guen` | `fkab` | `fkse` | `elma`
- `data-theme-segment`: `private` | `company`

Rejected alternatives (ADR 0002): a single slug attribute (needs `^=`/`*=` substring selectors for axis rules and occupies the reserved `data-theme`); classes (equal power, but bare `.company`/`.private` collide with app CSS and are illegible in DevTools). Each axis is independently visible on the element and independently switchable at runtime.

### 3.2 Layer structure — 15 theme rules cover 20 themes

The emitted theme CSS has exactly five layers:

1. **`:root` defaults** (1 rule) — the complete neutral default layer (§4). This layer _is_ the internal look, by design.
2. **Brand pointers** (6 rules) are keyed on brand alone and serve both variants. Each branded element declares `--brand`, `--brand-foreground`, and the aliases `--sidebar-brand: var(--brand)` / `--sidebar-brand-foreground: var(--brand-foreground)`. Declaring aliases on that element makes nested scopes resolve their own pair rather than inherit a value already resolved at the document root. Hosts may override the brand pair on the branded target scope, or override the sidebar aliases on that scope or its descendants, using normal CSS specificity/order or inline styles. An outer scope's resolved alias does not override a newly branded inner scope.
3. **Internal reset** (1 rule) — `[data-theme-variant="internal"]` re-declares the exact `EXTERNAL_RESET_KEYS` set with values copied from defaults: `background`, `foreground`; all card, muted, primary, and secondary tokens; all feature tokens; `border`, `input`; `radius`, `radius-button`; and `font-heading`. It does **not** reset primitives, the brand pair, or roles external palettes never override. This is what makes an internal scope nested under an external scope return to internal values while still receiving its layer-2 brand pointer.
4. **External brand palettes** (6 rules) — `[data-theme-variant="external"][data-theme-brand="<code>"]`; each emitted rule contains every `EXTERNAL_RESET_KEYS` declaration, taking a brand value where its source palette supplies one and the `DEFAULTS` value otherwise. This materialization is mandatory scope isolation: an inner external scope must reset every value an outer external/segment layer could have changed. fkab gets its **own selector** carrying a generator-level copy of the fkas value set (permanent alias, §5). `elma` gets its **own selector** carrying a generator-level copy of `DEFAULTS` for the reset set (reviewed must-override/isolation exception, not a template for inventing other customer palettes).
5. **Segment deltas** (1 rule) — only where values genuinely differ: `[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` is the sole delta at v1. `elma` has no segment delta.

The count is exact: 1 + 6 + 1 + 6 + 1 = **15 emitted theme rules**, the now-full internal rule counting as 1. Every rule owns its selector — the generator never merges layers or brands into shared selectors; deduplication is allowed only in the TS source modules (§8). Rules grow with **value differences, not permutations**. Adding a brand adds ~2 rules (accent pointer + external palette). The reserved dark-axis placeholder (§7.8) is a comment, not a sixteenth CSS rule.

### 3.3 Fallback by absence

Permutations without distinct palettes get **no CSS rule** and resolve from lower layers. `external-tkas-company` and `external-guen-company` inherit their private palettes because no company rule exists — zero fallback CSS is written. The segment-delta module records the actual overrides; adding a delta does not require restructuring other themes.

### 3.4 Specificity and Tailwind interop

`[data-x="y"]` has class specificity (0,1,0); attribute compounds appear only at genuine axis intersections (layers 4–5), so the layer order above is also cascade order without `!important` or `@layer` tricks. Tailwind v4 `@theme inline` maps each color utility to its backing role variable so values re-resolve at the use site and inside nested scopes. The [raw CSS entry](../../packages/ui/src/styles/ui.css) owns the utility definitions and locked metrics. For example, `--color-card: var(--card)` in `@theme inline` lets a `bg-card` utility resolve the nearest scope's card value.

Font and button-radius utilities are explicit because their public backing-token names would otherwise self-reference Tailwind theme variables. This contract follows Tailwind's documented [`@theme inline`](https://tailwindcss.com/docs/theme#referencing-other-variables) behavior. Component source uses the named radius utilities; it does not rely on Tailwind's unrelated default radii.

The [raw entry](../../packages/ui/src/styles/ui.css) owns the `@theme inline` mapping, explicit font and button-radius utilities, state variants, hit-area and scrollbar utilities, and the central reduced-motion rule. It imports `tw-animate-css` and, while the interim tier exists, the React Aria Tailwind plugin. It does not import Tailwind itself; the consumer recipe does that.

The original selector/utility source is `.ref/OrderModuleInternalWeb/packages/ui/src/styles/ui.css`. Its legacy theme blocks, base reset, product-hub rules, dark/inverted variants, debug utility, and unused keyframes remain excluded. See [reference sources](../reference-sources.md) before lifting more code.

The standalone-CSS build uses a build-only wrapper that imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` with `source(none)` (never `tailwindcss/preflight.css`), imports this raw entry, and names `dist/**/*.js` as its **only** `@source`. Source detection is off on purpose: with it on, Tailwind also scans the working tree, so a class spelled only in a test or an unshipped module lands in the published sheet. The wrapper carries exactly one `@source` line and no `@source not` exclusions — nothing under `src/` is scanned, so nothing under `src/` has to be excluded. _(Amended 2026-09-02, ADR [0005](../adr/0005-package-architecture.md) amendment 2026-09-02: source detection off, so the sheet describes the published JavaScript and needs no `@source not` exclusion; distribution contract in [architecture](architecture.md) §5.)_ That wrapper is compiler input only; the output is the published `styles.css`. Raw-source consumers instead use the recipe in [architecture](architecture.md) §5.

### 3.5 Scoped subtrees and portals

Markers on any element re-theme that subtree (the OrderModuleWeb per-track `<main>` re-branding pattern). A portal rendered **inside** the themed scope inherits correctly; a portal rendered **outside** silently takes the outer page theme. The CSS mechanism does not and cannot enforce this — containment is solved at the component layer: `ThemeScope` publishes its rendered element via React context, and overlay components' `container` prop **defaults to the nearest scope's element**, so portals land inside the active scope automatically; an explicit `container` overrides (§7.4).

### 3.6 `data-theme` stays free

None of the three attributes is `data-theme`. That attribute is reserved for the light/dark color-scheme axis. A host-placed closed bootstrap (`ColorSchemeScript` or `colorSchemeScriptSource`, §7.3 / §7.8) writes the resolved `"light"` or `"dark"` marker before paint; `ThemeProvider` owns the same marker at runtime. The attribute is given CSS meaning only when dark values land.

## 4 Token values and reference

TypeScript is the source of truth for token names, values, and composition. Edit the owning module and review the generated CSS snapshot; do not maintain a second value table in Markdown.

| Data                                                     | Owner                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Role names, types, reset keys, and override requirements | [Token contract](../../packages/ui/src/theme/tokens/contract.ts)             |
| Neutral and brand primitives                             | [Primitives](../../packages/ui/src/theme/tokens/primitives.ts)               |
| Complete neutral defaults                                | [Defaults](../../packages/ui/src/theme/tokens/defaults.ts)                   |
| Brand aliases and accent pointers                        | [Brand pointers](../../packages/ui/src/theme/tokens/brand-pointers.ts)       |
| External palettes                                        | [External palettes](../../packages/ui/src/theme/tokens/external-palettes.ts) |
| Segment overrides                                        | [Segment deltas](../../packages/ui/src/theme/tokens/segment-deltas.ts)       |
| Brand names and allowed segments                         | [Theme metadata](../../packages/ui/src/theme/tokens/themes.ts)               |
| Reviewed emitted CSS                                     | [CSS snapshot](../../packages/ui/src/theme/__snapshots__/themes.css)         |

The docs site's Tokens page and theme matrix are generated from this data. [Theme contract tests](../../packages/ui/src/theme/theme-contract.test.ts) check the complete theme set and nested-scope combinations; [contrast tests](../../packages/ui/src/theme/contrast-matrix.test.ts) check the separate accessibility obligations. Changing a value still requires those reviews. Source ownership does not make an accidental value change acceptable.

## 5 Value policy rulings

- **All minted values are final** (primary-soft tints, fkse accents, light-sidebar fills) — no provisional flags, no pending design review. Contrast consequences of these locked values are classified, not redesigned, in [accessibility](accessibility.md) §6.
- **fkab is a permanent, deliberate alias of fkas** — "100% how it should be for the foreseeable future". Not a gap, no design task, no flag. (This superseded ADR 0001's original "design-input gap" framing; the ADR is amended.)
- **fkse** keeps code `fkse` everywhere; only presentation metadata (`displayName: "Telinet"`, Telinet logo) differs.
- **elma** is corporate Elmera, not pinned, four legal themes. External `elma` copies internal grayscale defaults (`pick(DEFAULTS, EXTERNAL_RESET_KEYS)`) plus the reviewed brand pair; this isolation/must-override exception is not a template for inventing other customer palettes. No segment delta.
- The library's sidebar defaults spec the **new light sidebar**, not the dark one in the internal reference; guen's dark-sidebar orange accent is retired.

## 6 Illegal permutations

`*-fkab-private` and `*-fkse-company` are illegal. Three enforcement tiers, all mandatory:

1. **Compile time**: the `ThemeInput` discriminated union (§7.6) makes illegal combinations unrepresentable in typed code.
2. **Development runtime**: `validateTheme` (covering untyped inputs — env vars, CMS data) **throws**.
3. **Production runtime**: `validateTheme` **coerces to the pinned segment** (`fkab` → `company`, `fkse` → `private`) and emits a console warning.

**CSS stays best-effort**: the stylesheet neither forbids nor special-cases illegal attribute combinations — an illegal combination that somehow reaches the DOM renders whatever the layers resolve to. Enforcement is exclusively the provider's job.

## 7 Theme provider API

Single entry **`@elmeragroup/ui/theme`** — no per-framework entry points (`/theme/next`, `/theme/vite`, and the rest would be byte-identical aliases; ADR 0003). next-themes is **not vendored**; color-scheme ideas and MIT-notice text are copied, not taken as an npm dependency.

Brand and color scheme are separate writers. Treating `ThemeProvider` as a portable first-paint adapter is false: it cannot stamp `<html>` from `_app`, and React 19 `createRoot` `<script>` nodes do not execute on Vite.

| Axis                                       | Source of truth                                                                      | Initial-paint writer                                                                                          | Runtime writer                                                       | Persistence                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Brand (variant × brand × segment)          | Controlled `theme` from deployment, loader, or host config                           | SSR or build-time attributes on `<html>` via `themeAttributes(theme)`                                         | `ThemeProvider` echoes the same validated `theme`                    | None. Brand is never written to `localStorage`, cookies, or `data-theme`                                                    |
| Color scheme (`light` / `dark` / `system`) | Mount-level `forcedColorScheme` if set, else persisted preference / default / system | Host-placed closed classic script (`ColorSchemeScript` or `colorSchemeScriptSource`) before paintable content | Provider-owned state; setters and browser events apply synchronously | `localStorage` under `storageKey` (default `elmera-color-scheme`). Cookie persistence is a later SSR adapter, not this wave |
| Scoped brand                               | `ThemeScope.theme`                                                                   | Attributes on the scope element via `themeAttributes`                                                         | React reconciliation on that element                                 | None                                                                                                                        |

The host constructs **one** resolved brand configuration and **one** color-scheme configuration. The same brand object is passed to `themeAttributes` and `ThemeProvider.theme`. The same color-scheme literals (`storageKey`, `defaultColorScheme`, `enableSystem`, optional `forcedColorScheme`) are passed to the host bootstrap and to `ThemeProvider`. `injectColorSchemeScript` defaults to **`false`**: a host adapter is always the declared bootstrap owner.

Until dark token values land, “correct color scheme” means the correct pre-paint `data-theme` marker (`light` or `dark`). The painted canvas **intentionally remains light**. Do not set `document.documentElement.style.colorScheme`, do not add `<meta name="color-scheme">`, and do not enable Tailwind `class="dark"`. Hash-based CSP is not promised; a `nonce` on `ColorSchemeScript` is.

Package/export mechanics and which `/theme` names are server-safe vs client → [architecture](architecture.md) and [performance](performance.md) §3.

See [theme integration](../theming-integration.md#shared-setup) for app setup and framework recipes.

### 7.1 `ThemeProvider`

```tsx
<ThemeProvider theme={{ variant, brand, segment }} injectColorSchemeScript={false}>
```

- Input is the **decomposed object** (primary representation); the slug is always derivable. Pure, isomorphic helpers exported: `themeSlug(theme)` and `parseThemeSlug(slug)`.
- Fully controlled **brand**. **No `setTheme`** for variant/brand/segment. Hosts change brand by passing a new `theme` prop. Docs/Storybook pickers that preview other identities do **not** re-render this document provider; they feed `ThemeScope` (§7.4, [docs-site](docs-site.md) §4).
- Exact props:

  ```ts
  type ThemeProviderProps = ColorSchemeOptions & {
    theme: ThemeInput; // required, controlled brand
    children: ReactNode;
    disableTransitionOnChange?: boolean; // default false; runtime writes only
    injectColorSchemeScript?: boolean; // default false
    nonce?: string; // used only if injection is on
    scriptProps?: ColorSchemeScriptElementProps; // used only if injection is on
  };
  ```

  There is **no** `enableColorScheme`. `ColorSchemeOptions` is `{ storageKey?; defaultColorScheme?; enableSystem?; forcedColorScheme? }` with defaults `storageKey: "elmera-color-scheme"`, `defaultColorScheme: "system"`, `enableSystem: true`.

- `useTheme()` returns `{ ...theme, slug }` and throws outside `ThemeProvider` or `ThemeScope`. Brand data is defined whenever the controlled prop is defined.
- `useColorScheme()` takes **no** options, reads this document writer, and **throws** outside `ThemeProvider`. Two consumers cannot fork storage keys.
- Nested `ThemeProvider`s passthrough only when an outer **document writer** already exists. `ThemeScope` does not set that flag; a provider inside a scope-only tree still becomes the writer.
- Runtime brand echo happens in the insertion/layout phase so descendant layout work never measures a stale document brand. Color-scheme setters, storage events, and media events write `data-theme` in the same event turn. Passive effects hydrate preference, recover a missing marker, and subscribe to listeners.
- `disableTransitionOnChange` wraps **runtime** document writes only. It is not present in the parser-time bootstrap and no-ops safely if `document.body` is null.
- Opt-in `injectColorSchemeScript` renders a server-safe classic inline script as the **first child of the provider**. The host must still guarantee no paintable sibling precedes it. Prefer a host-placed script (§7.3). If a host bootstrap already ran, development warns.
- Development diagnostics (no extra `data-*` attributes, no HTML comments): missing `__ELMERA_COLOR_SCHEME_BOOTSTRAP__`; mismatch of `{ storageKey, defaultColorScheme, enableSystem, forcedColorScheme }` against the provider; host-plus-provider duplicate bootstrap (see §7.8 for the bootstrap-source `Symbol` marker); SSR/build brand attributes that disagree with the validated `theme` (recovery writes only that validated triple).
- Brand writes never persist. Color-scheme writes never touch the three brand attributes, `style.colorScheme`, or a color-scheme meta tag.

### 7.2 `themeAttributes(theme)`

Pure function with exact return type:

```ts
type ThemeAttributes = {
  "data-theme-variant": ThemeInput["variant"];
  "data-theme-brand": ThemeInput["brand"];
  "data-theme-segment": ThemeInput["segment"];
};
```

It validates untyped input before returning the three attributes. The headline brand recipe is spreading it on `<html>` from one host-owned configuration that is also passed to `ThemeProvider.theme`. Brand first paint is those attributes, never a script and never provider injection.

Document roots compose `themeAttributes(theme)` with `densityAttributes(defaultDensityForVariant(theme.variant))`. Both density values are stamped explicitly, including `dense`. `ThemeProvider` and `ThemeScope` have no `density` prop. `ThemeScope` does not compute density, does not own it, and has no `density` prop. Hosts may still spread `densityAttributes(...)` onto the ThemeScope host element as a DOM attribute (the docs `DemoFrame` sandbox does this). Library CSS ignores nested `data-density`; that sandbox imports the generated `@elmeragroup/ui/demo-stage-comfortable.css` artifact, which re-scopes the library comfortable block onto `.DemoStage` ([docs-site](docs-site.md) §4).

```ts
type Density = "dense" | "comfortable";

type DensityAttributes = {
  "data-density": Density;
};

function defaultDensityForVariant(variant: ThemeVariant): Density;
function densityAttributes(density: Density): DensityAttributes;
```

`defaultDensityForVariant` is the exact map `internal → dense`, `external → comfortable`. Unknown untyped values fail explicitly. `densityAttributes` serializes an already-resolved density.

### 7.3 First-paint adapters (host recipes)

[Theme integration](../theming-integration.md) contains the shared setup and framework recipes. The host owns the initial brand attributes, resolved document density, and a classic color-scheme bootstrap before paintable content. It passes matching configuration to `ThemeProvider`.

Next App Router and Vite have first-paint fixture coverage in `apps/docs` and `apps/static-theme`. Next Pages, TanStack Start, and React Router remain written recipes. These host fixtures are distinct from packed-consumer release checks. A descendant `ForceColorScheme` changes runtime state only; forced first paint requires matching configuration in the host's document adapter.

### 7.4 `ThemeScope`

Escape hatch for per-request/multi-theme subtrees (the sms-accept per-customer pattern; the docs theme matrix's 20-permutation grid). One component that **fuses** the three data attributes and a nested provider context so CSS and `useTheme()` cannot drift apart.

- Props: `{ theme: ThemeInput; children?: ReactNode }` plus the native `div` props/ref and base-ui `useRender`'s `render` prop; theme data attributes generated by `themeAttributes(theme)` are owned by the component and cannot be overridden through the remaining props.
- Polymorphic via base-ui **`useRender`** (`render` prop + `mergeProps`, default tag `div`). Standing convention: **all library polymorphism uses `useRender`, never an `as` prop**.
- A merged callback ref stores the rendered `HTMLElement` in state and publishes it through a private context, so ref attachment triggers the dependent overlays to re-render. The context distinguishes **no scope** (`undefined`) from **scope present but target not attached yet** (`null`).
- Every overlay resolves its portal target in this order: explicit `container` element/ref → nearest `ThemeScope` element → primitive default (`document.body`) only when no scope exists. If an explicit ref or nearest scope exists but its element is still `null`, portal content waits rather than briefly escaping to `document.body`. Package-private `OverlayPortal` owns that wait-not-body rule: it resolves the target through `useResolvedPortalContainer` and renders nothing while the result is `null`, so content never briefly escapes to `document.body` (2026-09-04). Base-ui overlays pass their primitive Portal into `OverlayPortal`; the RAC private Popover is the documented exception because it forwards `UNSTABLE_portalContainer` rather than a Portal component. The three-way result — element, `null` (wait), `undefined` (primitive default) — lives on the private `useResolvedPortalContainer` hook in the theme-scope module. Neither the component, the hook, nor the context is exported. _(Amended 2026-09-04: `OverlayPortal` owns the wait-not-body rule; the RAC Popover stays the `UNSTABLE_portalContainer` exception.)_
- An explicit object ref is checked again in a post-commit effect, so an initially open overlay recovers when a sibling target attaches in the same React commit. The resolver schedules one refresh only if the attached value differs from the rendered value; it creates no timer, observer, or polling loop. A still-null ref remains pending. Mutations after that commit, including targets revealed later by Suspense, require a React update that renders the overlay with the attached ref; object refs are not general attachment subscriptions. `ThemeScope` uses its observable callback-ref state instead.
- `ThemeScope` provides the same `{ ...theme, slug }` value as `ThemeProvider`; a nested scope always wins for `useTheme()` consumers within it. `useTheme()` outside the scope returns the document brand.
- `ThemeScope` is never a document writer: it does not set the private writer flag, does not stamp `<html>`, and cannot suppress a real `ThemeProvider`. Color-scheme state stays on the document writer; scopes do not fork it.

### 7.5 `BRANDS`

`BRANDS` is the public readonly metadata record in [theme metadata](../../packages/ui/src/theme/tokens/themes.ts). It owns display names and legal segments. Consumers import it rather than copying the record. Logo components use the same brand codes.

### 7.6 Types

- `ThemeInput` is a discriminated union that makes pinned-brand mistakes unrepresentable. [Theme axes](../../packages/ui/src/theme/theme-axes.ts) and [theme metadata](../../packages/ui/src/theme/tokens/themes.ts) own the declarations; [public type tests](../../packages/ui/src/theme/theme-api.test-d.tsx) protect their compatibility.
- `THEME_VARIANTS` (`["internal", "external"]`) and `THEME_SEGMENTS` (`["private", "company"]`) are the axis tuples. `LEGAL_THEMES` is the 20-permutation list derived from the pin table, in variant → brand → segment order. Hosts that need the legal set (docs, pickers) import these from `/theme` rather than re-deriving them.
- `themeSlug(theme: ThemeInput): ThemeSlug` is total. `parseThemeSlug(slug: string): ThemeInput | null` returns `null` for malformed axes and illegal pinned-brand combinations; it never coerces or logs.
- `coerceTheme(input: unknown): ThemeInput | null` is the env-free pin-table parse: `null` for non-objects and unknown/missing axes; a pinned brand with the wrong segment returns the same variant/brand with `BRANDS[brand].segments[0]`. It never throws or logs. Host pickers that need silent pinning (docs `ThemePicker`) call this, not `validateTheme`.
- `validateTheme(input: unknown): ThemeInput` layers §6 diagnostics on `coerceTheme`. It rejects non-objects and unknown/missing axis values in every environment. When all three axes are known but a pinned brand has the wrong segment, it follows §6: `process.env.NODE_ENV !== "production"` throws; production returns the coerced theme and calls `console.warn` once for that invocation. This is the library's sole environment read; consumer bundlers replace the conventional expression and Node SSR supplies it natively. `themeAttributes` and both theme providers call the validator at their runtime boundary even though their public prop is typed.
- Covered by the public-API type tests ([accessibility](accessibility.md) §9's pattern; testing strategy).

### 7.7 Locale provider

`ElmeraGroupUiProvider` is permanent and exported from `/theme`: `{ locale: SupportedLocale; children: ReactNode }`. It provides a memoized `{ locale }` value; `useElmeraGroupUi()` returns it and throws outside the provider. It performs no browser or user-agent detection. The interim `UiProviders` wrapper is documented by its public JSDoc and the authored docs page under `apps/docs/src/app/(docs)/components/ui-providers/`.

### 7.8 Color-scheme axis: wired, valueless

`<ColorSchemeScript>`, `colorSchemeScriptSource`, `useColorScheme()`, and `<ForceColorScheme>` ship functional in v1 — adapted from next-themes' script with its MIT notice retained. They write only reserved `data-theme`. They do not write brand attributes, `style.colorScheme`, or a color-scheme meta tag.

```ts
type ColorScheme = "light" | "dark" | "system";
type ColorSchemeOptions = {
  storageKey?: string;
  defaultColorScheme?: ColorScheme;
  enableSystem?: boolean;
  forcedColorScheme?: ColorScheme;
};
type ColorSchemeScriptElementProps = Omit<
  ScriptHTMLAttributes<HTMLScriptElement>,
  "type" | "src" | "children" | "dangerouslySetInnerHTML"
> & { "data-cfasync"?: string };
type ColorSchemeScriptProps = ColorSchemeOptions & {
  nonce?: string;
  scriptProps?: ColorSchemeScriptElementProps;
};
type UseColorSchemeResult = {
  colorScheme: ColorScheme;
  resolvedColorScheme: "light" | "dark" | undefined;
  setColorScheme: (value: ColorScheme) => void;
};
type ForceColorSchemeProps = { value: ColorScheme; children?: ReactNode };

function colorSchemeScriptSource(options?: ColorSchemeOptions): string;
function useColorScheme(): UseColorSchemeResult;
```

- **`colorSchemeScriptSource`** is a public `/theme` export. It returns a self-contained IIFE string with only primitive arguments. No imported bindings, no `process.env`, no bundler helpers, no `themeAttributes` / `validateTheme` names. After `JSON.stringify`, `<` becomes `\u003c`, U+2028 / U+2029 become `\u2028` / `\u2029`; quotes and ampersands are **not** HTML-entity-encoded. After applying `data-theme`, the IIFE overwrites `globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__` with `{ storageKey, defaultColorScheme, enableSystem, forcedColorScheme }` — the mismatch-detection channel for those four primitives.
- **`ColorSchemeScript`** is a **server-safe** renderer of that source (`<script nonce={…} dangerouslySetInnerHTML={…} />`). `scriptProps` cannot set `type`, `src`, `children`, or `dangerouslySetInnerHTML`; `data-cfasync="false"` is allowed. A matching CSP `nonce` executes; a missing or wrong nonce leaves a testable failing sentinel. This spec does not promise hash-based CSP. Opt-in `injectColorSchemeScript` wraps that source so it stamps a non-enumerable `Symbol.for("elmera.colorScheme.bootstrapSource")` marker on the manifest: `"provider"` when this injection created the manifest, `"duplicate"` when a host bootstrap already existed. Development diagnostics use that marker to distinguish a provider-owned self-inject from a host-plus-provider duplicate. Host `colorSchemeScriptSource` does not stamp it.
- Resolution order: document `forcedColorScheme` if present (does **not** read storage for the document write, including when the force is `"system"` → media); else a valid stored preference; else the default. `"system"` uses `prefers-color-scheme` when `enableSystem` is true, otherwise `"light"`. Invalid storage is ignored. Output is `"light"` | `"dark"` on `data-theme`.
- **`useColorScheme()`** takes **no** options. Configuration lives only on `ThemeProvider` and the matching host script. The server snapshot and first hydration render keep `resolvedColorScheme` undefined until mounted. After mount it reports the resolved marker. `setColorScheme` writes storage and, when no force is active, `data-theme` in the same event turn. Same-key `storage` events and enabled-system media changes apply synchronously. Listeners are removed on cleanup.
- **Two force layers, not interchangeable for first paint:**
  1. **Document-level force (no-flash).** `ThemeProvider forcedColorScheme` **and** the same primitive on `ColorSchemeScript` / `colorSchemeScriptSource` for that HTML document. Use this for a whole app or a route-specific document adapter.
  2. **Descendant `<ForceColorScheme value="dark">` (runtime-only).** Writes into the document-writer context after hydration. First paint is **not** forced unless the host also used layer 1. Innermost tree depth wins. Nested providers do not fork this stack.
- While either force is active: document `data-theme` follows the forced resolution; `resolvedColorScheme` reports that value; `setColorScheme` updates **storage only**. Storage events update hidden preference and do not write the document. Media-query changes write the document when the resolved source is `"system"` (including a `"system"` force) and `enableSystem` is true; a non-system force ignores those events. Removing the force applies the stored preference synchronously. Forcing never changes brand attributes.
- `ThemeInput` has **no dark field** — color scheme is an orthogonal, layered axis, never part of the brand theme.
- The emitted theme CSS ends with a ready-to-go **commented `[data-theme="dark"]` placeholder**, not an empty rule node. Values land there with the dark-mode roadmap item. When they do, nothing about the brand-theme API changes, and this wave still does not enable `style.colorScheme`.

## 8 Token pipeline (codegen)

Codegen across the board — hand-authored theme CSS is prohibited. The TypeScript modules linked in §4 own token data; the CSS snapshot is the reviewable generated reference.

1. **Source shape**: `TokenContract` contains all role tokens except locked values. `DEFAULTS` is `Required<TokenContract>`; every other layer module is `Partial<TokenContract>`. `EXTERNAL_RESET_KEYS` is the literal tuple from §3.2 and must contain every key any external palette or segment delta can override; a contract test compares that computed union to the tuple so a new override cannot bypass scope isolation. Brand pointers, external palettes, and segment deltas are separate data modules. Locked tokens (§2.4) are not accepted by layer types.
2. **Coverage before fallback**: `composeTheme(theme)` first records the keys supplied by all non-default layers, validates the appropriate must-override set from §2.5 against that record, and only then overlays those layers on `DEFAULTS`. Applying defaults first and checking the final object is forbidden because it masks missing brand data. The internal reset is generated by picking `EXTERNAL_RESET_KEYS` from `DEFAULTS`; it is never hand-maintained.
3. **Generator**: emits the 15-rule, five-layer structure of §3.2 — defaults → brand pointers → internal reset → external palettes → segment deltas, fallback by absence — followed by the commented `[data-theme="dark"]` placeholder (§7.8). The internal reset emits `pick(DEFAULTS, EXTERNAL_RESET_KEYS)`; every external brand rule emits that same default pick overlaid with its source palette; segment deltas remain partial final overrides. Every selector remains separate, including fkab's copied external palette and elma's default-copy external palette.
4. **Execution**: generation runs in the turbo build task; **generated output is not committed**. The committed, reviewable artifact is a CSS snapshot. Contract tests cover all 20 themes and every outer/inner combination of the 20 themes (**400 nested-scope cases**), asserting computed reset-key values, the inner brand pointer, exactly 15 CSS rule nodes, the terminal dark-placeholder comment, and the per-theme contrast matrix.
5. **Distribution**: a **single `themes.css` entry** containing all 20 permutations (tiny by construction — 15 CSS rules plus one comment), included in both distribution modes ([architecture](architecture.md)). Per-theme file splitting is rejected as premature at this size; size budget → [performance](performance.md).
