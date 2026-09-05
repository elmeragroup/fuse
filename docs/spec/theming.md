# Theming

Normative chapter for `@elmeragroup/ui`: the token contract, the cascade mechanism, the complete value matrix for all 20 themes, the theme provider API, and the token pipeline. Sources: Canonical token contract (wayfinder ticket 001) + [ADR 0001](../adr/0001-canonical-token-contract.md), Theming cascade prototype (wayfinder ticket 002) + [ADR 0002](../adr/0002-theme-attributes.md), Brand–segment matrix gaps (wayfinder ticket 004), Theme value matrix, Theme provider API (wayfinder ticket 006) + [ADR 0003](../adr/0003-data-only-theme-provider.md), Token pipeline (wayfinder ticket 018).

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

Values are in §4.2.

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
| internal inverted neutral ramp                                            | `--neutral-50..950`, renumbered light-to-dark and normalized to chroma 0 (§4.2)  |

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

1. **`:root` defaults** (1 rule) — the complete neutral default layer (§4.2). This layer _is_ the internal look, by design.
2. **Brand pointers** (6 rules) are keyed on brand alone and serve both variants. Each branded element declares `--brand`, `--brand-foreground`, and the aliases `--sidebar-brand: var(--brand)` / `--sidebar-brand-foreground: var(--brand-foreground)`. Declaring aliases on that element makes nested scopes resolve their own pair rather than inherit a value already resolved at the document root. Hosts may override the brand pair on the branded target scope, or override the sidebar aliases on that scope or its descendants, using normal CSS specificity/order or inline styles. An outer scope's resolved alias does not override a newly branded inner scope.
3. **Internal reset** (1 rule) — `[data-theme-variant="internal"]` re-declares the exact `EXTERNAL_RESET_KEYS` set with values copied from defaults: `background`, `foreground`; all card, muted, primary, and secondary tokens; all feature tokens; `border`, `input`; `radius`, `radius-button`; and `font-heading`. It does **not** reset primitives, the brand pair, or roles external palettes never override. This is what makes an internal scope nested under an external scope return to internal values while still receiving its layer-2 brand pointer.
4. **External brand palettes** (6 rules) — `[data-theme-variant="external"][data-theme-brand="<code>"]`; each emitted rule contains every `EXTERNAL_RESET_KEYS` declaration, taking a brand value where its source palette supplies one and the `DEFAULTS` value otherwise. This materialization is mandatory scope isolation: an inner external scope must reset every value an outer external/segment layer could have changed. fkab gets its **own selector** carrying a generator-level copy of the fkas value set (permanent alias, §5). `elma` gets its **own selector** carrying a generator-level copy of `DEFAULTS` for the reset set (reviewed must-override/isolation exception, not a template for inventing other customer palettes).
5. **Segment deltas** (1 rule) — only where values genuinely differ: `[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` is the sole delta at v1. `elma` has no segment delta.

The count is exact: 1 + 6 + 1 + 6 + 1 = **15 emitted theme rules**, the now-full internal rule counting as 1. Every rule owns its selector — the generator never merges layers or brands into shared selectors; deduplication is allowed only in the TS source modules (§8). Rules grow with **value differences, not permutations**. Adding a brand adds ~2 rules (accent pointer + external palette). The reserved dark-axis placeholder (§7.8) is a comment, not a sixteenth CSS rule.

### 3.3 Fallback by absence

Permutations without distinct palettes get **no CSS rule** and resolve from lower layers. `external-tkas-company` and `external-guen-company` inherit their private palettes because no company rule exists — zero fallback CSS is written. The value matrix marks these _(inherits private)_ so the gaps stay visible and fillable without restructuring.

### 3.4 Specificity and Tailwind interop

`[data-x="y"]` has class specificity (0,1,0); attribute compounds appear only at genuine axis intersections (layers 4–5), so the layer order above is also cascade order without `!important` or `@layer` tricks. Tailwind v4 `@theme inline` maps each color utility to its backing role variable so values re-resolve at the use site and inside nested scopes. The raw CSS entry contains:

```css
@theme inline {
  /* Generated for every color role and public primitive. */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  /* …all remaining color roles, neutral steps, and brand accents… */

  --radius-xs: calc(var(--radius) - 6px);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-popover: calc(var(--radius) - 8px);
  --breakpoint-xs: 574px;
  --breakpoint-lg: 60rem;
  --breakpoint-3xl: 1920px;
  --spacing: 0.25rem;
  --ease-overshoot: linear(
    0,
    0.402 7.4%,
    0.711 15.3%,
    0.929 23.7%,
    1.008 28.2%,
    1.067 33%,
    1.099 36.9%,
    1.12 41%,
    1.13 45.4%,
    1.13 50.1%,
    1.111 58.5%,
    1.019 83.2%,
    1.004 91.3%,
    1
  );
}

@utility font-sans {
  font-family: var(--font-sans);
}
@utility font-heading {
  font-family: var(--font-heading);
}
@utility font-mono {
  font-family: var(--font-mono);
}
@utility rounded-button {
  border-radius: var(--radius-button);
}
```

Font and button-radius utilities are explicit because their public backing-token names would otherwise self-reference Tailwind theme variables. This contract follows Tailwind's documented [`@theme inline`](https://tailwindcss.com/docs/theme#referencing-other-variables) behavior. Component source uses the named radius utilities; it does not rely on Tailwind's unrelated default radii.

The raw entry's selector/utility lift source is `.ref/OrderModuleInternalWeb/packages/ui/src/styles/ui.css`, but only the following ruled subset is retained; its legacy theme blocks, base reset, product-hub rules, `dark`/`inverted` variants, debug utility, and unused keyframes are not copied. The raw entry does **not** import Tailwind itself—the consumer recipe already does—but it contains `@import "tw-animate-css";`, `@plugin "tailwindcss-react-aria-components";` while the RAC tier exists, the `@theme inline` block above, the four explicit utilities above, the central reduced-motion rule, and these exact definitions:

