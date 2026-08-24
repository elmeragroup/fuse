# Research 028 — Effect-native TypeScript API extractor

Scheduled as [Effect-native TypeScript API extractor](../tickets/028-effect-native-api-extractor.md). Researched 2026-08-23 against primary sources: the `typescript-api-extractor` checkout at `.ref/typescript-api-extractor` (v1.0.0-beta.6, commit `e145350`), the Effect v4 checkout at `.ref/effect` (`effect@4.0.0-rc.111`), the installed `typescript@7.0.2` package in `node_modules/typescript`, this monorepo's own source, and first-party TypeScript announcements (URLs in Sources).

## TL;DR

- **Feasible, and the ground is unusually well prepared.** The monorepo already pins `typescript: 7.0.2` (`pnpm-workspace.yaml:43`) and the docs app already drives the TS 7 native compiler's programmatic API (`apps/docs/scripts/lib/api.ts:19` imports `API` from `typescript/unstable/sync`). The extractor's 116-fixture conformance harness is backend-neutral and ports cleanly, but its expected JSON is a **strada-specific oracle**; tsgo divergences must remain explicit and reviewable.
- **A mechanical port is impossible in this workspace — and that's clarifying.** `typescript-api-extractor` requires `typescript ^5.8 || ^6.0` (strada) and calls `ts.createProgram` (`.ref/typescript-api-extractor/package.json:42`, `src/index.ts:5`). `typescript@7.0.2` exports **no strada API at all** — its `exports` map is `.` → `lib/version.cjs` plus `./unstable/*` (`node_modules/typescript/package.json`). The port must be a rewrite of the resolver pipeline against a **backend service interface**, with a tsgo (`typescript/unstable/sync|async`) implementation first and an optional strada implementation via the official `@typescript/typescript6` bridge later.
- **Effect v4 corrections to folklore** (verified in `.ref/effect`): there is **no `ServiceMap`** — it was renamed back to `Context` (`.ref/effect/.changeset/pre/slow-beans-battle.md:28`); Schema lives at **`effect/Schema`** (capital S, single 17k-line module — there is no `effect/schema` subpath); `@effect/platform` merged into core (`effect/FileSystem`, `effect/Path`), with live Node layers in `@effect/platform-node`; the service pattern is `class X extends Context.Service<X, Shape>()("id")`; MCP server tooling ships inside core at `effect/unstable/ai/McpServer` with stdio and HTTP transports.
- **Recommended first scope**: new private tooling package `tooling/api-extractor` (`@elmeragroup/api-extractor`), with an Effect-native shell (project lifecycle as a scoped Layer, Schema-based data model, typed errors/warnings) around a **pure synchronous resolver core**. The core talks only in package-owned compiler vocabulary; only the tsgo backend may import `typescript/unstable/*`. Drive the rewrite through one project-scoped `extractModule(file, options)` seam, the copied fixture suite, and a non-cutting docs shadow comparison. Cross-file caching, concurrent/streaming orchestration, docs cutover, a strada backend, publishing, and MCP are later scopes.
- **Honest risk**: the tsgo API is officially labeled "not ready", and TypeScript 7.1 is expected to ship "a new (and different) API" — the backend seam is not optional architecture, it is the survival plan.

---

## 1. Anatomy of `typescript-api-extractor`

Checkout: `.ref/typescript-api-extractor` — 13,674 lines of non-test source, 7,096 lines of co-located tests, plus the `test/` conformance suite (measured with `wc -l`).

### 1.1 Public API

`src/index.ts` re-exports everything from `config`, `parser`, `models`, plus `createProgram`/`CompilerOptions`/`Program` straight from `typescript` (`src/index.ts:1-6`). The whole public surface is four functions and one options bag:

- `loadConfig(tsConfigPath)` → `{ options, fileNames }` — wraps `ts.readConfigFile` + `ts.parseJsonConfigFileContent`, throws the first diagnostic (`src/config.ts:9-28`). Reads the file system synchronously (`node:fs`).
- `parseFile(filePath, options, parserOptions?)` — creates a throwaway `ts.Program` and delegates (`src/parser.ts:64-86`).
- `parseFromProgram(filePath, program, parserOptions?)` — the real entry point: gets the checker, finds the source file (throws `Error` if absent), builds a `ScopedParserContext`, calls `parseModule` (`src/parser.ts:96-126`). **Fully synchronous.**
- `ParserOptions` (`src/parser.ts:209-245`): `shouldInclude`, `shouldResolveObject` (default policy `(propertyDepth === 0 || propertyCount <= 50) && depth <= 10`), `includeExternalTypes` (default false), `typeOperatorOutput: 'resolved' | 'syntaxOnly'`, `onWarning` callback (defaults to `console.warn`).
- Output typing is a clever recursive mapped type: `ResolvedModuleNode` vs `SyntaxOnlyModuleNode` correlate the `typeOperatorOutput` mode through the whole model graph (`src/parser.ts:16-52`).

### 1.2 Data model (`src/models/`)

DTO-ish classes with `toString()` renderers, serialized by `JSON.stringify` in tests. Root shapes:

- `ModuleNode { name, exports: ExportNode[], imports? }` (`src/models/module.ts`), `name` is the file path relative to `compilerOptions.rootDir` (`src/parsers/moduleParser.ts:139-141`).
- `ExportNode { name, type: AnyType, documentation?, reexportedFrom?, extendsTypes? }` with `withType()` and `isPublic(requireExplicitAnnotation?)` policy methods (`src/models/export.ts`).
- `AnyType` — a 16-member discriminated union on a string `kind`: `array | class | component | enum | external | function | intersection | intrinsic | literal | object | tuple | typeOperator | typeParameter | typeQuery | union` (`src/models/node.ts:23-38`).
- `TypeName { name, namespaces?, typeArguments? }` (`src/models/typeName.ts`), `Documentation { description?, defaultValue?, visibility?, tags[] }` with `hasTag`/`getTagValue` (`src/models/documentation.ts`).
- Compound constructors delegate normalization: `new UnionNode(...)` runs `typeCanonicalizer.canonicalizeUnionMembers` in the constructor (`src/models/types/union.ts:14-16`); `typeCanonicalizer.ts` (flattening, boolean-literal collapse, `never` removal, nullish-to-end ordering, dedup) and `typeEquivalence.ts` (structural equality incl. the "unaliased `any` is a wildcard" rule) are singletons (`docs/architecture.md:135-150`).
- `withTypeName` clones a node through its prototype to relabel it without re-running constructor normalization (`src/models/node.ts:40-50`).

### 1.3 Parser pipeline

Layered exactly as `docs/architecture.md` describes:

