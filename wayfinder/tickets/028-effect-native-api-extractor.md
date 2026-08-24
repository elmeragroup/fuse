---
id: 028
title: Effect-native TypeScript API extractor
type: task
status: open
assignee: null
blocked-by: []
labels: [ready-for-agent]
---

## Problem Statement

The repository needs a reusable description of the public TypeScript API that powers `@elmeragroup/ui`, but its current options are both inadequate. The docs app contains a narrow, docs-specific compiler walk that already uses TypeScript 7's unstable native API, while the more complete upstream `typescript-api-extractor` is tied to the TypeScript 5/6 JavaScript API and cannot run against the workspace's pinned TypeScript 7 package.

Without an owned extraction boundary, every consumer must either repeat fragile compiler traversal or bind directly to an API that TypeScript explicitly plans to replace in 7.1. That duplicates policy, makes compiler upgrades repository-wide rewrites, and leaves generated documentation, future machine-readable consumers, and conformance behavior without one schema-validated source of truth.

The implementation must solve that problem without destabilizing the existing docs build. It must preserve the upstream extractor's proven JSON semantics where TS7 can reproduce them, expose every unavoidable compiler divergence rather than silently blessing it, retain the source provenance needed by the current docs model, and demonstrate that the native compiler's IPC cost remains viable before the most expensive resolver work proceeds.

## Solution

Build a private workspace tooling package named `@elmeragroup/api-extractor`. It will wrap an immutable TypeScript 7 project snapshot in an Effect-scoped service and expose one high-level operation: extract one module from that project with explicit extractor options. The hot resolver pipeline remains synchronous, while Effect owns project lifecycle, typed failures, schemas, and resource safety.

The extractor will return an upstream-compatible, schema-validated module model, structured warnings, and a separate provenance sidecar. Compiler-specific objects remain behind a package-owned backend interface so no unstable TypeScript type, flag, AST node, or handle leaks into the resolver model or consumer contract.

Implementation proceeds test-first against the upstream 116-fixture suite, beginning with a four-case vertical slice that proves the backend boundary and records IPC timing. The first delivery also includes a docs adapter and shadow comparison against the existing docs extractor, but it does not change the production docs generation path.

## User Stories

