# `@elmeragroup/api-extractor`

Private Effect-native TypeScript API extraction for this workspace. The package owns the
semantic model and lifecycle boundary; only `src/backend/ts7/**` imports TypeScript 7's
unstable native API. Extraction is synchronous inside that backend and scoped by Effect so
the native compiler process is closed on both success and failure.

`src/parser.ts` is the backend-neutral seam. The backend returns normalized module descriptors,
opaque symbol/type/node/signature handles, and primitive graph facts; `src/parse/resolver.ts`
consumes that vocabulary to construct semantic types. Resolver policy—including recursion/session
state, signatures and parameters, object/index shapes, authored aliases and explicit arguments,
type-parameter substitution, two-hop mapped aliases, unions/intersections, external types, warning
messages, and the React component transform—does not import TypeScript. `BackendProject` requires
`resolveModule`, including declaration lookup for authored `.js` specifiers. The boundary test runs
the unchanged resolver against a compiler-free replacement graph rather than injecting a final
semantic tree.

The four Issue 02 fixture directories contain both immutable upstream `output.json` files and
separate TS7 `output.tsgo.json`/warning oracles. The upstream files are copied unchanged and are
never regenerated. Run `node scripts/issue-02-timing.ts --write` only for an explicit reviewed
timing refresh; normal CI uses `node scripts/issue-02-timing.ts --check` and evaluates all four
public-seam samples against the recorded stop conditions.

## Reproducible references

The ignored `.ref/` checkouts used during development are reproducible from any worktree:

```sh
git clone https://github.com/michaldudak/typescript-api-extractor.git .ref/typescript-api-extractor
git -C .ref/typescript-api-extractor checkout --detach e145350
git clone https://github.com/Effect-TS/effect.git .ref/effect
git -C .ref/effect checkout --detach effect@4.0.0-rc.111
```

The upstream extractor reference is pinned to `e145350` and the Effect reference is pinned
to release tag `effect@4.0.0-rc.111` (`648f566dd259898e7697c7fcb796183ccbc474ab`). Runtime
dependencies remain pinned to the same Effect RC tuple in `pnpm-workspace.yaml`.

The semantic model and resolver boundary are original workspace code informed by the
upstream extractor. Any future port of upstream source must retain the upstream MIT notice
and attribution in `NOTICE`, and any Effect-derived source must retain Effect's notice there
as well. No absolute path to an ignored checkout is used by package code or tests.
