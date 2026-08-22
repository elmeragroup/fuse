# 003 — Token value extraction

Answers ticket `wayfinder/tickets/003-token-value-extraction.md`: the actual token values available today for every brand/segment permutation, and where the gaps are.

## Sources

| Source                             | Path                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| External brand palettes            | `.ref/OrderModuleWeb/packages/ui/src/styles/brands.css`                                                                                                                              |
| External Tailwind theme mapping    | `.ref/OrderModuleWeb/packages/ui/src/styles/ui.css`                                                                                                                                  |
| Internal theme (all-in-one)        | `.ref/OrderModuleInternalWeb/packages/ui/src/styles/ui.css`                                                                                                                          |
| External app fonts                 | `.ref/OrderModuleWeb/apps/web-sales-module/lib/font/font.ts`                                                                                                                         |
| External Storybook fonts           | `.ref/OrderModuleWeb/apps/storybook/.storybook/fonts.ts`                                                                                                                             |
| Internal app fonts                 | `.ref/OrderModuleInternalWeb/apps/web-stormwind/app/(app)/layout.tsx`, `app/(auth)/layout.tsx`                                                                                       |
| Theme-class application (external) | `.ref/OrderModuleWeb/apps/web-sales-module/app/[lang]/layout.tsx`, `app/[lang]/sms-accept/[hashedCustomerId]/layout.tsx`, `.ref/OrderModuleWeb/apps/storybook/.storybook/preview.ts` |
| Theme-class application (internal) | `.ref/OrderModuleInternalWeb/apps/web-stormwind/app/(app)/layout.tsx`                                                                                                                |

All paths below are relative to `/Users/tommy.lunde.barvag/src/work/elmera/ui/` unless absolute.

---

## 1. External palettes (`brands.css`)

Brand blocks present: `.fkas` (L1–55), `.fkas-c` (L57–105), `.tkas` (L107–162), `.guen` (L164–215), `.guen-dark` (L217–266, media-gated), `.ngeas` (L268–311, legacy), `.fkse` (L313–367). Shared status block L369–398.

### 1.1 "New colors" (design-guide) matrix — light brands

All values verbatim oklch. `white` = `oklch(100% 0 0)`.

| Variable                       | `.fkas`                         | `.fkas-c`                       | `.tkas`                         | `.guen`                         | `.fkse`                         |
| ------------------------------ | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `--surface`                    | `oklch(96.042% 0.0214 46.99)`   | `oklch(98.23% 0.01428 213.1)`   | `oklch(97.902% 0.02928 188.87)` | `oklch(95.469% 0.01887 279.53)` | `oklch(98.014% 0.01729 210.19)` |
| `--surface-bright`             | `oklch(98.095% 0.01088 54.5)`   | `oklch(99.011% 0.0069 219.56)`  | `oklch(98.982% 0.01388 185.97)` | `oklch(99.199% 0.00734 80.72)`  | `oklch(99.007% 0.00865 210.19)` |
| `--on-surface`                 | `oklch(32.09% 0.10325 38.8)`    | `oklch(30.579% 0.03693 215.45)` | `oklch(30.407% 0.05238 190.82)` | `oklch(19.922% 0.12072 268.2)`  | `oklch(36.735% 0.09417 249.17)` |
| `--on-surface-muted`           | same as `--on-surface` `/ 0.7`  | same `/ 0.7`                    | same `/ 0.7`                    | same `/ 0.7`                    | same `/ 0.7`                    |
| `--surface-variant`            | `oklch(57.866% 0.19387 36.96)`  | `oklch(55.738% 0.06979 216.27)` | `oklch(55.688% 0.09585 191.06)` | `oklch(57.814% 0.22881 270.38)` | `oklch(56.873% 0.09344 229.37)` |
| `--surface-variant-bright`     | `oklch(74.389% 0.16389 43.68)`  | `oklch(78.71% 0.0657 225.82)`   | `oklch(77.279% 0.10225 190.47)` | `oklch(70.68% 0.1522 275.6)`    | `oklch(77.836% 0.11783 206.21)` |
| `--on-surface-variant`         | `oklch(80.097% 0.10434 49.42)`  | `oklch(90.856% 0.05958 225.03)` | `oklch(90.178% 0.09399 190.62)` | `oklch(84.919% 0.07412 279.64)` | `oklch(90.492% 0.09477 206.46)` |
| `--surface-text`               | `oklch(26.617% 0.00344 164.8)`  | `oklch(26.617% 0.00344 164.8)`  | `oklch(26.617% 0.00344 164.8)`  | `oklch(23.69% 0.05649 271.31)`  | `oklch(26.595% 0.00475 219.65)` |
| `--primary`                    | `oklch(48.48% 0.16637 35.92)`   | `oklch(47.471% 0.07313 217.18)` | `oklch(47.316% 0.08165 190.23)` | `oklch(48.63% 0.25238 271.95)`  | `oklch(48.158% 0.09084 240.16)` |
| `--on-primary`                 | white                           | white                           | white                           | white                           | white                           |
| `--primary-container`          | white                           | white                           | white                           | white                           | white                           |
| `--on-primary-container`       | `oklch(23.274% 0.07506 38.69)`  | `oklch(25.285% 0.03792 212.52)` | `oklch(22.003% 0.0378 191.8)`   | `oklch(14.028% 0.08604 266.38)` | `oklch(22.503% 0.06011 247.68)` |
| `--on-primary-container-muted` | same `/ 0.8`                    | same `/ 0.8`                    | same `/ 0.8`                    | same `/ 0.8`                    | same `/ 0.8`                    |
| `--secondary`                  | `oklch(32.09% 0.10325 38.8)`    | `oklch(30.579% 0.03693 215.45)` | `oklch(30.407% 0.05238 190.82)` | `oklch(19.922% 0.12072 268.2)`  | `oklch(36.735% 0.09417 249.17)` |
| `--on-secondary`               | white                           | white                           | white                           | white                           | white                           |
| `--secondary-container`        | `oklch(88.61% 0.05413 50.48)`   | `oklch(95.328% 0.03401 215.01)` | `oklch(94.764% 0.07736 190.94)` | `oklch(88.401% 0.04497 277.34)` | `oklch(93.68% 0.04194 223.32)`  |
| `--on-secondary-container`     | = `--secondary`                 | = `--secondary`                 | = `--secondary`                 | = `--secondary`                 | = `--secondary`                 |
| `--secondary-variant`          | `oklch(23.274% 0.07506 38.69)`  | `oklch(25.285% 0.03792 212.52)` | `oklch(22.003% 0.0378 191.8)`   | `oklch(14.028% 0.08604 266.38)` | `oklch(22.503% 0.06011 247.68)` |
| `--tertiary`                   | = `--secondary-variant`         | = `--secondary-variant`         | = `--secondary-variant`         | = `--secondary-variant`         | = `--secondary-variant`         |
| `--on-tertiary`                | white                           | white                           | white                           | white                           | white                           |
| `--tertiary-container`         | = `--tertiary`                  | = `--tertiary`                  | = `--tertiary`                  | = `--tertiary`                  | = `--tertiary`                  |
| `--on-tertiary-container`      | white                           | white                           | white                           | white                           | white                           |
| `--ring`                       | `oklch(48.444% 0.20509 296.29)` | same                            | same                            | same                            | same                            |