1. **Module walk** — `parseModule` gets the source-file symbol, `checker.getExportsOfModule`, filters values re-exported through `export type *` (this uses `ts.resolveModuleName`, `src/parsers/moduleParser.ts:63-81`), parses each export, then applies post-transforms (`src/parsers/moduleParser.ts:86-160`).
2. **Export normalization** — `exportDescriptors.ts` produces `ExportDescriptor` records (export-specifier targeting, namespace merging, re-export metadata) before any model node exists; `exportParser.ts` converts descriptors to `ExportNode`s.
3. **Type resolution** — `typeResolver.ts` is a small facade over `TypeResolutionSession` (`src/parsers/typeResolutionSession.ts`), which owns the cross-cutting mechanics: a **resolution cache keyed by `(typeId, typeStack depth, propertyDepth)`** because depth-sensitive options make the same type resolve differently at different depths (`src/parser.ts:176-182`), recursion guards (`typeStack` of internal type IDs), type-parameter substitution scopes, and warning replay.
4. **Ordered resolver registry** — 17 resolvers in a meaningful order, syntax-preserving ones first (`authored-keyof-alias`, `type-operator`, `external`, `type-parameter`, `array`, `intrinsic`, `enum`, `union`, `intersection`, `tuple`, `literal`, `callable`, `class`, `object`, `extract-utility`, `conditional`, `index-like`) — `src/parsers/typeResolvers/index.ts:30-59`. The largest single resolver is `typeOperatorTypeResolver.ts` (1,822 lines; its test is 4,485 lines).
5. **React transform** — `exportTransforms.ts` runs `transformComponentExport` over finished nodes, turning qualifying functions into `ComponentNode`s with merged prop lists (`src/parsers/exportTransforms.ts:1-20`, `src/parsers/componentParser.ts:43`).
6. **Scoped context** — `ScopedParserContext` extends the public `ParserContext` with balanced scope helpers (`runWithSymbolScope`, `runWithSourceNodeScope`, `runWithPropertyValueScope`, `runWithTypeParameterSubstitutionScope`) implemented as push/try/finally-pop over shared mutable stacks (`src/parserContext.ts:10-41`, `src/parserContextFactory.ts:14-77`).

### 1.4 Error and warning model

- **Fatal**: `ParserError extends Error` wrapping an inner error plus the `parsedSymbolStack` breadcrumb (`src/ParserError.ts`); `parseModule` wraps any non-`ParserError` throw (`src/parsers/moduleParser.ts:153-158`). `parseFromProgram` throws bare `Error` for a missing file (`src/parser.ts:119-121`).
- **Recoverable**: a closed union of three structured warnings — `unsupported-type-fallback` (with `typeFlags[]`, `typeText`, `sourceText?`), `missing-enum-declaration`, `missing-default-export-symbol` — each carrying `filePath/line/column/parsedSymbolStack` (`src/parser.ts:250-296`), delivered via the `onWarning` callback. This is already an Effect-shaped design: tagged, data-carrying, non-fatal.

### 1.5 Dependencies and effects

Two runtime deps: `typescript ^5.8 || ^6.0` and `es-toolkit` — the latter is **imported nowhere** in `src/` or `test/` (grep verified) and can be dropped. Side effects are confined to the edges: `src/config.ts` (fs + `ts.sys`) and `src/parsers/moduleParser.ts` (module resolution); everything else is pure synchronous computation over the checker. Uses one internal-API shim: `typeResolutionUtils.ts` reads private type IDs and builds shallow cycle placeholders (`docs/architecture.md:66-67`) — notably, tsgo's `Type` exposes `id` **publicly** (see §3.2).

### 1.6 Test-suite catalog

Two tiers, both vitest (v4.1.10, `testTimeout: 30_000` because every case builds a real program — `vitest.config.ts`):

**Conformance fixtures** — `test/index.test.ts` (44 lines) globs `test/fixtures/**/input.{d.ts,ts,tsx}` (116 fixture directories), builds **one shared `ts.Program`** over all inputs with `loadConfig(test/tsconfig.json)`, then for each fixture asserts `JSON.parse(JSON.stringify(parseFromProgram(input, program)))` equals `output.json`. `UPDATE_OUTPUT=true` regenerates outputs through prettier (`pnpm test:regen`). `.only`/`.skip` in a fixture directory name focuses/skips it. A separate `tsconfig.inputs.json` typechecks the fixtures themselves (`pnpm typecheck:test-inputs`). Fixture families by prefix: `react-*` (~20: components, hooks, forwardRef, memo, overloads, MUI OverridableComponent), `generic-*` (~13), `mapped-*`/`readonly-array-mapped-*` (~10), `module-*` (re-export forms, d.ts, namespaces), `class-*`, `enum-*`, `interface-*`, `union/intersection`, `type-operator`/`keyof`, `external-*`, `jsdoc-*`, `namespace-*`, plus regression singletons.

**Co-located tests** — 20 `src/**/*.test.ts` files (7,096 lines): integration tests that build tiny in-memory programs (`test/support/inMemoryProgram.ts` — a `ts.createCompilerHost` override that serves a `Record<path, source>` and falls back to the real FS for lib/package resolution) and assert model output; a few pure unit tests with `vi.mock` (`src/parsers/exportParser.test.ts`); `test/support/parserContext.ts` builds the production context capturing warnings into an array.

The key portability fact: **fixtures encode only `(input source, options) → output JSON`** — nothing about the compiler backend. They are a ready-made conformance suite for any reimplementation.

---

## 2. Effect v4 inventory (verified in `.ref/effect` @ `effect@4.0.0-rc.111`)

Version: `.ref/effect/packages/effect/package.json:4`. All ecosystem packages (`@effect/vitest`, `@effect/platform-node`, `@effect/ai-*`, …) share `4.0.0-rc.111`.

### 2.1 Module layout — what replaced what

- Subpath exports: `.` (barrel), `./testing`, `./unstable/{ai,cli,http,httpapi,rpc,schema,sql,workers,workflow,…}`, and a `./*` catch-all mapping **every top-level source file** to a subpath (`packages/effect/package.json` exports block). So: `effect/Schema`, `effect/Context`, `effect/Layer`, `effect/FileSystem`, `effect/Path`, `effect/Cache`, `effect/Stream`, `effect/unstable/ai/McpServer`.
- **`ServiceMap` does not exist.** It was renamed back to `Context`: ".changeset/pre/slow-beans-battle.md:28 — 'Rename the `ServiceMap` module to `Context` across exports, docs, and tests.'" Zero `ServiceMap` references in any `.ts` file.
- **There is no `effect/schema` subpath** — Schema is the top-level `packages/effect/src/Schema.ts` (17,104 lines). (Some in-repo docs like `packages/effect/MCP.md` still show `from "effect/schema"` — stale, 0 code hits.)
- **`@effect/platform` merged into core** (`MIGRATION.md` § Package Consolidation): `effect/FileSystem` (key defined `Context.Service("effect/platform/FileSystem")` at `src/FileSystem.ts:663`), `effect/Path` (`src/Path.ts:255`, pure-POSIX default layer at `:867`), `effect/PlatformError`. Live Node implementations stay in `@effect/platform-node`: `NodeFileSystem.layer`, `NodePath.layer`, `NodeStdio.layer`, and the aggregate `NodeServices.layer` (`packages/platform/node/src/NodeServices.ts:36-53`, the v4 replacement for `NodeContext.layer`).

