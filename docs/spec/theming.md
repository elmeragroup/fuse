# Theming

Normative chapter for `@elmeragroup/ui`: the token contract, the cascade mechanism, the complete value matrix for all 16 themes, the theme provider API, and the token pipeline. Sources: [Canonical token contract](../../wayfinder/tickets/001-canonical-token-contract.md) + [ADR 0001](../adr/0001-canonical-token-contract.md), [Theming cascade prototype](../../wayfinder/tickets/002-theming-cascade-prototype.md) + [ADR 0002](../adr/0002-theme-attributes.md), [Brand–segment matrix gaps](../../wayfinder/tickets/004-brand-segment-matrix-gaps.md), [Theme value matrix](../../wayfinder/research/004-theme-value-matrix.md), [Theme provider API](../../wayfinder/tickets/006-theme-provider-api.md) + [ADR 0003](../adr/0003-data-only-theme-provider.md), [Token pipeline](../../wayfinder/tickets/018-token-pipeline.md).

Cross-links: package layout, exports, and where `themes.css` ships → [architecture](architecture.md). Contrast obligations of token pairings (text-grade roles, documented deviations, contrast-matrix snapshot) → [accessibility](accessibility.md) §6. CSS size budget for the emitted theme stylesheet → [performance](performance.md).

## 1 Axes, themes, slugs

- A **theme** is a concrete permutation of three axes:
  - **Variant** — audience axis: `internal` (grayscale theme for internal tools; brand appears only in accents/logos) or `external` (full brand look-and-feel for customer-facing apps).
  - **Brand** — one of five consumer-facing energy brands with fixed four-character codes: Fjordkraft (`fkas`), TrøndelagKraft (`tkas`), Gudbrandsdal Energi (`guen`), Fjordkraft Företag (`fkab`), Fjordkraft Konsument (`fkse`). `fkse` renders under the consumer-facing trade name **Telinet** (logo and palette) while keeping the `fkse` code everywhere in code, slugs, attributes, and types; brand metadata carries `displayName: "Telinet"` (§7.5).
  - **Segment** — customer class: `private` (B2C) or `company` (B2B).
- **Pinned brands**: `fkab` is pinned to `company`; `fkse` is pinned to `private`. The other three brands span both segments. This yields **16 legal themes** at v1 (8 internal, 8 external). Illegal permutations (`*-fkab-private`, `*-fkse-company`) are handled per §6.
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

| Family | Tokens | Count |
|---|---|---|
| Surfaces | `--background`, `--foreground` | 2 |
| | `--card`, `--card-foreground`, `--card-soft`, `--card-soft-foreground` | 4 |
| | `--popover`, `--popover-foreground` | 2 |
| | `--muted`, `--muted-foreground` | 2 |
| | `--accent`, `--accent-foreground` | 2 |
| | `--feature`, `--feature-bright`, `--feature-foreground` | 3 |
| Interactive | `--primary`, `--primary-foreground`, `--primary-soft`, `--primary-soft-foreground` | 4 |
| | `--secondary`, `--secondary-foreground`, `--secondary-soft`, `--secondary-soft-foreground` | 4 |
| Brand | `--brand`, `--brand-foreground` | 2 |
| Status | `--error`, `--info`, `--success`, `--warning`, each × `-foreground`, `-soft`, `-soft-foreground` | 16 |
| | `--destructive`, `--destructive-foreground` — **shipped aliases** of `--error`/`--error-foreground` (sole shadcn-snippet compat concession) | 2 |
| Lines/focus | `--border`, `--input`, `--ring` | 3 |
| Sidebar | `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`, `--sidebar-brand`, `--sidebar-brand-foreground` | 8 |
| Right panel | `--right-panel`, `--right-panel-foreground` | 2 |
| Charts | `--chart-1` … `--chart-8` | 8 |
| Syntax | `--sh-identifier`, `--sh-keyword`, `--sh-string`, `--sh-class`, `--sh-property`, `--sh-entity`, `--sh-jsxliterals`, `--sh-sign`, `--sh-comment` | 9 |
| Shape | `--radius`, `--radius-button` | 2 |
| Type | `--font-sans`, `--font-heading` | 2 |

`--brand`/`--brand-foreground` are first-class in every theme: the brand-pointer layer selects the globally available brand accent in both variants. External `--primary` remains the brand palette's action/surface color and can differ from that accent; internal themes keep `--primary` neutral and express brand identity only in `--brand` (and `--sidebar-brand`). The variant axis lives entirely in **values**, never in names — no internal-only tokens exist.

### 2.3 Public primitives

- **Neutral ramp** `--neutral-50` … `--neutral-950` — Tailwind convention (50 lightest → 950 darkest), pure gray (chroma 0). Pure white is `--background`, not a ramp member. The legacy inverted ramp (0 = black) and its warm hue on steps 70–95 are retired.
- **Brand accents** `--brand-<code>` / `--brand-<code>-foreground` for all five brand codes, defined globally at `:root` and never re-themed. Every accent `-foreground` is white `oklch(1 0 0)`.

Values are in §4.2.

### 2.4 Locked (library-fixed, not themable)

Themes cannot override these values and the theme generator does not accept them:

