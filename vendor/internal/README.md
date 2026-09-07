# Vendored `@elmeragroup/internal`

Temporary. This directory holds the packed `@elmeragroup/internal` archive until a suitable version is published to npm. Two workspaces install it as a `file:` devDependency: the repository root ([`package.json`](../../package.json)), because `.oxlintrc.json` resolves the two lint plugins from there, and the docs app ([`apps/docs/package.json`](../../apps/docs/package.json)), which runs the API artifact generator. Import specifiers stay `@elmeragroup/internal` and its documented subpaths, so switching to the registry needs no code changes. [ADR 0010](../../docs/adr/0010-internal-package-owns-extraction-and-lint.md) records the adoption.

## Provenance

| Field         | Value                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Archive       | `elmeragroup-internal-0.1.0-canary.1.tgz`                                                    |
| SHA-256       | `1b254c00a3bb937ef46b1381adae629f56448c76eb25203882bbaa8596407323`                           |
| Size          | 131756 bytes                                                                                 |
| Source        | https://github.com/elmeragroup/internal                                                      |
| Source commit | `350f6e7f41b27a7d6d621d6edf4db4acb74b8aa0` (merge of elmeragroup/internal#3)                 |
| Built by      | https://github.com/elmeragroup/internal/actions/runs/34104176181, artifact `canary-packages` |

That run passed workspace checks, pack checks, and the packed-consumer test. Only its npm publish step failed (HTTP 409), which is why the archive is vendored.

The checksum above equals the `sha256` in the run's `archive.json` report. The report's own SHA-256, `4aa1e2bb05aca60cafa5685e2c7e00275320182cd264a884959db2f9cf1c585b`, is the value `verified.json` recorded with `"status": "pass"`. Those reports contain runner paths and are not committed. `pnpm test:repo-policy` re-checks the archive hash, both dependency paths, and the lint plugin specifiers.

The runtime dependencies pinned inside the package (`typescript`, `effect`, `@oxlint/plugins`) equal the catalog versions in `pnpm-workspace.yaml`, so the lockfile shares one copy of each.

## Removing this directory

1. Confirm the published version exists: `npm view @elmeragroup/internal versions --json`.
2. In the root `package.json` and in `apps/docs/package.json`, replace the `file:` dependency with the published version (`@elmeragroup/internal@canary` or the exact version per release policy) and run `pnpm install` from the repository root to regenerate the lockfile. `minimumReleaseAge` applies to the registry version; pnpm does not age-gate `file:` tarballs.
3. Delete `vendor/internal/` and `test/vendored-internal.test.mjs`, and drop the `vendor/internal/**` input from `//#test:repo-policy` in `turbo.json`.
4. Remove the vendoring amendment from `docs/spec/tooling.md` §2.
5. Rerun `pnpm install --frozen-lockfile` and `pnpm ci:checks`.

## Rebuilding the archive

If the Actions artifact has expired and this version is needed again, check out the source commit above and run `pnpm packages:pack` then `pnpm test:packed-consumer` in that repository. Copy only the `.tgz` here and update the checksum in this file and in the repo-policy test. Do not substitute a build from a newer commit without recording it.