### 2.2 Services and layers

The v4 service pattern (`packages/effect/src/Context.ts:201-244`; canonical example `ai-docs/src/01_effect/03_services/01_service.ts`):

```ts
import { Context, Effect, Layer, Schema } from "effect";

export class Database extends Context.Service<
  Database,
  {
    query(sql: string): Effect.Effect<Array<unknown>, DatabaseError>;
  }
>()("myapp/db/Database") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      /* ... */
      return Database.of({ query });
    })
  );
}
```

- `Context.Key<Id, Shape> extends Effect<Shape, never, Id>` (`Context.ts:64-69`) — the key **is** an effect, so `const db = yield* Database` works directly.
- `Context.Tag`, `Context.GenericTag`, `Effect.Tag`, `Effect.Service` are all gone (grep-verified); migration table in `.ref/effect/migration/services.md`. Convention: static `.layer` (not v3 `.Default`), id strings namespaced like `"myapp/db/Database"`.
- `Context.Reference<S>("id", { defaultValue })` (`Context.ts:1324`) gives a service **with a default** — no layer required to use it, a layer can override. Ideal for options/policy (see §4.3).
- Layer constructors are dual/curried: `Layer.succeed(Key, value)`, `Layer.sync(Key, () => value)`, `Layer.effect(Key, effect)` (`Layer.ts:807/926/1014`), plus `mergeAll` (1246), `provide` (1432), `unwrap` (1174), `mock` (2304), `build` (699).

### 2.3 Schema

Key APIs in `packages/effect/src/Schema.ts` (line refs): `Struct` 3581, `Union(members, {mode})` 4923, `Literal(s)` 2785/4969, `TaggedStruct` 6196, `TaggedUnion` 6470 (returns `.cases/.guards/.match`), `suspend` 5112, `Class` 14660, `TaggedClass` 14720, `TaggedError` 14841, `optional/optionalKey` 2511/2444, `decodeUnknownEffect/decodeUnknownSync` 1516/1920, `encodeSync` 2355, `is` 1442, `check/brand` 5135/5242, `Defect()` 10844, `toStandardSchemaV1` 1299. v3→v4 breaks: variadic → array arguments (`Union([A, B])`, `Literals(["a","b"])`), `annotations` → `annotate`, `decodeUnknown` → `decodeUnknownEffect` (`.ref/effect/migration/schema.md`).

Recursive discriminated unions — the shape `AnyType` needs — use `Schema.suspend` with an **explicit `Schema.Codec<T>` annotation** (required per `packages/effect/SCHEMA.md` § Recursive Schemas, lines 2103-2185):

```ts
const AnyTypeRef = Schema.suspend((): Schema.Codec<AnyType> => AnyType);
const UnionNode = Schema.Struct({ kind: Schema.Literal("union"), types: Schema.Array(AnyTypeRef) /* … */ });
const AnyType = Schema.Union([UnionNode, ObjectNode /* …14 more */]);
```

A tested recursive tagged-union example exists at `packages/effect/test/schema/toJsonSchemaDocument.test.ts:3335-3358`. `Schema.Class<Self>("Id")({ fields })` supports methods on the class body — the model's `toString()`/`isPublic()` renderers survive the port.

### 2.4 Errors

- `Schema.TaggedError<Self>()("Tag", fields)` (`Schema.ts:14841`) — serializable, `yield*`-able (mixes in `Cause.YieldableError`); the repo's own style guide (`LLMS.md:43-46, 151-153`) uses it for all domain errors, with `cause: Schema.Defect()` for wrapped defects. `Data.TaggedError` (`Data.ts:761`) remains for in-process-only errors.
- `Effect.try` (`Effect.ts:1638`) and `Effect.tryPromise` (`Effect.ts:969`; the thunk now receives an `AbortSignal`; default error is `Cause.UnknownError`).
- Renames: `catchAll` → `Effect.catch`, `catchAllCause` → `catchCause`, `catchSome` → `catchFilter` (`migration/error-handling.md`); `catchTag/catchTags` unchanged.

### 2.5 Caching, concurrency, streaming

- `Cache.make({ lookup, capacity, timeToLive? })` (`Cache.ts:288-305`; **`capacity` is required**, default TTL infinity). `Effect.cached`/`cachedWithTTL`/`cachedInvalidateWithTTL` (`Effect.ts:7110/7164/7227`). **`Effect.cachedFunction` does not exist in v4** (grep-verified) — the replacement is `Cache.make` or `RcMap.make({ lookup, idleTimeToLive })` (`RcMap.ts:239`) for scoped resources.
- `Effect.forEach(items, f, { concurrency, discard })` (`Effect.ts:779-790`); `Concurrency = number | "unbounded"` (`Types.ts:452`, no more `"inherit"`). `Effect.all` supports `mode: "result"`.
- `Stream<A, E, R>` wraps a `Channel` of `NonEmptyReadonlyArray<A>` chunks — v4 dropped `Chunk` for plain arrays (`Stream.ts:122-127`). Relevant ops: `fromIterable` 947, `mapEffect` (takes `concurrency`) 1821, `rechunk` 6853, `runCollect` 10396, `runForEach` 10638, `toReadableStream` 10999, NDJSON/text codecs via `pipeThroughChannel`/`splitLines` 8867/9267.

### 2.6 Testing

