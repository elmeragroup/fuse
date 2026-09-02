# `@elmeragroup/api-extractor`

Private, Effect-native TypeScript API extraction for this workspace. It reads one source file from a
configured TypeScript project and returns a package-owned semantic model, recoverable warnings, and
provenance. Compiler objects never cross the package boundary.

The package is intended for workspace tooling, including the docs API shadow. It is not published.

## Use the extractor

Create one scoped `ProjectExtractor` layer for a TypeScript project, then call `extractModule` for
files included by that project's `tsconfig.json`.

```ts
import { ProjectExtractor } from "@elmeragroup/api-extractor";
import { Effect } from "effect";
import { resolve } from "node:path";

const tsconfigPath = resolve("tsconfig.json");
const inputPath = resolve("src/index.ts");

const extraction = Effect.gen(function* () {
  const extractor = yield* ProjectExtractor;
  return yield* extractor.extractModule(inputPath, { includeExternalTypes: false });
}).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })));

const result = await Effect.runPromise(Effect.scoped(extraction));
```

The scoped lifetime is required: opening a project starts a native compiler process, and releasing
the scope closes it on success, typed failure, interruption, or defect. Reuse the service for every
file in the same project rather than opening one project per file.

`extractModule` returns:

- `module`: the semantic API model. Preserved type operators carry both the authored operand and
  the checker's resolved key set.
- `warnings`: recoverable losses. A warning has a stable `code`, location, and code-specific fields;
  `message` explains what failed, what the extractor did, and what a maintainer can do next.
- `provenance`: repository-relative declaration and re-export paths for model nodes.

Fatal setup, compiler, missing-file, and resolver failures remain typed Effect errors. Recoverable
losses use `warnings`; the extractor never logs them automatically.

### Options

- `includeExternalTypes` is `false` by default. Pass `true` to expand every dependency type, or an
  array of exact package names to expand only those packages.
- `shouldInclude` can omit individual object properties.
- `shouldResolveObject` can stop expansion of large or deep object shapes. The default expands root
  objects, objects with at most 50 properties, and paths no deeper than 10 type-resolution steps.
- `ProjectExtractor.live` also accepts `cwd` and a `ProjectFileSystem`. The filesystem seam supports
  virtual fixture inputs without exposing compiler internals.

## Guarantees and boundaries

Only `src/backend/ts7/**` imports TypeScript 7's unstable native API. The backend turns compiler
state into opaque handles and primitive facts. `src/parser.ts` and `src/parse/**` own the semantic
policy: recursion, aliases, generics, containers, mapped types, callables, classes, modules,
external types, warnings, and React component recognition.

The public model, warnings, errors, provenance, options, and service contain no compiler handles.
`src/parse/**` and `src/canonical/**` import no Effect module either; `test/boundary.test.ts` pins
both rules.
Each `extractModule` call gets an isolated synchronous extraction session, so recursion state and
warning collection cannot leak between calls. Output ordering and canonicalization are
deterministic for the pinned toolchain.

The ts7 adapter fetches each source file at most once per extraction session and keeps the
materialized tree for later node lookups; the compiler's project-scoped source-file cache keeps
shared library and dependency files across sessions. Files excluded by ownership are never read
as modules. Parser and public options never see this.

Some compiler shapes cannot fit the public model. The extractor keeps working and reports one of
these structured warning codes:

- `missing-enum-declaration`
- `missing-default-export-symbol`
- `unresolved-re-export`
- `omitted-index-signature`
- `unrepresented-construct-signatures`
- `omitted-callable-members`
- `uncertain-component-recognition`
- `unsupported-type-fallback`

Consumers should branch on `code` and structured fields, not parse `message` text.

## Fixture evidence

`scripts/fixture-catalog.ts` is the canonical fixture inventory. Its 125 records describe inputs,
oracle ownership, warning evidence, issue membership, type-check strategy, timing membership, and
package execution. Scripts and tests derive their ordered views from that catalog; do not add a
second fixture list.

The full conformance view contains 116 fixtures ported from upstream: 97 whose oracle is unchanged
and 19 with a reviewed TypeScript 7 divergence. Their evidence files are:

- `output.json` is immutable upstream evidence from
  `michaldudak/typescript-api-extractor@e145350`. No local command may rewrite or alias it.
- `output.tsgo.json` and `ts7-oracle.json` record an explicitly reviewed TypeScript 7 divergence.
- `warnings.tsgo.json` records reviewed recoverable warnings, including empty warning sets where the
  absence itself is evidence.
- `issue-14-conformance.json` is the generated report that binds fixture input, selected oracle,
  warning, type-check, and pinned-reference evidence.

Use these workflows from `tooling/api-extractor`:

