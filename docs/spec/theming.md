# Theming

Normative chapter for `@elmeragroup/ui`: the token contract, the cascade mechanism, the complete value matrix for all 16 themes, the theme provider API, and the token pipeline. Sources: [Canonical token contract](../../wayfinder/tickets/001-canonical-token-contract.md) + [ADR 0001](../adr/0001-canonical-token-contract.md), [Theming cascade prototype](../../wayfinder/tickets/002-theming-cascade-prototype.md) + [ADR 0002](../adr/0002-theme-attributes.md), [Brand–segment matrix gaps](../../wayfinder/tickets/004-brand-segment-matrix-gaps.md), [Theme value matrix](../../wayfinder/research/004-theme-value-matrix.md), [Theme provider API](../../wayfinder/tickets/006-theme-provider-api.md) + [ADR 0003](../adr/0003-data-only-theme-provider.md), [Token pipeline](../../wayfinder/tickets/018-token-pipeline.md).

Cross-links: package layout, exports, and where `themes.css` ships → [architecture](architecture.md). Contrast obligations of token pairings (text-grade roles, documented deviations, contrast-matrix snapshot) → [accessibility](accessibility.md) §6. CSS size budget for the emitted theme stylesheet → [performance](performance.md).

## 1 Axes, themes, slugs

- A **theme** is a concrete permutation of three axes:
  - **Variant** — audience axis: `internal` (grayscale theme for internal tools; brand appears only in accents/logos) or `external` (full brand look-and-feel for customer-facing apps).
  - **Brand** — one of five consumer-facing energy brands with fixed four-character codes: Fjordkraft (`fkas`), Trøndelagkraft (`tkas`), Gudbrandsdal Energi (`guen`), Fjordkraft Företag (`fkab`), Fjordkraft Konsument (`fkse`). `fkse` renders under the consumer-facing trade name **Telinet** (logo and palette) while keeping the `fkse` code everywhere in code, slugs, attributes, and types; brand metadata carries `displayName: "Telinet"` (§7.5).
  - **Segment** — customer class: `private` (B2C) or `company` (B2B).
- **Pinned brands**: `fkab` is pinned to `company`; `fkse` is pinned to `private`. The other three brands span both segments. This yields **16 legal themes** at v1 (8 internal, 8 external). Illegal permutations (`*-fkab-private`, `*-fkse-company`) are handled per §6.
- **Theme slug**: the canonical string name of a theme, `<variant>-<brand>-<segment>` — e.g. `internal-fkas-company`, `external-tkas-private`. Slugs are derived, never authoritative: the decomposed axes are the primary representation (§7.1).
- **Dark is not an axis of the theme.** Color scheme (light/dark) is an orthogonal, layered axis reserved on the `data-theme` attribute (§4.5, §7.7). No dark values are specced at v1; the machinery ships functional and valueless.

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

`--brand`/`--brand-foreground` are first-class in every theme: external themes set `--brand` to `--primary`'s value; internal themes keep `--primary` neutral and express brand identity only in `--brand` (and `--sidebar-brand`). The variant axis lives entirely in **values**, never in names — no internal-only tokens exist.

### 2.3 Public primitives

- **Neutral ramp** `--neutral-50` … `--neutral-950` — Tailwind convention (50 lightest → 950 darkest), pure gray (chroma 0). Pure white is `--background`, not a ramp member. The legacy inverted ramp (0 = black) and its warm hue on steps 70–95 are retired.
- **Brand accents** `--brand-<code>` / `--brand-<code>-foreground` for all five brand codes, defined globally at `:root` and never re-themed. Every accent `-foreground` is white `oklch(1 0 0)`.

Values in §5.1.

### 2.4 Locked (library-fixed, not themable)

Derived radii (`--radius-sm/md/lg/xl/popover` as `calc()` off `--radius`, external-style arithmetic), breakpoints, easing (`--ease-overshoot`), the spacing scale, and `--font-mono`. Themes cannot override these; the generator does not accept them.

### 2.5 Defaults + must-override model

The library ships a **complete neutral default layer at `:root`** — every contract token has a value before any theme marker exists. A theme overrides a subset. Brand-defining tokens are **must-override**:

- **External themes must supply**: `--background`/`--foreground`, the card family (`--card`, `--card-foreground`, `--card-soft`, `--card-soft-foreground`), `--primary`/`--primary-foreground`, `--brand`/`--brand-foreground`, the feature triple, `--radius`/`--radius-button`, `--font-sans`/`--font-heading`.
- **Internal themes must supply**: `--brand`/`--brand-foreground` and `--sidebar-brand`/`--sidebar-brand-foreground` (satisfied by the brand-pointer layer plus the default `--sidebar-brand: var(--brand)` alias).
- Statuses, ring, charts, and syntax colors stay shared-by-default; themes *may* override them but none does at v1.