Structural patterns worth noting for the future contract (values are literals in the file; the "=" relations above are _coincidences of value_, not `var()` references):

- Each brand has effectively 3 anchor tones: primary (~48% L), secondary/on-surface (~30% L, guen ~20%), and a darkest tone (~22–25% L, guen ~14%) reused for `--on-primary-container`, `--secondary-variant`, `--tertiary`, `--tertiary-container`.
- `--ring` is the identical violet `oklch(48.444% 0.20509 296.29)` in every external brand — a brand-independent focus color.

### 1.2 `.guen-dark` (brands.css L217–266)

Wrapped in `@media (prefers-color-scheme: dark)` and sets `color-scheme: dark`. Values are 8-digit hex (alpha suffix), not oklch:

| Variable                       | Value                           |
| ------------------------------ | ------------------------------- |
| `--surface`                    | `#0E1128`                       |
| `--surface-bright`             | `#151C39`                       |
| `--on-surface`                 | `#EDEFFDFF`                     |
| `--on-surface-muted`           | `#EDEFFDB3`                     |
| `--surface-variant`            | `#4B64FEFF`                     |
| `--surface-variant-bright`     | `#4B64FEFF`                     |
| `--on-surface-variant`         | `#000087FF`                     |
| `--surface-text`               | `#FFFFFFFF`                     |
| `--primary`                    | `#C3C9FEFF`                     |
| `--on-primary`                 | `#000000FF`                     |
| `--primary-container`          | `#151C39`                       |
| `--on-primary-container`       | `#EDEFFDFF`                     |
| `--on-primary-container-muted` | `#EDEFFDCC`                     |
| `--secondary`                  | `#EDEFFDFF`                     |
| `--on-secondary`               | `#000000FF`                     |
| `--secondary-container`        | `#151C39`                       |
| `--on-secondary-container`     | `#EDEFFDFF`                     |
| `--secondary-variant`          | `#FFFFFFFF`                     |
| `--tertiary`                   | `#05054BFF`                     |
| `--on-tertiary`                | `#FFB465FF`                     |
| `--tertiary-container`         | `#3A3AEAFF`                     |
| `--on-tertiary-container`      | `#FFFFFFFF`                     |
| `--ring`                       | `oklch(48.444% 0.20509 296.29)` |

Dark status overrides (L249–264, "Status containers stay light in the shared brand tokens; override for dark"):

| Variable                 | Value                 |
| ------------------------ | --------------------- |
| `--error`                | `oklch(75% 0.12 30)`  |
| `--error-container`      | `oklch(28% 0.05 30)`  |
| `--on-error-container`   | `oklch(90% 0.03 30)`  |
| `--info`                 | `oklch(75% 0.08 264)` |
| `--info-container`       | `oklch(28% 0.04 264)` |
| `--on-info-container`    | `oklch(90% 0.02 264)` |
| `--success`              | `oklch(75% 0.1 145)`  |
| `--success-container`    | `oklch(28% 0.04 145)` |
| `--on-success-container` | `oklch(90% 0.03 145)` |
| `--warning`              | `oklch(78% 0.1 75)`   |
| `--warning-container`    | `oklch(28% 0.04 75)`  |
| `--on-warning-container` | `oklch(90% 0.03 75)`  |

It does **not** define `--on-error` / `--on-info` / `--on-success` / `--on-warning` (those stay white from the shared block), nor any legacy triplets, nor radii (radii inherit from wherever `--radius`/`--radius-button` is otherwise set — `.guen-dark` alone provides none).

### 1.3 Legacy HSL-triplet tokens per brand (consumed via `hsl(var(--x))` in `ui.css`)

Marked in-file: "Legacy Tailwind tokens not part of the design guide. Keep while older utilities still reference them."

