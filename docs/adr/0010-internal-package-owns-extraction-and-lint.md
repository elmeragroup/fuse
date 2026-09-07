# 0010 — `@elmeragroup/internal` owns API extraction and the lint rules

Date: 2026-09-07. Status: accepted. Supersedes [ADR 0007](0007-docs-api-extraction-pipeline.md).

## Context

Three workspace packages held engineering tooling that is not specific to this library: `tooling/api-extractor` (the Effect-based TypeScript API extractor), `tooling/oxlint-plugin` (the `elmera/*` rules), and `tooling/oxlint-anti-slop` (the vendored anti-slop rules). The docs generator wrapped the extractor in a second checker walk, an Effect adapter, and a shadow comparison that reconciled the two ([ADR 0007](0007-docs-api-extraction-pipeline.md)). That was about 130 KB of pipeline code and a 580 KB reviewed snapshot in `apps/docs`, plus the extractor's own timing, conformance and boundary gates in `ci:checks`.

The same code now ships from [elmeragroup/internal](https://github.com/elmeragroup/internal) as `@elmeragroup/internal`. Its root export, `generateApiArtifacts`, produces the committed `api.json` shape this docs site renders, with the Elmera defaults (`includeExternalTypes: ["@base-ui/react"]`, accepted `unsupported-type-fallback` warnings) built in. Its `oxlint` and `oxlint/anti-slop` entries export the two plugins.

## Decision

- The docs generation pass and the `api.json` drift check call `generateApiArtifacts` from `@elmeragroup/internal` (`apps/docs/scripts/lib/api-artifact.ts`). The pass runs it in `write` mode, the drift test in `check` mode. No checker walk, adapter, or shadow comparison remains in this repository.
- The artifact banner is passed through `generatedBy`, so the committed `api.json` files are byte-identical to what the retired pipeline wrote. 65 of 66 artifacts did not change in the cutover.
- A facade that only re-exports a dependency has an empty `apiExportNames` entry in `components.ts` and publishes an artifact with an empty `parts` list. Today that is `focusable`, whose old artifact carried two parts with no props and `node_modules` source paths. The package rejects both such a walk and an empty export list ([elmeragroup/internal#4](https://github.com/elmeragroup/internal/issues/4)), so `api-artifact.ts` writes that one artifact itself until the package can. A page's RSC badge is read from its implementation module's own directive, never from the artifact.
- Root `.oxlintrc.json` loads the plugins from `@elmeragroup/internal/oxlint` and `@elmeragroup/internal/oxlint/anti-slop`. Rule names and tiers are unchanged. The two path-wide overrides that exempted the plugin sources from the type-unsafe rules are gone with the sources.
- `@elmeragroup/internal` is a devDependency of the workspace root (for oxlint, which resolves plugin specifiers from the config's directory) and of `apps/docs` (for generation). Until a suitable version is on npm, both install the packed archive under `vendor/internal/`; `vendor/internal/README.md` records provenance and the switch-back steps.
- `tooling/typescript` stays: the shared tsconfig bases are repository configuration, not tooling code.

## Consequences

- `apps/docs` no longer depends on `effect` or on a workspace extractor. The catalog entries for `effect` and `@oxlint/plugins` are gone; both are pinned runtime dependencies inside the package and still resolve to the versions the catalog used to pin, so the lockfile keeps one copy of each. The `minimumReleaseAgeExclude` entry for `effect@4.0.0-rc.111` stays until the package moves to a stable release ([roadmap](../spec/roadmap.md) §12).
- `ci:checks` loses `docs#test:shadow` and the extractor's private gates. The drift check, the generated-output tests, and the repo-policy tests are the regression net for an `@elmeragroup/internal` upgrade.
- Extractor and rule changes happen in the source repository and reach this one through a version bump. A rule the library needs that does not exist upstream is a change request there, not a local plugin.
