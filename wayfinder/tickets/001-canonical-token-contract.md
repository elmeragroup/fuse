---
id: 001
title: Canonical token contract
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

The two reference projects use **conflicting token contracts** and the library must have exactly one. Which token naming model does `@elmeragroup/ui` standardize on, and what is the exact set of token names every theme must supply?

- OrderModuleInternalWeb (`packages/ui/src/styles/ui.css`) is **shadcn-style**: `--background/--foreground`, `--primary/--primary-foreground`, `--muted`, `--card`, `--sidebar-*`, `--chart-1..8`, neutral ramp `--neutral-0..100`, `--brand-<code>` accent vars, `--radius` + `--radius-button`.
- OrderModuleWeb (`packages/ui/src/styles/brands.css`) is **Material-3-style**: `--surface/--on-surface/--surface-variant`, `--primary/--on-primary/--primary-container/--on-primary-container`, `--secondary`, `--tertiary`, four-way status set (`error/info/success/warning` each with `on-`/`-container` forms), `--radius` + `--radius-button`, all oklch.

Decide: (a) one unified contract (which one wins, or a merged superset), (b) the complete token list (colors, radii, fonts, breakpoints, chart ramp, sidebar block, status set), (c) which tokens are **themable** (themes must/can override) vs **locked** (library-fixed), (d) how the internal grayscale + brand-accent model maps onto the same contract the external full-brand themes use, (e) legacy-token bridging policy (the refs carry legacy HSL triplets and known footguns like `--popover: var(--card)` eager-binding — the new contract should shed these deliberately).