| Variable                          | `.fkas` (L35–52) | `.fkas-c` (L87–101) | `.tkas` (L140–158)               | `.guen` (L195–211)          | `.fkse` (L347–363) |
| --------------------------------- | ---------------- | ------------------- | -------------------------------- | --------------------------- | ------------------ |
| `--muted`                         | `60 4.8% 95.9%`  | `60 4.8% 95.9%`     | `210 40% 96.1%`                  | `210 40% 96.1%`             | `60 4.8% 95.9%`    |
| `--muted-foreground`              | `25 5.3% 44.7%`  | `25 5.3% 44.7%`     | `215.4 16.3% 46.9%`              | `215.4 16.3% 46.9%`         | `25 5.3% 44.7%`    |
| `--inactive`                      | `0 0% 85%`       | — **missing**       | `0 0% 85%`                       | `0 0% 85%`                  | `0 0% 85%`         |
| `--popover`                       | `0 0% 100%`      | `0 0% 100%`         | `0 0% 100%`                      | `0 0% 100%`                 | `0 0% 100%`        |
| `--popover-foreground`            | `20 14.3% 4.1%`  | `20 14.3% 4.1%`     | `222.2 84% 4.9%`                 | `222.2 84% 4.9%`            | `20 14.3% 4.1%`    |
| `--border`                        | `20 5.9% 90%`    | `20 5.9% 90%`       | `214.3 31.8% 91.4%`              | `214.3 31.8% 91.4%`         | `20 5.9% 90%`      |
| `--primary-light`                 | —                | —                   | `178 100% 21%` (tkas-only, L150) | —                           | —                  |
| `--accent`                        | `60 4.8% 95.9%`  | `60 4.8% 95.9%`     | `210 40% 96.1%`                  | `222.2 47.4% 11.2%` (dark!) | `60 4.8% 95.9%`    |
| `--accent-foreground`             | `24 9.8% 10%`    | `24 9.8% 10%`       | `222.2 47.4% 11.2%`              | `210 40% 96.1%` (light!)    | `24 9.8% 10%`      |
| `--success-foreground`            | `0 0% 100%`      | `0 0% 100%`         | `0 0% 100%`                      | `0 0% 100%`                 | `0 0% 100%`        |
| `--destructive` (dead)            | `0 84.2% 60.2%`  | `0 84.2% 60.2%`     | `0 84.2% 60.2%`                  | `0 84.2% 60.2%`             | `0 84.2% 60.2%`    |
| `--destructive-foreground` (dead) | `60 9.1% 97.8%`  | `60 9.1% 97.8%`     | `210 40% 98%`                    | `210 40% 98%`               | `60 9.1% 97.8%`    |

### 1.4 Radii per external brand

| Variable          | `.fkas` (L53–54) | `.fkas-c` (L103–104) | `.tkas` (L160–161) | `.guen` (L213–214) | `.guen-dark` | `.ngeas` (L309–310) | `.fkse` (L365–366) |
| ----------------- | ---------------- | -------------------- | ------------------ | ------------------ | ------------ | ------------------- | ------------------ |
| `--radius`        | `0.75rem`        | `0.75rem`            | `0.95rem`          | `0.5rem`           | — (none)     | `0.5rem`            | `0.75rem`          |
| `--radius-button` | `1.8125rem`      | `1.8125rem`          | `0.95rem`          | `0.5rem`           | — (none)     | `0.5rem`            | `1.8125rem`        |

Derived in external `ui.css` `@theme inline` (L92–97): `--radius-xl = radius + 4px`, `--radius-lg = radius`, `--radius-md = radius − 2px`, `--radius-sm = radius − 4px`, `--radius-popover = radius − 8px`, `--radius-button = var(--radius-button)` (self-referential mapping).

### 1.5 Shared status block (brands.css L369–398)

Applied to `.fkas, .fkas-c, .tkas, .guen, .guen-dark, .ngeas, .fkse` — one set of values for **all** external brands (guen-dark then overrides containers under the dark media query, §1.2):

| Variable                   | Value                           |
| -------------------------- | ------------------------------- |
| `--error`                  | `oklch(45.262% 0.17845 30.42)`  |
| `--on-error`               | `oklch(100% 0 0)`               |
| `--error-container`        | `oklch(93.52% 0.02195 14.08)`   |
| `--on-error-container`     | `var(--error)`                  |
| `--info`                   | `oklch(39.999% 0.09979 263.74)` |
| `--on-info`                | `oklch(100% 0 0)`               |
| `--info-container`         | `oklch(93.153% 0.02014 233.86)` |
| `--on-info-container`      | `var(--info)`                   |
| `--success`                | `oklch(42.774% 0.13765 144.24)` |
| `--on-success`             | `oklch(100% 0 0)`               |
| `--success-container`      | `oklch(93.464% 0.02761 150.41)` |
| `--on-success-container`   | `var(--success)`                |
| `--warning`                | `oklch(46.804% 0.10443 65.71)`  |
| `--on-warning`             | `oklch(100% 0 0)`               |
| `--warning-container`      | `oklch(93.486% 0.04795 81.5)`   |
| `--on-warning-container`   | `var(--warning)`                |
| `--destructive`            | `var(--error)`                  |
| `--destructive-foreground` | `var(--on-error)`               |

This block appears _after_ all brand blocks at equal (single-class) specificity, so its `--destructive: var(--error)` **overrides every per-brand legacy `--destructive` triplet** (see Gaps §4).

### 1.6 `.ngeas` legacy block (brands.css L268–311) — out of scope, recorded

Pure shadcn-era block, no "new colors". Mixed formats:

| Variable                                     | Value                                                           |
| -------------------------------------------- | --------------------------------------------------------------- |
| `--background` / `--foreground`              | `0 0% 100%` / `224 71.4% 4.1%`                                  |
| `--muted` / `--muted-foreground`             | `220 14.3% 95.9%` / `220 8.9% 46.1%`                            |
| `--popover` / `--popover-foreground`         | `0 0% 100%` / `224 71.4% 4.1%`                                  |
| `--card` / `--card-foreground`               | `0 0% 100%` / `224 71.4% 4.1%`                                  |
| `--border` / `--input`                       | `220 13% 91%` / `220 13% 91%`                                   |
| `--primary` / `--primary-foreground`         | `262.1 83.3% 57.8%` / `210 20% 98%`                             |
| `--secondary` / `--secondary-foreground`     | `220 14.3% 95.9%` / `220.9 39.3% 11%`                           |
| `--accent` / `--accent-foreground`           | `220 14.3% 95.9%` / `220.9 39.3% 11%`                           |
| `--success` / `--success-foreground`         | `142 71% 31%` / `0 0% 100%`                                     |
| `--info` / `--on-info`                       | `oklch(40% 0.1 263.74)` / `oklch(100% 0 0)`                     |
| `--info-container`                           | `oklch(98.31% 0.008 278.64)`                                    |
| `--success-container`                        | `oklch(96.51% 0.0034 145.55)`                                   |
| `--warning-container`                        | `oklch(95.86% 0.0272 63.96)`                                    |
| `--error-container`                          | `oklch(98.4% 0.008 36.55)`                                      |
| `--destructive` / `--destructive-foreground` | `0 84.2% 60.2%` / `210 20% 98%` (dead, see §1.5)                |
| `--ring`                                     | `hsl(262.1 83.3% 57.8%)` — full `hsl()` function, unique format |
| `--radius` / `--radius-button`               | `0.5rem` / `0.5rem`                                             |