`@effect/vitest@4.0.0-rc.111` (`packages/vitest/package.json`; peers `effect workspace:^`, `vitest >=4.1.0 <5.0.0` — the monorepo catalog's `vitest: 4.1.10` satisfies it). API (`packages/vitest/src/index.ts`): `it.effect(name, () => Effect<…>)` (runs on `TestClock`), `it.live`, `layer(myLayer)((it) => …)` for sharing a built Layer across a describe block, `.each`, `.prop` (Schemas as arbitraries), `it.flakyTest`. It re-exports all of vitest. Core also ships `effect/testing` (`TestClock`, `TestConsole`, `FastCheck`).

### 2.7 MCP

MCP server tooling is **inside core effect**, not a separate package: `packages/effect/src/unstable/ai/McpServer.ts` (2,431 lines) + `McpSchema.ts` + `McpProtocol.ts`; prose guide `packages/effect/MCP.md` (partly stale, trust source). Surface: `McpServer.layerStdio({ name, version, protocols })` (`McpServer.ts:1207-1222`, requires the `Stdio` service — provide `NodeStdio.layer` from `@effect/platform-node`, or `Stdio.layerTest` in tests, see `test/unstable/ai/McpServer/McpServer.test.ts:715-735`); `McpServer.layerHttp({ path, … })` (`:1317`); `McpServer.toolkit(toolkit)` (`:1614`) registering a `Toolkit` as a Layer; `McpServer.resource` (`:1857`, incl. a template-tag overload with `McpSchema.param`); `McpServer.prompt` (`:2055`). Tools are `Tool.make(name, { description, parameters, success, failure, dependencies })` (`unstable/ai/Tool.ts:1204-1265`) grouped by `Toolkit.make(...)` — **the MCP input/output JSON Schemas are derived from the Effect Schemas automatically**, and declared failures become `isError: true` tool results.

---

## 3. TS 7 / tsgo reality check

### 3.1 Status (first-party sources)

- **TypeScript 7.0 shipped 2026-07-08** ("Announcing TypeScript 7.0", devblogs) — the 10x native Go port. npm `typescript` dist-tags: `latest: 7.0.2`, `next: 7.1.0-dev.*`. TypeScript 6.0 (2026-03-23) is the last JS-codebase release and the API bridge.
- **7.0 ships no stable API**: "While TypeScript 7.0 is here, it does not ship with an API… We expect TypeScript 7.1 to ship with a new (and different) API" (7.0 announcement). Strada-compat is explicitly **not** the plan ("we will not port _all_ APIs to Corsa as we are rethinking API compatibility" — typescript-go discussion #454). Tools that embed the compiler are told to use `@typescript/typescript6` (`npm install -D typescript@npm:@typescript/typescript6`, re-exports the TS 6.0 API + `tsc6`).
- `@typescript/api` never shipped standalone (npm 404); it was folded into `@typescript/native-preview` (typescript-go commit `effd0f8c`), which is now frozen (last publish 2026-07-07) since `typescript@7` itself ships the same `unstable/*` API. The typescript-go README's feature table still lists "API | not ready". The language service is LSP-native (nearly complete).

### 3.2 What `typescript@7.0.2` actually exposes (verified in `node_modules/typescript`)

Exports: `./unstable/sync`, `./unstable/async`, `./unstable/fs`, `./unstable/proto`, `./unstable/ast` (+ `ast/is`, `ast/factory`, `ast/utils`, `ast/scanner`, `ast/visitor`, `ast/clone`) — and **nothing else programmatic** (`node_modules/typescript/package.json` exports). The API spawns the native compiler as a child process and talks over IPC; sync and async clients are the same 528-line surface, the async one returning Promises (`dist/api/sync/api.d.ts`, `dist/api/async/api.d.ts`).

Surface relevant to the extractor (all in `dist/api/sync/api.d.ts`, line refs):

| Extractor need (strada)                                                                                  | tsgo equivalent                                                                                                                                          | Where                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ts.createProgram(files, options)`                                                                       | `new API({ cwd, fs? })` → `updateSnapshot({ openProjects: [tsconfig] })` → `Project { program, checker }`                                                | `api.d.ts:23-39, 119-130` |
| `loadConfig` (readConfigFile/parseJsonConfigFileContent)                                                 | `api.parseConfigFile(file)`                                                                                                                              | `api.d.ts:38`             |
| `checker.getExportsOfModule`                                                                             | present                                                                                                                                                  | `:320`                    |
| `checker.getSymbolAtLocation`, `getTypeOfSymbol`, `getDeclaredTypeOfSymbol`, `getTypeOfSymbolAtLocation` | present (with batched array overloads to amortize IPC)                                                                                                   | `:215-226, 253`           |
| `type.getCallSignatures()`                                                                               | `checker.getSignaturesOfType(type, SignatureKind.Call)`                                                                                                  | `:233`                    |
| JSDoc: `symbol.getDocumentationComment`, `getJsDocTags`                                                  | `checker.getDocumentationCommentOfSymbol` / `getJsDocTagsOfSymbol`, also on `Symbol`                                                                     | `:322-323, 408-409`       |
| alias chasing: `getAliasedSymbol`, `getImmediateAliasedSymbol`, `getExportSpecifierLocalTargetSymbol`    | present                                                                                                                                                  | `:292-299`                |
| internal `(type as any).id` for recursion cache                                                          | **public** `TypeObject.id`, plus `flags`, `objectFlags`, `aliasSymbol`, `aliasTypeArguments`, `readonly`, `elementFlags`                                 | `:411-434`                |
| flags enums                                                                                              | `TypeFlags`, `SymbolFlags`, `ObjectFlags`, `ElementFlags`, `SignatureKind`, `ModifierFlags` exported                                                     | `:21`                     |
| type classification                                                                                      | `isUnionType/isTupleType/isConditionalType/…` guards + `Type.is*()` methods; `isErrorType`                                                               | `:464-510`                |
| `ts.isFunctionDeclaration` etc.                                                                          | `typescript/unstable/ast/is` (already used by the docs app, `apps/docs/scripts/lib/api.ts:13-18`)                                                        | package exports           |
| tuple/array identity, readonly                                                                           | `isTupleType`, `isArrayType`, `TupleType` + `elementFlags`/`readonly`                                                                                    | `:270-271, 428-430`       |
| index signatures                                                                                         | `getIndexInfosOfType`                                                                                                                                    | `:282`                    |
| generics                                                                                                 | `getTypeArguments(ref)`, `getConstraintOfTypeParameter`, `getBaseConstraintOfType`                                                                       | `:327, 287-288`           |
| enum values                                                                                              | `getConstantValue(node)`                                                                                                                                 | `:290`                    |
| external-lib detection                                                                                   | `program.isSourceFileFromExternalLibrary`, `getSourceFileMetadata`                                                                                       | `:162, 148`               |
| in-memory programs (test support)                                                                        | **`createVirtualFileSystem(files: Record<string,string>)`** passed as `APIOptions.fs`                                                                    | `dist/api/fs.d.ts`        |
| `ts.resolveModuleName` (used by `moduleParser.ts:69` for `export type *` filtering)                      | **no direct equivalent** in the sync API — needs a workaround (resolve via the export symbols' declaring source files instead)                           | gap                       |
| declarations                                                                                             | `Symbol.declarations` are `NodeHandle[]` needing `.resolve()` — an extra IPC hop per authored-syntax lookup, mitigated by the client's source-file cache | `:339-356, 388`           |

Two facts make "TS 7 native" concrete rather than aspirational here: **the docs app already runs this API in production** (`apps/docs/scripts/lib/api.ts:41-57` — `openLibraryProject()` opens `packages/ui/tsconfig.json` and walks `getExportsOfModule`/`getPropertiesOfType`/`typeToString` synchronously), and `oxlint-tsgolint: 7.0.2001` (catalog line 27) already runs tsgo-based type-aware linting.

### 3.3 Backend-abstraction recommendation

Because (a) the workspace's `typescript` has no strada API, (b) tsgo's API is unstable and will change in 7.1, and (c) the fixture harness can run against more than one backend even though its current oracle is strada-specific, the port should talk to the compiler **only through a `CompilerBackend` service**. The interface covers the operation families in the table above, but it must be defined in _our_ vocabulary rather than exposing tsgo's `Type`, `Symbol`, `NodeHandle`, flags, or AST node types.

This is a hard architectural invariant, not folder organization:

- only `backend/ts7/**` may import `typescript/unstable/*`;
- the resolver core sees package-owned opaque handles, normalized discriminants/flags, and package-owned result records;
- backend handles never appear in `ModuleNode`, warnings, errors, or the public service interface;
- a future backend change is considered isolated only when the model, resolver signatures, and conformance runner compile unchanged.

The upstream parser uses many concrete compiler types and AST predicates, so “backend-only rewrite at 7.1” is a claim to prove, not assume. Before the broad port, a vertical slice must demonstrate authored aliases/generics, mapped types, `export type *`, and a React compound component through this boundary. Implementations:

1. **`backend/ts7/**` (now)** — wraps `typescript/unstable/sync` (see §4.4 for why sync, not async). Program lifecycle is a scoped Layer (`api.close()` as the finalizer).
2. **`backend/strada.ts` (optional, later)** — wraps `typescript@npm:@typescript/typescript6` for byte-parity comparison against upstream `typescript-api-extractor` output and as a hedge; also the only way to run the original library side-by-side.
3. **7.1 API (future)** — when the stable API lands, it becomes a third implementation behind the same key; fixtures decide when it is ready.

---

## 4. Proposed package design

### 4.1 Placement, naming, scaffolding

- Directory `tooling/api-extractor`, name **`@elmeragroup/api-extractor`**, **`private: true`**. ADR-0005 says tooling lives under `tooling/*` and `packages/ui` remains the sole public package (`docs/adr/0005-package-architecture.md:11`; `docs/spec/tooling.md:21`). Publishing later means a separate product decision and an ADR amendment.
- `pnpm gen` only scaffolds components (`plopfile.mjs:72`), so scaffold by hand from the existing tooling-package conventions: catalog-only deps, `type: module`, `tsconfig.json` extending `@elmeragroup/typescript-config/internal-package.json` (`tooling/typescript/internal-package.json`), and standard script names (`build`, `test`, `type-check`, `lint`, `ci:checks`) so the root task graph picks it up without a per-package turbo file. Add an oxlint override only if a rule demonstrably needs scoping.
- Catalog additions to `pnpm-workspace.yaml`: `effect`, `@effect/vitest`, `@effect/platform-node` (none present today — grep-verified zero `effect` usage anywhere in the workspace), all pinned exactly to `4.0.0-rc.111`; `@effect/platform-node-shared` arrives transitively at the same version. Keep the global `minimumReleaseAge: 4320`, but add exact-version `minimumReleaseAgeExclude` entries for those four RC 111 packages. Do not use a package-name-only or `@effect/*` exception: the bypass is for this reviewed version tuple only. `typescript: 7.0.2` and `vitest: 4.1.10` are already present and compatible.
- In-repo consumers can import source directly (the docs generate script already runs `node --experimental-strip-types`, `apps/docs/package.json`), so no distribution build belongs in the first scope. Add `tsdown` only if this tooling package later needs a standalone artifact.
- **Worktree preflight**: `.ref/` is ignored and worktree-local, so a new worktree does not inherit the research checkouts. Before implementation, make `.ref/typescript-api-extractor` at commit `e145350` and `.ref/effect` at the researched commit/version available in this worktree through reproducible checkouts or local links. Record the pinned commits and setup in the package README; committed code and tests must not depend on another worktree's absolute path.

### 4.2 Layout and port map

```
tooling/api-extractor/
  package.json / tsconfig.json / vitest.config.ts
  src/
    index.ts                      # package barrel
    errors.ts                     # Schema.TaggedError classes (§4.5)
    model/                        # upstream-compatible Schema data model (§4.3)
      TypeName.ts  Documentation.ts  Export.ts  Module.ts
      nodes.ts                    # 16 node schemas + AnyType recursive union
      canonicalize.ts             # port of models/typeCanonicalizer.ts (pure)
      equivalence.ts              # port of models/typeEquivalence.ts (pure)
    provenance.ts                 # declaration/source metadata sidecar (§4.3)
    CompilerBackend.ts            # Context.Service key + interface (§3.3)
    backend/ts7/**                # Layer over typescript/unstable/sync (scoped)
    ExtractorOptions.ts           # options + defaults (§4.4)
    parse/
      session.ts                  # port of typeResolutionSession + parserContext scopes
      module.ts export.ts descriptors.ts documentation.ts common.ts
      resolvers/                  # 17 resolvers, same ordered registry
      transforms/component.ts     # React transform
    Extractor.ts                  # facade service + layer (§4.4)
  test/
    fixtures/**                   # copied verbatim from .ref/typescript-api-extractor/test/fixtures
    conformance.test.ts           # fixture runner (§5)
    support/virtualFs.ts          # createVirtualFileSystem helpers
```

Module-by-module port map (source → target):

| `.ref/typescript-api-extractor/src/…`                                                                                                                                          | New module                                                          | Notes                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `config.ts`                                                                                                                                                                    | `backend/*` (`loadConfig` → `parseConfigFile` on the backend)       | becomes `Effect<Config, ConfigError, CompilerBackend>`                                                    |
| `parser.ts` (entry points, options, warnings)                                                                                                                                  | `Extractor.ts`, `ExtractorOptions.ts`, `errors.ts`, `provenance.ts` | one project-scoped `extractModule(file, options)` operation; preserve mode-correlated output typing       |
| `ParserError.ts`                                                                                                                                                               | `errors.ts`                                                         | `Schema.TaggedError`                                                                                      |
| `parserContext.ts` / `parserContextFactory.ts`                                                                                                                                 | `parse/session.ts`                                                  | scope helpers stay sync push/pop                                                                          |
| `parsers/moduleParser.ts`, `exportParser.ts`, `exportDescriptors.ts`, `exportTransforms.ts`, `componentParser.ts`, `documentationParser.ts`, `common.ts`, `sourceFileUtils.ts` | `parse/…`                                                           | `resolveModuleSpecifier` needs the tsgo workaround (§3.2)                                                 |
| `parsers/typeResolutionSession.ts` + `typeResolution*.ts`                                                                                                                      | `parse/session.ts`, `parse/resolvers/_registry.ts`                  | cache stays a per-parse `Map` (§4.6)                                                                      |
| `parsers/typeResolvers/*` (17 files)                                                                                                                                           | `parse/resolvers/*`                                                 | port only after the compiler-boundary vertical slice proves the hard cases                                |
| `models/*`                                                                                                                                                                     | `model/*`                                                           | classes → `Schema.Class`/structs                                                                          |
| `test/support/inMemoryProgram.ts`                                                                                                                                              | `test/support/virtualFs.ts`                                         | replaced by `createVirtualFileSystem` (`dist/api/fs.d.ts`) — ~150 lines of compiler-host shimming deleted |

### 4.3 Schema-based data model — the first real Effect win

Port each `models/types/*` class to a schema (structs for pure data, `Schema.Class` where methods earn their keep), keep the existing `kind` string discriminators (they are already the JSON contract of the 116 `output.json` fixtures — e.g. `test/fixtures/react-component-function-declaration/output.json` is exactly the serialized model), and tie the recursion with `Schema.suspend` + explicit `Schema.Codec<AnyType>` annotations (§2.3). What this buys, concretely:

- **The fixture assertion becomes the codec**: `Schema.encodeSync(ModuleNode)(result.module)` must equal the applicable upstream oracle — round-trip fidelity is now a tested schema law, not a `JSON.parse(JSON.stringify(...))` coincidence.
- **Validated consumer boundary**: future consumers can decode persisted module JSON instead of trusting it; an MCP schema can be derived later without making MCP part of this package's first contract.
- **Constructor-normalization survives**: canonicalization moves from the `UnionNode` constructor into a `make` helper (schema `.check`s validate; a `canonicalizeUnion(types)` smart-constructor normalizes) — same policy, now in one visible place instead of a constructor side effect.

Do **not** add docs-specific fields to `ModuleNode` or its descendants: that would corrupt the upstream JSON contract. Upstream `ComponentNode` carries only `typeName` and `props`, and `PropertyNode` carries only `name`, `type`, `documentation`, and `optional`; neither retains declaration paths, synthesized-vs-declared origin, implementation defaults, RSC status, or forwarded-package ownership.

Instead, `ExtractionResult` carries a separate schema-validated `provenance` sidecar. Entries are keyed by a stable structural path (export/member/property names, never object identity) and may contain declaration paths, whether a symbol was synthesized, and authored default initializers. The docs adapter derives own-vs-forwarded packages and RSC status from those paths while keeping those policies docs-local:

```ts
type ExtractionResult = {
  module: ModuleNode;
  warnings: ReadonlyArray<ExtractWarning>;
  provenance: ReadonlyArray<{
    path: ReadonlyArray<string>;
    declarationPaths: ReadonlyArray<string>;
    synthesized: boolean;
    defaultInitializer?: string;
  }>;
};
```

### 4.4 Services and the sync-core decision

```ts
export class CompilerBackend extends Context.Service<CompilerBackend, BackendShape>()(
  "elmera/api-extractor/CompilerBackend",
) {
  static readonly ts7: Layer.Layer<CompilerBackend, BackendError> = /* backend/ts7/** */
}

export class ProjectExtractor extends Context.Service<ProjectExtractor, {
  extractModule(
    file: string,
    options?: ExtractorOptions,
  ): Effect.Effect<ExtractionResult, ExtractError>
}>()("elmera/api-extractor/ProjectExtractor") {
  static layer(request: OpenProject): Layer.Layer<
    ProjectExtractor,
    ConfigError | BackendError,
    CompilerBackend
  >
}
```

`ProjectExtractor.layer({ tsconfig, fs? })` owns one immutable project snapshot and releases its `API` process when the surrounding Scope closes. This gives production and tests the same highest useful seam: `extractModule(file, options)`. Project-wide iteration is ordinary composition over that operation, not a second extractor API.

**Deliberate design choice — the resolver core stays synchronous.** The extractor makes thousands of fine-grained checker calls per module (every property, signature, union member). Wrapping each in an `Effect` would put fiber overhead inside the hottest loop for zero gain, and the tsgo _sync_ client exists precisely because "much TypeScript API usage today is synchronous" (typescript-go PR #2716). So: resolvers are plain functions over the package-owned `BackendShape` (sync signatures); Effect owns project lifecycle, config loading, typed error mapping (`Effect.try` around the sync parse), and Scope safety. A future async compiler API may require a second backend shape or a redesigned hot loop; do not claim it can be absorbed without evidence from the boundary tests.

### 4.5 Error and warning model

- `class ExtractError extends Schema.TaggedError<ExtractError>()("ExtractError", { symbolStack: Schema.Array(Schema.String), cause: Schema.Defect() })` — the `ParserError` port; `FileNotInProgramError`, `ConfigError`, `BackendError` similarly (`Schema.TaggedError`, §2.4). Callers get typed channels: `Effect.catchTag("FileNotInProgramError", …)`.
- Warnings are already a closed tagged union (`src/parser.ts:250-296`) — port the three variants to a `Schema.TaggedUnion`-style union and **return them instead of calling back** as part of `ExtractionResult`. The package neither calls `console.warn` nor logs automatically; the docs adapter, CLI, or future server decides whether warnings fail, log, or render. Serializable warnings remain safe to expose to later consumers.

### 4.6 Lifecycle and deferred scaling features

- **Per-parse type cache stays**: a plain `Map<string, AnyType>` inside the session is depth-keyed, mutation-hot, and never outlives one `extractModule` call (`src/parser.ts:176-182`). Do not effect-ify it.
- **No cross-file cache in the first scope**: a file-path-only key is incorrect across project snapshots and option sets, while the docs build currently extracts each entry once. A later cache must live inside one immutable project scope and key at least the file plus normalized options; callback policies also need an explicit identity strategy.
- **Sequential project iteration in the first scope**: Effect fiber concurrency cannot parallelize blocking calls through one synchronous IPC channel. Real parallelism needs measured evidence and multiple backend processes. Use `collectTiming` during the boundary spike and fixture burn-down, but do not add worker orchestration pre-emptively.
- **No `Stream` API in the first scope**: callers can iterate files and call the one extraction seam. Add streaming only when a real consumer needs incremental delivery or bounded-memory project output.

---

## 5. TDD migration plan

The conformance suite is the highest behavioral oracle, but its expected JSON records strada behavior. The first-scope testing seam is always a project-scoped `extractModule(file, options)` call; fixtures must not bypass it to test resolver internals directly. Plan:

1. **Copy fixtures and license verbatim** — all 116 directories from `.ref/typescript-api-extractor/test/fixtures` (inputs _and_ expected outputs; the JSON contract is the `kind`-discriminated model, §4.3). Preserve the original `output.json` files as the strada oracle. Include the upstream MIT copyright and license in the tooling package and identify copied/ported material plus commit `e145350` in its README. Keep the `.only`/`.skip` directory-name conventions, the `UPDATE_OUTPUT` regen mode, and a fixture-typecheck config (`test/tsconfig.inputs.json` pattern).
2. **Port the runner first** (`test/index.test.ts`, 44 lines → `test/conformance.test.ts`): glob fixtures, build **one shared backend/program Layer** over all inputs (mirroring the original's single shared `ts.Program` for speed), then per fixture either plain `it` + `Effect.runPromise` or `@effect/vitest`'s `layer(TestBackendLayer)((it) => { it.effect(name, …) })` — the `layer` helper (§2.6) is exactly the shared-program pattern. Keep a generous `testTimeout` (the original uses 30 s for CPU-contention reasons, `vitest.config.ts`).
3. **Prove the backend boundary before the broad port.** Implement the thinnest end-to-end slices needed to pass `alias-with-explicit-type-args`, `mapped-alias-two-hop`, `module-dts-declarations-and-reexports`, and `base-ui-component`. During this spike, assert that no module outside `backend/ts7/**` imports `typescript/unstable/*`, collect IPC timing, and revise the package-owned handle vocabulary if any resolver needs to reach through the boundary. Do not begin the full resolver burn-down while this invariant is false.
4. **Run the whole suite red, make it green group by group.** Suggested order, simplest semantics → hardest, using fixture-name prefixes as the grouping (skip-list drives the burn-down):
   1. `module-export-forms`, `function-declaration-expression-arrow`, `function-parameters-optional-and-defaults` — intrinsics, literals, plain functions, docs.
   2. `interface-extends-basic-resolution`, `object-property-count-limit-scope`, `jsdoc-*`, `enum-members-values-and-docs` — objects, index signatures, JSDoc, enums, the `shouldResolveObject`/`shouldInclude` policies.
   3. `union-*`, `intersection-*`, `large-nested-union-any-order`, `nested-function-union-any-deduplication` — brings in the canonicalizer + equivalence (port their pure co-located tests `models/typeCanonicalizer.test.ts` first; they need no compiler at all).
   4. `type-array-syntax-resolution`, `type-tuple-resolution`, `type-record-resolution`, `type-index-signature-resolution` — containers, readonly.
   5. `class-*` — constructors, members, visibility, overloads.
   6. `generic-*`, `mapped-*`, `readonly-array-mapped-*`, `alias-with-explicit-type-args` — substitution scopes and binding derivation, the subtlest non-React area.
   7. `keyof`/type-operator fixtures + `typeOperatorOutput` modes — the largest resolver (1,822 lines).
   8. `namespace-*`, `module-reexports-*`, `module-dts-declarations-and-reexports`, `interface-merged-default-and-aliased-exports` — export descriptors, re-export metadata, `export type *` (the `resolveModuleName` workaround lands here).
   9. `react-*` (~20 fixtures incl. `react-mui-overridable-component`, `base-ui-component`) — the component transform.
   10. `external-*` + `includeExternalTypes` policy.
5. **Co-located tests**: port the pure ones wholesale (canonicalizer, equivalence, documentation, exportDescriptors ordering); port the in-memory-program integration tests onto `createVirtualFileSystem` (§3.2) — the 150-line `inMemoryProgram.ts` compiler-host shim is deleted, its own test (`inMemoryProgram.test.ts`) becomes a smoke test of the virtual-FS helper. Skip the `vi.mock`-based unit tests (`exportParser.test.ts`) — module-mocking seams won't survive the restructure; the fixtures cover the behavior.
6. **Divergence policy**: where tsgo legitimately differs from strada (type printing, union member ordering, alias preservation), never replace or silently regenerate `output.json`. Add `output.tsgo.json` plus a colocated machine-readable reason record that classifies the difference and links the relevant compiler limitation or intentional semantic choice. A fixture passes only when it matches the original oracle or an explicitly reviewed tsgo oracle. The test report prints total fixtures, unchanged matches, reviewed divergences, and failures. A strada backend is not required to adjudicate the first scope; the pinned upstream output remains the baseline.

---

## 6. Docs-app integration

Today the docs app hand-rolls extraction in `apps/docs/scripts/lib/api.ts` (341 lines): `openLibraryProject()` opens `packages/ui/tsconfig.json` through `typescript/unstable/sync`, `describeComponentApi` (`api.ts:287-340`) walks `getExportsOfModule` → props via `getPropertiesOfType`, printing types with `typeToString`, reading destructuring defaults off the AST, gating on missing JSDoc via `ProblemLog` (`scripts/lib/errors.ts`), orchestrated by `scripts/generate.ts:332-363` and wired into turbo as the `generate` task (`apps/docs/turbo.json`; root `//#lint` depends on it, `turbo.json:10`). Spec: `docs/spec/docs-site.md` §8.

The first scope does **not** replace that production path. It adds a docs adapter that maps `ExtractionResult.module` plus the provenance sidecar (§4.3) into the existing `ApiPart`/`ApiProp` shapes (`apps/docs/src/lib/docs-model.ts:39-58`). Declaration paths let the adapter preserve own-vs-forwarded classification; authored initializers preserve defaults; the docs app continues to own RSC detection, repo-relative path policy, missing-JSDoc failure policy, MDX, and frontmatter.

Run the existing and new extractors side by side through a dedicated shadow-comparison test or command across the component inventory. Compare the full `ApiPart[]` output and the problem set. The first scope is complete only when every difference is either fixed or explicitly reviewed, but the root docs generation task continues to use `lib/api.ts`. Production cutover and deletion of the existing walk require a later spec after shadow parity; this keeps `docs#generate` and the root lint/build gate unchanged during the extractor rewrite.

## 7. Future MCP server (out of first scope)

Everything needed is in the `effect` checkout (§2.7). This is feasibility evidence, not a contract for the first specification. A future MCP design must decide whether provenance paths are exposed, normalized, or omitted. Illustrative sketch:

```ts
const toolkit = Toolkit.make(
  Tool.make("extract_api", {
    description: "Extract the public API of a TypeScript module",
    parameters: { file: Schema.String, tsconfig: Schema.optional(Schema.String) },
    success: ExtractionResult, // ModuleNode schema → MCP outputSchema, derived
    failure: ExtractError, // becomes isError:true tool results
  })
);
const server = McpServer.toolkit(toolkit).pipe(
  Layer.provide(toolkitHandlersLayer), // handlers yield* ProjectExtractor
  Layer.provide(
    McpServer.layerStdio({ name: "elmera-api-extractor", version, protocols: [McpProtocol.v2025_11_25] })
  ),
  Layer.provide(NodeStdio.layer), // layerStdio requires the Stdio service
  Layer.provide(ProjectExtractor.layer({ tsconfig })),
  Layer.provide(CompilerBackend.tsgo)
);
```

Per-component API tables also map naturally onto `McpServer.resource` templates (`McpServer.ts:1857`, `mcp://…/${component}` with `McpSchema.param`). The conformance harness for the server exists upstream to crib from: `packages/effect/test/unstable/ai/McpServer/` (stdio + HTTP harnesses).

## 8. Residual risks and stop conditions

1. **tsgo API instability (highest).** Officially "not ready"; 7.1 will ship "a new (and different) API". The §3.3 boundary limits the intended blast radius, but the vertical slice must prove that compiler-owned objects do not leak. If a hard case cannot be expressed without leaking tsgo types into the resolver core, stop and revise the boundary before the broad port.
2. **Checker-fidelity gaps.** Known missing op: `ts.resolveModuleName` (needed by `export type *` filtering, `moduleParser.ts:63-81`); `Symbol.declarations` as `NodeHandle`s adds IPC hops to authored-syntax lookup; strada-internal tricks (`authoredTypeAlias.ts` lazy-cache preflights, `typeResolutionUtils.ts`) have no guaranteed tsgo analogue. The vertical slice and fixture burn-down (§5.3-4) are the discovery mechanism. A fixture may be unreachable on tsgo v7.0, but it must remain a visible, reasoned divergence rather than disappear.
3. **Output parity vs. strada.** The original `output.json` files encode strada checker behavior (union ordering, alias preservation, `typeToString` text). The dual-oracle policy (§5.6) preserves that evidence and prevents `UPDATE_OUTPUT` from blessing drift silently.
4. **IPC chattiness/performance.** The extractor is checker-call-dense; per-call IPC could dominate. Record `collectTiming` during the four-case boundary slice and again after the second fixture group. If the trajectory makes the full suite impractical, stop for batching design before investing in the generic/type-operator/React groups. The batched array overloads (`getSymbolAtLocation(nodes[])`, `api.d.ts:216`) are the first lever.
5. **Effect v4 is an RC.** The `ServiceMap`→`Context` rename happened _within_ the RC line. Pin RC 111 exactly and treat the matching `.ref/effect` source as authoritative over prose docs (even in-repo `MCP.md` is already stale). Preserve the repository-wide 72 h policy and scope its deliberate bypass to exact RC 111 selectors for the four resolved Effect packages; future versions do not inherit the exception.
6. **Publication is a different product decision.** The package lives under `tooling/*` and is private. Publishing the extractor or an MCP server requires its own consumer/security contract, an ADR amendment, and the internal-name collision check (`docs/adr/0005-package-architecture.md:33`).
7. **Docs cutover remains gated on shadow parity.** `docs#generate` gates root lint and build (`turbo.json:10`). The first scope adds comparison coverage without changing the production generator; a later spec owns cutover and deletion.
8. **Upstream drift is opt-in.** The first scope targets the immutable beta.6 snapshot at `e145350`; there is no automatic fixture sync. A refresh is a separate reviewed change that records the new commit, preserves attribution, and explains oracle changes.

## 9. First specification boundary

The first implementation specification should describe one deliverable: a private, Effect-native tooling package that extracts an upstream-compatible, schema-validated TypeScript module model from an immutable TS7 project snapshot through one project-scoped operation.

**In scope**:

- `tooling/api-extractor` scaffolding, the exact Effect RC 111 dependency tuple, and its exact-version release-age exclusions;
- package-owned compiler handles plus the scoped tsgo backend;
- `ProjectExtractor.extractModule(file, options)` as the single production and conformance seam;
- upstream-compatible `ModuleNode`, typed warnings/errors, and the separate provenance sidecar;
- the compiler-boundary vertical slice, all 116 conformance fixtures, pure model-law tests, explicit divergence reporting, and upstream MIT attribution;
- a dedicated docs shadow adapter/comparison that leaves the production docs generator untouched;
- timing evidence at the two stop points in §8.

**Out of scope**:

- replacing or deleting the docs app's current extractor;
- a strada or TypeScript 7.1 backend;
- cross-file caching, worker concurrency, `Stream`/NDJSON APIs, or a standalone build artifact;
- MCP transport/tool/resource implementation;
- publishing this private tooling package or changing ADR-0005.

**Definition of done**:

- only the tsgo backend imports `typescript/unstable/*`;
- the four-case boundary slice and the complete fixture runner pass through `extractModule`;
- every fixture either matches the immutable strada oracle or has an explicit reviewed tsgo oracle and reason;
- schema encoding preserves upstream module JSON, while provenance independently supplies every fact required by the docs shadow adapter;
- the shadow comparison accounts for every component API and problem-set difference without changing `docs#generate`;
- normal repository formatting, lint, type-check, test, and CI checks pass for the changed task graph.

## Sources

- `.ref/typescript-api-extractor` @ commit `e145350` — `src/` (all files cited above), `test/`, `docs/architecture.md`, `docs/output-format.md`, `docs/api-reference.md`, `package.json`, `vitest.config.ts`.
- `.ref/effect` @ `effect@4.0.0-rc.111` — `packages/effect/src/{Schema,Context,Layer,Effect,Cache,Stream,FileSystem,Path,Data,Types}.ts`, `packages/effect/src/unstable/ai/{McpServer,McpProtocol,Tool,Toolkit}.ts`, `packages/effect/{SCHEMA,MCP,LLMS,MIGRATION}.md`, `migration/*.md`, `packages/vitest/`, `packages/platform/node/`, `.changeset/pre/slow-beans-battle.md`.
- `node_modules/typescript` @ 7.0.2 — `package.json` (exports), `dist/api/sync/api.d.ts`, `dist/api/async/api.d.ts`, `dist/api/fs.d.ts`, `dist/api/options.d.ts`.
- This repo — `pnpm-workspace.yaml`, `turbo.json`, `plopfile.mjs`, `packages/ui/{package.json,tsconfig.json,vitest.config.ts,tsdown.config.ts}`, `apps/docs/{package.json,turbo.json,scripts/generate.ts,scripts/lib/api.ts,src/lib/docs-model.ts}`, `docs/adr/0005-package-architecture.md`, `docs/spec/{tooling,docs-site}.md`, `wayfinder/TRACKER.md`.
- First-party web: [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (2026-07-08), [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [Announcing TypeScript Native Previews](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/), [A 10x Faster TypeScript](https://devblogs.microsoft.com/typescript/typescript-native-port/), [microsoft/typescript-go README + FAQ #454](https://github.com/microsoft/typescript-go), [PR #2716 (sync API without NAPI)](https://github.com/microsoft/typescript-go/pull/2716), [@typescript/native-preview on npm](https://www.npmjs.com/package/@typescript/native-preview), [typescript on npm](https://www.npmjs.com/package/typescript).
