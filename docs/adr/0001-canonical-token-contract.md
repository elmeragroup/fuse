# 0001 — Canonical token contract: shadcn grammar with a soft form, two public tiers

Date: 2026-08-17. Status: accepted; amended 2026-08-18 after the accepted shared brand-pointer cascade.

## Context

`@elmeragroup/ui` inherits two reference codebases with **incompatible token vocabularies**: OrderModuleInternalWeb is shadcn-style (`--background/--foreground`, `--card`, neutral ramp, `--brand-<code>` accents), OrderModuleWeb is Material-3-style (`--surface/--on-surface`, `--primary-container/--on-primary-container`, four-status `-container` system). Names like `--primary`, `--ring`, `--radius` exist in both with different meanings. The library must have exactly one contract, and 20 theme permutations (variant × brand × segment) must supply it. Usage analysis of the external app showed the M3 names were not used as M3 intends: `--surface-text` was never consumed, `--primary-container` (white everywhere) was the de-facto default Card, `--tertiary`/`--secondary-variant` were value-coincident aliases of one dark anchor tone, and `--destructive` was a dead alias of `--error`.

## Decision

- **shadcn grammar** (`--x` / `--x-foreground`), per standing directive, extended with a **soft form** `--x-soft(-foreground)` replacing M3's `-container`/`on-` — applied to the four statuses (`error/info/success/warning`), `primary`, `secondary`, and `card`.
- **M3 roles remapped by evidence, not by name**: `surface→background`, `on-surface→foreground`, `primary-container→card` (the real default card), `surface-bright→card-soft`, `secondary-container→secondary-soft`, `surface-variant family→` a minted `--feature/--feature-bright/--feature-foreground` role (strong brand promo panels).
- **Two public tiers**: semantic role tokens (themable) plus public primitives — `--neutral-50..950` (renumbered to Tailwind convention from the internal inverted ramp, normalized to pure gray) and `--brand-<code>(-foreground)` for all six visual identities at `:root`.
- **`--brand/--brand-foreground` are first-class**: the later accepted cascade selects the global brand accent in both variants. External `--primary` is the brand palette's action/surface color and may differ; internal themes keep primary neutral and express brand identity only through the brand pair (and `--sidebar-brand`). The variant axis lives entirely in values, never in names.
- **Defaults + must-override**: the library ships a complete neutral `:root` default layer; themes override subsets; compose-time, variant-specific must-override sets prevent brand identity from falling through to defaults. External themes supply their brand/surface/interactive/shape identity; internal themes supply the brand pair while inheriting the neutral system. This is an obligation on the composed theme, not on each partial layer module. Locked (not themable): derived radii arithmetic, breakpoints, easing, spacing, `--font-mono`.
- **Clean break on legacy**: all values oklch; no HSL-triplet wrappers; `--popover` never eager-bound to `var(--card)`; dead tokens (`--surface-text`, `--tertiary*`, `--secondary-variant`, `--inactive`, `--primary-light`) shed. Sole compat concession: `--destructive(-foreground)` shipped as aliases of error.

The complete normative enumeration, values, and legacy rename table live in [theming](../spec/theming.md) §§2–5. Ticket 001 is provenance only.

## Alternatives rejected

- **M3 vocabulary as the base** — contradicted the standing shadcn directive, and the external codebase itself misuses the M3 roles (white "primary-container" as card), so fidelity bought nothing.
- **Dual contracts (one per variant)** — doubles every component's styling surface and makes the 20-theme matrix combinatorial instead of value-only.
- **Semantic-only contract (private primitives)** — rejected by the owner: the neutral ramp and brand accents are wanted as public, stable API (internal tools legitimately render other brands' accents).
- **Dropping the soft/container concept** — alerts, badges, callouts, and the default Card all consume soft forms today; opacity composition can't reproduce the hand-tuned tints.
- **Every theme enumerates every token** — verbose and makes adding brand N+1 expensive, against the effort's "adding brands must be cheap" constraint.

## Consequences

- Ported shadcn snippets work with correct semantics (`accent` stays subtle; destructive resolves to error).
- The white default-card look and the tinted elevation ramp both survive under new names (`--card`, `--card-soft`).
- `--brand-fkse` must be minted (Telinet blue). `--brand-fkab` aliases `--brand-fkas` — originally flagged as a design gap, later ruled a **permanent, deliberate alias** (see the Brand–segment matrix gaps ticket resolution).
- Any future OrderModule migration re-maps names via the spec's reference table; no runtime bridge exists to lean on.
