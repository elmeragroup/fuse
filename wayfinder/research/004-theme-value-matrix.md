# 004 — Theme value matrix

The final token values for all 16 theme permutations, per the policies resolved in [Brand–segment matrix gaps](../tickets/004-brand-segment-matrix-gaps.md), the contract of [Canonical token contract](../tickets/001-canonical-token-contract.md), and the rule structure of [Theming cascade prototype](../tickets/002-theming-cascade-prototype.md).

**Provenance markers** used throughout:
- `[ref]` — verbatim from a reference codebase (source: [003 token extraction](003-token-values.md))
- `[conv]` — legacy HSL converted to oklch (exact sRGB→OKLab math, this doc §0)
- `[mint]` — minted value, **final** (user decision, no design review pending)
- `[user]` — value supplied directly by the user (new light sidebar)
- *(inherit)* — no rule emitted; the permutation resolves the value from a lower layer (fallback by absence)

## 0. Conversions performed

| Legacy | oklch |
|---|---|
| `hsl(20 5.9% 90%)` (fkas/fkse border) | `oklch(0.9232 0.0026 48.72)` |
| `hsl(214.3 31.8% 91.4%)` (tkas/guen border) | `oklch(0.929 0.0126 255.53)` |
| `hsl(60 4.8% 95.9%)` (fkas/fkse muted) | `oklch(0.97 0.0013 106.42)` |
| `hsl(210 40% 96.1%)` (tkas/guen muted) | `oklch(0.9684 0.0068 247.9)` |

## 1. Library defaults (`:root`) — layer 1, complete

Every token has a value before any theme marker exists. Internal themes are nearly identical to this layer.

### 1.1 Public primitives

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
| `--brand-fkab` | `var(--brand-fkas)` | **permanent alias by design** (user decision — not a gap, no design task) |
| `--brand-fkse` | `oklch(0.4816 0.0908 240.16)` | [mint] — Telinet blue (external fkse `--primary`) |

### 1.2 Role-token defaults

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
| `--sidebar-brand` / `--sidebar-brand-foreground` | `var(--brand)` / `var(--brand-foreground)` | alias — guen's dark-sidebar orange accent (`--brand-guen-sidebar`) is **retired** with the light sidebar |
| `--right-panel` / `--right-panel-foreground` | `oklch(0.9851 0 0)` / `oklch(0.1448 0 0)` | [ref] internal |
| `--chart-1..8` | `oklch(0.289 0.0518 217.7)`, `oklch(0.3629 0.0619 204.44)`, `oklch(0.4322 0.0777 181.31)`, `oklch(0.4933 0.1113 160.18)`, `oklch(0.5623 0.139 143.03)`, `oklch(0.6348 0.1494 124.51)`, `oklch(0.714 0.1487 100.58)`, `oklch(0.7945 0.1709 71.19)` | [ref] internal teal→amber |
| `--sh-identifier/keyword/string/class/property/entity/jsxliterals/sign/comment` | `#5c6773`, `#ff7733`, `#86b300`, `#a37acc`, `#36a3d9`, `#f29718`, `#4cbf99`, `#ed9366`, `#abb0b6` | [ref] Ayu Light |
| `--radius` / `--radius-button` | `0.375rem` / `0.375rem` | [ref] internal |
| `--font-sans` | `Roboto, ui-sans-serif, system-ui, sans-serif` | [ref] |
| `--font-heading` | `var(--font-sans)` | fallback semantics |

## 2. Brand pointers — layer 2 (5 rules, both variants)

`[data-theme-brand="<code>"] { --brand: var(--brand-<code>); --brand-foreground: var(--brand-<code>-foreground); }` for each of fkas, tkas, guen, fkab, fkse.

## 3. Internal variant — layer 3 (1 rule)

`[data-theme-variant="internal"]` overrides **nothing beyond the defaults** except confirming the grayscale identity — in practice the internal rule is nearly empty because layer 1 *is* the internal look (that was deliberate). All 8 internal permutations = defaults + brand pointer. Segment has **no internal value axis** (confirmed: no internal segment styling exists in the refs).

## 4. External variant per brand — layer 4 (4 palettes + 1 alias)

`[data-theme-variant="external"][data-theme-brand="<code>"]`. fkab emits **no own palette**: it is a permanent alias — the generator emits the fkas value set under the fkab selector (or a shared selector), by design, indefinitely.

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

All `[ref]` unless marked. “= X value” means the same literal is repeated (no `var()` indirection — the ref’s value-coincidences made explicit as duplicated literals, per the contract’s no-eager-binding rule; a generator may deduplicate at its source level).

## 5. Segment delta — layer 5 (exactly 1 rule)

`[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]` (the ref’s `.fkas-c`):

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

(The ref’s missing `--inactive` in `.fkas-c` is moot — `--inactive` is dead in the contract.)

## 6. Composition matrix — how each of the 16 permutations resolves

| Theme slug | Layers applied | Notes |
|---|---|---|
| `internal-fkas-private` / `-company` | 1 + 2(fkas) | segment axis valueless internally |
| `internal-tkas-private` / `-company` | 1 + 2(tkas) | |
| `internal-guen-private` / `-company` | 1 + 2(guen) | sidebar accent = navy `--brand` on the light sidebar (old dark-sidebar orange retired) |
| `internal-fkab-company` | 1 + 2(fkab→fkas alias) | `internal-fkab-private` is **illegal** (pinned) |
| `internal-fkse-private` | 1 + 2(fkse) | first time fkse has internal accents at all | `internal-fkse-company` **illegal** |
| `external-fkas-private` | 1 + 2(fkas) + 4(fkas) | |
| `external-fkas-company` | 1 + 2(fkas) + 4(fkas) + 5 | the only segment delta |
| `external-tkas-private` / `-company` | 1 + 2(tkas) + 4(tkas) | company *(inherits private — no rule)* |
| `external-guen-private` / `-company` | 1 + 2(guen) + 4(guen) | company *(inherits private — no rule)* |
| `external-fkab-company` | 1 + 2(fkab) + 4(fkas values) | permanent alias by design |
| `external-fkse-private` | 1 + 2(fkse) + 4(fkse) | renders as Telinet (displayName + logo) |

Illegal permutations (`*-fkab-private`, `*-fkse-company`): TS type-error at the provider, dev-mode throw, production coerce-to-pinned-segment with console warning. CSS remains best-effort.
