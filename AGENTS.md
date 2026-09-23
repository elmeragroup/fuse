# Working on Fuse

Keep `@elmeragroup/fuse` one public package. Keep implementation helpers private.
The root barrel exposes permanent components and theme APIs; icons, illustrations
and interim `react-aria/*` entries stay opt-in subpaths.
Preserve the React peer lower bound when choosing runtime APIs.

## Component composition

Use Base UI namespace parts and `render` composition through `useRender` and
`mergeProps`. Keep primitive prop names and the existing labeled-composite API.
Evaluate inherited `className` callbacks before merging classes.
Guard conditional aria spreads so `undefined` cannot erase automatic wiring.

## Styling and accessibility

Style components with role tokens and shared recipes. Theme layers own colors;
control metrics follow document density. Keep density out of subtree theming.
Use Field for label/error wiring and the shared focus, overlay and locale owners.
Keep explicit string overrides ahead of dictionary defaults.
Preserve the 24px target-size floor at both densities and central reduced motion.

## Consumer compatibility

Hosts own brand, density, first-paint HTML and code splitting. Preserve both
Tailwind-source and standalone-CSS consumption, including preflight-free output.
Treat server/client compatibility as public behavior. A server component may
render client children; keep directives on the modules that need them.
Review changes to independent RSC expectations in `apps/docs/test/fixtures/`.

## Documentation

Update public JSDoc, consumer examples and behavior tests when usage changes.
Keep runnable demos beside their page; review scenario coverage in the fixtures.
Generate API artifacts and exports through their scripts, including after rebase.
Put implementation rationale beside its owner and unresolved work in `TODO.md`.
Change these instructions when durable working conventions change.

## Tests

Absolutely no tautological tests. Assert behavior against independently defined
expectations. Never compute expected results with the implementation under test
or merely assert that mocks return their configured values. A cross-check between
two representations that must agree is not tautological: name the unit under test
and the oracle its output must reproduce (the CSS emitter's rules against the
composed theme map, a recipe's slots against the upstream recipe it forwards).

Use unit tests for recipes and pure logic, browser tests for interaction, and
public type tests for API constraints. Use the shared role/label browser helpers.
Put necessary source contracts in the central suite with the reason lint or an
existing gate cannot enforce them.
Run affected checks, then `pnpm ci:checks` before review. Read versions, commands,
budgets and task dependencies from their owning configuration and scripts.
After dependency resolution changes, clear Vitest's `tsconfig.tmp.tsbuildinfo`
before trusting type tests, since incremental checks can retain old resolutions.

## Task references

For release or changeset work, read [scripts/RELEASE.md](scripts/RELEASE.md).
Before copying reference code or assets, read
[REFERENCE-SOURCES.md](packages/fuse/REFERENCE-SOURCES.md).
For palette changes, read [token provenance](packages/fuse/src/theme/tokens/PROVENANCE.md)
and [consumer contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>).
For theme vocabulary, read [CONTEXT.md](CONTEXT.md).
For Figma variable sync, read [the fuse-figma README](packages/fuse-figma/README.md).