| Token | Value |
| --- | --- |
| `--radius-xs` | `calc(var(--radius) - 6px)` |
| `--radius-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `var(--radius)` |
| `--radius-xl` | `calc(var(--radius) + 4px)` |
| `--radius-popover` | `calc(var(--radius) - 8px)` |
| `--breakpoint-xs` | `574px` |
| `--breakpoint-lg` | `60rem` |
| `--breakpoint-3xl` | `1920px` |
| `--spacing` | `0.25rem` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |
| `--ease-overshoot` | the exact `linear(0, 0.402 7.4%, 0.711 15.3%, 0.929 23.7%, 1.008 28.2%, 1.067 33%, 1.099 36.9%, 1.12 41%, 1.13 45.4%, 1.13 50.1%, 1.111 58.5%, 1.019 83.2%, 1.004 91.3%, 1)` curve |

### 2.5 Defaults + must-override model

The library ships a **complete neutral default layer at `:root`** — every contract token has a value before any theme marker exists. A theme overrides a subset. Brand-defining tokens are **must-override**:

- **External themes must supply**, across their composed non-default layers: `--background`, `--foreground`, the complete card, muted, primary, and secondary families; the feature triple; `--border`, `--input`; `--radius`, `--radius-button`; and `--brand`, `--brand-foreground`. Typography is optional in the source palette: all brands use the default `--font-sans`, and only fkas overrides `--font-heading`. The generator still materializes the default heading value in every other emitted external rule so a nested scope cannot inherit an outer fkas font (§3.2).
- **Internal themes must supply**: `--brand` and `--brand-foreground`, satisfied by the brand-pointer layer. `--sidebar-brand` and `--sidebar-brand-foreground` are complete defaults that resolve through that pair and therefore are not separate coverage obligations.
- Statuses, ring, charts, and syntax colors stay shared-by-default; themes *may* override them but none does at v1.

Must-override is a **theme-level** obligation, not a per-module one. Individual layer modules are `Partial<TokenContract>` and never have to carry the full set themselves (internal themes, for instance, satisfy their brand-pair obligation via the brand-pointer layer). Enforcement happens at **compose time** in the token pipeline — each of the 16 themes is resolved through its layers and the build fails if a resolved theme lacks any must-override token (§8) — and is re-checked at the CSS level by the theme-contract test.

### 2.6 Legacy bridging: clean break

No HSL-triplet wrappers, no bridge layer. This table is the complete semantic rename guide for lifting reference styles; it is documentation only and does not create aliases:

| Reference token/concept | Canonical token |
| --- | --- |
| `--surface` / `--on-surface` | `--background` / `--foreground` |
| `--primary-container` / `--on-primary-container` | `--card` / `--card-foreground` |
| `--surface-bright` | `--card-soft` (foreground uses `--card-soft-foreground`) |
| `--surface-variant` / `--surface-variant-bright` / `--on-surface-variant` | `--feature` / `--feature-bright` / `--feature-foreground` |
| `--on-surface-muted` | `--muted-foreground` |
| `--primary` / `--on-primary` | `--primary` / `--primary-foreground` |
| `--secondary` / `--on-secondary` | `--secondary` / `--secondary-foreground` |
| `--secondary-container` / `--on-secondary-container` | `--secondary-soft` / `--secondary-soft-foreground` |
| `--<status>` / `--on-<status>` | `--<status>` / `--<status>-foreground` for `error`, `info`, `success`, `warning` |
| `--<status>-container` / `--on-<status>-container` | `--<status>-soft` / `--<status>-soft-foreground` |
| legacy per-brand accent selected for the current brand | `--brand` / `--brand-foreground` (primitives remain `--brand-<code>` pairs) |
| internal inverted neutral ramp | `--neutral-50..950`, renumbered light-to-dark and normalized to chroma 0 (§4.2) |

New roles with no faithful legacy alias are `--popover(-foreground)`, `--primary-soft(-foreground)`, and the trimmed sidebar contract; ports choose them by the component semantics documented in §5 and each component's consumed-token section. Deliberately dead with **no replacement alias**: `--surface-text`, `--tertiary*` (all forms), `--secondary-variant`, `--inactive`, `--primary-light`, `--sidebar-background`, `--sidebar-primary(-foreground)`, per-brand `--destructive` triplets, `--on-primary-container-muted` (use opacity utilities), and the `.ngeas` block. The `--destructive` alias pair is the only runtime compatibility concession.

## 3 Cascade mechanism

### 3.1 Three data attributes

Theme markers are three data attributes, **placeable on any element** — no selector anchors to `<html>`:

```html
<html data-theme-variant="external" data-theme-brand="fkas" data-theme-segment="company">
```

- `data-theme-variant`: `internal` | `external`
- `data-theme-brand`: `fkas` | `tkas` | `guen` | `fkab` | `fkse`
- `data-theme-segment`: `private` | `company`

Rejected alternatives (ADR 0002): a single slug attribute (needs `^=`/`*=` substring selectors for axis rules and occupies the reserved `data-theme`); classes (equal power, but bare `.company`/`.private` collide with app CSS and are illegible in DevTools). Each axis is independently visible on the element and independently switchable at runtime.

### 3.2 Layer structure — 13 theme rules cover 16 themes

The emitted theme CSS has exactly five layers:

1. **`:root` defaults** (1 rule) — the complete neutral default layer (§4.2). This layer *is* the internal look, by design.
2. **Brand pointers** (5 rules) — keyed on brand alone, serving both variants: `[data-theme-brand="<code>"] { --brand: var(--brand-<code>); --brand-foreground: var(--brand-<code>-foreground); }`.
3. **Internal reset** (1 rule) — `[data-theme-variant="internal"]` re-declares the exact `EXTERNAL_RESET_KEYS` set with values copied from defaults: `background`, `foreground`; all card, muted, primary, and secondary tokens; all feature tokens; `border`, `input`; `radius`, `radius-button`; and `font-heading`. It does **not** reset primitives, the brand pair, or roles external palettes never override. This is what makes an internal scope nested under an external scope return to internal values while still receiving its layer-2 brand pointer.
4. **External brand palettes** (5 rules) — `[data-theme-variant="external"][data-theme-brand="<code>"]`; each emitted rule contains every `EXTERNAL_RESET_KEYS` declaration, taking a brand value where its source palette supplies one and the `DEFAULTS` value otherwise. This materialization is mandatory scope isolation: an inner external scope must reset every value an outer external/segment layer could have changed. fkab gets its **own selector** carrying a generator-level copy of the fkas value set (permanent alias, §5).
5. **Segment deltas** (1 rule) — only where values genuinely differ: `[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` is the sole delta at v1.

The count is exact: 1 + 5 + 1 + 5 + 1 = **13 emitted theme rules**, the now-full internal rule counting as 1. Every rule owns its selector — the generator never merges layers or brands into shared selectors; deduplication is allowed only in the TS source modules (§8). Rules grow with **value differences, not permutations**. Adding a brand adds ~2 rules (accent pointer + external palette). The reserved dark-axis placeholder (§7.8) is a comment, not a fourteenth CSS rule.

### 3.3 Fallback by absence

Permutations without distinct palettes get **no CSS rule** and resolve from lower layers. `external-tkas-company` and `external-guen-company` inherit their private palettes because no company rule exists — zero fallback CSS is written. The value matrix marks these *(inherits private)* so the gaps stay visible and fillable without restructuring.

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
  --ease-overshoot: linear(0, 0.402 7.4%, 0.711 15.3%, 0.929 23.7%, 1.008 28.2%, 1.067 33%, 1.099 36.9%, 1.12 41%, 1.13 45.4%, 1.13 50.1%, 1.111 58.5%, 1.019 83.2%, 1.004 91.3%, 1);
}

@utility font-sans { font-family: var(--font-sans); }
@utility font-heading { font-family: var(--font-heading); }
@utility font-mono { font-family: var(--font-mono); }
@utility rounded-button { border-radius: var(--radius-button); }
```

Font and button-radius utilities are explicit because their public backing-token names would otherwise self-reference Tailwind theme variables. This contract follows Tailwind's documented [`@theme inline`](https://tailwindcss.com/docs/theme#referencing-other-variables) behavior. Component source uses the named radius utilities; it does not rely on Tailwind's unrelated default radii.

The raw entry's selector/utility lift source is `.ref/OrderModuleInternalWeb/packages/ui/src/styles/ui.css`, but only the following ruled subset is retained; its legacy theme blocks, base reset, product-hub rules, `dark`/`inverted` variants, debug utility, and unused keyframes are not copied. The raw entry does **not** import Tailwind itself—the consumer recipe already does—but it contains `@import "tw-animate-css";`, `@plugin "tailwindcss-react-aria-components";` while the RAC tier exists, the `@theme inline` block above, the four explicit utilities above, the central reduced-motion rule, and these exact definitions:

```css
@custom-variant data-open {
  &:where([data-state="open"]), &:where([data-open]:not([data-open="false"])) { @slot; }
}
@custom-variant data-closed {
  &:where([data-state="closed"]), &:where([data-closed]:not([data-closed="false"])) { @slot; }
}
@custom-variant data-checked {
  &:where([data-state="checked"]), &:where([data-checked]:not([data-checked="false"])) { @slot; }
}
@custom-variant data-unchecked {
  &:where([data-state="unchecked"]), &:where([data-unchecked]:not([data-unchecked="false"])) { @slot; }
}
@custom-variant data-selected {
  &:where([data-selected="true"]) { @slot; }
}
@custom-variant data-disabled {
  &:where([data-disabled="true"]), &:where([data-disabled]:not([data-disabled="false"])) { @slot; }
}
@custom-variant data-active {
  &:where([data-state="active"]), &:where([data-active]:not([data-active="false"])) { @slot; }
}
@custom-variant data-horizontal {
  &:where([data-orientation="horizontal"]) { @slot; }
}
@custom-variant data-vertical {
  &:where([data-orientation="vertical"]) { @slot; }
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
  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

The standalone-CSS build uses a build-only wrapper that imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` (never `tailwindcss/preflight.css`), imports this raw entry, and points `@source` at the emitted `dist/**/*.js` graph. That wrapper is compiler input only; the output is the published `styles.css`. Raw-source consumers instead use the recipe in [architecture](architecture.md) §5.

### 3.5 Scoped subtrees and portals

Markers on any element re-theme that subtree (the OrderModuleWeb per-track `<main>` re-branding pattern). A portal rendered **inside** the themed scope inherits correctly; a portal rendered **outside** silently takes the outer page theme. The CSS mechanism does not and cannot enforce this — containment is solved at the component layer: `ThemeScope` publishes its rendered element via React context, and overlay components' `container` prop **defaults to the nearest scope's element**, so portals land inside the active scope automatically; an explicit `container` overrides (§7.4).

### 3.6 `data-theme` stays free

None of the three attributes is `data-theme`. That attribute is reserved for the light/dark color-scheme axis, set by `<ColorSchemeScript>` from v1 (§7.8) and given CSS meaning only when dark values land.

## 4 Value matrix — all layers, all brands

The tables below are the **final, normative values** (Brand–segment matrix gaps: all mints final — no provisional flags, no pending design review). Provenance markers:

- `[ref]` — verbatim from a reference codebase (token extraction, research 003)
- `[conv]` — legacy HSL converted to oklch (exact sRGB→OKLab math; conversion table in §4.1)
- `[mint]` — minted value, **final** (user decision, no design review pending)
- `[user]` — value supplied directly by the user (new light sidebar)
- *(inherit)* — no rule emitted; the permutation resolves the value from a lower layer (fallback by absence)

### 4.1 Conversions performed

| Legacy | oklch |
|---|---|
| `hsl(20 5.9% 90%)` (fkas/fkse border) | `oklch(0.9232 0.0026 48.72)` |
| `hsl(214.3 31.8% 91.4%)` (tkas/guen border) | `oklch(0.929 0.0126 255.53)` |
| `hsl(60 4.8% 95.9%)` (fkas/fkse muted) | `oklch(0.97 0.0013 106.42)` |
| `hsl(210 40% 96.1%)` (tkas/guen muted) | `oklch(0.9684 0.0068 247.9)` |

### 4.2 Layer 1 — library defaults (`:root`), complete

Every token has a value before any theme marker exists. Internal themes are nearly identical to this layer.

#### 4.2.1 Public primitives

Neutral ramp (internal ramp renumbered to Tailwind order, normalized to pure gray; old inverted 0=black scale retired; pure white is `--background`, not a ramp member):

| Token | Value | Token | Value |
|---|---|---|---|
| `--neutral-50` | `oklch(0.96 0 0)` | `--neutral-500` | `oklch(0.57 0 0)` |
| `--neutral-100` | `oklch(0.91 0 0)` | `--neutral-600` | `oklch(0.48 0 0)` |
| `--neutral-200` | `oklch(0.83 0 0)` | `--neutral-700` | `oklch(0.40 0 0)` |
| `--neutral-300` | `oklch(0.74 0 0)` | `--neutral-800` | `oklch(0.31 0 0)` |
| `--neutral-400` | `oklch(0.66 0 0)` | `--neutral-900` | `oklch(0.23 0 0)` |
| | | `--neutral-950` | `oklch(0.16 0 0)` |

Brand accents (all five, `:root`, never re-themed; every `-foreground` is white `oklch(1 0 0)`):

| Token | Value | Provenance |
|---|---|---|
| `--brand-fkas` | `oklch(0.68 0.21747 38.8)` | [ref] |
| `--brand-tkas` | `oklch(0.86 0.1035 191.11)` | [ref] |
| `--brand-guen` | `oklch(0.21 0.0399 265.73)` | [ref] |
| `--brand-fkab` | `var(--brand-fkas)` | **permanent alias by design** (not a gap, no design task) |
| `--brand-fkse` | `oklch(0.4816 0.0908 240.16)` | [mint] — Telinet blue (external fkse `--primary`) |

#### 4.2.2 Role-token defaults

| Token | Default | Provenance |
|---|---|---|
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)` | [ref] internal |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)` | [ref] internal |
| `--card-soft` / `--card-soft-foreground` | `oklch(0.9702 0 0)` / `oklch(0.15 0.0041 49.31)` | [ref] internal v2 |
| `--popover` / `--popover-foreground` | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)` | independent literals (never `var(--card)`) |
| `--muted` / `--muted-foreground` | `oklch(0.97 0.0013 106.42)` / `oklch(0.5555 0 0)` | [ref] internal |
| `--accent` / `--accent-foreground` | `oklch(0.96 0 0)` / `oklch(0.16 0 0)` | [ref] internal v2, normalized |
| `--feature` / `--feature-bright` / `--feature-foreground` | `oklch(0.96 0 0)` / `oklch(0.98 0 0)` / `oklch(0.16 0 0)` | [mint] neutral (internal points feature at a neutral per contract) |
| `--primary` / `--primary-foreground` | `oklch(0.16 0 0)` / `oklch(1 0 0)` | [ref] internal (neutral-950/white) |
| `--primary-soft` / `--primary-soft-foreground` | `oklch(0.96 0 0)` / `oklch(0.16 0 0)` | [mint] |
| `--secondary` / `--secondary-foreground` | `oklch(0.97 0 0)` / `oklch(0.22 0 0)` | [ref] internal, normalized |
| `--secondary-soft` / `--secondary-soft-foreground` | `oklch(0.9219 0 0)` / `oklch(0.16 0 0)` | [mint] |
| `--brand` / `--brand-foreground` | `oklch(0.16 0 0)` / `oklch(1 0 0)` | neutral until a brand pointer applies |
| `--error` / `--error-foreground` | `oklch(0.4526 0.17845 30.42)` / `oklch(1 0 0)` | [ref] shared status block |
| `--error-soft` / `--error-soft-foreground` | `oklch(0.9352 0.02195 14.08)` / `oklch(0.4526 0.17845 30.42)` | [ref] |
| `--info` / `--info-foreground` | `oklch(0.4 0.09979 263.74)` / `oklch(1 0 0)` | [ref] |
| `--info-soft` / `--info-soft-foreground` | `oklch(0.9315 0.02014 233.86)` / `oklch(0.4 0.09979 263.74)` | [ref] |
| `--success` / `--success-foreground` | `oklch(0.4277 0.13765 144.24)` / `oklch(1 0 0)` | [ref] |
| `--success-soft` / `--success-soft-foreground` | `oklch(0.9346 0.02761 150.41)` / `oklch(0.4277 0.13765 144.24)` | [ref] |
| `--warning` / `--warning-foreground` | `oklch(0.468 0.10443 65.71)` / `oklch(1 0 0)` | [ref] |
| `--warning-soft` / `--warning-soft-foreground` | `oklch(0.9349 0.04795 81.5)` / `oklch(0.468 0.10443 65.71)` | [ref] |
| `--destructive` / `--destructive-foreground` | `var(--error)` / `var(--error-foreground)` | contract aliases |
| `--border` / `--input` | `oklch(0.9219 0 0)` / `oklch(0.9219 0 0)` | [user] |
| `--ring` | `oklch(0.4844 0.20509 296.29)` | [ref] shared violet, brand-independent |
| `--sidebar` / `--sidebar-foreground` | `oklch(0.9851 0 0)` / `oklch(0.16 0 0)` | [user] — **new light sidebar** (dark ref sidebar retired) |
| `--sidebar-accent` / `--sidebar-accent-foreground` | `oklch(0.9219 0 0)` / `oklch(0.16 0 0)` | [mint] light selection per mock |
| `--sidebar-border` | `oklch(0.9219 0 0)` | [user] |
| `--sidebar-ring` | `var(--ring)` | alias |
| `--sidebar-brand` / `--sidebar-brand-foreground` | `var(--brand)` / `var(--brand-foreground)` | alias — guen's dark-sidebar orange accent is **retired** with the light sidebar |
| `--right-panel` / `--right-panel-foreground` | `oklch(0.9851 0 0)` / `oklch(0.1448 0 0)` | [ref] internal |
| `--chart-1..8` | `oklch(0.289 0.0518 217.7)`, `oklch(0.3629 0.0619 204.44)`, `oklch(0.4322 0.0777 181.31)`, `oklch(0.4933 0.1113 160.18)`, `oklch(0.5623 0.139 143.03)`, `oklch(0.6348 0.1494 124.51)`, `oklch(0.714 0.1487 100.58)`, `oklch(0.7945 0.1709 71.19)` | [ref] internal teal→amber |
| `--sh-identifier/keyword/string/class/property/entity/jsxliterals/sign/comment` | `#5c6773`, `#ff7733`, `#86b300`, `#a37acc`, `#36a3d9`, `#f29718`, `#4cbf99`, `#ed9366`, `#abb0b6` | [ref] Ayu Light |
| `--radius` / `--radius-button` | `0.375rem` / `0.375rem` | [ref] internal |
| `--font-sans` | `Roboto, ui-sans-serif, system-ui, sans-serif` | [ref] |
| `--font-heading` | `var(--font-sans)` | fallback semantics |