```css
@custom-variant data-open {
  &:where([data-state="open"]),
  &:where([data-open]:not([data-open="false"])) {
    @slot;
  }
}
@custom-variant data-closed {
  &:where([data-state="closed"]),
  &:where([data-closed]:not([data-closed="false"])) {
    @slot;
  }
}
@custom-variant data-checked {
  &:where([data-state="checked"]),
  &:where([data-checked]:not([data-checked="false"])) {
    @slot;
  }
}
@custom-variant data-unchecked {
  &:where([data-state="unchecked"]),
  &:where([data-unchecked]:not([data-unchecked="false"])) {
    @slot;
  }
}
@custom-variant data-selected {
  &:where([data-selected="true"]) {
    @slot;
  }
}
@custom-variant data-disabled {
  &:where([data-disabled="true"]),
  &:where([data-disabled]:not([data-disabled="false"])) {
    @slot;
  }
}
@custom-variant data-active {
  &:where([data-state="active"]),
  &:where([data-active]:not([data-active="false"])) {
    @slot;
  }
}
@custom-variant data-horizontal {
  &:where([data-orientation="horizontal"]) {
    @slot;
  }
}
@custom-variant data-vertical {
  &:where([data-orientation="vertical"]) {
    @slot;
  }
}

@utility hit-area-* {
  position: relative;
  --hit-area-t: --spacing(--value(number) * -1);
  --hit-area-t: calc(--value([*]) * -1);
  --hit-area-b: --spacing(--value(number) * -1);
  --hit-area-b: calc(--value([*]) * -1);
  --hit-area-l: --spacing(--value(number) * -1);
  --hit-area-l: calc(--value([*]) * -1);
  --hit-area-r: --spacing(--value(number) * -1);
  --hit-area-r: calc(--value([*]) * -1);
  &::before {
    content: "";
    position: absolute;
    top: var(--hit-area-t, 0px);
    right: var(--hit-area-r, 0px);
    bottom: var(--hit-area-b, 0px);
    left: var(--hit-area-l, 0px);
    pointer-events: inherit;
  }
}

@utility no-scrollbar {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

The standalone-CSS build uses a build-only wrapper that imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` with `source(none)` (never `tailwindcss/preflight.css`), imports this raw entry, and names `dist/**/*.js` as its **only** `@source`. Source detection is off on purpose: with it on, Tailwind also scans the working tree, so a class spelled only in a test or an unshipped module lands in the published sheet. The wrapper carries exactly one `@source` line and no `@source not` exclusions — nothing under `src/` is scanned, so nothing under `src/` has to be excluded. _(Amended 2026-09-02, ADR [0005](../adr/0005-package-architecture.md) amendment 2026-09-02: source detection off, so the sheet describes the published JavaScript and needs no `@source not` exclusion; distribution contract in [architecture](architecture.md) §5.)_ That wrapper is compiler input only; the output is the published `styles.css`. Raw-source consumers instead use the recipe in [architecture](architecture.md) §5.

### 3.5 Scoped subtrees and portals

Markers on any element re-theme that subtree (the OrderModuleWeb per-track `<main>` re-branding pattern). A portal rendered **inside** the themed scope inherits correctly; a portal rendered **outside** silently takes the outer page theme. The CSS mechanism does not and cannot enforce this — containment is solved at the component layer: `ThemeScope` publishes its rendered element via React context, and overlay components' `container` prop **defaults to the nearest scope's element**, so portals land inside the active scope automatically; an explicit `container` overrides (§7.4).

### 3.6 `data-theme` stays free

None of the three attributes is `data-theme`. That attribute is reserved for the light/dark color-scheme axis. A host-placed closed bootstrap (`ColorSchemeScript` or `colorSchemeScriptSource`, §7.3 / §7.8) writes the resolved `"light"` or `"dark"` marker before paint; `ThemeProvider` owns the same marker at runtime. The attribute is given CSS meaning only when dark values land.

## 4 Value matrix — all layers, all brands

The tables below are the **final, normative values** (Brand–segment matrix gaps: all mints final — no provisional flags, no pending design review). Provenance markers:

- `[ref]` — verbatim from a reference codebase (token extraction, research 003)
- `[conv]` — legacy HSL converted to oklch (exact sRGB→OKLab math; conversion table in §4.1)
- `[mint]` — minted value, **final** (user decision, no design review pending)
- `[user]` — value supplied directly by the user (new light sidebar)
- _(inherit)_ — no rule emitted; the permutation resolves the value from a lower layer (fallback by absence)

### 4.1 Conversions performed

| Legacy                                      | oklch                        |
| ------------------------------------------- | ---------------------------- |
| `hsl(20 5.9% 90%)` (fkas/fkse border)       | `oklch(0.9232 0.0026 48.72)` |
| `hsl(214.3 31.8% 91.4%)` (tkas/guen border) | `oklch(0.929 0.0126 255.53)` |
| `hsl(60 4.8% 95.9%)` (fkas/fkse muted)      | `oklch(0.97 0.0013 106.42)`  |
| `hsl(210 40% 96.1%)` (tkas/guen muted)      | `oklch(0.9684 0.0068 247.9)` |

### 4.2 Layer 1 — library defaults (`:root`), complete

Every token has a value before any theme marker exists. Internal themes are nearly identical to this layer.

#### 4.2.1 Public primitives

Neutral ramp (internal ramp renumbered to Tailwind order, normalized to pure gray; old inverted 0=black scale retired; pure white is `--background`, not a ramp member):

| Token           | Value             | Token           | Value             |
| --------------- | ----------------- | --------------- | ----------------- |
| `--neutral-50`  | `oklch(0.96 0 0)` | `--neutral-500` | `oklch(0.57 0 0)` |
| `--neutral-100` | `oklch(0.91 0 0)` | `--neutral-600` | `oklch(0.48 0 0)` |
| `--neutral-200` | `oklch(0.83 0 0)` | `--neutral-700` | `oklch(0.40 0 0)` |
| `--neutral-300` | `oklch(0.74 0 0)` | `--neutral-800` | `oklch(0.31 0 0)` |
| `--neutral-400` | `oklch(0.66 0 0)` | `--neutral-900` | `oklch(0.23 0 0)` |
|                 |                   | `--neutral-950` | `oklch(0.16 0 0)` |

