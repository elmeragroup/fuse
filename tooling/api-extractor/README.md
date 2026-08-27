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

`src/parse/container.ts` owns array and tuple policy, and `src/parse/mapped.ts` owns
mapped-type policy. An array's public name comes only from an alias, never from the authored
`Array<T>`/`T[]` spelling; a tuple's ordered elements come from the reference's type arguments,
so optional, labelled, rest, and variadic elements keep their semantic order. Authored element
syntax is aligned to those elements by _width_, not by index, mirroring upstream's tuple element
selection plan: a fixed position is one element, a spread of a known finite tuple contributes that
tuple's own elements, and an open rest absorbs the remainder and describes each of them with its
array's element syntax. Authored element syntax is only ever read from array literal syntax or from
a reference the backend verified against TypeScript's own `Array`/`ReadonlyArray` interfaces —
never from a reference's first type argument on the strength of its name, which for any other
generic (or a project declaration that shadows those names) describes a different type than the
element the checker reports. A spread of a _generic_ tuple alias is left to the semantic element type,
because its authored elements are written in terms of the declaration's own parameters. A mapped type
becomes one synthesized index signature only when its key domain is open (a constraint whose
base is `string` or `number`); a finite literal key domain, or an `as` clause, is left to
ordinary object resolution so the real properties are reported. The semantic model has a single
`indexSignature` slot with a `string` or `number` key, matching upstream: a `symbol` or
pattern key, or a second signature that cannot fit, is reported as an `omitted-index-signature`
warning instead of disappearing. That warning carries a `reason`, because the two omissions are
not the same fact: `unrepresentable-key` is a key domain the model cannot encode, while
`additional-signature` is the representable `number` key of a legal `string`-plus-`number` pair,
which lost only the single slot. A `readonly` index signature has no encoding in that model and
is reported with the same shape as a mutable one. Index-signature keys have their own provenance
path (`…/indexSignature/key`), which is what distinguishes an authored key from a mapped type's
synthesized one; array, tuple, and index-signature containers are otherwise transparent in the
provenance grammar, so a nested property keeps the container's own path.

`src/canonical/` owns compound-type policy below the extraction seam: `render.ts` reproduces the
upstream `toString()` forms, `equivalence.ts` compares model types structurally (wildcard `any`,
alpha-renamed generics, unordered compound members), and `canonicalize.ts` exposes the `unionType`
and `intersectionType` smart constructors that flatten, simplify, order, and deduplicate members.
Those functions are pure and hold no state, so recursion and equivalence work stays local to one
synchronous `extractModule` call. Their laws are tested directly in
`test/issue-04-canonicalization.test.ts` without starting a compiler process.

The four Issue 02 fixture directories contain both immutable upstream `output.json` files and
separate TS7 `output.tsgo.json`/warning oracles. The upstream files are copied unchanged and are
never regenerated. Run `node scripts/issue-02-timing.ts --write` only for an explicit reviewed
timing refresh; normal CI uses `node scripts/issue-02-timing.ts --check` and evaluates all four
public-seam samples against the recorded stop conditions.

The Issue 04 union and intersection fixtures are listed in `issue04CanonicalizationFixtures`
(`scripts/fixture-registry.ts`). Eleven reproduce the immutable upstream `output.json`;
`mapped-type-prettify-intersection-resolution` keeps that upstream oracle unchanged and adds a
reviewed `output.tsgo.json` plus a `ts7-oracle.json` reason record. A TS7 oracle is only ever
refreshed as an explicit reviewed change, and its record carries the difference count and digest
against the preserved upstream oracle, so a stale or silently regenerated TS7 oracle fails CI.

The Issue 05 container fixtures are listed in `issue05ContainerFixtures`
(`scripts/fixture-registry.ts`). All twenty-five reproduce the immutable upstream `output.json`,
so this family carries no reviewed TS7 divergence of its own. Landing it did refresh the
`base-ui-component` TS7 oracle and its `ts7-oracle.json` reason record as an explicit reviewed
change, because mapped-key, recursive-container, and boolean-literal handling move leaves inside
the external React graph that record already excludes from the equality contract.
`test/fixtures/issue-05-review` is a workspace-authored fixture, not an upstream port: it pins the
container and index-signature cases raised in review — rest-element pairing, an index type reached
without authored `keyof` syntax, an array element reached through a reference that is not one of
TypeScript's own array interfaces (including project declarations that shadow those names, in
`shadowed.ts`), a container alias whose elements must not become its name's type arguments, the
key set a `keyof` resolves to, library names under `includeExternalTypes`, and the two
`omitted-index-signature` reasons.