Must-override is enforced at the type level in the token pipeline (§8.2) and re-checked at the CSS level by the theme-contract test.

### 2.6 Legacy bridging: clean break

No HSL-triplet wrappers, no bridge layer. Deliberately dead: `--surface-text`, `--tertiary*` (all forms), `--secondary-variant`, `--inactive`, `--primary-light`, `--sidebar-background`, `--sidebar-primary(-foreground)`, per-brand `--destructive` triplets, `--on-primary-container-muted` (use opacity utilities), the `.ngeas` block. The `--destructive` alias pair is the only compat concession. Migration from OrderModule* names uses the mapping in ADR 0001; no runtime bridge exists.

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

### 3.2 Layer structure — 13 rules cover 16 themes

The emitted theme CSS has exactly five layers:

1. **`:root` defaults** (1 rule) — the complete neutral default layer (§5.1–5.2). This layer *is* the internal look, by design.
2. **Brand pointers** (5 rules) — keyed on brand alone, serving both variants: `[data-theme-brand="<code>"] { --brand: var(--brand-<code>); --brand-foreground: var(--brand-<code>-foreground); }`.
3. **Internal base** (1 rule) — `[data-theme-variant="internal"]`, in practice nearly empty because layer 1 is already the internal grayscale.
4. **External brand palettes** (5 rules) — `[data-theme-variant="external"][data-theme-brand="<code>"]`; fkab's rule carries the fkas value set (permanent alias, §6.1).
5. **Segment deltas** (1 rule) — only where values genuinely differ: `[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` is the sole delta at v1.

Rules grow with **value differences, not permutations**. Adding a brand adds ~2 rules (accent pointer + external palette).

### 3.3 Fallback by absence

Permutations without distinct palettes get **no CSS rule** and resolve from lower layers. `external-tkas-company` and `external-guen-company` inherit their private palettes because no company rule exists — zero fallback CSS is written. The value matrix marks these *(inherits private)* so the gaps stay visible and fillable without restructuring.

### 3.4 Specificity and Tailwind interop

`[data-x="y"]` has class specificity (0,1,0); attribute compounds appear only at genuine axis intersections (layers 4–5), so the layer order above is also cascade order without `!important` or `@layer` tricks. Tailwind v4 `@theme inline` emits `var(--token)` at the use site, so tokens re-resolve per scope under this mechanism — interop is a non-issue.

### 3.5 Scoped subtrees and portals

Markers on any element re-theme that subtree (the OrderModuleWeb per-track `<main>` re-branding pattern). A portal rendered **inside** the themed scope inherits correctly; a portal rendered **outside** silently takes the outer page theme. The mechanism does not and cannot enforce this — portal-inside discipline is owned by the provider API: overlay components take a `container` prop, and docs mandate portalling inside the scope (§7.4).

### 3.6 `data-theme` stays free

None of the three attributes is `data-theme`. That attribute is reserved for the light/dark color-scheme axis, set by `<ColorSchemeScript>` from v1 (§7.7) and given CSS meaning only when dark values land.

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

`[data-theme-variant="internal"]` overrides **nothing beyond the defaults** — the rule is nearly empty because layer 1 *is* the internal look (deliberate). All 8 internal permutations = defaults + brand pointer. Segment has **no internal value axis** (confirmed: no internal segment styling exists in the refs).

### 4.5 Layer 4 — external variant per brand (4 palettes + 1 alias)

Selector: `[data-theme-variant="external"][data-theme-brand="<code>"]`. fkab emits **no own palette**: the generator emits the fkas value set under the fkab selector (or a shared selector) — permanent alias by design, indefinitely.

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
| `--font-heading` | `"Neo Sans", var(--font-sans)` | *(inherit)* | *(inherit)* | *(inherit)* |

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
| `internal-fkas-private` / `-company` | 1 + 2(fkas) | segment axis valueless internally |
| `internal-tkas-private` / `-company` | 1 + 2(tkas) | |
| `internal-guen-private` / `-company` | 1 + 2(guen) | sidebar accent = navy `--brand` on the light sidebar (old dark-sidebar orange retired) |
| `internal-fkab-company` | 1 + 2(fkab→fkas alias) | `internal-fkab-private` is **illegal** (pinned) |
| `internal-fkse-private` | 1 + 2(fkse) | first time fkse has internal accents; `internal-fkse-company` **illegal** |
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

### 7.1 `ThemeProvider`

```tsx
<ThemeProvider theme={{ variant, brand, segment }}>
```