Base per user directive: the shadcn variable base (see the effort's original brief) plus what `ui.css` already defines. Dark mode: the contract must not preclude a future `data-theme` light/dark axis, but no dark values are specced.

This is the load-bearing decision of the whole effort — most theming tickets block on it.

## Resolution

Decided 2026-08-17 via grilling (5 rounds, all branches confirmed by the user). Full rationale and rejected alternatives in [ADR 0001](../../docs/adr/0001-canonical-token-contract.md). Usage evidence backing the mappings came from the [token value extraction](../research/003-token-values.md) plus a usage-count sweep of OrderModuleWeb source (key facts: `--surface-text` 0 uses; `--on-surface` ~149; `--primary-container` family ~123 and is the *default Card*; `--surface-bright` 20; `--secondary-container` 44; `--tertiary` 3; `--secondary-variant` 0).

### (a) Contract model

shadcn grammar wins (per standing directive): `--x` / `--x-foreground` pairs, extended with a **soft form** `--x-soft` / `--x-soft-foreground` (replaces M3 `-container`/`on-`). All values **oklch**. Two public tiers: **role tokens** (semantic, themable) and **public primitives** (neutral ramp + brand accents) — primitives are stable API but not themed per theme.

### (b) The token list

**Themable role tokens:**

| Family | Tokens | Values source (external) |
|---|---|---|
| Surfaces | `--background/--foreground` | ← `--surface` / `--on-surface` (surface-text is dead, on-surface is real body text) |
| | `--card/--card-foreground` | ← `--primary-container` / `--on-primary-container` (the white default card) |
| | `--card-soft/--card-soft-foreground` | ← `--surface-bright` (tinted elevated tier between page and white card) |
| | `--popover/--popover-foreground` | independent values, **never** `var(--card)` (eager-binding footgun shed) |
| | `--muted/--muted-foreground` | muted-foreground ← `--on-surface-muted` semantics; oklch literals, not opacity aliases |
| | `--accent/--accent-foreground` | subtle hover slot, shadcn semantics (guen's inverted legacy accent not carried) |
| | `--feature/--feature-bright/--feature-foreground` | ← `--surface-variant`/`-bright`/`--on-surface-variant` (strong brand promo/hero panels) |
| Interactive | `--primary/--primary-foreground` | ← external `--primary`/`--on-primary` |
| | `--primary-soft/--primary-soft-foreground` | new **real tint** library default (today's white primary-container value moved to card) |
| | `--secondary/--secondary-foreground` | ← external `--secondary`/`--on-secondary` |
| | `--secondary-soft/--secondary-soft-foreground` | ← `--secondary-container`/`--on-secondary-container` (tinted hairlines, card secondary variant) |
| Brand | `--brand/--brand-foreground` | first-class in every theme: external sets `--brand` = `--primary`'s value; internal keeps `--primary` neutral and puts the brand color here |
| Status | `--error`, `--info`, `--success`, `--warning`, each × `-foreground`, `-soft`, `-soft-foreground` (16) | ← shared status block; `-soft` ← `-container`; `-soft-foreground` gets the base color as default (today's alias made explicit) |
| | `--destructive/--destructive-foreground` | **shipped aliases** of `--error`/`--error-foreground` (shadcn-snippet compat) |
| Lines/focus | `--border`, `--input` | legacy HSL triplets converted to oklch (neutral hairlines); brand-tinted dividers use `--secondary-soft` |
| | `--ring` | themable; library default = the shared violet `oklch(48.444% 0.20509 296.29)` (brand-independent as today) |
| Sidebar (8) | `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`, `--sidebar-brand`, `--sidebar-brand-foreground` | trimmed from 11; `--sidebar-background`, `--sidebar-primary(-foreground)` had zero consumption |
| Right panel | `--right-panel/--right-panel-foreground` | internal values carried |
| Charts | `--chart-1..8` | themable; library default = internal teal→amber ramp |
| Syntax | `--sh-identifier`, `--sh-keyword`, `--sh-string`, `--sh-class`, `--sh-property`, `--sh-entity`, `--sh-jsxliterals`, `--sh-sign`, `--sh-comment` | library default = Ayu Light (internal values) |
| Shape | `--radius`, `--radius-button` | per-brand identity (fkas 0.75/pill 1.8125, tkas 0.95, guen 0.5, fkse 0.75) |
| Type | `--font-sans`, `--font-heading` | Tailwind-native names; heading falls back to sans (only fkas has Neo Sans today) |

**Public primitives:**

- `--neutral-50..950` — Tailwind convention (50 lightest → 950 darkest), values from the internal ramp **renumbered** (it was inverted: 0=black) and **normalized to pure gray** (warm hue on steps 70–95 dropped).
- `--brand-<code>/--brand-<code>-foreground` for all five brands, defined globally at `:root` (internal tools render multi-brand data). `--brand-fkse` **minted** from the Telinet blue palette (`.fkse` `--primary`); `--brand-fkab` keeps the fkas value, **flagged as a design-input gap** for [Brand–segment matrix gaps](004-brand-segment-matrix-gaps.md).

### (c) Themable vs locked

**Themable**: everything in the role-token table. **Locked (library-fixed)**: derived radii formula (`--radius-sm/md/lg/xl/popover` as calc off `--radius`, external-style arithmetic — internal's collapse-to-one-size rejected), breakpoints, easing (`--ease-overshoot`), spacing scale, `--font-mono`.

**Completeness model**: the library ships a complete neutral default layer at `:root`; a theme overrides any subset. The contract marks brand-defining tokens as **must-override** (external themes: background/foreground, card family, primary pair, brand pair, feature, radius pair, fonts; internal themes: brand pair, sidebar-brand pair). Statuses, ring, charts stay shared-by-default.

### (d) Internal grayscale mapping

Internal themes supply the same contract: `--primary` stays neutral (near-black on white), `--brand`/`--sidebar-brand` carry the brand color, `--feature` points at a neutral, everything else inherits library defaults. The variant axis is expressed entirely inside token *values* — no internal-only names.

### (e) Legacy bridging

**Clean break.** No HSL-triplet wrappers, no bridge layer shipped (`--destructive` alias is the sole compat concession). Dead deliberately: `--surface-text`, `--tertiary*` (all forms), `--secondary-variant`, `--inactive`, `--primary-light`, `--sidebar-background`, `--sidebar-primary(-foreground)`, `.ngeas` block, per-brand `--destructive` triplets, `--on-primary-container-muted` (use opacity utilities). The spec carries an old→new mapping table as migration reference only.