The Issue 07 generic and alias fixtures are listed in `issue07GenericFixtures`
(`scripts/fixture-registry.ts`). Thirteen reproduce the immutable upstream
`output.json`; `type-alias-basic-resolution` keeps that upstream oracle
unchanged and adds a reviewed `output.tsgo.json` plus a `ts7-oracle.json`
reason record, because TypeScript 7's union identity pinning erases the
intermediate named alias union at optional positions. A TS7 oracle is only ever
refreshed as an explicit reviewed change, and its record carries the difference
count and digest against the preserved upstream oracle.
Landing generic substitution refreshed the `base-ui-component` TS7 oracle and
its `ts7-oracle.json` reason record a second time as an explicit reviewed
change: render-callback state parameters now carry their instantiated alias
name and namespace exactly as upstream shows, anonymous construct-only union
arms resolve as the bare objects upstream reports (emptying that fixture's
recoverable-warning oracle), and module export ordering now reports locally
declared value exports first with everything else in source order — all inside
the external React graph the record excludes from equality, with the preserved
upstream oracle untouched.
`test/fixtures/issue-07-review` is workspace-authored, not an upstream port: it
pins constrained class/method/call-signature parameters, substitution through
nested properties/callbacks/containers/unions/intersections/returns,
declaration-scoped parameter identity for same-named parameters, chained and
recursive alias cutting with per-extraction bounds plus the structured
fallback warning a genuinely unresolvable cycle reports, generic tuple-alias
spread pairing, and concrete `keyof` flattening inside alias type arguments.

