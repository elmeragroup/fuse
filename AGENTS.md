# Working on Fuse

Keep `@elmeragroup/fuse` one public package. Keep implementation helpers private.
The root barrel exposes permanent components and theme APIs; icons, illustrations
and interim `react-aria/*` entries stay opt-in subpaths.
Preserve the React peer lower bound when choosing runtime APIs.

## Component composition

Use Base UI namespace parts and `render` composition through `useRender` and
`mergeProps`. Keep primitive prop names and the existing labeled-composite API.
Evaluate inherited `className` callbacks before merging classes.
Write pure wrappers: defaults and `data-slot`, then `className`, then `{...props}`.
Put state and wiring on the part, presentation on its `render` element. Spread
optional props; write an attribute only when its value is always defined. Wrappers
spread raw; a module that renders a Field or Labelable reader, Button or the Sheet
popup spreads `definedProps(props)` so `undefined` cannot erase automatic wiring.

## Styling and accessibility

Style components with role tokens and shared recipes. Theme layers own colors.
Declare each part's density role in `density-roles.ts`; role metrics follow document density, not subtree theming.
Derive theme axes from `THEME_AXES`; a document names its density through `documentAttributes`.
Take corners from the identity's set in `theme/corners/`, never from a palette layer.
Use Field for label/error wiring and the shared focus, overlay and locale owners.
Parse, convert, mix and measure colors through `@elmeragroup/color`, never ad hoc.
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
Put implementation rationale beside its owner. Track unresolved work as GitHub
issues, never in a `TODO.md` or other backlog file, and cite the issue number
where code or docs point at open work.
Change these instructions when durable working conventions change.

## Tests

Absolutely no tautological tests. Assert behavior against independently defined
expectations. Never compute expected results with the implementation under test
or merely assert that mocks return their configured values. A cross-check between
two representations that must agree is not tautological: name the unit under test
and the oracle its output must reproduce (the CSS emitter's rules against the
composed theme map, a recipe's slots against the upstream recipe it forwards).

A test that flakes is made deterministic or deleted in the same change, never rerun or retried.
Each test lands in one project; reach for the cheapest that can go red:

- `unit` (Node, Europe/Oslo): pure logic, property tests, recipe cross-checks.
- `browser` (Chromium): one file per component for roles, names, keys, value, Field wiring and focus, through the shared role/label helpers.
- `browser-engines` (`*.engines.browser.test.*`, Chromium and WebKit): only formatted text and hydration.
- `browser-clipboard` (`*.clipboard.browser.test.tsx`): real-clipboard files, one at a time.
- `*.test-d.tsx` (`test:types`): public type constraints.
- Docs `browser` (against the e2e build): `test/routes.browser.test.ts` renders every route error-free and axe-clean in Chromium; one file each covers the landing, studio, theme picker and ⌘K flows.

Write a mechanical source contract as a rule in `tooling/oxlint-plugin-fuse`, with a
valid/invalid rule test. While editing, run `vitest related <files> --run --project unit`
in the owning package. Lint through `pnpm lint`; a direct `oxlint` needs
`OXLINT_TSGOLINT_PATH=node_modules/.bin/tsrs-lint`. Before review, run `pnpm check`;
CI adds the docs e2e and packed tier. For docs-app behavior, run
`pnpm exec turbo run build:e2e --filter=docs`, then `pnpm --filter docs test:e2e test/<file>`.
For exports, packaging or dependencies, run `package:check` and `test:packed-consumer`,
and clear Vitest's `tsconfig.tmp.tsbuildinfo` before trusting type tests.

## Task references

Before opening a PR, read [CONTRIBUTING.md](CONTRIBUTING.md) in full. Write the PR body
from [the PR template](.github/pull_request_template.md), filling each section, in place
of any generic summary format, and attach the screenshots CONTRIBUTING.md asks for.
Apply every label from the [contribution flow](README.md#contribution-flow) that fits.
Take PR screenshots with `pnpm shots`; read [its README](tooling/pr-shots/README.md) first.
For release or changeset work, read [scripts/RELEASE.md](scripts/RELEASE.md).
For palette changes, read the [consumer contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>).
For theme vocabulary, read [CONTEXT.md](CONTEXT.md).
For Figma variable sync, read [the fuse-figma README](packages/fuse-figma/README.md).