### 4.3 Layer 2 — brand pointers (5 rules, both variants)

For each of `fkas`, `tkas`, `guen`, `fkab`, `fkse`:

```css
[data-theme-brand="<code>"] {
  --brand: var(--brand-<code>);
  --brand-foreground: var(--brand-<code>-foreground);
}
```

### 4.4 Layer 3 — internal variant (1 rule)

`[data-theme-variant="internal"]` introduces no new design values. It re-declares `EXTERNAL_RESET_KEYS` from §3.2 with literals copied from `DEFAULTS`; it must not reset `--brand`/`--brand-foreground`, because the earlier brand-pointer layer is meant to survive. Primitives and shared roles that no external layer overrides are also omitted. All eight internal permutations resolve as defaults + internal reset + brand pointer. Segment has no internal value axis.

### 4.5 Layer 4 — external variant per brand (4 palettes + 1 alias)

Selector: `[data-theme-variant="external"][data-theme-brand="<code>"]`. fkab has **no palette of its own in source**: the generator emits the fkas value set under fkab's **own selector** — a generator-level copy, permanent alias by design, indefinitely. Before emission, every external source palette is overlaid on `pick(DEFAULTS, EXTERNAL_RESET_KEYS)`, so all five rules directly declare the complete reset set. This prevents values from a themed ancestor—including fkas's heading font and the company segment delta—from leaking into a nested external scope. Deduplication is allowed only in the source modules, never via shared selectors in the output; the emitted rule count stays exactly 13 (§3.2).