The Issue 06 class and callable fixtures are listed in `issue06CallableFixtures`
(`scripts/fixture-registry.ts`). All nine reproduce the immutable upstream `output.json`, so this
family also carries no reviewed TS7 divergence of its own. An exported class resolves from its
STATIC side — where construct signatures live — and reports constructors, instance members,
statics with their built-in Function names skipped, getter-only accessors as readonly properties,
and overload sets in source order; a class reached through an object keeps only its
property-kind members, mirroring upstream's declaration whitelist.
`test/fixtures/issue-06-review` is workspace-authored: it pins inherited-member extraction,
private/protected filtering on methods, callable interfaces whose named state cannot ride along
(`omitted-callable-members`, addressed at the callable's structural path), non-class shapes that
declare `new (…)` (`unrepresented-construct-signatures`, addressed at the
`constructSignatures` slot), material overload preservation, and rest-parameter optionality.
Two facts are normalized beyond the checker because TypeScript 7 keeps them out of symbol
space: constructor documentation is read from the authored JSDoc of the constructor declaration
(no checker symbol carries it), and per-overload parameter summaries are read from the owning
declaration's own `@param` entry so one overload's summary cannot leak into another.
`omitted-callable-members` is depth-gated: it reports only for callables anchoring a described
value at depth zero, while nested positions keep their pinned prior behavior.
`unrepresented-construct-signatures` is not: it reports wherever a non-class shape's construct side
would drop, including nested positions.
One reviewed deviation from upstream remains: at the export root a signature parameter whose
authored node names only a bare type parameter of the declaring signature is resolved without
replaying that node — the nameless anchor would otherwise be read as an unresolvable module
value — while nested positions keep the authored syntax.

The Issue 08 mapped-type fixtures are listed in `issue08MappedFixtures`
(`scripts/fixture-registry.ts`). All three reproduce the immutable upstream `output.json`, so
this family also carries no reviewed TS7 divergence of its own.
`external-mapped-type-name-preservation` carries its own vendored `node_modules/floating-ui`
stub, like `module-resolution-package` does: the mapped type it is named for lives inside that
external declaration, and the fixture pins that a union member derived from it still reports its
external name. `test/fixtures/issue-08-review` is workspace-authored, not an upstream port: it
pins filtered keys (`as never`), a conditional key remap on a plain object, `+?`/`-?` modifier
arithmetic outside the readonly-array wrappers, and the provenance split between synthesized
mapped members (marked, with no declaration ownership) and authored facts.

### Mapped-type value templates (Issue 08)

A mapped type over an open key domain synthesizes one index signature; a finite domain or an
`as` clause resolves through ordinary object resolution, where the checker's instantiated members
report their own optionality. The template node rides along to the value resolver only when it
contains a preservable `keyof` — the same gate `type-parameter.ts` applies to constraints and
defaults — so a template that merely names an alias (`type U = unknown`) cannot publish that
alias name onto the intrinsic the checker resolved, while `{ [P in K]: keyof T }` keeps the
syntax its key set needs. Synthesized members are marked in provenance: an open domain marks its
invented key (`…/indexSignature/key`), and finite or remapped domains mark every member the
checker had no declaration for, while homomorphic modifiers keep each member's own declaration
associated.

### Generic substitutions and aliases (Issue 07)

`src/parse/type-parameter.ts` owns type-parameter policy. Signature slots
(`resolveSignatureNode`) report constrained and defaulted parameter nodes by
replaying the authored constraint — the checker's base constraint steps in only
when that replay degraded to an `any` the source never wrote — and occurrences
elsewhere resolve through the chained-constraint view TypeScript's base
constraint provides. Class declarations carry their parameters as names, which
is exactly how the upstream class model represents them; their constrained
parameter nodes appear on method and call-signature slots instead. An authored
node naming a bare type parameter is refused as a public name from both sides
(authored and checker symbol), so a substitution never renames a shape after a
declaration's internal parameter.

Alias bindings flow through `src/parse/substitutions.ts`
(`bindAliasParameters`), keyed by declaration identity rather than name, so
same-named parameters of different declarations cannot contaminate each other.
The tuple selection plan uses those bindings to pair the spread of a _generic_
tuple alias (`[...Tail<string>]`) with the declaration's own element syntax,
rebound per instantiation; concrete `keyof` key sets flatten inside alias type
arguments. Deferred conditional utility instantiations (`Extract<keyof T,
string>`) resolve through the checker's base constraint. Recursion cutting,
equivalence, and every cache stay local to one synchronous `extractModule`
call; an unresolvable cycle degrades through the structured fallback contract
rather than silently disappearing.

### Type operators, conditionals, and output modes (Issue 09)

The Issue 09 type-operator fixtures are listed in `issue09TypeOperatorFixtures`
(`scripts/fixture-registry.ts`). Four reproduce the immutable upstream
`output.json`; `type-literal-union-resolution` keeps that upstream oracle
unchanged and adds a reviewed `output.tsgo.json` plus a `ts7-oracle.json`
reason record, because TypeScript 7 orders a reduced `keyof` key set by
sorted key where TypeScript 6 preserved the operand's declaration order (all
seven leaf differences are confined to that one operator's `resolvedType`
members). The family ports the deferred `type-extract-utility-resolution`
(`Extract<…>` conditional reduction), `type-alias-export-preservation`
(reduced `ConditionalAlias` union branch order), and
`unresolved-indexed-access-fallback` fixtures exactly.
`test/fixtures/issue-09-review` is workspace-authored, not an upstream port:
it pins that a unique symbol resolves to the `symbol` intrinsic carrying its
declaring name — as an exported constant and as a computed key inside a
`keyof` operand's object — with no fallback warning, and that `keyof` over a
local intersection keeps the authored intersection as its operand while
reporting both members' keys exactly.

Authored `keyof` syntax is reconstructed before every broad shape resolver —
upstream runs its operator resolvers first for the same reason — so an
operator is never replaced by its reduced result: the operand stays and the
checker's key set rides on `resolvedType`, with `resolutionKind` recording
whether it is exact, a base constraint, or a fallback. A `typeof X` /
`typeof import(…)` query operand is preserved as a `typeQuery` node carrying
the authored expression; named object operands compact to their public name
plus index signature, as upstream's shallow-object operand rule does. A
deferred conditional reports its resolved branches as a union; a built-in
`Extract` over an index-like check type resolves through the checker's base
constraint; and an Index or indexed-access shape reached without authored
syntax degrades through upstream's `resolveIndexLikeType` — base constraint
when one exists, otherwise `any`, silently. That operator machinery now lives
in `src/parse/type-operator.ts`, moved out of the resolver with zero behavior
change (the same recursion enters through a caller-supplied resolve callback,
as in `container.ts` and `mapped.ts`).

