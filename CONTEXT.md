# CONTEXT

Ubiquitous language for the `@elmeragroup/ui` whitelabel component library effort.

## Glossary

- **Brand**: one of the five consumer-facing energy brands, each with a fixed four-character code: Fjordkraft (`fkas`), Trøndelagkraft (`tkas`), Gudbrandsdal Energi (`guen`), Fjordkraft Företag (`fkab`), Fjordkraft Konsument (`fkse`). Note: `fkse` renders under the consumer-facing trade name **Telinet** (logo and palette) while keeping the `fkse` code. Brands found in reference code but outside this effort's scope: Steddi, NGE/ngef, Trumf, Elmera Group.
- **Segment**: the customer class a surface serves — `private` (B2C) or `company` (B2B).
- **Pinned brand**: a brand that exists in only one segment. `fkab` is pinned to `company`; `fkse` is pinned to `private`. The other three brands span both segments.
- **Variant**: the audience axis of a theme — `internal` (grayscale theme for internal tools, brand appears only in accents/logos) or `external` (full brand look-and-feel for customer-facing apps).
- **Theme**: a concrete permutation of variant × brand × segment, e.g. `internal-fkas-company`, `external-tkas-private`. 16 permutations exist at v1 (8 internal, 8 external).
- **Theme slug**: the canonical string name of a theme, `<variant>-<brand>-<segment>`.
- **Token / token contract**: a CSS custom property that components consume (e.g. a primary color role). The *contract* is the fixed set of token names every theme must supply; themes vary values, never names.
- **Interim tier (react-aria)**: components still built on `react-aria-components` (date/calendar family and a few atoms) pending a base-ui equivalent; part of the library, marked for future migration.
