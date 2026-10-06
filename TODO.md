# Open work

## Design and accessibility review

- Review GE dark semantics, Telinet's live collection, shared support roles,
  chart ordering and syntax colors.
- Check dark states, fixed-color artwork and chart distinction in product screens.
- When design supplies ring colors or an audit escalates contrast, replace the
  shared violet where needed. Retain the [accepted contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>)
  until reviewed replacements exist, including internal and Telinet light muted copy.
- Ask design for Nordic Green Energy's radius and button radius, and sign off its palette.
  `external-palettes.ts` maps the NGE Material 3 scheme by meaning, keeps the default
  `0.375rem` radius and takes the `1.8125rem` pill button that Fjordkraft and Telinet use,
  since the nordicgreen.fi buttons are pills. Running `figma:sync` for the four new theme
  modes and two primitives waits on the owner.
- Ask design for an external secondary hover tone. Every external palette sets `secondary`
  equal to `foreground`, so `--secondary-hover` equals `--secondary` and the hover is invisible.
- Ask design for a text-grade foreground on dark `feature`, or lighter dark `feature` tones.
  White text on dark `feature` measures 4.49:1 for tkas, 4.38:1 for fkse and 4.49:1 for elma,
  under the 4.5:1 floor. Until design decides, the landing's brand sites fill strong bands and
  the promo hero with `primary-soft` in dark mode (`landing/brand-site/site-band.tsx`).
- Confirm the external Button numbers with design. They come from the sales flow's own button
  recipe, not a published brand spec: the comfortable label inset of 16px at `sm` and 32px at
  `md` and `lg` (`theme/tokens/density-metrics.ts`) and the 2px outline in `--foreground`
  (`EXTERNAL_VARIANT_LAYER`). Also confirm the comfortable icon edge, three quarters of that
  inset (12px at `sm`, 24px at `md` and `lg`), and pick a comfortable `xs` inset and icon edge,
  which keep the 12px and 10px control values.
- Ask design whether external themes keep the reference's 4px corner on the `Checkbox`,
  the phone country trigger and the standalone `Calendar` (`styles/corner-radius.ts`), or
  round them from the brand radius. Internal themes round them with `--radius`.
- Confirm the external field corner with design. `--radius-field` is 0.25rem for every brand,
  from the Central design system's Text input ("Ready for review"), whose
  `Border-radius/Rounded MD` variable reads 4px in the one mode the file shows. Ask whether
  that variable varies by brand, and whether the external `rounded-*` scale, where
  `rounded-md` sits 2px inside the brand radius, should follow Central's radius variables.
- Ask design about the remaining Central Text input deltas at comfortable density: 8px
  inline padding (Fuse 14px), 16px input text (Fuse 18px), a 16px label (Fuse 14px), a
  darker border on hover, grey disabled fill and text instead of the 50% dim, and an error
  icon inside the box.
- Decide whether `PhoneNumberField` and `NumberField` name their wrapper `group` from the field's
  label or drop the role. The controls inside have names; the groups around them have none.
- Decide with design whether `Item` gets an unclamped description variant. `Item.Description`
  clamps to two lines, matching shadcn, and funnel needed an unclamped one for full instructions.
  `shadcn(no-restyle)` rejects `line-clamp-*` on `ItemDescription` and points to a variant in
  `components/item/index.ts`, so the docs show no `className` override. Until then, consumers
  render their own element for long text.
- Confirm the shared overlay-close dictionary and the docs' client-demo rule and
  three non-public import exceptions with the owner; these remain implemented defaults.

## Consumer and release verification

- Add first-paint fixtures for the written Next Pages, TanStack Start and React Router recipes.
- Finish release activation, packed Next/Vite fixtures and authentication work in
  [the release runbook](scripts/RELEASE.md).
- After the first stable release, decide whether a new component, public API or public
  behavior change needs an issue with a code-owner-agreed scope before work starts, and
  add that rule to [CONTRIBUTING.md](CONTRIBUTING.md).
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
- No select demo shows `Select.Content alignItemWithTrigger`; only `select.browser.test.tsx`
  exercises it. Add a demo beside the page and list it in the component inventory.
- `Select.Content` measures its fixed-position containing block when it mounts, when its portal
  target resizes and when Base UI reports an open request (`select/select.tsx`). A host that
  sets `open` from its own code, without a trigger event, after it transforms an ancestor
  of the target, gets the earlier measurement, and the popup opens away from its trigger.
- React Aria 3.52.1 misjudges the room around a popover inside a positioned container. In
  `react-aria/dist/private/overlays/calculatePosition.mjs`, `getOffset` (lines 363-371) measures
  a boundary in page coordinates and adds the document scroll. `getPosition` (line 300)
  measures the trigger relative to the popover's containing block. `getAvailableSpace` (line 213) adds the two, so a scope's page offset counts as free space and the popover never flips.
  Fuse now picks the vertical side itself inside a portal target that clips its overflow, and
  turns React Aria's flip off there (`react-aria/internal/popover.tsx`). Outside such targets
  React Aria still flips on its own numbers. Report the coordinate mix upstream, then drop the
  Fuse side choice once a fixed release is installed.
