# Open work

## Design and accessibility review

- Review GE dark semantics, Telinet's live collection, shared support roles,
  chart ordering and syntax colors.
- Check dark states, fixed-color artwork and chart distinction in product screens.
- When design supplies ring colors or an audit escalates contrast, replace the
  shared violet where needed. Retain the [accepted contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>)
  until reviewed replacements exist, including internal and Telinet light muted copy.
- Ask design for an external secondary hover tone. Every external palette sets `secondary`
  equal to `foreground`, so `--secondary-hover` equals `--secondary` and the hover is invisible.
- Ask design whether external themes keep the reference's 4px corner on the `Checkbox`,
  the phone country trigger and the standalone `Calendar` (`styles/corner-radius.ts`), or
  round them from the brand radius. Internal themes round them with `--radius`.
- Confirm the shared overlay-close dictionary and the docs' client-demo rule and
  three non-public import exceptions with the owner; these remain implemented defaults.

## Consumer and release verification

- Add first-paint fixtures for the written Next Pages, TanStack Start and React Router recipes.
- Finish release activation, packed Next/Vite fixtures and authentication work in
  [the release runbook](scripts/RELEASE.md).
- After upstream tooling uses stable Effect 4 and the release-age guard admits it,
  upgrade and remove prerelease exclusions unless another exception is justified.
- Retire repo-policy workarounds when upstream lint can require disable reasons
  and configure the focus-ring owner path.
- Replace the `state faces` source contract with `elmera/no-local-state-face` once the
  upstream plugin ships it with a configurable owner path and per-check allow lists.
- Scope the within-target focus faces to the group's own control. `withinFocusRingClass` and
  InputGroup's focus border still match any descendant `data-focus-ring-control`, so a
  focused NumberField nested in an InputGroup addon also rings the outer group. The state
  face already reads only a direct child (`styles/state-face.ts`).
- `pnpm lint` never type-checks `apps/docs/test/fixtures/rsc-namespace-register.mjs`: `oxlint .`
  reports nothing, while `oxlint apps/docs` reports `typescript(no-unsafe-call)` at line 3. Find
  which root or tsconfig makes the difference so the fixture directory is not silently unlinted,
  then fix or explicitly allow the call.
- `DialogRoot` (`components/dialog/dialog.tsx`) stamps `data-slot="dialog"` on Base UI's
  `Dialog.Root`, which renders no DOM: `useRenderDialogRoot` destructures only its named props,
  so the attribute is discarded. Drop it, and fix any comment that claims the root carries a slot.
- The docs `sheet-demos` browser test failed once during the RSC namespace work
  (2026-09-25, T3) and passed on every rerun. If it recurs, diagnose before raising any timeout.
- `CssColor.parse` in `@elmeragroup/color` does not read `oklab()`, which is how Chromium
  serializes every `color-mix(in oklab, …)` / Tailwind `/NN` computed fill. Browser contrast
  checks over translucent fills, such as the Alert action's, throw `InvalidColor` until it
  does. Also correct the notation list in `packages/color/src/css-color.ts`, which names only
  `rgb()`, `oklch()` and `lab()` as Chromium's computed serializations.

## Control size

- Docs token extraction is file-granular: Select lists xs/lg control metrics and the
  text-entry family lists gap-md/px-icon-md they don't bind; resolve per recipe (from
  built CSS, or aware of tv calls) instead of per file.
- Move the segmented ToggleGroup item's remaining rounded-none, shadow-none and scale-100
  classes from `group-data-[spacing=0]/toggle-group:` (any ancestor group) onto the
  item's own `data-[spacing=0]:`, which it already stamps, so they follow the nearest
  group as its inset does.
- Sweep the older "not a control rung" lint-disable reasons and other "rung" wording on
  control metrics to "control size"; "rung" is reserved for radius rungs.

## Figma token sync

- Run the first sync against a real Enterprise file and confirm that empty picker scopes,
  the per-type scopes from the REST variable types page, cross-collection aliases, the
  mode change order and the read-back check behave as the in-memory fake assumes.
  - Find out whether Figma checks for an alias cycle after each value in a batch or once
    at the end. The sync orders values so that either rule passes, and the fake checks
    after each one.
  - Check which scopes Figma keeps on the STRING font variables. The REST variable types
    page says scopes are currently only supported on FLOAT and COLOR variables, so
    `font-sans` and `font-heading` sync with `ALL_SCOPES`. If Figma keeps `FONT_FAMILY`
    on a STRING variable, tighten them to it. If it stores other scopes than the sync
    sent, every `check` reports drift.
- Add a CI job running `figma:check` once a service account owns a personal access token.
- Add named Figma variables for the private corners in `styles/corner-radius.ts`, such
  as the compact corner that caps `rounded-md` at 10px in external themes, when the
  component pilot needs them. The sync sends only the plain radius rungs, `radius-step`
  and the density metrics.
- Remove the unused `--radius-popover` rung from `fuse.css` and `RADIUS_RUNGS` in a
  separate change. No component uses it, Fuse popups use `rounded-md`, and the Figma sync
  already leaves it out.
- Revisit Figma extended collections for brand theming if the two-collection mode
  pairing proves awkward for designers.

## Product-triggered work

- When Base UI offers suitable date primitives, migrate the interim React Aria tier.
  Removing its public subpaths is a major release; other interim atoms can move earlier.
- When a product commits to charts, ship the deferred chart entry and decide its optional peer.
- When a product needs density preferences, define persistence and pre-paint stamping in the host.
- Add brands and locales on product demand; reconsider locale subsetting near ten locales.
- When behavioral tests miss a visual regression or manual theme review stops scaling,
  add visual regression coverage over demos to the publish gate.
- When measured icon weight becomes a problem, reconsider Phosphor core code generation.
- Revisit a source registry or separate playground when consumer demand or docs limitations justify it.
- The docs DTCG export still emits light modes only; the Figma sync in `packages/fuse-figma`
  writes both schemes. Retire the export after the first real Enterprise sync, once designers
  work from the synced variables.
- Retire `toResult` from `@elmeragroup/color/effect` unless a consumer adopts it; the Figma
  sync no longer reads token colors through it, and only its own test calls it.

OrderModule application migrations remain outside this repository's work.