`.ngeas` is also included in the shared status block selector (L374), so its own `--info`/`--success`/`--destructive`/containers are all overridden by L376–397 — the whole block is effectively dead except `--background`, `--foreground`, `--card*`, `--input`, `--primary*`, `--secondary*`, `--accent*`, `--muted*`, `--popover*`, `--border`, `--ring`, radii.

### 1.7 External Tailwind mapping quirks (`OrderModuleWeb/packages/ui/src/styles/ui.css`)

- New-color tokens map 1:1 as raw values (`--color-surface: var(--surface)` etc., L21–63). Fallback chains: `--color-surface-variant-bright: var(--surface-variant-bright, var(--surface-variant))` (L26), `--color-secondary-variant: var(--secondary-variant, var(--secondary))` (L37), `--color-tertiary-container: var(--tertiary-container, var(--tertiary))` (L43), `--color-on-tertiary-container: var(--on-tertiary-container, var(--on-tertiary))` (L44).
- Legacy tokens are wrapped: `--color-muted: hsl(var(--muted))` etc. (L67–80) — this is why legacy vars are bare HSL triplets.
- `--color-destructive: var(--error)`, `--color-destructive-foreground: var(--on-error)` (L82–83) — destructive is hard-aliased to error at the Tailwind layer too.
- `--color-primary-light: hsl(var(--primary-light))` (L77) exists in the contract but only tkas supplies a value.
- Font tokens: `--font-family-sans: var(--font-primary), ui-sans-serif, …` (L12–14); `--font-family-heading: var(--font-heading), var(--font-primary), …` (L15–17); plus a self-referential `--font-heading: var(--font-heading)` (L18).
- Breakpoints `--breakpoint-xs: 574px`, `--breakpoint-lg: 60rem` (L89–90).

---

## 2. Internal theme (`OrderModuleInternalWeb/packages/ui/src/styles/ui.css`)

Internal is a grayscale (neutral) theme; brand shows up only via `--brand` accents. Semantically it is shadcn-shaped (`background/foreground/card/...`), **not** the external `surface/on-surface` shape.

### 2.1 `:root` brand accent variables (L95–108)

| Variable                    | Value                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--brand-fkas`              | `oklch(0.68 0.21747 38.8022)`                                                                                                   |
| `--brand-fkas-foreground`   | `oklch(1 0 0)`                                                                                                                  |
| `--brand-tkas`              | `oklch(0.86 0.1035 191.11)`                                                                                                     |
| `--brand-tkas-foreground`   | `oklch(1 0 0)`                                                                                                                  |
| `--brand-guen`              | `oklch(0.21 0.0399 265.73)`                                                                                                     |
| `--brand-guen-foreground`   | `oklch(1 0 0)`                                                                                                                  |
| `--brand-guen-sidebar`      | `oklch(0.67 0.1876 45.95)` — distinct orange so the segment-switcher label stays legible on the dark sidebar (comment L101–102) |
| `--brand-fkab`              | `oklch(0.68 0.21747 38.8022)` — **identical to `--brand-fkas`**                                                                 |
| `--brand-fkab-foreground`   | `oklch(1 0 0)`                                                                                                                  |
| `--brand-steddi`            | `oklch(0.27 0.1495 291.63)`                                                                                                     |
| `--brand-steddi-foreground` | `oklch(1 0 0)`                                                                                                                  |
| `--brand-steddi-background` | `oklch(1 0 0)`                                                                                                                  |

No `--brand-fkse` and no `--brand-ngef` exist, despite `.v2.fkse` / `.v2.ngef` selectors (L307, L311).

### 2.2 `:root` neutral scale (L128–139)

Naming is **inverted** relative to Tailwind convention: `--neutral-0` is near-black, `--neutral-100` is white.

| Var            | Value                          | Var             | Value                      |
| -------------- | ------------------------------ | --------------- | -------------------------- |
| `--neutral-0`  | `oklch(0.16 0 0)`              | `--neutral-60`  | `oklch(0.66 0 0)`          |
| `--neutral-10` | `oklch(0.23 0.00171 197.0363)` | `--neutral-70`  | `oklch(0.74 0.0019 17.2)`  |
| `--neutral-20` | `oklch(0.31 0.0017 286.3)`     | `--neutral-80`  | `oklch(0.83 0.0025 17.21)` |
| `--neutral-30` | `oklch(0.4 0.0019 197.08)`     | `--neutral-90`  | `oklch(0.91 0.0024 17.2)`  |
| `--neutral-40` | `oklch(0.48 0 0)`              | `--neutral-95`  | `oklch(0.96 0.0019 17.19)` |
| `--neutral-50` | `oklch(0.57 0 0)`              | `--neutral-100` | `oklch(1 0 0)`             |

### 2.3 `:root` semantic defaults (L141–212)

| Variable                                                  | Value                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background` / `--foreground`                           | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                                                                                                                  |
| `--muted` / `--muted-foreground`                          | `oklch(0.97 0.0013 106.42)` / `oklch(0.55 0.0117 58.07)`                                                                                                                                                                                                                                                                                     |
| `--card` / `--card-foreground`                            | `oklch(1 0 0)` / `oklch(0.15 0.0041 49.31)`                                                                                                                                                                                                                                                                                                  |
| `--popover` / `--popover-foreground`                      | `var(--card)` / `var(--card-foreground)` (L149–150; eager-binding caveat commented at L147 and L226–228)                                                                                                                                                                                                                                     |
| `--border` / `--input`                                    | `oklch(0.92 0.0026 48.72)` / same                                                                                                                                                                                                                                                                                                            |
| `--primary` / `--primary-foreground`                      | `var(--neutral-0)` / `var(--neutral-100)`                                                                                                                                                                                                                                                                                                    |
| `--secondary` / `--secondary-foreground`                  | `oklch(0.97 0.0013 106.42)` / `oklch(0.22 0.0061 56.04)`                                                                                                                                                                                                                                                                                     |
| `--brand` / `--brand-foreground`                          | first set literally `oklch(0.68 0.21747 38.8022)` / `oklch(1 0 0)` (L156–157), then **re-declared** as `var(--brand-fkas)` / `var(--brand-fkas-foreground)` (L172–173)                                                                                                                                                                       |
| `--accent` / `--accent-foreground`                        | `oklch(0.97 0.0013 106.42)` / `oklch(0.22 0.0061 56.04)`                                                                                                                                                                                                                                                                                     |
| `--success` / `--success-foreground`                      | `oklch(0.5273 0.1371 150.09)` / `oklch(1 0 0)`                                                                                                                                                                                                                                                                                               |
| `--destructive` / `--destructive-foreground`              | `oklch(0.4815 0.1975 29.23)` / `oklch(1 0 0)`                                                                                                                                                                                                                                                                                                |
| `--warning` / `--warning-foreground` / `--warning-accent` | `oklch(0.9586 0.0271 63.9)` / `oklch(0.2662 0.0034 165.35)` / `oklch(0.662 0.1366 68.98)`                                                                                                                                                                                                                                                    |
| `--info` / `--info-foreground`                            | `oklch(0.623 0.214 259.8)` / `oklch(0.488 0.243 264.4)`                                                                                                                                                                                                                                                                                      |
| `--radius` / `--radius-button`                            | `0.375rem` / `0.375rem`                                                                                                                                                                                                                                                                                                                      |
| `--sidebar-brand` / `--sidebar-brand-foreground`          | `var(--brand-fkas)` / `var(--brand-fkas-foreground)` (L174–175)                                                                                                                                                                                                                                                                              |
| `--steddi` / `--steddi-foreground`                        | `var(--brand-steddi)` / `var(--brand-steddi-foreground)` (L177–178)                                                                                                                                                                                                                                                                          |
| `--sidebar-foreground`                                    | `oklch(1 0 0)` (L179) then **re-declared** `var(--neutral-100)` (L183)                                                                                                                                                                                                                                                                       |
| `--sidebar` / `--sidebar-background`                      | `var(--neutral-0)` / `var(--neutral-10)`                                                                                                                                                                                                                                                                                                     |
| `--sidebar-primary` / `--sidebar-primary-foreground`      | `var(--neutral-100)` / `var(--neutral-0)`                                                                                                                                                                                                                                                                                                    |
| `--sidebar-accent` / `--sidebar-accent-foreground`        | `var(--neutral-30)` / `var(--neutral-100)`                                                                                                                                                                                                                                                                                                   |
| `--sidebar-border` / `--sidebar-ring`                     | `var(--neutral-30)` / `var(--neutral-30)`                                                                                                                                                                                                                                                                                                    |
| `--right-panel` / `--right-panel-foreground`              | `oklch(0.9851 0 0)` / `oklch(0.1448 0 0)`                                                                                                                                                                                                                                                                                                    |
| `--chart-1..8`                                            | `oklch(0.289 0.0518 217.7)` `#00313c`, `oklch(0.3629 0.0619 204.44)` `#00474d`, `oklch(0.4322 0.0777 181.31)` `#005e53`, `oklch(0.4933 0.1113 160.18)` `#00744b`, `oklch(0.5623 0.139 143.03)` `#3b8939`, `oklch(0.6348 0.1494 124.51)` `#77991b`, `oklch(0.714 0.1487 100.58)` `#b8a400`, `oklch(0.7945 0.1709 71.19)` `#ffa600` (L194–201) |
| `--sh-*` (sugar-high syntax colors, Ayu Light)            | `--sh-identifier #5c6773`, `--sh-keyword #ff7733`, `--sh-string #86b300`, `--sh-class #a37acc`, `--sh-property #36a3d9`, `--sh-entity #f29718`, `--sh-jsxliterals #4cbf99`, `--sh-sign #ed9366`, `--sh-comment #abb0b6` (L204–212)                                                                                                           |