- A server component that renders `SelectionItem.Shell` with direct `SelectionItem.SubSection`
  children still loses the partition: Flight revives the SubSection's client reference as a
  lazy wrapper, so the shell's `child.type` filter misses it and the band renders inside the
  label. `CheckboxItem` and `RadioItem` partition on the server and pass `subSections`. Decide
  whether direct Shell use documents `subSections` for server trees or gets a server-side row.
  The same applies when a client component renders `CheckboxItem`/`RadioItem` around
  SubSection children it received from a server component.
- Move `isThemeDevelopment` from `theme/validate-theme.ts` to its own module in `src/internal/`.
  It is blocked because `elmera/restrict-process-env` in `@elmeragroup/internal` allows
  `process.env` only in `src/theme/validate-theme.ts`. Once the rule accepts the new owner, point
  `checkValidateThemeEnv` in `packages/fuse/scripts/package-check-packed.ts` at the new packed
  module.
- Decide whether `fuse.css` keeps its static `data-open`, `data-closed`, `data-checked`,
  `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal` and
  `data-vertical` variants, which replace Tailwind's functional `data-*` variants of the same
  name in a host's own classes at `:where()` specificity (`data-selected:` also matches only
  `="true"`), or namespaces them (`fuse-open:`) and moves the `neutral-*` palette remap into an
  opt-in file so `fuse/css` carries only what components need. Both are breaking for consumers
  that write Fuse's variants today, so they wait for a reviewed decision; the package README
  documents the current behaviour under "What `fuse/css` changes in your theme".
- Two separate React roots on one document, each with its own `ThemeProvider`, each get a
  color-scheme runtime. They reconcile against the live `data-theme`, so they converge rather
  than ping-pong, but neither sees the other's `setColorScheme`: a document gets no `storage`
  event for its own writes. Decide whether `ColorSchemeRoot` warns in development when a second
  runtime connects to the same document.
- `PopoverInfoButton` (`components/popover-info-button/popover-info-button.tsx`) spreads
  consumer props onto its `trigger` Button, which renders as `PopoverTrigger render={trigger}`.
  Render-element props beat the part, so a forwarded `aria-expanded={undefined}` or `disabled`
  overrides `Popover.Trigger`'s own value. Route the state and ARIA props through
  `PopoverTrigger` and keep only presentation on the Button.
- Give Base UI's `DirectionProvider` an owner and document RTL setup. `LocaleProvider` carries
  only the locale, so a consumer must wrap the app in `DirectionProvider` and set `dir`, or
  logical-side popups such as NavigationMenu's `inline-end` open on the LTR side. Also add
  `@base-ui/react/direction-provider` to `optimizeDeps.include` in `packages/fuse/vitest.config.ts`;
  until then the NavigationMenu browser test imports it from the `@base-ui/react` root entry.
- Report two toast bugs to Base UI. `Toast.Provider` subscribes to a manager in its own effect,
  so the manager drops calls made before then, including calls from a child's mount effect.
  `promiseToast` overwrites a `type` that the success or error state returns with `"success"`
  or `"error"`. The Fuse workaround for the first is a call queue in `createToastManager()`
  that a bridge rendered first in `Toast.Provider` replays. For the second, Fuse runs
  `promise()` over its own `add` and `update`. Remove each workaround once Fuse installs a
  fixed release.
- `Item.Root hidden` stays visible in a host without Tailwind's preflight. The user-agent rule
  `[hidden] { display: none }` loses to the item's `flex` class; preflight makes `[hidden]`
  `display: none !important`. Decide whether `Item.Root`, and the other parts whose root sets
  `display`, carry a `hidden` reset.
- The interim React Aria fields read React Aria's form context, not Fuse `Form`'s `errors`, so
  a server error under their name does not reach them. A form that mixes them with Base UI
  fields keeps React Aria's `Form`. Wire them to `Form`'s `errors`, or retire them with the
  date tier below.

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
- Give the trigger caret's base classes one owner. Select, Combobox and NavigationMenu each
  spell out its size, muted colour and rotate transition by hand.

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

## Data table

- The docs API reference lists only `value` and `className` for the default cells: the generator
  collapses their `Intl` option spreads. Document the formatting options once the generator
  expands mapped `Intl` types.
- Faceted filters, toolbars, search, URL state, editable cells, virtualization, column resizing,
  pinning, grouping and expanding are out of the first entry.