- Input is the **decomposed object** (primary representation); the slug is always derivable. Pure, isomorphic helpers exported: `themeSlug(theme)` and `parseThemeSlug(slug)`.
- Fully controlled context carrier. **No `setTheme`** — switching is host-owned state (docs/Storybook pickers re-render the provider).
- `useTheme()` → `{ variant, brand, segment, slug }`.

### 7.2 `themeAttributes(theme)`

Pure function returning the three `data-theme-*` attributes as a spreadable object. The **headline recipe** is spreading it on `<html>` in the framework's root layout, with the theme sourced from env.

### 7.3 SSR recipes (documentation, not code)

All four reduce to "spread the attributes on your root element, server-side":

1. **Next App Router** — `app/layout.tsx`: `<html {...themeAttributes(theme)}>`.
2. **React Router 7** — `root.tsx` `Layout` component, same spread on `<html>`.
3. **TanStack Start** — root route's document shell, same spread.
4. **Vite SPA** — `%VITE_*%` placeholders in `index.html`, or set the attributes on `document.documentElement` pre-mount (before `createRoot(...).render()`).

No framework needs an inline script or hydration suppression for the brand theme.

### 7.4 `ThemeScope`

Escape hatch for per-request/multi-theme subtrees (the sms-accept per-customer pattern; the docs playground's 16-permutation grid). One component that **fuses** the three data attributes and a nested provider context so CSS and `useTheme()` cannot drift apart.

- Polymorphic via base-ui **`useRender`** (`render` prop + `mergeProps`, default tag `div`). Standing convention: **all library polymorphism uses `useRender`, never an `as` prop**.
- Portal discipline: overlay components take a `container` prop; when overlays open inside a `ThemeScope`, apps **must** portal them inside the scope's element or they silently take the outer theme (§3.5). The docs mandate this recipe wherever `ThemeScope` is shown.

### 7.5 `BRANDS`

Exported record, one entry per brand: `{ code, displayName, segments }`. `fkse` → `displayName: "Telinet"`. `segments` encodes pinning (`fkab: ["company"]`, `fkse: ["private"]`, others both). Logo components live with the icon system, keyed by the same codes.

### 7.6 Types

- `ThemeInput` is a **discriminated union** making `fkab`+`private` and `fkse`+`company` unrepresentable at compile time (discriminate on `brand`; pinned brands narrow `segment` to a literal).
- `validateTheme(input)` covers untyped inputs: dev throw / prod coerce + warn per §6.
- Covered by the public-API type tests ([accessibility](accessibility.md) §8's pattern; testing strategy).

### 7.7 Dark axis: wired, valueless

- `<ColorSchemeScript>` and `useColorScheme()` ship **functional** in v1 — adapted from next-themes' `script.ts` (53 lines, MIT notice retained). The script reads the stored/system preference and sets the reserved **`data-theme`** attribute before first paint; it is the only inline script in the system.
- `ThemeInput` has **no dark field** — color scheme is an orthogonal, layered axis, never part of the brand theme.
- The emitted theme CSS ships a ready-to-go **empty `[data-theme="dark"]`-guarded section** containing only a comment; values land with the dark-mode roadmap item. When they do, nothing about the brand-theme API changes.

## 8 Token pipeline (codegen)

Codegen across the board — hand-authored theme CSS is prohibited. The value matrix in §4 is documentation; **TypeScript is the source of truth**.

1. **Source shape**: **per-theme-layer TS modules** (defaults, brand pointers, internal base, one module per external brand palette, segment deltas), each validated against a contract type whose **required fields are exactly the must-override tokens** (§2.5) — type-level enforcement of the completeness model. Optional fields are the may-override remainder; locked tokens (§2.4) are not in the type at all. Adding brand N+1 = one new file (+2 emitted rules).
2. **Generator**: emits the theme CSS in the 13-rule, five-layer structure of §3.2 — defaults → brand pointers → internal base → external palettes → segment deltas, fallback by absence (a missing layer module emits nothing) — plus the commented-empty `[data-theme="dark"]` section (§7.7).
3. **Execution**: generation runs in the turbo build task; **generated output is not committed**. The committed, reviewable artifact is a **CSS snapshot test** — value changes surface in PR diffs via the snapshot, with no stale-generated-file failure mode. The contract test re-checks must-override completeness at the CSS level, and the per-theme contrast matrix ([accessibility](accessibility.md) §6) is snapshotted alongside.
4. **Distribution**: a **single `themes.css` entry** containing all 16 permutations (tiny by construction — 13 rules), included in both distribution modes ([architecture](architecture.md)). Per-theme file splitting is rejected as premature at this size; size budget → [performance](performance.md).