A commented-out shadcn default block sits at L110–126 (dead).

### 2.4 `.dark, .inverted` overrides (L215–258)

| Variable                                                  | Value                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--background` / `--foreground`                           | `var(--neutral-0)` / `var(--neutral-100)`                                                                                 |
| `--muted` / `--muted-foreground`                          | `var(--neutral-10)` / `var(--neutral-95)`                                                                                 |
| `--card` / `--card-foreground`                            | `var(--neutral-0)` / `var(--neutral-100)`                                                                                 |
| `--popover` / `--popover-foreground`                      | re-issued `var(--card)` / `var(--card-foreground)` (L229–230, comment L226–228 explains the eager-binding bug this fixes) |
| `--border` / `--input`                                    | `var(--neutral-50)` / `var(--neutral-50)`                                                                                 |
| `--primary` / `--primary-foreground`                      | `var(--neutral-100)` / `var(--neutral-0)`                                                                                 |
| `--secondary` / `--secondary-foreground`                  | `var(--neutral-0)` / `var(--neutral-100)`                                                                                 |
| `--accent` / `--accent-foreground`                        | `var(--neutral-0)` / `var(--neutral-95)`                                                                                  |
| `--success` / `--success-foreground`                      | `oklch(0.74 0.192 149.49)` / `oklch(1 0 0)`                                                                               |
| `--destructive` / `--destructive-foreground`              | `oklch(0.74 0.2078 25.33)` / `oklch(1 0 0)`                                                                               |
| `--warning` / `--warning-foreground` / `--warning-accent` | `oklch(0.25 0.03 64)` / `oklch(0.95 0.01 64)` / `oklch(0.76 0.14 69)`                                                     |
| `--ring`                                                  | `var(--neutral-100)`                                                                                                      |
| `--radius` / `--radius-button`                            | `0.375rem` / `0.375rem`                                                                                                   |

### 2.5 Internal per-brand blocks (L260–303)

| Variable                                         | `.fkas` (L260–269)         | `.tkas` (L271–280)         | `.guen` (L282–291)                                           | `.fkab` (L293–296)       | `.steddi` (L298–303)                                     |
| ------------------------------------------------ | -------------------------- | -------------------------- | ------------------------------------------------------------ | ------------------------ | -------------------------------------------------------- |
| `--background`                                   | `oklch(1 0 0)`             | `oklch(1 0 0)`             | `oklch(1 0 0)`                                               | —                        | `var(--brand-steddi-background)`                         |
| `--foreground`                                   | `oklch(0.15 0.0041 49.31)` | `oklch(0.14 0.036 258.53)` | `oklch(0.14 0.036 258.53)`                                   | —                        | —                                                        |
| `--primary` / `--primary-foreground`             | `var(--brand-fkas)` / fg   | `var(--brand-tkas)` / fg   | `var(--brand-guen)` / fg                                     | —                        | `var(--brand-steddi)` / —                                |
| `--brand` / `--brand-foreground`                 | `var(--brand-fkas)` / fg   | `var(--brand-tkas)` / fg   | `var(--brand-guen)` / fg                                     | `var(--brand-fkab)` / fg | —                                                        |
| `--sidebar-brand` / `--sidebar-brand-foreground` | `var(--brand-fkas)` / fg   | `var(--brand-tkas)` / fg   | `var(--brand-guen-sidebar)` / `var(--brand-guen-foreground)` | —                        | `var(--brand-steddi)` / `var(--brand-steddi-foreground)` |

There is **no internal `.fkse` block** and no `.ngef` block.

### 2.6 `.v2` grayscale block (L305–348)

Selector: `.v2, .v2.fkas, .v2.fkse, .v2.tkas, .v2.guen, .v2.fkab, .v2.ngef, .fkab` — note bare `.fkab` is in the list, and `.v2.steddi` is **not**.

| Variable                                                      | Value                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `--background` / `--foreground`                               | `var(--neutral-100)` / `var(--neutral-0)`                       |
| `--muted` / `--muted-foreground`                              | `oklch(97.02% 0 0)` / `oklch(55.55% 0 0)`                       |
| `--card` / `--card-foreground`                                | `var(--neutral-100)` / `var(--neutral-0)`                       |
| `--border` / `--input`                                        | `oklch(86.99% 0 0)` / `oklch(86.99% 0 0)`                       |
| `--primary` / `--primary-foreground`                          | `var(--neutral-0)` / `var(--neutral-100)`                       |
| `--secondary` / `--secondary-foreground`                      | `var(--neutral-100)` / `var(--neutral-0)`                       |
| `--accent` / `--accent-foreground`                            | `var(--neutral-95)` / `var(--neutral-0)`                        |
| `--ring`                                                      | `var(--neutral-0)`                                              |
| `--radius` / `--radius-button`                                | `0.375rem` / `0.375rem`                                         |
| `--sidebar` / `--sidebar-background` / `--sidebar-foreground` | `var(--neutral-0)` / `var(--neutral-10)` / `var(--neutral-100)` |
| `--sidebar-primary` / `--sidebar-primary-foreground`          | `var(--neutral-100)` / `var(--neutral-0)`                       |
| `--sidebar-accent` / `--sidebar-accent-foreground`            | `var(--neutral-30)` / `var(--neutral-100)`                      |
| `--sidebar-border` / `--sidebar-ring`                         | `var(--neutral-30)` / `var(--neutral-30)`                       |

Cascade effect: the app always puts `v2` + brand class on `<html>` (`apps/web-stormwind/app/(app)/layout.tsx:78`), so `.v2.fkas` (specificity 0,2,0) beats `.fkas` (0,1,0) — per-brand `--primary`/`--background`/`--foreground` are dead in practice; the brand survives only through `--brand`, `--sidebar-brand` and the `--brand-*` accent vars, which `.v2` never touches. That _is_ the "internal = grayscale with brand accents" variant. (`.steddi`'s `--primary` also loses when `.v2` is present: equal specificity, `.v2` block is later in source order.)

### 2.7 Internal `@theme inline` (L350–455)

- Fonts: `--font-sans: var(--font-primary), system-ui, …` (L351–353); `--font-heading: var(--font-heading), var(--font-primary), …` (L354–356). Nothing internal ever _sets_ the outer `--font-heading`, so headings fall back to `--font-primary`.
- Radii: `--radius-xs/sm/md/lg/xl` are **all** `calc(var(--radius))` (L377–381) — every size collapses to `0.375rem`; `--radius-button: var(--radius-button)` (L382).
- Status mapping: `--color-error: var(--destructive)`, `--color-error-foreground: var(--destructive-foreground)` (L416–417) — internal has no separate error palette; `--color-info-foreground: var(--info-foreground)` (L419).
- Brand utility colors `--color-fkas/tkas/guen/fkab/steddi(-foreground)` (L422–431) — again no fkse.
- Extras with no external counterpart: sidebar family (L383–390), `--color-right-panel` (L395–396), neutral scale (L398–409), `--ease-overshoot` (L437–452), `--breakpoint-3xl: 1920px` (L454).

---

## 3. Fonts per brand (Next font setup)

### 3.1 External app (`OrderModuleWeb/apps/web-sales-module/lib/font/font.ts`)

- `--font-primary` = Roboto (Google), subsets latin, weights `400/500/700` (L8–12) — for **every** brand (`getPrimaryBrandFont`, L97–106, all switch arms return `robotoFont`).
- `--font-heading` (`getHeadingBrandFont`, L108–117), switching on `env.NEXT_PUBLIC_BRAND_NAME`:
  - `Fjordkraft` → **Neo Sans** local font (L14–53): `NeoSans.woff2` 400 normal, `NeoSans-Medium` 500, `NeoSans-Bold` 700, `NeoSans-Italic` 400 italic, `NeoSans-BoldItalic` 700 italic, `NeoSans-Black` 900, `NeoSans-BlackItalic` 900 italic — from `public/static/fonts/NeoSans/`.
  - `Trøndelagkraft` → Roboto.
  - default (i.e. **GudbrandsdalEnergi and FjordkraftSverige**) → Roboto.
- Commented-out configs (never active): **Mohr** local heading font (`Mohr-Bold` 700, `Mohr-Light` 300; L55–69) and **Museo Sans** local primary font (300/500/700/900; L71–95) — evidence a distinct brand font was planned (likely GUEN) but disabled.
- Applied in `apps/web-sales-module/app/[lang]/layout.tsx:34–35,111`: `<html className={cn(primaryFont.variable, headingFont.variable, brand)}>`; body uses `font-family-sans` (L113).
- Storybook mirrors this per-brand switch with the same fonts (`apps/storybook/.storybook/fonts.ts:8–77`) and applies theme + font classes in `apps/storybook/.storybook/preview.ts:52–66`.

Effective heading-font matrix:

| Brand             | `--font-primary`                               | `--font-heading`                    |
| ----------------- | ---------------------------------------------- | ----------------------------------- |
| fkas (and fkas-c) | Roboto 400/500/700                             | Neo Sans 400/500/700/900 (+italics) |
| tkas              | Roboto 400/500/700                             | Roboto                              |
| guen              | Roboto 400/500/700                             | Roboto (Mohr/Museo commented out)   |
| fkse              | Roboto 400/500/700                             | Roboto (falls through `default`)    |
| fkab              | n/a — brand does not exist in the external app | n/a                                 |

### 3.2 Internal app (`OrderModuleInternalWeb/apps/web-stormwind`)

- `(app)/layout.tsx:33–37`: Roboto, subsets latin, `--font-primary`, weights `400/500/600/700`. Applied on `<html className={cn("v2", robotoFont.variable, getBrandClassName(brandContext.brand))}>` (L76–80).
- `(auth)/layout.tsx:19–23`: Roboto, `--font-primary`, weights `400/700` only (different weight set from the app layout). Applied as `cn("v2", robotoFont.variable)` — **no brand class** on auth screens (L35).
- No heading font is ever loaded internally; `--font-heading` in `@theme` (internal ui.css L354–356) resolves to its `var(--font-primary)` fallback. All brands, all screens: Roboto.

---

## 4. Gaps & oddities

Items the spec must later resolve (ticket-listed items first, then additional findings).

### Ticket-listed

1. **No external `tkas`/`guen` company palettes.** Only `.fkas-c` exists (`brands.css:57`). The `-c` suffix is applied in exactly one place — the sms-accept layout — and only when `brand === Fjordkraft` and the customer is `LargeCustomer`/`Business` (`apps/web-sales-module/app/[lang]/sms-accept/[hashedCustomerId]/layout.tsx:15–28`); Storybook hardcodes it as a fifth theme `"fkas-c"` (`preview.ts:30–35`). For `external-tkas-company` and `external-guen-company` there are **no token values anywhere** — the spec must either mint palettes or fall back to the private ones.
2. **No external `fkab` block at all.** The external `Brand` union is only `Fjordkraft | FjordkraftSverige | Trøndelagkraft | GudbrandsdalEnergi` (`OrderModuleWeb/packages/types/domain/brand.ts:1–2`); `brands.css` has no `.fkab`. Internally `--brand-fkab: oklch(0.68 0.21747 38.8022)` is byte-identical to `--brand-fkas` (internal `ui.css:95` vs `:104`) — fkab has never had its own color. `external-fkab-company` has zero reference values; the closest existing thing is fkas.
3. **`fkse` renders as Telinet.** Logo: `BrandLogo` renders `TelinetLogo`/`TelinetLogoMini` for `FjordkraftSverige` (`OrderModuleWeb/packages/ui/src/brand-logo.tsx:21–27`; SVGs at `packages/ui/src/icons/telinet-logo(.tsx|-mini.tsx)`). Palette: `.fkse` (`brands.css:313`) is a blue/teal ramp (~hue 210–250), nothing like fkas orange. The `fkse` code names the legal entity; the visual identity is Telinet — the spec should decide what the brand is _called_ vs what it _looks like_.
4. **Dead/overridden legacy HSL triplets.** (a) Every per-brand `--destructive`/`--destructive-foreground` triplet (`brands.css:50–51,100–101,157–158,210–211,304–305,362–363`) is dead twice over: the shared status block re-declares `--destructive: var(--error)` later at equal specificity (`brands.css:396–397`), and the Tailwind mapping bypasses it anyway (`--color-destructive: var(--error)`, external `ui.css:82`). (b) The whole `.ngeas` block (`brands.css:268–311`) is a legacy shadcn palette for out-of-scope NGE; its status colors are additionally clobbered by the shared block since `.ngeas` is in its selector list (L374). (c) Remaining triplets (`--muted`, `--border`, `--accent`, `--popover*`, `--inactive`, `--success-foreground`, tkas `--primary-light`) are still live via `hsl(var(--x))` wrappers (external `ui.css:67–80`) — they're the un-migrated tail of the old theme.
5. **`guen-dark` recorded (out of scope for v1)** — full values in §1.2. Oddities: it is double-gated (needs the `.guen-dark` class **and** `prefers-color-scheme: dark`, `brands.css:217–218`); no `.ts`/`.tsx` in either repo ever applies the class (grep hits only the CSS file itself); values are 8-digit hex — many with a redundant `FF` alpha — instead of oklch; it defines no radii and no legacy triplets, so those must come from a co-applied `.guen` class or nothing; it overrides only the status _container_ trios, leaving `--on-error`/`--on-info`/`--on-success`/`--on-warning` white from the shared block.

### Additional findings

6. **Two incompatible token vocabularies.** External is Material-3-ish (`surface/on-surface/primary-container/...`); internal is shadcn-ish (`background/foreground/card/...`). Names like `--primary`, `--secondary`, `--ring`, `--radius` exist in **both** with different meanings/values — a merged contract can't just union them.
7. **Internal has no `fkse` tokens at all.** `.v2.fkse` and `.v2.ngef` appear in the v2 selector (internal `ui.css:307,311`) but there is no `--brand-fkse`/`--brand-ngef` variable, no `.fkse` accent block, and no `--color-fkse` Tailwind mapping (L422–431) — `internal-fkse-private` currently renders with the fkas defaults from `:root` (L172–175). The internal brand union _does_ include `FjordkraftKonsument → FKSE` (`OrderModuleInternalWeb/packages/validation/src/constants/brand.ts:5,12`), so the class `fkse` genuinely gets set on `<html>` and silently no-ops.
8. **Internal per-brand blocks are dead under `.v2`.** The app always renders `class="v2 <brand>"` (`(app)/layout.tsx:78`), and `.v2.<brand>` (0,2,0) outranks `.<brand>` (0,1,0), so the `--primary`/`--background`/`--foreground` in `.fkas`/`.tkas`/`.guen` (internal `ui.css:260–291`) never apply. Only `--brand`/`--sidebar-brand` survive. `.steddi` (L298–303) loses its `--primary` too (equal specificity, `.v2` block later in source). Bare `.fkab` is itself inside the v2 selector list (L312), so fkab is grayscale even without `v2`.
9. **No segment axis internally.** Internal theming is brand-class only; nothing distinguishes company vs private (the fkas/fkab and fkse split encodes country/entity, not segment). The 8 internal permutations in CONTEXT.md have exactly one value set each today: v2 grayscale + per-brand accent.
10. **`--inactive` missing from `.fkas-c`** (present in `.fkas:38`, `.tkas:143`, `.guen:198`, `.fkse:350`) — company fkas silently inherits whatever ancestor value exists, or none.
11. **`--primary-light` is tkas-only** (`brands.css:150`) yet mapped globally (`--color-primary-light`, external `ui.css:77`) — `text-primary-light` etc. is invalid/unset for every other brand.
12. **`.guen` legacy `--accent`/`--accent-foreground` are inverted** relative to every other brand: accent is dark `222.2 47.4% 11.2%`, foreground light `210 40% 96.1%` (`brands.css:205–206`); fkas/tkas/fkse all do light-accent/dark-foreground. Looks like a swap bug preserved as-is.
13. **`--ring` is one shared violet** `oklch(48.444% 0.20509 296.29)` in all external brands (fkas:30, fkas-c:84, tkas:135, guen:192, guen-dark:247, fkse:342) — deliberate brand-independent focus color, except `.ngeas` which uses `hsl(262.1 83.3% 57.8%)` (L307), the only full-`hsl()` value in the file.
14. **Status "on-container" = base color.** Shared block sets `--on-error-container: var(--error)` etc. (`brands.css:379,384,389,394`) — the on-container role is an alias, not an independent value; guen-dark is the only place it's a distinct color.
15. **Radius spread**: external `--radius` 0.75/0.75/0.95/0.5/0.75rem and `--radius-button` 1.8125 (pill) for fkas/fkas-c/fkse vs 0.95 (tkas) vs 0.5 (guen); internal flattens everything to 0.375rem and collapses xs–xl to a single size (internal `ui.css:377–381`), while external derives xl/lg/md/sm/popover arithmetically (external `ui.css:92–96`). Both files contain the self-referential `--radius-button: var(--radius-button)` mapping (external `ui.css:97`, internal `ui.css:382`).
16. **Duplicate/self-referential declarations to not carry forward**: internal `:root` sets `--brand`/`--brand-foreground` twice (literal at L156–157, `var(--brand-fkas))` at L172–173) and `--sidebar-foreground` twice (L179, L183); external `@theme` has `--font-heading: var(--font-heading)` (external `ui.css:18`); internal keeps a commented-out shadcn block (internal `ui.css:110–126`). The `--popover: var(--card)` eager-binding footgun is documented in-file (internal `ui.css:147–149, 226–229`) and must be remembered by any theme that re-points `--card` per scope.
17. **Internal `--info-foreground` is darker than `--info`** (`oklch(0.488 0.243 264.4)` on `oklch(0.623 0.214 259.8)`, internal `ui.css:167–168`) — unusable as text-on-info; internal also lacks any `--info` dark-mode override (L215–258 touches success/destructive/warning but not info).
18. **Internal neutral scale naming is inverted** (`--neutral-0` = near-black, internal `ui.css:128–139`), and steps 70–95 carry a faint warm hue (17.2) while others are pure gray — a contract adopting it should normalize.
19. **`--surface-text` is near-identical but not shared**: fkas, fkas-c, tkas all repeat `oklch(26.617% 0.00344 164.8)` and fkse uses `oklch(26.595% 0.00475 219.65)`; only guen differs meaningfully (`oklch(23.69% 0.05649 271.31)`). Candidate for a shared default with per-brand override.
20. **Fonts**: only fkas has a real heading font (Neo Sans, local woff2); tkas/guen/fkse all resolve to Roboto, with guen's presumable brand fonts (Mohr, Museo Sans) present but commented out (`font.ts:55–95`). The external switch keys on the full brand _name_ string from env, not the brand code. Internal loads Roboto with two different weight sets in two layouts (`400/500/600/700` app vs `400/700` auth) and never populates `--font-heading`. fkab, existing only internally, has no font identity beyond Roboto.
21. **Internal-only token families with no external counterpart** (contract scope decision needed): sidebar family (11 vars), `--right-panel(-foreground)`, `--chart-1..8` (a teal→amber ramp with hex comments, internal `ui.css:194–201`), sugar-high `--sh-*` syntax colors (L204–212), `--warning-accent`, `--steddi(-foreground)`, `--ease-overshoot`, `--breakpoint-3xl`. Conversely external-only: `--surface-*`/`--on-*` role system, `--radius-popover`, `--breakpoint-xs`/`--breakpoint-lg`, `--inactive`, `--primary-light`, the four-status `*-container` system.
22. **External fallback chains reveal optional tokens**: `--surface-variant-bright`, `--secondary-variant`, `--tertiary-container`, `--on-tertiary-container` all have `var(x, fallback)` mappings (external `ui.css:26,37,43–44`) even though every current brand supplies them — today's optionality that the contract can either lock down or keep.

---

## 5. Quick reference: where theme classes are set

| App                           | Element  | Classes                                                                                                                  |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| External web-sales-module     | `<html>` | `--font-primary` var + `--font-heading` var + brand code (`fkas`/`fkse`/`tkas`/`guen`) — `app/[lang]/layout.tsx:106–112` |
| External sms-accept           | `<main>` | brand code, or `fkas-c` for FKAS business customers — `sms-accept/[hashedCustomerId]/layout.tsx:24,43`                   |
| External Storybook            | `<html>` | font vars + one of `fkas`/`fkse`/`tkas`/`guen`/`fkas-c` + `bg-surface` — `.storybook/preview.ts:60–65`                   |
| Internal web-stormwind (app)  | `<html>` | `v2` + `--font-primary` var + brand code from session — `(app)/layout.tsx:76–80`                                         |
| Internal web-stormwind (auth) | `<html>` | `v2` + `--font-primary` var, **no brand** — `(auth)/layout.tsx:35`                                                       |