- `packages/fuse/scripts/generate-exports.ts` repeats the peer list by hand in `WorkspacePeers`,
  the `peerDependenciesMeta` type and `publishedPeerDependencies()`, and
  `packages/fuse/scripts/size-limit.ts` repeats it in `PEER_EXTERNALS`. Derive all four from
  `PUBLISHED_PEER_RANGES`.
- Give `DataTable.ColumnToggle` and `DataTable.Pagination`'s Rows per page Select a controlled
  open state. Neither takes `open` or `onOpenChange`, so a host that must close their popups
  remounts them, as the landing's Order search does
  (`apps/docs/src/app/(landing)/landing/app-shell/order-search.tsx`).

## Landing stand-ins

The hero window's Dashboard (`apps/docs/src/app/(landing)/landing/app-shell/`), the brand sites
(`landing/brand-site/`) and the nav's theme picker (`landing/theme-picker/`) compose these pieces
locally because Fuse has no part for them. Replace
each stand-in once Fuse ships the part.

- Add a `Kbd` part. `app-shell/kbd.tsx` draws the shortcut caps in the sidebar, tooltips and
  palette.
- Add a `Command` palette part. `app-shell/command-palette.tsx` builds one from `Dialog` and the
  ARIA combobox pattern, as the docs search (`apps/docs/src/components/search-palette.tsx`) does.
- Add Sun, Moon and Monitor to the icon roster. The nav's theme picker draws Phosphor's regular
  paths for light, dark and system in `theme-picker/scheme-icon.tsx`.
- Add a floating action bar for row selections. `app-shell/bulk-toolbar.tsx` positions its own
  `role="toolbar"` over the queues' list and over Order search's table.
- Add a list and detail split that becomes a Sheet below a breakpoint. `app-shell/dashboard-main.tsx`
  switches between an `aside` and a `Sheet`, and `app-shell/dashboard-app.tsx` reads its own
  `(width >= 80rem)` query.
- Let `Sidebar` live in a bounded container. `Sidebar.Provider` sets `min-h-svh`, the desktop
  rail is `fixed` and `h-svh`, `setOpen` writes the `sidebar:state` cookie even when controlled,
  and a window listener toggles on ⌘B from anywhere. `app-shell/dashboard-app.tsx` makes the
  window the rail's containing block with `transform`, keeps the open state in memory and stops
  ⌘B in the capture phase; `app-shell/dashboard-sidebar.tsx` sets the rail to `h-full`.
- Let `ScrollArea` content truncate. Base UI gives the content `min-width: fit-content`, so a
  child never narrows below its longest line. `app-shell/order-list.tsx` and
  `app-shell/order-detail.tsx` add `contain-inline-size` to their scrolled content.
- Give `TrondelagkraftLogo` and `GudbrandsdalEnergiLogo` full artwork for light surfaces, and
  draw Telinet's "Energi" and the Nordic Green Energy wordmark in `currentColor`. Their fixed
  fills (white, navy in Telinet's and dark green in Nordic Green Energy's) vanish on one of the
  schemes, so those sites set `logo: "wordmark"` in `brand-site/sites/` and
  draw the landing's one-ink `brand-wordmark.tsx`, as the Elmera site's brand grid does.
- Give the outline `Button` the ink of the `background` it paints. It inherits the text colour,
  so on a strong brand block its label is light on light. The promo hero in
  `brand-site/site-hero.tsx` passes `quiet="ghost"` for its second action instead.
- Let `Sidebar.Inset` render an element other than `<main>`. A page that already has a `main`
  landmark cannot use it, so `app-shell/dashboard-main.tsx` copies its inset classes onto a `div`
  next to the `inset` rail.

Every overlay on a side of the hero window must close when that side hides, through
`useSideOverlay` or `useSideRemountKey` in `landing/window-side.tsx`. Nothing enforces this, so a
new overlay that skips both keeps its scroll lock after a flip. Add a lint rule, or a browser test
that opens every overlay on a side before flipping the window.

## Product-triggered work

- When Base UI offers suitable date primitives, migrate the interim React Aria tier.
  Removing its public subpaths is a major release; other interim atoms can move earlier.
- When a product commits to charts, ship the deferred chart entry and decide its optional peer.
- When a product needs arrow-key roving focus across a row of controls, add a `Toolbar` over
  Base UI 1.8's toolbar. Fuse has none today.
- When a product needs density preferences, define persistence and pre-paint stamping in the host.
- Add brands and locales on product demand; reconsider locale subsetting near ten locales.
- When behavioral tests miss a visual regression or manual theme review stops scaling,
  add visual regression coverage over demos to the publish gate.
- When measured icon weight becomes a problem, reconsider Phosphor core code generation.
- Revisit a source registry or separate playground when consumer demand or docs limitations justify it.
- The docs DTCG export still emits light modes only; the Figma sync in `packages/fuse-figma`
  writes both schemes. Retire the export after the first real Enterprise sync, once designers
  work from the synced variables.

OrderModule application migrations remain outside this repository's work.