1. As a UI library maintainer, I want to extract a module's complete public TypeScript API under the workspace's pinned TypeScript 7 compiler, so that generated consumers describe the code the repository actually checks.
2. As a UI library maintainer, I want extraction to operate on an immutable project snapshot, so that every module in one run observes a consistent compiler state.
3. As an extractor consumer, I want one project-scoped extraction operation, so that I do not need to understand compiler programs, checkers, snapshots, or process cleanup.
4. As an extractor consumer, I want default extraction options, so that the common path is concise and deterministic.
5. As an extractor consumer, I want inclusion, object-resolution, external-type, and type-operator policies to remain configurable, so that the upstream extractor's useful behavior is preserved.
6. As an extractor consumer, I want the type-operator output mode to remain correlated with the returned model type, so that resolved and syntax-preserving results cannot be confused at compile time.
7. As an extractor consumer, I want a schema-validated module result, so that persisted or transported extraction output can be decoded rather than trusted blindly.
8. As an extractor consumer, I want the established kind-discriminated node model preserved, so that upstream-compatible output retains its existing meaning.
9. As an extractor consumer, I want union and structural normalization to remain deterministic, so that equivalent APIs do not create noisy output churn.
10. As an extractor consumer, I want fatal extraction failures in a typed error channel, so that missing files, invalid configuration, backend failures, and parser failures can be handled deliberately.
11. As an extractor consumer, I want recoverable extraction problems returned as structured warnings, so that each application can choose whether to fail, log, or display them.
12. As an extractor consumer, I want the package to avoid automatic console output and logging, so that extraction remains composable in builds, tests, and future servers.
13. As a docs maintainer, I want declaration provenance alongside the semantic module model, so that docs can distinguish library-owned props from forwarded dependency props.
14. As a docs maintainer, I want authored default initializers retained as provenance, so that generated API tables continue to show implementation defaults.
15. As a docs maintainer, I want synthesized symbols identified explicitly, so that recipe axes remain exempt from declaration-site JSDoc rules for the same reason they are today.
16. As a docs maintainer, I want declaration paths available without embedding docs policy into the semantic model, so that RSC status and repository-relative paths remain docs-owned decisions.
17. As a docs maintainer, I want the new extractor mapped into the existing API-table model, so that comparison measures consumer-visible behavior rather than internal shapes.
18. As a docs maintainer, I want the old and new extractors run side by side across the component inventory, so that migration differences are known before production cutover.
19. As a docs maintainer, I want the production generator left unchanged in this delivery, so that root lint and build remain protected while parity is established.
20. As a tooling maintainer, I want only the TS7 backend to import unstable TypeScript modules, so that the future compiler API migration has one enforced boundary.
21. As a tooling maintainer, I want compiler types represented by package-owned opaque handles and normalized records, so that resolver modules cannot accidentally couple to tsgo objects.
22. As a tooling maintainer, I want backend handles excluded from models, warnings, errors, and service contracts, so that no compiler implementation detail crosses a durable boundary.
23. As a future backend maintainer, I want the model, resolver signatures, and conformance runner to compile unchanged when a backend is replaced, so that backend isolation is an observable architectural property.
24. As a contributor, I want the hardest compiler-boundary cases proven before the full port, so that an invalid abstraction is discovered while change is still cheap.
25. As a contributor, I want authored aliases and generics included in the boundary slice, so that syntax-preserving behavior is not deferred until after the architecture hardens.
26. As a contributor, I want mapped types included in the boundary slice, so that synthesized keys and type-parameter substitution test the backend vocabulary early.
27. As a contributor, I want type-only module re-exports included in the boundary slice, so that the known missing module-resolution operation is addressed explicitly.
28. As a contributor, I want a React compound component included in the boundary slice, so that the downstream component transform is proven against real library shapes.
29. As a reviewer, I want the original 116 upstream outputs retained unchanged, so that strada behavior remains a stable and inspectable oracle.
30. As a reviewer, I want every legitimate TS7 difference represented by a separate expected output and a machine-readable reason, so that compiler drift cannot be hidden in regenerated fixtures.
31. As a reviewer, I want the conformance report to count unchanged matches, reviewed divergences, and failures, so that parity is visible at a glance.
32. As a reviewer, I want fixture regeneration prevented from overwriting the upstream oracle, so that a convenience command cannot erase comparison evidence.
33. As a contributor, I want fixture inputs typechecked independently, so that a green extractor test cannot conceal invalid TypeScript test programs.
34. As a contributor, I want virtual-filesystem integration tests to use the TS7 API's supported filesystem seam, so that tests exercise production project behavior without custom compiler-host shims.
35. As a contributor, I want pure canonicalization and equivalence laws tested directly, so that deterministic model behavior can be diagnosed without starting a compiler process.
36. As a tooling maintainer, I want the per-extraction recursion and type cache retained as a local synchronous data structure, so that the hot loop remains efficient without introducing stale cross-file state.
37. As a tooling maintainer, I want project iteration to remain sequential initially, so that Effect concurrency does not pretend to parallelize one blocking IPC channel.
38. As a tooling maintainer, I want timing captured during the boundary slice and early fixture burn-down, so that IPC viability is demonstrated before the generic, type-operator, and React resolver investment.
39. As a tooling maintainer, I want explicit stop conditions for backend leakage and unacceptable IPC growth, so that implementation pauses for architecture work instead of accumulating workarounds.
40. As a repository maintainer, I want the extractor to follow existing workspace scripts, catalog pinning, formatting, linting, type-checking, testing, and CI conventions, so that it behaves like the repository's other tooling packages.
41. As a repository maintainer, I want one exact Effect v4 RC shared by core, test, and Node integration packages, so that RC-line API drift cannot create an incoherent dependency graph.
42. As a repository maintainer, I want the release-age bypass limited to the exact reviewed Effect RC 111 packages, so that the repository's global supply-chain delay remains intact for every other dependency and future Effect version.
43. As a repository maintainer, I want the reference checkouts pinned and reproducible in every worktree, so that implementation never relies on another worktree's absolute filesystem paths.
44. As a repository maintainer, I want the upstream MIT copyright and license retained with copied and ported material, so that the repository honors its redistribution obligations.
45. As a repository maintainer, I want upstream fixture refreshes to be explicit reviewed changes, so that a moving beta dependency cannot silently redefine the task's acceptance criteria.
46. As a repository maintainer, I want the extractor to remain private tooling, so that this implementation does not accidentally expand the public package or release contract.