Tokens not listed per brand *(inherit)* from `:root`: popover pair, accent pair, statuses, ring, sidebar family, right-panel, charts, syntax colors.

| Token | fkas | tkas | guen | fkse |
|---|---|---|---|---|
| `--background` | `oklch(0.96042 0.0214 46.99)` | `oklch(0.97902 0.02928 188.87)` | `oklch(0.95469 0.01887 279.53)` | `oklch(0.98014 0.01729 210.19)` |
| `--foreground` | `oklch(0.3209 0.10325 38.8)` | `oklch(0.30407 0.05238 190.82)` | `oklch(0.19922 0.12072 268.2)` | `oklch(0.36735 0.09417 249.17)` |
| `--card` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` |
| `--card-foreground` | `oklch(0.23274 0.07506 38.69)` | `oklch(0.22003 0.0378 191.8)` | `oklch(0.14028 0.08604 266.38)` | `oklch(0.22503 0.06011 247.68)` |
| `--card-soft` | `oklch(0.98095 0.01088 54.5)` | `oklch(0.98982 0.01388 185.97)` | `oklch(0.99199 0.00734 80.72)` | `oklch(0.99007 0.00865 210.19)` |
| `--card-soft-foreground` | = `--foreground` value | = `--foreground` value | = `--foreground` value | = `--foreground` value |
| `--muted` | `oklch(0.97 0.0013 106.42)` [conv] | `oklch(0.9684 0.0068 247.9)` [conv] | `oklch(0.9684 0.0068 247.9)` [conv] | `oklch(0.97 0.0013 106.42)` [conv] |
| `--muted-foreground` | fg `/ 0.7` | fg `/ 0.7` | fg `/ 0.7` | fg `/ 0.7` |
| `--primary` | `oklch(0.4848 0.16637 35.92)` | `oklch(0.47316 0.08165 190.23)` | `oklch(0.4863 0.25238 271.95)` | `oklch(0.48158 0.09084 240.16)` |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` |
| `--primary-soft` | `oklch(0.94 0.03 45)` [mint] | `oklch(0.94 0.04 191)` [mint] | `oklch(0.93 0.035 277)` [mint] | `oklch(0.9368 0.04194 223.32)` [mint] |
| `--primary-soft-foreground` | = `--card-foreground` value | = `--card-foreground` value | = `--card-foreground` value | = `--card-foreground` value |
| `--secondary` | `oklch(0.3209 0.10325 38.8)` | `oklch(0.30407 0.05238 190.82)` | `oklch(0.19922 0.12072 268.2)` | `oklch(0.36735 0.09417 249.17)` |
| `--secondary-foreground` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` | `oklch(1 0 0)` |
| `--secondary-soft` | `oklch(0.8861 0.05413 50.48)` | `oklch(0.94764 0.07736 190.94)` | `oklch(0.88401 0.04497 277.34)` | `oklch(0.9368 0.04194 223.32)` |
| `--secondary-soft-foreground` | = `--secondary` value | = `--secondary` value | = `--secondary` value | = `--secondary` value |
| `--feature` | `oklch(0.57866 0.19387 36.96)` | `oklch(0.55688 0.09585 191.06)` | `oklch(0.57814 0.22881 270.38)` | `oklch(0.56873 0.09344 229.37)` |
| `--feature-bright` | `oklch(0.74389 0.16389 43.68)` | `oklch(0.77279 0.10225 190.47)` | `oklch(0.7068 0.1522 275.6)` | `oklch(0.77836 0.11783 206.21)` |
| `--feature-foreground` | `oklch(0.80097 0.10434 49.42)` | `oklch(0.90178 0.09399 190.62)` | `oklch(0.84919 0.07412 279.64)` | `oklch(0.90492 0.09477 206.46)` |
| `--border` / `--input` | `oklch(0.9232 0.0026 48.72)` [conv] | `oklch(0.929 0.0126 255.53)` [conv] | `oklch(0.929 0.0126 255.53)` [conv] | `oklch(0.9232 0.0026 48.72)` [conv] |
| `--radius` | `0.75rem` | `0.95rem` | `0.5rem` | `0.75rem` |
| `--radius-button` | `1.8125rem` | `0.95rem` | `0.5rem` | `1.8125rem` |
| `--font-heading` | `"Neo Sans", var(--font-sans)` | `var(--font-sans)` [default reset] | `var(--font-sans)` [default reset] | `var(--font-sans)` [default reset] |

All `[ref]` unless marked. Two notational conventions in this table:

- **"= X value"** means the same literal is repeated in the emitted CSS — no `var()` indirection. The refs' value-coincidences are made explicit as duplicated literals per the contract's no-eager-binding rule; the generator may deduplicate at its TS source level, never in the output.
- **"fg `/ 0.7`"** means the brand's `--foreground` oklch literal with an appended `/ 0.7` alpha channel (e.g. fkas: `oklch(0.3209 0.10325 38.8 / 0.7)`) — a self-contained oklch literal with alpha, not an opacity alias of another token.

### 4.6 Layer 5 — segment delta (exactly 1 rule)

`[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` (the ref's `.fkas-c`):

| Token | Value |
|---|---|
| `--background` | `oklch(0.9823 0.01428 213.1)` |
| `--foreground` | `oklch(0.30579 0.03693 215.45)` |
| `--card-foreground` | `oklch(0.25285 0.03792 212.52)` |
| `--card-soft` | `oklch(0.99011 0.0069 219.56)` |
| `--card-soft-foreground` | `oklch(0.30579 0.03693 215.45)` |
| `--muted-foreground` | fg `/ 0.7` |
| `--primary` | `oklch(0.47471 0.07313 217.18)` |
| `--primary-soft` | `oklch(0.95328 0.03401 215.01)` |
| `--primary-soft-foreground` | `oklch(0.25285 0.03792 212.52)` |
| `--secondary` | `oklch(0.30579 0.03693 215.45)` |
| `--secondary-soft` | `oklch(0.95328 0.03401 215.01)` |
| `--secondary-soft-foreground` | `oklch(0.30579 0.03693 215.45)` |
| `--feature` | `oklch(0.55738 0.06979 216.27)` |
| `--feature-bright` | `oklch(0.7871 0.0657 225.82)` |
| `--feature-foreground` | `oklch(0.90856 0.05958 225.03)` |

### 4.7 Composition matrix — how each of the 16 themes resolves

| Theme slug | Layers applied | Notes |
|---|---|---|
| `internal-fkas-private` / `-company` | 1 + 2(fkas) + 3 | segment axis valueless internally |
| `internal-tkas-private` / `-company` | 1 + 2(tkas) + 3 | |
| `internal-guen-private` / `-company` | 1 + 2(guen) + 3 | sidebar accent = navy `--brand` on the light sidebar (old dark-sidebar orange retired) |
| `internal-fkab-company` | 1 + 2(fkab→fkas alias) + 3 | `internal-fkab-private` is **illegal** (pinned) |
| `internal-fkse-private` | 1 + 2(fkse) + 3 | first time fkse has internal accents; `internal-fkse-company` **illegal** |
| `external-fkas-private` | 1 + 2(fkas) + 4(fkas) | |
| `external-fkas-company` | 1 + 2(fkas) + 4(fkas) + 5 | the only segment delta |
| `external-tkas-private` / `-company` | 1 + 2(tkas) + 4(tkas) | company *(inherits private — no rule)* |
| `external-guen-private` / `-company` | 1 + 2(guen) + 4(guen) | company *(inherits private — no rule)* |
| `external-fkab-company` | 1 + 2(fkab) + 4(fkas values) | permanent alias by design; `external-fkab-private` **illegal** |
| `external-fkse-private` | 1 + 2(fkse) + 4(fkse) | renders as Telinet (displayName + logo); `external-fkse-company` **illegal** |

## 5 Value policy rulings

- **All minted values are final** (primary-soft tints, fkse accents, light-sidebar fills) — no provisional flags, no pending design review. Contrast consequences of these locked values are classified, not redesigned, in [accessibility](accessibility.md) §6.
- **fkab is a permanent, deliberate alias of fkas** — "100% how it should be for the foreseeable future". Not a gap, no design task, no flag. (This superseded ADR 0001's original "design-input gap" framing; the ADR is amended.)
- **fkse** keeps code `fkse` everywhere; only presentation metadata (`displayName: "Telinet"`, Telinet logo) differs.
- The library's sidebar defaults spec the **new light sidebar**, not the dark one in the internal reference; guen's dark-sidebar orange accent is retired.

## 6 Illegal permutations

`*-fkab-private` and `*-fkse-company` are illegal. Three enforcement tiers, all mandatory:

1. **Compile time**: the `ThemeInput` discriminated union (§7.6) makes illegal combinations unrepresentable in typed code.
2. **Development runtime**: `validateTheme` (covering untyped inputs — env vars, CMS data) **throws**.
3. **Production runtime**: `validateTheme` **coerces to the pinned segment** (`fkab` → `company`, `fkse` → `private`) and emits a console warning.

**CSS stays best-effort**: the stylesheet neither forbids nor special-cases illegal attribute combinations — an illegal combination that somehow reaches the DOM renders whatever the layers resolve to. Enforcement is exclusively the provider's job.

## 7 Theme provider API

Single entry **`@elmeragroup/ui/theme`** — no per-framework entry points (a Next-specific export would be a byte-identical alias; ADR 0003). The provider is **data-only**: no effects, no inline script for the brand theme, no DOM mutation, no hydration suppression. The theme is server-known and deployment-fixed, so zero flash holds by construction. next-themes is **not vendored**. Package/export mechanics → [architecture](architecture.md).

Minimal app setup:

```tsx
// Server layout
import {
  ColorSchemeScript,
  ElmeraGroupUiProvider,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import "@elmeragroup/ui/styles.css";
import "@elmeragroup/ui/themes.css";

const theme = { variant: "external", brand: "fkas", segment: "private" } as const;

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" {...themeAttributes(theme)} suppressHydrationWarning>
      <head><ColorSchemeScript /></head>
      <body>
        <ThemeProvider theme={theme}>
          <ElmeraGroupUiProvider locale="nb-NO">
            {children}
          </ElmeraGroupUiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` is required only because `ColorSchemeScript` sets the reserved `data-theme` attribute before hydration; it is unrelated to the server-known brand attributes. Apps not using the color-scheme machinery omit both. RAC consumers replace `ElmeraGroupUiProvider` in the example with `UiProviders` from `@elmeragroup/ui/react-aria/ui-providers`, because that wrapper includes the same locale provider plus RAC routing/i18n context; they do not nest both locale providers. `UiProviders` requires a function-valued `navigate` prop, so a Next App Router layout renders a small app-owned `"use client"` provider wrapper that calls `useRouter()` and passes `url => router.push(url)`—it does not pass a server function through the layout boundary.

### 7.1 `ThemeProvider`

```tsx
<ThemeProvider theme={{ variant, brand, segment }}>
```

- Input is the **decomposed object** (primary representation); the slug is always derivable. Pure, isomorphic helpers exported: `themeSlug(theme)` and `parseThemeSlug(slug)`.
- Fully controlled context carrier. **No `setTheme`** — switching is host-owned state (docs/Storybook pickers re-render the provider).
- Props: `{ theme: ThemeInput; children: ReactNode }`. `useTheme()` returns `{ ...theme, slug }` and throws outside `ThemeProvider` or `ThemeScope`.

### 7.2 `themeAttributes(theme)`

Pure function with exact return type:

```ts
type ThemeAttributes = {
  "data-theme-variant": ThemeInput["variant"];
  "data-theme-brand": ThemeInput["brand"];
  "data-theme-segment": ThemeInput["segment"];
};
```

It validates untyped input before returning the three attributes. The headline recipe is spreading it on `<html>` in the framework's root layout, with the theme sourced from env.

### 7.3 SSR recipes (documentation, not code)

All four reduce to "spread the attributes on your root element, server-side":

1. **Next App Router** — `app/layout.tsx`: `<html {...themeAttributes(theme)}>`.
2. **React Router 7** — `root.tsx` `Layout` component, same spread on `<html>`.
3. **TanStack Start** — root route's document shell, same spread.
4. **Vite SPA** — `%VITE_*%` placeholders in `index.html`, or set the attributes on `document.documentElement` pre-mount (before `createRoot(...).render()`).

No framework needs an inline script or hydration suppression for the brand theme.

### 7.4 `ThemeScope`

Escape hatch for per-request/multi-theme subtrees (the sms-accept per-customer pattern; the docs playground's 16-permutation grid). One component that **fuses** the three data attributes and a nested provider context so CSS and `useTheme()` cannot drift apart.

- Props: `{ theme: ThemeInput; children?: ReactNode }` plus the native `div` props/ref and base-ui `useRender`'s `render` prop; theme data attributes generated by `themeAttributes(theme)` are owned by the component and cannot be overridden through the remaining props.
- Polymorphic via base-ui **`useRender`** (`render` prop + `mergeProps`, default tag `div`). Standing convention: **all library polymorphism uses `useRender`, never an `as` prop**.
- A merged callback ref stores the rendered `HTMLElement` in state and publishes it through a private context, so ref attachment triggers the dependent overlays to re-render. The context distinguishes **no scope** (`undefined`) from **scope present but target not attached yet** (`null`).
- Every overlay resolves its portal target in this order: explicit `container` element/ref → nearest `ThemeScope` element → primitive default (`document.body`) only when no scope exists. If an explicit ref or nearest scope exists but its element is still `null`, portal content waits rather than briefly escaping to `document.body`. Base-ui entries forward the resolved element to their portal/container API; RAC private Popover/Modal adapters forward it to the matching RAC portal-container API. The private `useThemeScopeContainer` hook and context are not exported.
- `ThemeScope` provides the same `{ ...theme, slug }` value as `ThemeProvider`; a nested scope always wins for `useTheme()` consumers within it.

### 7.5 `BRANDS`

Exported readonly record with this exact value and inferred literal types:

```ts
type BrandCode = "fkas" | "tkas" | "guen" | "fkab" | "fkse";
type ThemeSegment = "private" | "company";

const BRANDS = {
  fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
  tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
  guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
  fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
  fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
} as const satisfies Record<BrandCode, {
  code: BrandCode;
  displayName: string;
  segments: readonly ThemeSegment[];
}>;
```

Logo components live with the icon system, keyed by the same codes.

### 7.6 Types

- `ThemeInput` is this exact discriminated union, making pinned-brand mistakes unrepresentable:

  ```ts
  type ThemeVariant = "internal" | "external";
  type BrandCode = "fkas" | "tkas" | "guen" | "fkab" | "fkse";
  type ThemeSegment = "private" | "company";
  type ThemeInput =
    | { variant: ThemeVariant; brand: "fkas" | "tkas" | "guen"; segment: "private" | "company" }
    | { variant: ThemeVariant; brand: "fkab"; segment: "company" }
    | { variant: ThemeVariant; brand: "fkse"; segment: "private" };
  type ThemeSlug =
    | `${ThemeVariant}-${"fkas" | "tkas" | "guen"}-${ThemeSegment}`
    | `${ThemeVariant}-fkab-company`
    | `${ThemeVariant}-fkse-private`;
  type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";
  ```
- `themeSlug(theme: ThemeInput): ThemeSlug` is total. `parseThemeSlug(slug: string): ThemeInput | null` returns `null` for malformed axes and illegal pinned-brand combinations; it never coerces or logs.
- `validateTheme(input: unknown): ThemeInput` rejects non-objects and unknown/missing axis values in every environment. When all three axes are known but a pinned brand has the wrong segment, it follows §6: `process.env.NODE_ENV !== "production"` throws; production returns the same variant/brand with the pinned segment and calls `console.warn` once for that invocation. This is the library's sole environment read; consumer bundlers replace the conventional expression and Node SSR supplies it natively. `themeAttributes` and both theme providers call the validator at their runtime boundary even though their public prop is typed.
- Covered by the public-API type tests ([accessibility](accessibility.md) §8's pattern; testing strategy).

### 7.7 Locale provider

`ElmeraGroupUiProvider` is permanent and exported from `/theme`: `{ locale: SupportedLocale; children: ReactNode }`. It provides a memoized `{ locale }` value; `useElmeraGroupUi()` returns it and throws outside the provider. It performs no browser or user-agent detection. The interim `UiProviders` wrapper is specified in [ui-providers](components/ui-providers.md).

### 7.8 Dark axis: wired, valueless

- `<ColorSchemeScript>` and `useColorScheme()` ship functional in v1 — adapted from next-themes' script with its MIT notice retained. Their exact public types are:

  ```ts
  type ColorScheme = "light" | "dark" | "system";
  type ColorSchemeOptions = {
    storageKey?: string;
    defaultColorScheme?: ColorScheme;
    enableSystem?: boolean;
  };
  type ColorSchemeScriptProps = ColorSchemeOptions & { nonce?: string };
  type UseColorSchemeResult = {
    colorScheme: ColorScheme;
    resolvedColorScheme: "light" | "dark" | undefined;
    setColorScheme: (value: ColorScheme) => void;
  };

  function useColorScheme(options?: ColorSchemeOptions): UseColorSchemeResult;
  ```

  All options default to `storageKey: "elmera-color-scheme"`, `defaultColorScheme: "system"`, and `enableSystem: true`; an app overriding one passes the same options to the script and hook. Before paint, the script accepts a stored value only when it is one of the three `ColorScheme` literals, otherwise uses the default, consults `prefers-color-scheme` only when system mode is both selected and enabled, and sets reserved `data-theme` to the resolved literal `"light"` or `"dark"`. Disabled system mode resolves `"system"` to `"light"` deterministically. Storage or media-query failures also fall back without throwing.

  The client hook's server snapshot and first hydration render are `{ colorScheme: defaultColorScheme, resolvedColorScheme: undefined }`; after mount it reads the validated preference and the script-set DOM attribute. `setColorScheme` updates local state, storage, and the root attribute. The hook listens for same-key `storage` events and, while in enabled system mode, `prefers-color-scheme` changes; it removes both listeners on cleanup. This makes multi-tab and OS changes observable without making hydration depend on browser state.
- `ThemeInput` has **no dark field** — color scheme is an orthogonal, layered axis, never part of the brand theme.
- The emitted theme CSS ends with a ready-to-go **commented `[data-theme="dark"]` placeholder**, not an empty rule node. Values land there with the dark-mode roadmap item. When they do, nothing about the brand-theme API changes.

## 8 Token pipeline (codegen)

Codegen across the board — hand-authored theme CSS is prohibited. The value matrix in §4 is documentation; **TypeScript is the source of truth**.

1. **Source shape**: `TokenContract` contains all role tokens except locked values. `DEFAULTS` is `Required<TokenContract>`; every other layer module is `Partial<TokenContract>`. `EXTERNAL_RESET_KEYS` is the literal tuple from §3.2 and must contain every key any external palette or segment delta can override; a contract test compares that computed union to the tuple so a new override cannot bypass scope isolation. Brand pointers, external palettes, and segment deltas are separate data modules. Locked tokens (§2.4) are not accepted by layer types.
2. **Coverage before fallback**: `composeTheme(theme)` first records the keys supplied by all non-default layers, validates the appropriate must-override set from §2.5 against that record, and only then overlays those layers on `DEFAULTS`. Applying defaults first and checking the final object is forbidden because it masks missing brand data. The internal reset is generated by picking `EXTERNAL_RESET_KEYS` from `DEFAULTS`; it is never hand-maintained.
3. **Generator**: emits the 13-rule, five-layer structure of §3.2 — defaults → brand pointers → internal reset → external palettes → segment deltas, fallback by absence — followed by the commented `[data-theme="dark"]` placeholder (§7.8). The internal reset emits `pick(DEFAULTS, EXTERNAL_RESET_KEYS)`; every external brand rule emits that same default pick overlaid with its source palette; segment deltas remain partial final overrides. Every selector remains separate, including fkab's copied external palette.
4. **Execution**: generation runs in the turbo build task; **generated output is not committed**. The committed, reviewable artifact is a CSS snapshot. Contract tests cover all 16 themes and every outer/inner combination of the 16 themes (**256 nested-scope cases**), asserting computed reset-key values, the inner brand pointer, exactly 13 CSS rule nodes, the terminal dark-placeholder comment, and the per-theme contrast matrix.
5. **Distribution**: a **single `themes.css` entry** containing all 16 permutations (tiny by construction — 13 CSS rules plus one comment), included in both distribution modes ([architecture](architecture.md)). Per-theme file splitting is rejected as premature at this size; size budget → [performance](performance.md).