Brand accents (all six, `:root`, never re-themed; every `-foreground` is white `oklch(1 0 0)`):

| Token          | Value                         | Provenance                                                |
| -------------- | ----------------------------- | --------------------------------------------------------- |
| `--brand-fkas` | `oklch(0.68 0.21747 38.8)`    | [ref]                                                     |
| `--brand-tkas` | `oklch(0.86 0.1035 191.11)`   | [ref]                                                     |
| `--brand-guen` | `oklch(0.21 0.0399 265.73)`   | [ref]                                                     |
| `--brand-fkab` | `var(--brand-fkas)`           | **permanent alias by design** (not a gap, no design task) |
| `--brand-fkse` | `oklch(0.4816 0.0908 240.16)` | [mint] — Telinet blue (external fkse `--primary`)         |
| `--brand-elma` | `oklch(0.29 0.05 220.14)`     | [user] — reviewed Elmera brand pair (~13.93:1 on white)   |

#### 4.2.2 Role-token defaults

| Token                                                                           | Default                                                                                                                                                                                                                                           | Provenance                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `--background` / `--foreground`                                                 | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                       | [ref] internal                                                                  |
| `--card` / `--card-foreground`                                                  | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                       | [ref] internal                                                                  |
| `--card-soft` / `--card-soft-foreground`                                        | `oklch(0.9702 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                  | [ref] internal v2                                                               |
| `--popover` / `--popover-foreground`                                            | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                       | independent literals (never `var(--card)`)                                      |
| `--muted` / `--muted-foreground`                                                | `oklch(0.97 0.0013 106.42)` / `oklch(0.5555 0 0)`                                                                                                                                                                                                 | [ref] internal                                                                  |
| `--accent` / `--accent-foreground`                                              | `oklch(0.96 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                                             | [ref] internal v2, normalized                                                   |
| `--feature` / `--feature-bright` / `--feature-foreground`                       | `oklch(0.96 0 0)` / `oklch(0.98 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                         | [mint] neutral (internal points feature at a neutral per contract)              |
| `--primary` / `--primary-foreground`                                            | `oklch(0.16 0 0)` / `oklch(1 0 0)`                                                                                                                                                                                                                | [ref] internal (neutral-950/white)                                              |
| `--primary-soft` / `--primary-soft-foreground`                                  | `oklch(0.96 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                                             | [mint]                                                                          |
| `--secondary` / `--secondary-foreground`                                        | `oklch(0.97 0 0)` / `oklch(0.22 0 0)`                                                                                                                                                                                                             | [ref] internal, normalized                                                      |
| `--secondary-soft` / `--secondary-soft-foreground`                              | `oklch(0.9219 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                                           | [mint]                                                                          |
| `--brand` / `--brand-foreground`                                                | `oklch(0.16 0 0)` / `oklch(1 0 0)`                                                                                                                                                                                                                | neutral until a brand pointer applies                                           |
| `--error` / `--error-foreground`                                                | `oklch(0.4526 0.17845 30.42)` / `oklch(1 0 0)`                                                                                                                                                                                                    | [ref] shared status block                                                       |
| `--error-soft` / `--error-soft-foreground`                                      | `oklch(0.9352 0.02195 14.08)` / `oklch(0.4526 0.17845 30.42)`                                                                                                                                                                                     | [ref]                                                                           |
| `--info` / `--info-foreground`                                                  | `oklch(0.4 0.09979 263.74)` / `oklch(1 0 0)`                                                                                                                                                                                                      | [ref]                                                                           |
| `--info-soft` / `--info-soft-foreground`                                        | `oklch(0.9315 0.02014 233.86)` / `oklch(0.4 0.09979 263.74)`                                                                                                                                                                                      | [ref]                                                                           |
| `--success` / `--success-foreground`                                            | `oklch(0.4277 0.13765 144.24)` / `oklch(1 0 0)`                                                                                                                                                                                                   | [ref]                                                                           |
| `--success-soft` / `--success-soft-foreground`                                  | `oklch(0.9346 0.02761 150.41)` / `oklch(0.4277 0.13765 144.24)`                                                                                                                                                                                   | [ref]                                                                           |
| `--warning` / `--warning-foreground`                                            | `oklch(0.468 0.10443 65.71)` / `oklch(1 0 0)`                                                                                                                                                                                                     | [ref]                                                                           |
| `--warning-soft` / `--warning-soft-foreground`                                  | `oklch(0.9349 0.04795 81.5)` / `oklch(0.468 0.10443 65.71)`                                                                                                                                                                                       | [ref]                                                                           |
| `--destructive` / `--destructive-foreground`                                    | `var(--error)` / `var(--error-foreground)`                                                                                                                                                                                                        | contract aliases                                                                |
| `--border` / `--input`                                                          | `oklch(0.9219 0 0)` / `oklch(0.9219 0 0)`                                                                                                                                                                                                         | [user]                                                                          |
| `--ring`                                                                        | `oklch(0.4844 0.20509 296.29)`                                                                                                                                                                                                                    | [ref] shared violet, brand-independent                                          |
| `--sidebar` / `--sidebar-foreground`                                            | `oklch(0.9851 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                                           | [user] — **new light sidebar** (dark ref sidebar retired)                       |
| `--sidebar-accent` / `--sidebar-accent-foreground`                              | `oklch(0.9219 0 0)` / `oklch(0.16 0 0)`                                                                                                                                                                                                           | [mint] light selection per mock                                                 |
| `--sidebar-border`                                                              | `oklch(0.9219 0 0)`                                                                                                                                                                                                                               | [user]                                                                          |
| `--sidebar-ring`                                                                | `var(--ring)`                                                                                                                                                                                                                                     | alias                                                                           |
| `--sidebar-brand` / `--sidebar-brand-foreground`                                | `var(--brand)` / `var(--brand-foreground)`                                                                                                                                                                                                        | alias — guen's dark-sidebar orange accent is **retired** with the light sidebar |
| `--right-panel` / `--right-panel-foreground`                                    | `oklch(0.9851 0 0)` / `oklch(0.1448 0 0)`                                                                                                                                                                                                         | [ref] internal                                                                  |
| `--chart-1..8`                                                                  | `oklch(0.289 0.0518 217.7)`, `oklch(0.3629 0.0619 204.44)`, `oklch(0.4322 0.0777 181.31)`, `oklch(0.4933 0.1113 160.18)`, `oklch(0.5623 0.139 143.03)`, `oklch(0.6348 0.1494 124.51)`, `oklch(0.714 0.1487 100.58)`, `oklch(0.7945 0.1709 71.19)` | [ref] internal teal→amber                                                       |
| `--sh-identifier/keyword/string/class/property/entity/jsxliterals/sign/comment` | `#5c6773`, `#ff7733`, `#86b300`, `#a37acc`, `#36a3d9`, `#f29718`, `#4cbf99`, `#ed9366`, `#abb0b6`                                                                                                                                                 | [ref] Ayu Light                                                                 |
| `--radius` / `--radius-button`                                                  | `0.375rem` / `0.375rem`                                                                                                                                                                                                                           | [ref] internal                                                                  |
| `--font-sans`                                                                   | `Roboto, ui-sans-serif, system-ui, sans-serif`                                                                                                                                                                                                    | [ref]                                                                           |
| `--font-heading`                                                                | `var(--font-sans)`                                                                                                                                                                                                                                | fallback semantics                                                              |

### 4.3 Layer 2 — brand pointers (6 rules, both variants)

For each of `fkas`, `tkas`, `guen`, `fkab`, `fkse`, `elma`:

```css
[data-theme-brand="<code>"] {
  --brand: var(--brand-<code>);
  --brand-foreground: var(--brand-<code>-foreground);
}
```

### 4.4 Layer 3 — internal variant (1 rule)

`[data-theme-variant="internal"]` introduces no new design values. It re-declares `EXTERNAL_RESET_KEYS` from §3.2 with literals copied from `DEFAULTS`; it must not reset `--brand`/`--brand-foreground`, because the earlier brand-pointer layer is meant to survive. Primitives and shared roles that no external layer overrides are also omitted. All ten internal permutations resolve as defaults + internal reset + brand pointer. Segment has no internal value axis.

### 4.5 Layer 4 — external variant per brand (4 palettes + 1 alias + 1 default-copy)

Selector: `[data-theme-variant="external"][data-theme-brand="<code>"]`. fkab has **no palette of its own in source**: the generator emits the fkas value set under fkab's **own selector** — a generator-level copy, permanent alias by design, indefinitely. `elma` has **no unique customer palette**: the generator emits `pick(DEFAULTS, EXTERNAL_RESET_KEYS)` under elma's **own selector** so compose-time must-override and nested-scope isolation still pass. **Reviewed exception:** this is not a template for inventing other customer external palettes. Before emission, every external source palette is overlaid on `pick(DEFAULTS, EXTERNAL_RESET_KEYS)`, so all six rules directly declare the complete reset set. This prevents values from a themed ancestor—including fkas's heading font and the company segment delta—from leaking into a nested external scope. Deduplication is allowed only in the source modules, never via shared selectors in the output; the emitted rule count stays exactly 15 (§3.2).

Tokens not listed per brand _(inherit)_ from `:root`: popover pair, accent pair, statuses, ring, sidebar family, right-panel, charts, syntax colors.

| Token                         | fkas                                | tkas                                | guen                                | fkse                                  |
| ----------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ------------------------------------- |
| `--background`                | `oklch(0.96042 0.0214 46.99)`       | `oklch(0.97902 0.02928 188.87)`     | `oklch(0.95469 0.01887 279.53)`     | `oklch(0.98014 0.01729 210.19)`       |
| `--foreground`                | `oklch(0.3209 0.10325 38.8)`        | `oklch(0.30407 0.05238 190.82)`     | `oklch(0.19922 0.12072 268.2)`      | `oklch(0.36735 0.09417 249.17)`       |
| `--card`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                        |
| `--card-foreground`           | `oklch(0.23274 0.07506 38.69)`      | `oklch(0.22003 0.0378 191.8)`       | `oklch(0.14028 0.08604 266.38)`     | `oklch(0.22503 0.06011 247.68)`       |
| `--card-soft`                 | `oklch(0.98095 0.01088 54.5)`       | `oklch(0.98982 0.01388 185.97)`     | `oklch(0.99199 0.00734 80.72)`      | `oklch(0.99007 0.00865 210.19)`       |
| `--card-soft-foreground`      | = `--foreground` value              | = `--foreground` value              | = `--foreground` value              | = `--foreground` value                |
| `--muted`                     | `oklch(0.97 0.0013 106.42)` [conv]  | `oklch(0.9684 0.0068 247.9)` [conv] | `oklch(0.9684 0.0068 247.9)` [conv] | `oklch(0.97 0.0013 106.42)` [conv]    |
| `--muted-foreground`          | fg `/ 0.7`                          | fg `/ 0.7`                          | fg `/ 0.7`                          | fg `/ 0.7`                            |
| `--primary`                   | `oklch(0.4848 0.16637 35.92)`       | `oklch(0.47316 0.08165 190.23)`     | `oklch(0.4863 0.25238 271.95)`      | `oklch(0.48158 0.09084 240.16)`       |
| `--primary-foreground`        | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                        |
| `--primary-soft`              | `oklch(0.94 0.03 45)` [mint]        | `oklch(0.94 0.04 191)` [mint]       | `oklch(0.93 0.035 277)` [mint]      | `oklch(0.9368 0.04194 223.32)` [mint] |
| `--primary-soft-foreground`   | = `--card-foreground` value         | = `--card-foreground` value         | = `--card-foreground` value         | = `--card-foreground` value           |
| `--secondary`                 | `oklch(0.3209 0.10325 38.8)`        | `oklch(0.30407 0.05238 190.82)`     | `oklch(0.19922 0.12072 268.2)`      | `oklch(0.36735 0.09417 249.17)`       |
| `--secondary-foreground`      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                      | `oklch(1 0 0)`                        |
| `--secondary-soft`            | `oklch(0.8861 0.05413 50.48)`       | `oklch(0.94764 0.07736 190.94)`     | `oklch(0.88401 0.04497 277.34)`     | `oklch(0.9368 0.04194 223.32)`        |
| `--secondary-soft-foreground` | = `--secondary` value               | = `--secondary` value               | = `--secondary` value               | = `--secondary` value                 |
| `--feature`                   | `oklch(0.57866 0.19387 36.96)`      | `oklch(0.55688 0.09585 191.06)`     | `oklch(0.57814 0.22881 270.38)`     | `oklch(0.56873 0.09344 229.37)`       |
| `--feature-bright`            | `oklch(0.74389 0.16389 43.68)`      | `oklch(0.77279 0.10225 190.47)`     | `oklch(0.7068 0.1522 275.6)`        | `oklch(0.77836 0.11783 206.21)`       |
| `--feature-foreground`        | `oklch(0.80097 0.10434 49.42)`      | `oklch(0.90178 0.09399 190.62)`     | `oklch(0.84919 0.07412 279.64)`     | `oklch(0.90492 0.09477 206.46)`       |
| `--border` / `--input`        | `oklch(0.9232 0.0026 48.72)` [conv] | `oklch(0.929 0.0126 255.53)` [conv] | `oklch(0.929 0.0126 255.53)` [conv] | `oklch(0.9232 0.0026 48.72)` [conv]   |
| `--radius`                    | `0.75rem`                           | `0.95rem`                           | `0.5rem`                            | `0.75rem`                             |
| `--radius-button`             | `1.8125rem`                         | `0.95rem`                           | `0.5rem`                            | `1.8125rem`                           |
| `--font-heading`              | `"Neo Sans", var(--font-sans)`      | `var(--font-sans)` [default reset]  | `var(--font-sans)` [default reset]  | `var(--font-sans)` [default reset]    |

All `[ref]` unless marked. Two notational conventions in this table:

- **"= X value"** means the same literal is repeated in the emitted CSS — no `var()` indirection. The refs' value-coincidences are made explicit as duplicated literals per the contract's no-eager-binding rule; the generator may deduplicate at its TS source level, never in the output.
- **"fg `/ 0.7`"** means the brand's `--foreground` oklch literal with an appended `/ 0.7` alpha channel (e.g. fkas: `oklch(0.3209 0.10325 38.8 / 0.7)`) — a self-contained oklch literal with alpha, not an opacity alias of another token.

### 4.6 Layer 5 — segment delta (exactly 1 rule)

`[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` (the ref's `.fkas-c`):

| Token                         | Value                           |
| ----------------------------- | ------------------------------- |
| `--background`                | `oklch(0.9823 0.01428 213.1)`   |
| `--foreground`                | `oklch(0.30579 0.03693 215.45)` |
| `--card-foreground`           | `oklch(0.25285 0.03792 212.52)` |
| `--card-soft`                 | `oklch(0.99011 0.0069 219.56)`  |
| `--card-soft-foreground`      | `oklch(0.30579 0.03693 215.45)` |
| `--muted-foreground`          | fg `/ 0.7`                      |
| `--primary`                   | `oklch(0.47471 0.07313 217.18)` |
| `--primary-soft`              | `oklch(0.95328 0.03401 215.01)` |
| `--primary-soft-foreground`   | `oklch(0.25285 0.03792 212.52)` |
| `--secondary`                 | `oklch(0.30579 0.03693 215.45)` |
| `--secondary-soft`            | `oklch(0.95328 0.03401 215.01)` |
| `--secondary-soft-foreground` | `oklch(0.30579 0.03693 215.45)` |
| `--feature`                   | `oklch(0.55738 0.06979 216.27)` |
| `--feature-bright`            | `oklch(0.7871 0.0657 225.82)`   |
| `--feature-foreground`        | `oklch(0.90856 0.05958 225.03)` |

### 4.7 Composition matrix — how each of the 20 themes resolves

| Theme slug                           | Layers applied                | Notes                                                                                  |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------- |
| `internal-fkas-private` / `-company` | 1 + 2(fkas) + 3               | segment axis valueless internally                                                      |
| `internal-tkas-private` / `-company` | 1 + 2(tkas) + 3               |                                                                                        |
| `internal-guen-private` / `-company` | 1 + 2(guen) + 3               | sidebar accent = navy `--brand` on the light sidebar (old dark-sidebar orange retired) |
| `internal-elma-private` / `-company` | 1 + 2(elma) + 3               | grayscale defaults + Elmera brand pair; no segment delta                               |
| `internal-fkab-company`              | 1 + 2(fkab→fkas alias) + 3    | `internal-fkab-private` is **illegal** (pinned)                                        |
| `internal-fkse-private`              | 1 + 2(fkse) + 3               | first time fkse has internal accents; `internal-fkse-company` **illegal**              |
| `external-fkas-private`              | 1 + 2(fkas) + 4(fkas)         |                                                                                        |
| `external-fkas-company`              | 1 + 2(fkas) + 4(fkas) + 5     | the only segment delta                                                                 |
| `external-tkas-private` / `-company` | 1 + 2(tkas) + 4(tkas)         | company _(inherits private — no rule)_                                                 |
| `external-guen-private` / `-company` | 1 + 2(guen) + 4(guen)         | company _(inherits private — no rule)_                                                 |
| `external-elma-private` / `-company` | 1 + 2(elma) + 4(default-copy) | reviewed isolation exception; company _(inherits private — no rule)_                   |
| `external-fkab-company`              | 1 + 2(fkab) + 4(fkas values)  | permanent alias by design; `external-fkab-private` **illegal**                         |
| `external-fkse-private`              | 1 + 2(fkse) + 4(fkse)         | renders as Telinet (displayName + logo); `external-fkse-company` **illegal**           |

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

Minimal app setup (Next App Router shape; every host follows the same split):

```tsx
import {
  ColorSchemeScript,
  ElmeraGroupUiProvider,
  ThemeProvider,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import "@elmeragroup/ui/styles.css";
import "@elmeragroup/ui/themes.css";

const theme = { variant: "external", brand: "fkas", segment: "private" } as const;
const colorScheme = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const;

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
          injectColorSchemeScript={false}>
          <ElmeraGroupUiProvider locale="nb-NO">{children}</ElmeraGroupUiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Token-backed canvas (required on every host so a missing attribute cannot flash the UA default):

```css
html,
body {
  background: var(--background);
  color: var(--foreground);
}
```

`suppressHydrationWarning` on `<html>` is required wherever the color-scheme script mutates `data-theme` before hydration. Brand attributes match on server and client and do not themselves require it. Apps that omit color-scheme machinery omit the script, the warning, and the provider color-scheme props. RAC consumers replace `ElmeraGroupUiProvider` with `UiProviders` from `@elmeragroup/ui/react-aria/ui-providers`; they do not nest both locale providers. `UiProviders` requires a function-valued `navigate` prop, so a Next App Router layout renders a small app-owned `"use client"` wrapper that calls `useRouter()` and passes `url => router.push(url)` — it does not pass a server function through the layout boundary.

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

The library does not ship per-framework entries. Each named host places **brand attributes** and the **closed classic bootstrap** in a host-owned location **before any paintable application content**. `ThemeProvider` is context + runtime echo, not a universal first-paint adapter.

Shared invariants for every recipe:

- One resolved `theme` object to `themeAttributes` and `ThemeProvider`.
- One resolved density on the document root via `densityAttributes(defaultDensityForVariant(theme.variant))` (or an already-resolved override of that primitive). `ThemeProvider` and `ThemeScope` have no `density` prop. Forwarding `data-density` as a DOM attribute onto a ThemeScope host is allowed for the docs preview sandbox; it is not library nested density.
- Matching color-scheme literals to the bootstrap and the provider, including document-level `forcedColorScheme` when used.
- Import `themes.css` (and the chosen JS stylesheet). Set a token-backed `html, body { background: var(--background) }` so the UA canvas cannot flash.
- `suppressHydrationWarning` on `<html>` wherever a color-scheme script mutates `data-theme` on a React-owned document.
- `injectColorSchemeScript={false}` unless the host has no other place to put a classic script and can guarantee the injected node is first.
- Never a client-rendered `createRoot` `<script>`, never a copied generated IIFE checked into source, never `style.colorScheme`, never `<meta name="color-scheme">`, never cookie persistence, never hash-CSP.

Verified guarantees vs written guidance:

| Host                           | Status                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Next App Router                | **Fixture-verified** (`apps/docs` production HTML + delayed-hydration / JS-disabled / nonce probes)                                          |
| Vite / pure CSR                | **Fixture-verified** (`apps/static-theme` production HTML + React-blocked probes). That app is not `fixtures/vite` and is not a publish gate |
| Next Pages                     | Documented recipe only. Do not claim verified no-flash                                                                                       |
| TanStack Start                 | Documented recipe only. Do not claim verified no-flash                                                                                       |
| React Router 7 (framework/SSR) | Documented recipe only. Do not claim verified no-flash                                                                                       |

Route-specific forced **first paint** is a **document-adapter** job: a distinct root layout, `_document`, HTML entry, or `transformIndexHtml` path that knows the route’s force at HTML-generation time and passes the same primitive to bootstrap and provider. Descendant `<ForceColorScheme>` is **runtime-only** (hydration and later). Do not document it as a no-flash page lock.

#### Next App Router (fixture-verified)

Root layout spreads `{...themeAttributes(theme)}` and `{...densityAttributes(defaultDensityForVariant(theme.variant))}` on `<html>` and passes that same `theme` to `ThemeProvider`. Place server-rendered `ColorSchemeScript` in `<head>` **or** as the first child of `<body>` before SkipNav/shell. This repo’s docs fixture uses `<head>`: Next App Router injects a hidden streaming preamble as the first body node, so first-in-`<body>` is not first paint on that host. `injectColorSchemeScript={false}`. `suppressHydrationWarning` on `<html>`. Token-backed canvas as above.

A route that must first-paint forced dark uses a route-group layout (or equivalent document) that passes `forcedColorScheme` into **both** `ColorSchemeScript` and `ThemeProvider`. A page-level `<ForceColorScheme value="dark">` does not change the first frame.

#### Next Pages (recipe only)

`pages/_document` owns first paint. `_app` cannot stamp `<html>` and must not be asked to.

```tsx
// pages/_document.tsx
import { Head, Html, Main, NextScript } from "next/document";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "../lib/theme";

export default function Document() {
  return (
    <Html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <Head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// pages/_app.tsx
import type { AppProps } from "next/app";
import { ThemeProvider } from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "../lib/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      theme={theme}
      storageKey={colorScheme.storageKey}
      defaultColorScheme={colorScheme.defaultColorScheme}
      enableSystem={colorScheme.enableSystem}
      injectColorSchemeScript={false}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

The classic script may live in `<Head>` or as the first body child ahead of `<Main />`. Token-backed canvas belongs in the global stylesheet. Route-specific force is a distinct `_document` (or equivalent) that passes the same `forcedColorScheme` into the script and the `_app` provider.

#### TanStack Start (recipe only)

Root document shell spreads `themeAttributes(theme)` and `densityAttributes(defaultDensityForVariant(theme.variant))` on `<html>`. Place `ScriptOnce` with `colorSchemeScriptSource(colorScheme)` **before** children and module scripts. Pass the same `theme` and color-scheme literals to `ThemeProvider` with injection off. `suppressHydrationWarning` on `<html>`. Token-backed canvas as above.

```tsx
import { ScriptOnce } from "@tanstack/react-router";
import {
  colorSchemeScriptSource,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "./theme";

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ScriptOnce>{colorSchemeScriptSource(colorScheme)}</ScriptOnce>
      </head>
      <body>
        <ThemeProvider theme={theme} {...colorScheme} injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`colorSchemeScriptSource` is called at document-render time and returns closed IIFE text; do not import an apply function through the app graph. Route-specific force is a document that passes the same `forcedColorScheme` into `colorSchemeScriptSource` and `ThemeProvider`.

#### React Router 7 framework/SSR (recipe only)

Root `Layout` spreads `themeAttributes(theme)` and `densityAttributes(defaultDensityForVariant(theme.variant))` on `<html>` and renders `ColorSchemeScript` in `<head>` (parser-time) before `Meta`/`Links` content that depends on the marker. Same `theme` and color-scheme literals on `ThemeProvider`, injection off. Cookie/loader color state is a later optional SSR adapter; this wave does not persist color scheme in cookies.

```tsx
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "./theme";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
          injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

Token-backed canvas in the root stylesheet. Route-specific force is a layout that emits the same `forcedColorScheme` on the head script and the provider.

#### Vite / pure CSR (fixture-verified)

Brand attributes are substituted into `index.html` at **build time**. Color scheme is a **raw classic** inline script in that file **before** the module bundle. First paint must not depend on `createRoot`: React 19 creates client `<script>` nodes that do not execute.

The proven adapter is Vite’s `transformIndexHtml` hook (`order: "post"`) in `vite.config.ts`:

1. Import `themeAttributes`, `defaultDensityForVariant`, `densityAttributes`, and `colorSchemeScriptSource` from `@elmeragroup/ui/theme` **in the Vite config**, not from the client graph. Call them at config/build time with the same `DOCUMENT_THEME` / `DOCUMENT_COLOR_SCHEME` the React tree will receive. This import resolves into the built `dist` output, which is why the workspace lint task depends on the UI package build having run first (`import/no-cycle` resolves imports).
2. Stamp the three brand attributes and `data-density` on `<html>`. Source HTML must not already contain them; the adapter throws with a clear message if the opening `<html>` tag already has `data-theme-variant`, `data-theme-brand`, `data-theme-segment`, or `data-density`. It does not strip-and-restamp.
3. Inject `<script>${colorSchemeScriptSource(options)}</script>` immediately before the first `type="module"` tag. Do **not** hand-copy the generated IIFE into `index.html`. Do **not** render `ColorSchemeScript` from `createRoot`.
4. Token CSS that **defines** `--background` must precede that parser-blocking script. Vite production builds often emit the hashed `themes.css` link at or after the module entry; hoist those `rel="stylesheet"` links to immediately before the bootstrap. Keep `html, body { background: var(--background) }`.
5. Mount `ThemeProvider` with the same theme and color-scheme literals and `injectColorSchemeScript={false}`.
6. A bundling Vite config loader can rewrite `Function.prototype.toString()` and break the closed IIFE. Keep the generator on the published module (this repo’s fixture uses `--configLoader native` and the packed `dist/theme.js` so workspace TypeScript source is not re-emitted).
7. Route-specific forced first paint is a second HTML entry (or a transform that inspects the filename/URL) that passes the same `forcedColorScheme` into `colorSchemeScriptSource` and `ThemeProvider`.

`apps/static-theme` is the verified private workspace proof of this recipe. It is not `fixtures/vite` and not a release packed-consumer gate.

### 7.4 `ThemeScope`

Escape hatch for per-request/multi-theme subtrees (the sms-accept per-customer pattern; the docs playground's 20-permutation grid). One component that **fuses** the three data attributes and a nested provider context so CSS and `useTheme()` cannot drift apart.

- Props: `{ theme: ThemeInput; children?: ReactNode }` plus the native `div` props/ref and base-ui `useRender`'s `render` prop; theme data attributes generated by `themeAttributes(theme)` are owned by the component and cannot be overridden through the remaining props.
- Polymorphic via base-ui **`useRender`** (`render` prop + `mergeProps`, default tag `div`). Standing convention: **all library polymorphism uses `useRender`, never an `as` prop**.
- A merged callback ref stores the rendered `HTMLElement` in state and publishes it through a private context, so ref attachment triggers the dependent overlays to re-render. The context distinguishes **no scope** (`undefined`) from **scope present but target not attached yet** (`null`).
- Every overlay resolves its portal target in this order: explicit `container` element/ref → nearest `ThemeScope` element → primitive default (`document.body`) only when no scope exists. If an explicit ref or nearest scope exists but its element is still `null`, portal content waits rather than briefly escaping to `document.body`. Package-private `OverlayPortal` owns that wait-not-body rule: it resolves the target through `useResolvedPortalContainer` and renders nothing while the result is `null`, so content never briefly escapes to `document.body` (2026-09-04). Base-ui overlays pass their primitive Portal into `OverlayPortal`; the RAC private Popover is the documented exception because it forwards `UNSTABLE_portalContainer` rather than a Portal component. The three-way result — element, `null` (wait), `undefined` (primitive default) — lives on the private `useResolvedPortalContainer` hook in the theme-scope module. Neither the component, the hook, nor the context is exported. _(Amended 2026-09-04: `OverlayPortal` owns the wait-not-body rule; the RAC Popover stays the `UNSTABLE_portalContainer` exception.)_
- An explicit object ref is checked again in a post-commit effect, so an initially open overlay recovers when a sibling target attaches in the same React commit. The resolver schedules one refresh only if the attached value differs from the rendered value; it creates no timer, observer, or polling loop. A still-null ref remains pending. Mutations after that commit, including targets revealed later by Suspense, require a React update that renders the overlay with the attached ref; object refs are not general attachment subscriptions. `ThemeScope` uses its observable callback-ref state instead.
- `ThemeScope` provides the same `{ ...theme, slug }` value as `ThemeProvider`; a nested scope always wins for `useTheme()` consumers within it. `useTheme()` outside the scope returns the document brand.
- `ThemeScope` is never a document writer: it does not set the private writer flag, does not stamp `<html>`, and cannot suppress a real `ThemeProvider`. Color-scheme state stays on the document writer; scopes do not fork it.

### 7.5 `BRANDS`

Exported readonly record with this exact value and inferred literal types:

```ts
type BrandCode = "fkas" | "tkas" | "guen" | "fkab" | "fkse" | "elma";
type ThemeSegment = "private" | "company";

const BRANDS = {
  fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
  tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
  guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
  fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
  fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
  elma: { code: "elma", displayName: "Elmera", segments: ["private", "company"] },
} as const satisfies Record<
  BrandCode,
  {
    code: BrandCode;
    displayName: string;
    segments: readonly ThemeSegment[];
  }
>;
```

Logo components live with the icon system, keyed by the same codes.

### 7.6 Types

- `ThemeInput` is this exact discriminated union, making pinned-brand mistakes unrepresentable:

  ```ts
  type ThemeVariant = "internal" | "external";
  type BrandCode = "fkas" | "tkas" | "guen" | "fkab" | "fkse" | "elma";
  type ThemeSegment = "private" | "company";
  type ThemeInput =
    | { variant: ThemeVariant; brand: "fkas" | "tkas" | "guen" | "elma"; segment: "private" | "company" }
    | { variant: ThemeVariant; brand: "fkab"; segment: "company" }
    | { variant: ThemeVariant; brand: "fkse"; segment: "private" };
  type ThemeSlug =
    | `${ThemeVariant}-${"fkas" | "tkas" | "guen" | "elma"}-${ThemeSegment}`
    | `${ThemeVariant}-fkab-company`
    | `${ThemeVariant}-fkse-private`;
  type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";
  ```

- `THEME_VARIANTS` (`["internal", "external"]`) and `THEME_SEGMENTS` (`["private", "company"]`) are the axis tuples. `LEGAL_THEMES` is the 20-permutation list derived from the pin table, in variant → brand → segment order. Hosts that need the legal set (docs, playground, pickers) import these from `/theme` rather than re-deriving them. _(Amended 2026-09-02.)_
- `themeSlug(theme: ThemeInput): ThemeSlug` is total. `parseThemeSlug(slug: string): ThemeInput | null` returns `null` for malformed axes and illegal pinned-brand combinations; it never coerces or logs.
- `coerceTheme(input: unknown): ThemeInput | null` is the env-free pin-table parse: `null` for non-objects and unknown/missing axes; a pinned brand with the wrong segment returns the same variant/brand with `BRANDS[brand].segments[0]`. It never throws or logs. Host pickers that need silent pinning (docs `ThemePicker`) call this, not `validateTheme`.
- `validateTheme(input: unknown): ThemeInput` layers §6 diagnostics on `coerceTheme`. It rejects non-objects and unknown/missing axis values in every environment. When all three axes are known but a pinned brand has the wrong segment, it follows §6: `process.env.NODE_ENV !== "production"` throws; production returns the coerced theme and calls `console.warn` once for that invocation. This is the library's sole environment read; consumer bundlers replace the conventional expression and Node SSR supplies it natively. `themeAttributes` and both theme providers call the validator at their runtime boundary even though their public prop is typed.
- Covered by the public-API type tests ([accessibility](accessibility.md) §9's pattern; testing strategy).

### 7.7 Locale provider

`ElmeraGroupUiProvider` is permanent and exported from `/theme`: `{ locale: SupportedLocale; children: ReactNode }`. It provides a memoized `{ locale }` value; `useElmeraGroupUi()` returns it and throws outside the provider. It performs no browser or user-agent detection. The interim `UiProviders` wrapper is specified in [ui-providers](components/ui-providers.md).

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

Codegen across the board — hand-authored theme CSS is prohibited. The value matrix in §4 is documentation; **TypeScript is the source of truth**.

1. **Source shape**: `TokenContract` contains all role tokens except locked values. `DEFAULTS` is `Required<TokenContract>`; every other layer module is `Partial<TokenContract>`. `EXTERNAL_RESET_KEYS` is the literal tuple from §3.2 and must contain every key any external palette or segment delta can override; a contract test compares that computed union to the tuple so a new override cannot bypass scope isolation. Brand pointers, external palettes, and segment deltas are separate data modules. Locked tokens (§2.4) are not accepted by layer types.
2. **Coverage before fallback**: `composeTheme(theme)` first records the keys supplied by all non-default layers, validates the appropriate must-override set from §2.5 against that record, and only then overlays those layers on `DEFAULTS`. Applying defaults first and checking the final object is forbidden because it masks missing brand data. The internal reset is generated by picking `EXTERNAL_RESET_KEYS` from `DEFAULTS`; it is never hand-maintained.
3. **Generator**: emits the 15-rule, five-layer structure of §3.2 — defaults → brand pointers → internal reset → external palettes → segment deltas, fallback by absence — followed by the commented `[data-theme="dark"]` placeholder (§7.8). The internal reset emits `pick(DEFAULTS, EXTERNAL_RESET_KEYS)`; every external brand rule emits that same default pick overlaid with its source palette; segment deltas remain partial final overrides. Every selector remains separate, including fkab's copied external palette and elma's default-copy external palette.
4. **Execution**: generation runs in the turbo build task; **generated output is not committed**. The committed, reviewable artifact is a CSS snapshot. Contract tests cover all 20 themes and every outer/inner combination of the 20 themes (**400 nested-scope cases**), asserting computed reset-key values, the inner brand pointer, exactly 15 CSS rule nodes, the terminal dark-placeholder comment, and the per-theme contrast matrix.
5. **Distribution**: a **single `themes.css` entry** containing all 20 permutations (tiny by construction — 15 CSS rules plus one comment), included in both distribution modes ([architecture](architecture.md)). Per-theme file splitting is rejected as premature at this size; size budget → [performance](performance.md).