## Implementation Decisions

- Create one private internal-package workspace alongside the repository's existing tooling packages. Its package name is `@elmeragroup/api-extractor`; it is not publishable and has no standalone distribution build in this scope.
- Respect ADR-0005: `@elmeragroup/ui` remains the sole public package. Publishing the extractor or exposing it as a product requires a later architectural decision.
- Add `effect`, `@effect/vitest`, and `@effect/platform-node` to the workspace catalog at exactly `4.0.0-rc.111`; `@effect/platform-node-shared` resolves transitively at the same version. All Effect-family packages must use that exact tuple.
- Keep the global 72-hour minimum release age unchanged. Add exact-version release-age exclusions for `effect`, `@effect/vitest`, `@effect/platform-node`, and `@effect/platform-node-shared` at `4.0.0-rc.111`. Do not exempt bare package names or the entire `@effect` scope, so later releases must satisfy the normal policy unless separately reviewed.
- Keep the workspace's existing TypeScript 7.0.2 and Vitest 4.1.10 pins. Do not add TypeScript 6 or a strada compatibility alias in this scope.
- Follow the internal-package TypeScript configuration and the repository's standard build, lint, type-check, test, and aggregate CI script names. Add lint overrides only for a demonstrated incompatibility, never pre-emptively.
- Document reproducible setup for the two ignored reference checkouts: the upstream extractor beta.6 snapshot at commit `e145350` and the researched Effect revision for RC 111. No committed implementation or test may reference another worktree by absolute path.
- Expose one high-level service, `ProjectExtractor`, built from one immutable project snapshot and closed with its surrounding Effect Scope.
- Make `ProjectExtractor.extractModule(file, options)` the only extraction operation. Project-wide processing is caller composition over this method, not another public service API.
- Keep the resolver pipeline synchronous because it performs thousands of fine-grained checker operations over a synchronous IPC client. Effect owns acquisition, release, configuration, typed failures, and orchestration around that hot loop.
- Introduce a `CompilerBackend` service expressed entirely in package-owned vocabulary. It owns project/config parsing, symbol/type/node handles, classification, declaration resolution, checker operations, and source metadata required by the resolver.
- Restrict imports from TypeScript's unstable programmatic and AST modules to the TS7 backend implementation. Enforce this restriction mechanically in tests or lint configuration.
- Represent compiler entities with opaque package-owned handles and normalized discriminants. Do not expose compiler enums, flags, node classes, handle classes, checker types, program types, or project types beyond the backend.
- Treat backend isolation as proven only if a backend replacement leaves the semantic model, resolver signatures, and conformance runner unchanged. The four-case boundary slice is a mandatory architecture gate before broad resolver implementation.
- Port the upstream parser pipeline in its meaningful order: module export discovery, descriptor normalization, type-resolution session, ordered resolver registry, component transformation, and balanced scoped context.
- Preserve the upstream parser options and their default policies, including inclusion filtering, object-resolution limits, external-type inclusion, and resolved versus syntax-preserving type-operator output.
- Preserve mode-correlated output typing for resolved and syntax-preserving type operators rather than collapsing both modes into an ambiguous result.
- Model the semantic output with Effect Schema. Preserve the existing string discriminators and upstream JSON shapes for modules, exports, documentation, type names, and all 16 type-node variants.
- Use schema classes only where model methods provide value; use schema structs for pure data. Recursive codecs use suspended schemas with explicit codec annotations.
- Move constructor-side normalization into explicit smart constructors while preserving upstream union canonicalization, equivalence, recursion, and string-rendering semantics.
- Define `ExtractionResult` as three independent concerns: the upstream-compatible semantic module, a readonly list of structured warnings, and a schema-validated provenance sidecar.
- Keep docs-only metadata out of the semantic module. Adding declaration paths, RSC state, default initializers, or forwarded-package ownership to the upstream model is forbidden because it would change the conformance contract.
- Address provenance entries by stable structural paths made from export, member, and property names rather than object identity. Each entry can carry declaration paths, synthesized-symbol state, and an authored default initializer.
- Let the docs adapter derive library-owned versus forwarded packages and RSC status from provenance. Repository-relative path conversion, missing-JSDoc policy, RSC policy, MDX, and frontmatter remain docs concerns.
- Port fatal failures into tagged schema errors with separate cases for configuration, backend startup/operation, missing files, and parser failures. Preserve parsed-symbol breadcrumbs where available and retain wrapped causes for diagnostics.
- Port the three recoverable upstream warning variants as a closed tagged union. Return warnings in `ExtractionResult`; do not call warning callbacks, `console.warn`, or Effect logging automatically.
- Retain the depth-sensitive per-extraction type cache as a plain map inside the resolution session. It never outlives one `extractModule` call.
- Do not add cross-file result caching. A later cache would need immutable project-snapshot scope, normalized option identity, and an explicit policy for callback-valued options.
- Do not add worker pools, concurrent extraction, Stream APIs, NDJSON output, or incremental project delivery. Iterate modules sequentially through the one extraction operation.
- Copy all 116 upstream fixture directories and preserve every original expected output as the immutable strada oracle. The original oracle is never regenerated in place.
- For a legitimate TS7 divergence, add a separate TS7 expected output and a colocated machine-readable reason that identifies the compiler limitation or intentional semantic difference. The runner reports unchanged matches, reviewed divergences, and failures separately.
- Copy the upstream MIT license and copyright notice and identify copied or substantially ported material plus commit `e145350` in the package documentation.
- Pin upstream conformance to beta.6 at `e145350`. There is no automatic upstream sync; any refresh is a separate reviewed change with renewed attribution and explained oracle changes.
- Add a docs adapter that produces the existing API-part and API-prop model from the semantic module and provenance sidecar.
- Add a dedicated shadow comparison across the component inventory. Compare complete API-part results and the current problem set from both extractors.
- Leave the existing docs extractor as the production implementation. Do not alter the root docs generation dependency, delete the old compiler walk, or switch generated output in this scope.
- Capture native API timing during the four-case boundary slice and after the second fixture group. If backend objects leak through the seam or timing growth makes the remaining suite impractical, stop broad implementation and revise the boundary or batching strategy first.