```sh
# Verify catalog, fixture type-checks, warnings, selected oracles, and the stored report.
pnpm run check:catalog
pnpm run test:fixtures
pnpm run test:conformance

# Refresh the generated conformance report after a deliberate implementation change.
pnpm run report:conformance

# Refresh every cataloged warning oracle and the report in one reviewed batch.
pnpm run report:warnings

# Refresh selected warning fixtures only.
node scripts/conformance/report.ts --write-warnings <fixture-name> ...

# Refresh a selected, pre-classified TypeScript 7 module divergence.
node scripts/conformance/report.ts --write-ts7 <fixture-name> ...
```

Every write command requires the appropriate reviewed evidence and uses
`scripts/artifact-batch-writer.ts`. The writer validates all destinations before writing, rejects
absolute paths, traversal, duplicates, symlink and hardlink escapes, overlapping writers, and any
destination that is or aliases immutable `output.json`. A batch either commits in full or restores
the original files and reports recovery status.

`report:warnings` derives its allowed destinations and expected warning-code order from the catalog.
It verifies the pinned upstream checkout before extraction, writes only `warnings.tsgo.json` files
plus the generated conformance report, and never targets module oracles. Review warning prose and
structured fields in the diff before committing the refreshed evidence.

The ignored reference checkout must be clean, at the pinned commit, and have the exact recorded path
universe. To inspect it without writing evidence:

```sh
node scripts/conformance/report.ts --audit-reference
node scripts/conformance/report.ts --audit-reference --reference-required
```

## Local checks

Run the complete package gate before opening a review:

```sh
pnpm run check:all
```

`check:all` is `format:check`, `lint`, `build`, `type-check`, `test` and then `ci:checks`, the
evidence half (catalog, boundary, fixture type-checks, conformance and the three timing plans). The
individual commands are listed in `package.json`; run the one that covers what you changed while
iterating.

When a change can affect the docs API shadow, also run from the repository root:

```sh
pnpm --filter docs test:shadow
pnpm --filter docs generate
```

The shadow compares the current docs generator with this extractor over every component page and
stores the reviewed difference set in `apps/docs/test/api-shadow.snapshot.json`. After a deliberate
change on either side, review the differences and run `pnpm --filter docs shadow:update`.

Timing reports are evidence, not benchmarks. `scripts/timing.ts --plan <issue02|issue14|externalSelection>`
runs one plan. Deterministic counters must match exactly and scheduler-sensitive durations are
recorded observations that only need to stay finite and non-negative; no check depends on
milliseconds. The IPC stop condition is decided by request count and bytes received against the
catalog ceilings: per fixture in the Issue 02 and external-selection plans, and summed over the four
fixtures in the Issue 14 plan, so a dense walk cannot trade one for a megabyte dump. `test/fixtures/issue-02-timing.json`
is the immutable pre-optimization baseline the Issue 14 plan measures against; only its ceiling
metadata moves with the catalog. Refresh the Issue 14 report (`report:timing:issue14`) only after
reviewing the semantic output and the reason for a timing change.

## Common maintenance

When adding or porting a fixture:

1. Add one record to `fixtureEvidenceCatalog` with its input, oracle, warning, issue, and execution
   metadata.
2. Preserve copied `output.json` bytes. Add reviewed TypeScript 7 evidence only when the catalog
   declares a divergence and the reason record accounts for every changed path.
3. Run `check:catalog`, `test:fixtures`, the focused semantic test, and `test:conformance`.
4. Refresh only the reviewed artifact class that changed, then inspect the complete diff.

When adding a warning, define its structured schema and stable code first, render its human message
centrally in `src/parse/fallback.ts`, and add focused coverage for identity, context, output behavior,
and a useful action. Refresh reviewed warning evidence through `report:warnings`.

When extending the model or resolver, keep compiler-specific reads behind backend contracts. Run the
boundary check before and after the change; a new TypeScript import or compiler object in a public
type is an architectural regression.

## Reproducible references and attribution

From `tooling/api-extractor`, create the ignored development references with:

```sh
git clone https://github.com/michaldudak/typescript-api-extractor.git ../../.ref/typescript-api-extractor
git -C ../../.ref/typescript-api-extractor checkout --detach e145350
git clone https://github.com/Effect-TS/effect.git ../../.ref/effect
git -C ../../.ref/effect checkout --detach effect@4.0.0-rc.111
```

The Effect reference resolves to commit `648f566dd259898e7697c7fcb796183ccbc474ab`. Runtime
dependencies remain pinned to the same Effect RC tuple in `pnpm-workspace.yaml`.

The semantic model and resolver boundary are original workspace code informed by the upstream
extractor. Any future source port must retain the relevant MIT attribution in `NOTICE`. Package code
and tests must not depend on absolute paths to ignored reference checkouts.