One piece of upstream's operator replay is deferred, with no ported or
applicable fixture demanding it: while type-parameter substitutions are
ACTIVE, `getIndexedAccessSourceTypeNodes` and its tuple-literal and
tuple-number selectors (`typeOperatorTypeResolver.ts:308-405`) recover the
authored source nodes an indexed access was written from — including tuple
element positions selected by a literal or numeric index — so a preservable
`keyof` inside them is replayed rather than resolved from the checker's
substituted type, and `getCollapsedUnionOperatorResult`
(`typeOperatorTypeResolver.ts:613-638`) recovers a pre-canonicalization union
origin member when exactly one authored union member was `keyof`. Both fire
only when substitutions are in scope, which is precisely when the checker's
own view has already consumed that syntax. A shape that needs them would
report through the existing fallback contract until the replay lands beside
the substitution scope it extends (`src/parse/substitutions.ts`).

The extraction option is correlated with the returned model the way upstream
correlates its parser entry points: a literal `typeOperatorOutput:
"syntaxOnly"` call returns `SyntaxOnlyExtractionResult`, whose operators
report `resolvedType`/`resolutionKind` as `never`; default and literal
`"resolved"` calls return `ExtractionResult`, whose operators all REQUIRE
their payloads, so a syntax-only result cannot be assigned to the resolved
view (upstream's own assignment error between its entry points); a
dynamically-typed option returns their union. Documentation, warnings, and
provenance keep their structural locations across both modes, and no backend
object reaches either result.

### Namespaces, merged declarations, and re-exports (Issue 10)

The Issue 10 module-surface fixtures are listed in `issue10ModuleSurfaceFixtures`
(`scripts/fixture-registry.ts`). Four reproduce the immutable upstream
`output.json`; `namespace-export-resolution` keeps that upstream oracle
unchanged and adds a reviewed `output.tsgo.json` plus a `ts7-oracle.json`
reason record, because TypeScript 7 hands the resolver a flattened union view:
optional enum properties arrive as expanded enum literals beside `undefined`,
and a two-hop alias union reports the final hop instead of the intermediate
name (both verified against the raw checker). The family ports
`module-reexports-basic` (`export * as`, renamed and type-only named
re-exports, merged namespaces reached through a specifier), two nested-
namespace alias fixtures, and the merged-interface/default/aliased-re-export
fixture.

The backend module walk now mirrors upstream's descriptor normalization. A pure
namespace export contributes only its flattened members; an `export * as Name`
re-export flattens the target module under the public name; any other export
contributes its own draft followed by the members of every namespace merged
onto its target — including through a specifier, so `export { f } from '…'`
still reports `f.Props`. Export ordering recovers TypeScript 6's symbol-table
semantics deterministically: locally declared values first, then symbols
introduced by an explicit statement of this container in statement order, then
star-contributed names in star order — applied at every namespace level, since
TypeScript 7's raw enumeration differs from TypeScript 6's. A type-only star
filters non-pure types BEFORE descriptor expansion, so a skipped function
cannot leak its merged namespace members as top-level names.

Re-export facts are preserved rather than erased: a renamed re-export carries
its original authored name on `ExportNode.reexportedFrom`; provenance entries
carry `reexportChain`, the repository-relative files of each intermediate
re-export declaration outermost-first, while `declarationPaths` keeps the
origin; documentation follows upstream's descriptor symbol — the ultimate
target for module re-exports, the local binding for local specifiers.
Namespace member exports apply upstream's public-name rule: the root type is
renamed to the exported name under the accumulated namespace path, which is
why `Root.NamespacedType` reports `{name: "NamespacedType", namespaces:
["Root"]}` even though the alias resolves elsewhere, and why qualified
operands like `Nested.Foo` report the declaration's own enclosing chain
(`["Root", "Nested"]`) before falling back to the written qualifier.

Three structured warnings cover the conditions the walk can no longer hide,
all rendered through the shared schema/message path:
`missing-default-export-symbol` (upstream's own condition; TypeScript 7
materializes `export default function f(){}` as the declaration itself with a
synthetic `default` symbol name, so the underlying declaration is resolved
through the declaration's authored name when possible), and
`unresolved-re-export` with reasons `cycle` (a barrel cycle stops at the first
revisit) and `ambiguous`. The `ambiguous` reason detects names two runtime
star exports contribute from different modules; TypeScript itself rejects that
shape with TS2308 at typecheck time, so it is unrepresentable in the
typechecked fixture suite but remains guarded for projects extracted without
that guarantee.

### React function components and hooks (Issue 11)

The Issue 11 React fixtures are listed in `issue11ReactFixtures`
(`scripts/fixture-registry.ts`). All ten reproduce the immutable upstream
`output.json`, so this family also carries no reviewed TS7 divergence of its
own: function declarations, function variables (`React.FC` annotations keep
the callable's own name as the component name), return-type recognition
including namespaced, generic, and nullable React returns, plain overload sets
squashed into one prop table (also through their generic form), callback,
literal, and optional prop shapes, and the two hook fixtures whose lowercase
names must stay ordinary functions with defaults and overload documentation
intact.

The resolver-owned transform mirrors upstream's `componentParser` policy on
package-owned facts only. Recognition requires a capitalized (or `default`)
export name plus a resolved function — or a union in which EVERY arm is such a
function — whose return type carries exactly one of the names `Element`,
`ReactElement`, or `ReactNode` in any position of a union, so a local
`ListElement` or the DOM's `HTMLElement` never promotes an ordinary function.
Component naming follows upstream's rule: an aliased union lends its own name;
an unaliased one takes the first arm's name only when every arm agrees. Props
are squashed across every call signature (or every overload declaration's own
authored props parameter, which keeps per-overload provenance on the
componentProps paths), a signature without a props parameter contributes an
empty use-set so the remaining forms' props become optional with `undefined`
added, and equivalent prop contributions collapse inside the union
constructor. A declined candidate keeps its resolved kind byte-for-byte — the
callable surface is preserved wherever the contract does not require the
component shape.

One structured warning extends upstream's silent pass-through: when a
capitalized export holds a union with SOME arms returning React node types and
at least one arm that does not, the export keeps its union kind and the
transform reports `uncertain-component-recognition` (reason
`mixed-component-union`) instead of silently changing the semantic kind.
`test/fixtures/issue-11-review` is workspace-authored, not an upstream port:
it pins that guard end-to-end (warning schema, rendered message, unchanged
union kind), all-component union merging, alias naming, the zero-prop
signature optionality rule, the call-signature fallback reading for annotated
constants without initializers, and the lookalike-return classifications.

### Wrapped, compound, and polymorphic React APIs (Issue 12)

The remaining upstream React family is listed in `issue12ReactFixtures` and
the complete audit (all 22 React fixtures plus the Base UI compound boundary)
is listed in `issue12ReactFixtureAudit` (`scripts/fixture-registry.ts`). The
four Issue 12 ports preserve their copied inputs and upstream `output.json`
files byte-for-byte. `react-forward-ref-component` and
`react-memo-component` reproduce their immutable upstream outputs. The
forward-ref union and MUI overridable fixtures keep separate `output.tsgo.json`
oracles and machine-readable `ts7-oracle.json` records: TypeScript 7 changes
checker member enumeration (87 and 164 leaf differences respectively), while
the authored component/ref structures and polymorphic props remain intact.
The MUI fixture also records its eight structured `omitted-index-signature`
warnings rather than silently dropping unsupported symbol/number signatures.

Wrapper expansion remains a React policy in `src/parse`, after dependency
ownership ordering has decided which external references are opaque. Component
recognition consumes every resolved call signature and every authored props
parameter, and the resolver follows the first argument of nested `memo` and
`forwardRef` calls so props provenance survives supported combinations. There
are two authored-recovery entry points:

- Direct exported overloaded functions retain each authored declaration's
  contribution, including the implementation declaration, as established by
  upstream.
- Identifiers reached through supported wrappers use every checker-visible
  public overload/signature, which excludes the implementation while retaining
  public generics.

Wrapper calls and React wrapper-type expansion exceptions both require the
canonical resolved React symbol identity, the public module and package origin
`react`, and external compiler ownership. Same-name lookalikes from another
dependency do not qualify. The wrapper type name, ref attributes, export
documentation, and property ownership remain visible, and generic or
overloaded surfaces are never reduced to one selected signature.

Namespace flattening exposes compound members as `Root.Member` descriptors,
including the Base UI-style `Props`, `State`, `Actions`, and `Value` surfaces.
The workspace-authored `test/fixtures/issue-12-review` fixture pins nested
wrappers, a namespace compound child, wrapper documentation, ref identity,
and public-seam provenance. No React-specific rule is added to the TS7 facts
backend, and the `facts.ts` size ceiling remains in force.

### External-type ownership and resolver ordering (Issue 13)

Ownership is a normalized backend fact rather than resolver-side path
matching. `src/backend/ts7/file-ownership.ts` classifies each declaration's
source file — project-authored, TypeScript's standard library, or packaged
dependency, plus the wider toolchain-directory form the built-in gates ask for —
and `src/parse/ownership.ts` consumes that classification through one mandatory
compiler operation (`declarationOwnership`), replacing every `node_modules` and
lib-directory probe that used to live in resolver code. Replacement backends
must explicitly report project ownership when appropriate; quantifiers stay
with their questions (a symbol is external when ANY of its declarations is,
upstream's `isSymbolExternal` ground truth).

The resolver now applies upstream's registry order where it matters:
dependency-owned types summarize as opaque references BEFORE unions,
callables, classes, and objects expand them (`externalPolicy`, mirroring
upstream's `resolveExternalType`). That ordering is why an external handler or
ref-callback alias reports as a named reference instead of a signature graph.
The summarization:

- declines type parameters; arrays and tuples whose container identity has no
  external alias (explicit `Array<T>` references included, answered by the
  normalized `builtInArray` fact); built-in utility aliases declared in
  TypeScript toolchain lib directories; and React's component wrapper types
  (`FC`, `FunctionComponent`, `ForwardRefExoticComponent`, memo/exotic), whose
  expansions feed the component transform — upstream's two allow-lists;
- names a fully-resolved external interface by its own name and everything
  else by the alias spelling it was reached as, keeping namespaces and type
  arguments on the node; an aliased bivariance wrapper renames to
  `React.RefCallback`, exactly like upstream;
- keeps the export-root boundary explicit: named dependency-alias
  summarization at the root is upstream-faithful, while dependency-owned bare
  interfaces and values are a documented workspace deviation that resolve to
  anonymous empty objects (without a public type name). The
  `test/fixtures/issue-13-review` vendored-package fixture pins both root
  shapes in `test/issue-13-upstream.test.ts`;
- runs only when `includeExternalTypes` is false. Enabled mode expands under
  the same limits upstream defaults to (`shouldResolveObject`: property depth
  zero or at most fifty properties, never past ten intermediate types), so
  dependency graphs stay bounded in both modes.

Upstream's external resolver emits no diagnostics of its own: unresolved
shapes degrade through its `unsupported-type-fallback` path (mirrored here
structurally) and nameless externals degrade to a silent `any`. This seam keeps
the structured warning on those degradations so an omission stays inspectable,
and no compiler path or handle reaches durable model identity — summarized
references carry names, namespaces, and arguments only, asserted end-to-end in
`test/issue-13-upstream.test.ts`.

The Issue 13 fixtures are listed in `issue13ExternalFixtures`
(`scripts/fixture-manifest.ts`). Six reproduce the immutable upstream
`output.json` byte-for-byte: the three hook fixtures and
`react-event-handlers` whose deferral this ordering resolves,
`external-conditional-type-resolution`, and
`module-reexports-aliased-source-tracking`. Nine keep that upstream oracle
unchanged and add reviewed `output.tsgo.json` oracles plus machine-readable
reason records for verified compiler-view divergences: `react-refs`
(alias-identity union expansion), `react-component-union-variants`,
`react-component-render-callback-props`, and
`generic-props-namespace-specialization` (the external React graph genus
recorded since Issue 02),
`react-component-overload-any-callback-deduplication` (reduced-Omit member
order plus one recorded fallback),
`external-union-type-name-preservation`,
`interface-extends-namespace-and-omit-resolution` (ReactNode expansion plus
checker member order beside the matching heritage, namespace, and export
surface),
`module-reexports-parts-namespace` (`TS7_UNION_MEMBER_FLATTENING`; the latter
down to three leaves from the React-graph collapse),
`module-export-forms` (the synthetic default-export symbol name). Landing the
ordering refreshed the `base-ui-component` TS7 oracle and its reason record a
fourth time as an explicit reviewed change: summarized references now match
the preserved oracle across most of the external graph, moving the recorded
difference count from 9126 to 3940.

### TypeScript 7 native-module workarounds (Issue 10)

Three gaps in the native seam required workarounds behind the normalized
contract. First, remote AST nodes answer `"elements" in clause` affirmatively
for a namespace export clause while carrying no elements, which crashed
`readModule` on `export * as NS from '…'`; the guard is a kind check via
`isNamedExports`. Second, `getAliasedSymbol` panics the compiler process on a
non-alias symbol ("Should only get alias here"), so every alias resolution
checks the alias flag first and treats failure as an unresolved target rather
than a crash. Third, unresolved remote nodes expose no parent chain, so
specifier ownership walks only over `.resolve()`d nodes. None of this leaks
past `src/backend/ts7/**`: resolvers see drafts, chains, and warnings only.

The Issue 02 supplemental seam pins (`issue02SupplementalFixtures`) were
reviewed to the Issue 10 ordering rule: they recorded raw TypeScript 7
enumeration order, and explicit re-exports now deterministically precede
star-contributed names, so `module-dts-type-star`, `module-resolution-alias`,
and `module-resolution-package` pin the reordered names. The reviewed
`base-ui-component` TS7 oracle and its reason record were refreshed a third
time for the same reason: namespace member exports now apply upstream's
public-name rule, which renames one leaf to `{name: "Value", namespaces:
["BaseUIComponent1"]}` exactly as the preserved upstream oracle shows.

### Deferred to later issues

- **Not this issue — TypeScript 7 divergences.**
  `generic-callback-typeparam-vs-typename-collision` (TypeScript 7 renders a
  circular self-referential `{self: T}` constraint through the type parameter
  where TypeScript 6's intermediate view yields the interface object) was
  re-probed when Issue 13 landed and is unchanged at eight leaf differences;
  its genus is constraint rendering under substitution, not external-type
  policy, so it stays adjudicated with the conformance issue.
  `namespace-export-resolution` was ported under its own issue as a reviewed
  TS7 divergence for the same kind of genuine compiler difference: union
  member flattening.

- **Issue 14 is complete.** The five former fixture debts are now ported and
  covered by the authoritative 116-entry manifest in
  `scripts/fixture-manifest.ts`. TypeScript 7's
  `generic-callback-typeparam-vs-typename-collision`,
  `interface-extends-basic-resolution`, and
  `symbol-double-underscore-name-preservation` cases are separately reviewed
  divergences; `type-intrinsic-props-resolution` is an unchanged oracle match.
  `module-imports-only` is also an unchanged match. Its input remains byte-for-
  byte identical and is independently typechecked in a test-only virtual
  workspace that supplies the single upstream `src/models/export` dependency;
  no production API or copied input is altered.

### Full conformance (Issue 14)

`pnpm run test:conformance` runs the authoritative
`ProjectExtractor.extractModule(file, options)` seam once for each of the 116
pinned upstream fixture directories and validates the deterministic report at
`test/fixtures/issue-14-conformance.json`. The report has exactly 116 unique
fixtures: 97 unchanged oracle matches, 19 explicitly reviewed TypeScript 7
divergences, zero failures, zero unclassified records, and 116/116 passing
independent input typechecks. Each record has one disposition, input/oracle
hashes, typecheck evidence, extraction evidence, and (for reviewed cases) a
separate `output.tsgo.json` and machine-readable `ts7-oracle.json` with a
specific difference genus, count, and digest; every extraction record also
carries the SHA-256 of the bytes in its selected `output.json` or
`output.tsgo.json` oracle. Newer reviewed
records also carry exact difference paths, while legacy records intentionally
retain the stable count/digest contract. The original upstream
`output.json` files are never regenerated.

Every record also stores normalized warning details and a digest. A fixture
with no `warnings.tsgo.json` has an explicit empty-warning expectation; an
unexpected warning or equal-count detail drift fails the report checks rather
than being hidden by a count-only assertion.

Independent fixture typechecks are owned by `scripts/issue-14-typecheck.ts`.
The persisted command is package-relative and runnable from
`tooling/api-extractor`, for example
`node scripts/issue-14-typecheck.ts --fixture module-imports-only --pretty false`.
The runner invokes the pinned compiler with the exact `--pretty false` setting;
the one upstream-relative import is staged in a disposable workspace, while
the conformance extraction itself still uses the public virtual
`ProjectFileSystem` seam. Representative direct and virtual commands are
executed by permanent tests so the recorded evidence cannot describe a
nonexistent `tsc` executable.

To refresh the report after a deliberate implementation change, run
`pnpm run report:conformance`. The only TS7 output update path is the explicit
`node scripts/issue-14-conformance.ts --write-ts7 <fixture-name> ...` command;
it accepts only the three newly reviewed fixture names, writes only
`output.tsgo.json`, `warnings.tsgo.json`, and `ts7-oracle.json`, and rejects
any `output.json` target. Before extraction or the first write, a shared
generated-artifact guard resolves every destination and checks both real paths
and device/inode identity against all 116 immutable `output.json` files, so
symlink and hardlink aliases are rejected. The conformance and timing report
writers use the same guard. The shared `scripts/reference.ts` owner pins the
repository-root `.ref/typescript-api-extractor` checkout to commit `e145350`.
The default audit is optional, so normal CI remains green when that ignored
checkout is absent; use `node scripts/issue-14-conformance.ts --audit-reference`
to print the verified/skipped result, or add `--reference-required` to make an
unavailable checkout fail. When present, the audit recursively compares every
copied upstream fixture and support file, excluding only local generated TS7,
warning, and evidence artifacts. A verified result first checks that the
repository is a clean Git checkout at the full pinned commit, then validates
the exact 251-file `test/fixtures` path universe (including its recorded
SHA-256 identity) before comparing bytes. An unversioned, dirty, or differently
shaped tree is rejected; a custom fixture root may only be used as the local
side of a comparison against that validated checkout. The persisted report
stores this identity and must retain `status: "verified"`; `--write` refuses to
write a report when the optional audit is skipped. Each fixture extraction also
records typed Effect failures and defects as a failed record so later fixtures
continue to run and the failure-index totals remain derived from the records.

The second IPC artifact is
`test/fixtures/issue-14-timing.json`. `pnpm run test:timing:issue14` measures
the same four public-seam samples as Issue 02 in a fresh extractor session per
fixture, compares every baseline, deterministic counter, arithmetic delta, and
aggregate field with the current Issue 02 report, and checks the backend and
durable-contract boundaries. Deterministic request/byte/node counters must
match exactly; scheduler-sensitive round-trip, server, and transport fields
are recorded as observational values rather than pretending to be byte-stable,
and both the live and stored four-sample aggregate must remain at or below
1000 ms. The artifact records that stable-counters-only contract and its
rationale explicitly.
The recorded run pins Node 24.13.0 and exactly `typescript@7.0.2`, and rerunning
`pnpm run test:timing:issue14` takes a real second sample before accepting the
stored artifact. Use `pnpm run report:timing:issue14` only to write this
separate timing artifact; it cannot target a fixture `output.json`.

### CI command ownership

Turbo owns the package's ordinary build, type-check, lint, format, and Vitest
tasks. The package `ci:checks` script therefore runs only extractor-specific
boundary checks, fixture typechecks, Issue 14 conformance, and the two timing
contracts. Run `pnpm run check:all` for the explicit standalone command that
combines those checks with the ordinary package validation tasks.

## Reproducible references

The ignored repository-root `.ref/` checkouts used during development are reproducible from any worktree:

Run the following from `tooling/api-extractor`:

```sh
git clone https://github.com/michaldudak/typescript-api-extractor.git ../../.ref/typescript-api-extractor
git -C ../../.ref/typescript-api-extractor checkout --detach e145350
git clone https://github.com/Effect-TS/effect.git ../../.ref/effect
git -C ../../.ref/effect checkout --detach effect@4.0.0-rc.111
```

The upstream extractor reference is pinned to `e145350` and the Effect reference is pinned
to release tag `effect@4.0.0-rc.111` (`648f566dd259898e7697c7fcb796183ccbc474ab`). Runtime
dependencies remain pinned to the same Effect RC tuple in `pnpm-workspace.yaml`.

The semantic model and resolver boundary are original workspace code informed by the
upstream extractor. Any future port of upstream source must retain the upstream MIT notice
and attribution in `NOTICE`, and any Effect-derived source must retain Effect's notice there
as well. No absolute path to an ignored checkout is used by package code or tests.