## Testing Decisions

- The highest and primary test seam is the project-scoped `extractModule(file, options)` operation. Conformance, virtual-filesystem integration, provenance, warning, error, and docs-shadow behavior should enter through this seam.
- A good extractor test supplies TypeScript source plus options and asserts encoded semantic output, warnings, provenance, or typed failure. It does not assert resolver call order, internal stacks, Effect plumbing, or compiler-backend method calls.
- Pure canonicalization, equivalence, documentation, and model smart constructors may be tested below the extraction seam because they are deterministic domain laws with no compiler lifecycle.
- Port the upstream conformance runner and all 116 fixture inputs and outputs. Build one shared immutable virtual project layer for the suite so tests share startup cost while each assertion still calls `extractModule`.
- Keep fixture inputs typechecked through a dedicated test-input configuration independently of extraction assertions.
- Preserve fixture focus and skip naming conventions and a regeneration workflow, but constrain regeneration to TS7-specific outputs. The immutable upstream oracle must never be overwritten by the regeneration command.
- A fixture passes only when encoded module output matches the original strada oracle or an explicitly reviewed TS7 oracle with its reason record.
- The conformance report must print total fixtures, unchanged oracle matches, reviewed TS7 divergences, and failures. A reduced unchanged count is a reviewed signal, not hidden test maintenance.
- Start with an architecture vertical slice covering explicit alias arguments, a multi-hop mapped alias, declaration-file re-exports including type-only forms, and a representative Base UI/React compound component.
- Add an architecture assertion that no source outside the TS7 backend imports any TypeScript unstable entry point. This is an external boundary contract even though it is enforced statically.
- Use the TS7 virtual filesystem implementation for in-memory projects. Replace upstream custom compiler-host shimming with a small helper and test that helper through the public extraction seam.
- Test schema encoding of the semantic module against fixture JSON and schema decoding/round-tripping of representative recursive nodes, errors, warnings, and provenance entries.
- Test that structural provenance paths are stable and supply declaration ownership, synthesized state, and authored default initializers without adding fields to the semantic module JSON.
- Test recoverable warnings as returned data and fatal conditions as tagged failures. Assert that extraction produces no automatic console or Effect log output.
- Port useful pure upstream tests for canonicalization, equivalence, documentation, and descriptor ordering. Do not recreate module-mocking tests whose seam disappears in the new architecture when conformance covers the behavior.
- Run the docs adapter in shadow mode across the full component inventory and compare complete API-part arrays plus the accumulated problem set. Every difference must be fixed or recorded as reviewed before completion.
- Keep the existing docs generator active during all tests. The shadow comparison must not write production generated artifacts or change the root build dependency.
- Record native API timing for the four boundary cases and after the second fixture group. Include the measurements in the implementation resolution so reviewers can judge whether batching work was correctly deferred.
- Verify backend finalizers by observing that the project API process closes when the test layer Scope ends, including failure paths.
- Run the repository's normal formatting, lint, type-check, package tests, and aggregate CI checks after adding the tooling package and task-graph edges.

