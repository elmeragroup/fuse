# CONTEXT

Ubiquitous language for the `@elmeragroup/ui` whitelabel component library effort.

## Glossary

- **Brand**: a visual-identity code used on `data-theme-brand` — the five consumer-facing energy brands plus corporate Elmera (`elma`), each with a fixed four-character code: Fjordkraft (`fkas`), TrøndelagKraft (`tkas`), Gudbrandsdal Energi (`guen`), Fjordkraft Företag (`fkab`), Fjordkraft Konsument (`fkse`), Elmera (`elma`). Note: `fkse` renders under the consumer-facing trade name **Telinet** (logo and palette) while keeping the `fkse` code. Brands found in reference code but outside this theme set: Steddi, NGE/ngef, Trumf.
- **Segment**: the customer class a surface serves — `private` (B2C) or `company` (B2B).
- **Pinned brand**: a brand that exists in only one segment. `fkab` is pinned to `company`; `fkse` is pinned to `private`. The other four brands span both segments. `fkab` shares Fjordkraft's (`fkas`) visual identity by deliberate, permanent policy — it is an alias, not a missing palette.
- **Variant**: the audience axis of a theme — `internal` (grayscale theme for internal tools, brand appears only in accents/logos) or `external` (full brand look-and-feel for customer-facing apps).
- **Theme**: a concrete permutation of variant × brand × segment, e.g. `internal-fkas-company`, `external-tkas-private`, `internal-elma-private`. 20 permutations exist at v1 (10 internal, 10 external).
- **Theme slug**: the canonical string name of a theme, `<variant>-<brand>-<segment>`.
- **Token / token contract**: a CSS custom property that components consume (e.g. a primary color role). The *contract* is the fixed set of token names; themes vary values, never names. The library ships complete defaults; a theme overrides a subset.
- **Role token**: a semantic, themable token named for its job (`--primary`, `--card`, `--error`), following the shadcn grammar of base + `-foreground` pairs.
- **Primitive token**: a public but non-themed token holding a raw palette value — the neutral ramp (`--neutral-50..950`, 50 lightest) and the per-brand accents (`--brand-<code>`). Stable API, same values in every theme.
- **Soft form (`-soft`)**: the tinted-background companion of a role (`--error-soft`/`--error-soft-foreground`) — the contract's rename of Material-3's `-container` concept.
- **Feature role**: the strong brand-colored panel role (`--feature`) for promo/hero surfaces — deliberately distinct from `--accent`, which stays a subtle hover tint.
- **Must-override token**: a contract token a composed theme is required to supply through its non-default layers rather than inherit silently. The set is variant-specific: external themes supply their brand/surface/interactive/shape identity; internal themes supply the brand pair while inheriting the neutral system. It is a theme-level obligation, never a requirement on each layer module.
- **Interim tier (react-aria)**: components still built on `react-aria-components` (date/calendar family and a few atoms) pending a base-ui equivalent; part of the library, marked for future migration.
- **Supported locale**: a language the library ships built-in strings for — `nb-NO`, `sv-SE`, `en-US`, `fi-FI` at v1. Apps set one locale on the UI provider; components never take a locale directly.
- **String dictionary**: a component's built-in per-locale strings (empty states, nav labels, close buttons). Provides the correct-language default; an explicit string prop always overrides it.
- **Text-grade role**: a token pairing whose foreground must meet 4.5:1 contrast on its surface in every theme. `feature-foreground` is not text-grade — it is accent/decorative; text on feature panels is white.