## Out of Scope

- Replacing, deleting, or changing the production docs API extractor.
- Changing generated documentation output, API-table policy, RSC classification policy, MDX compilation, frontmatter, search, or markdown endpoints.
- Adding TypeScript 6, a strada backend, side-by-side execution of the original upstream package, or automatic parity adjudication through strada.
- Implementing a TypeScript 7.1 backend or claiming that its future asynchronous API can reuse the synchronous hot loop without redesign.
- Cross-file result caching or cache invalidation across snapshots and option sets.
- Parallel compiler workers, Effect concurrency for module extraction, streaming project output, NDJSON, or incremental delivery.
- An MCP server, MCP tools, MCP resources, HTTP or stdio transports, or decisions about exposing provenance to remote clients.
- A CLI, daemon, watch mode, language-server integration, or public network interface.
- A standalone build artifact, npm publication, changesets, public exports, or changes to the repository's single-public-package ADR.
- Automatic synchronization with future upstream extractor releases or silent regeneration of upstream fixture outputs.
- General docs-model redesign beyond the adapter needed for shadow comparison.
- Performance optimization beyond collecting timing evidence and stopping for a separately designed batching intervention when required.

## Further Notes

- Source research: [Effect-native TypeScript API extractor](../research/028-effect-api-extractor.md).
- Governing package decision: [ADR 0005 — Single-package architecture](../../docs/adr/0005-package-architecture.md). This task adds private tooling and does not alter the public package family.
- The upstream semantic and fixture baseline is `typescript-api-extractor` 1.0.0-beta.6 at commit `e145350`.
- The implementation pins the Effect family to `4.0.0-rc.111` and deliberately bypasses the release-age check only for the four exact RC 111 package selectors. pnpm supports exact-version entries in `minimumReleaseAgeExclude`; the global 72-hour policy remains unchanged for everything else. See [pnpm dependency-resolution settings](https://pnpm.io/settings/dependency-resolution#minimumreleaseageexclude).
- TypeScript remains pinned at 7.0.2. Its programmatic surface is explicitly unstable; the compiler boundary and stop conditions are required scope, not optional refactoring polish.
- The confirmed testing seam is the one project-scoped `extractModule(file, options)` operation. The user's approval of the revised research establishes this seam; no additional discovery interview is required.
