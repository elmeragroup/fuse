# Open work

## Design and accessibility review

- Review GE dark semantics, Telinet's live collection, shared support roles,
  chart ordering and syntax colors.
- Check dark states, fixed-color artwork and chart distinction in product screens.
- Ask design for per-brand focus ring colors. Every theme draws the neutral `oklch(0.6 0 0)` ring;
  a brand tunes it with a `ring` entry in its light palette (`external-palettes.ts`) and in its
  dark sheet (`external-dark-palettes.ts`) plus each of its segment dark sheets
  (`segment-sheets.ts`), which replace the brand's dark sheet. `contrast-matrix.test.ts` holds it to 3:1. Retain the
  [accepted contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>) until reviewed
  replacements exist.
- Ask design to set the opaque light `muted-foreground` tones from `external-palettes.ts`,
  `segment-sheets.ts` and `defaults.ts` in the brand Figma files, which set the brand foreground
  at 70% alpha. Running `figma:sync` for the new values waits on the owner.
- Ask design for Nordic Green Energy's radius and button radius, and sign off its palette.
  `external-palettes.ts` maps the NGE Material 3 scheme by meaning, sets a 6px `0.375rem`
  placeholder radius and takes the `1.8125rem` pill button that Fjordkraft and Telinet use,
  since the nordicgreen.fi buttons are pills. Running `figma:sync` for the new `Fuse brand`
  mode and two primitives waits on the owner.
- Ask design for an external secondary hover tone. The fkas, tkas, guen, fkse and elma themes
  paint `secondary` in the brand color, and `--secondary-hover`, 5% toward `foreground`, measures
  1.03–1.06:1 against it in light and 1.01–1.04:1 in dark, so the hover is faint. Nordic Green
  Energy sets `secondary` equal to `foreground`, so its hover equals `--secondary` and does not show.
- Ask design how the external link Button should look. The `link` variant in
  `button-variants.ts` colors its text with `text-primary`, which is the text color in the fkas,
  tkas, guen, fkse and elma themes, so a link Button reads as plain text until hover underlines it.
- Ask design for a light `muted` that clears the 1.1:1 hover-tint floor on `card` and `popover`.
  The shared 0.97 on a white surface measures 1.09:1 on every light theme, so
  `contrast-matrix.test.ts` holds `muted` to that floor in dark only. External light modals fill
  with the page tint (`--dialog`), where the same tint, such as the corner close button's hover,
  measures 1.03–1.04:1.
- Ask design how edgeless selection rows should stand out in a dark Dialog or Sheet. Dark modals
  keep `--dialog` on the popover, which every dark palette sets equal to `card`, the row fill, and
  external rows draw no outer edge, so a `RadioItem` or `CheckboxItem` group in a dark modal has
  no row outlines.
- Ask design whether dark external cards keep an edge. `--card-border` is a light-only key, so
  the zero-alpha external edge carries into dark, where `Card` and the `card` Accordion item stand
  off the page only by the dark `card` step: about 1.25:1 in fkas, tkas and fkab, but 1.09:1 in
  fkse and 1.13:1 in ngfi. Keeping an edge there means dropping `card-border` from
  `LIGHT_ONLY_KEYS` and naming it in each dark sheet.
- Ask design whether `Popover` follows `Dialog` onto the page tint in external light. A Popover can
  hold a form, as the basic demo does, but the anchored popups share the `accent`-on-`popover`
  1.1:1 floor in `contrast-matrix.test.ts`, which the external light accent, 1.00–1.07:1 on the
  page tint, would not clear.
- Ask design for a text-grade foreground on dark `feature`, or lighter dark `feature` tones.
  White text on dark `feature` measures 4.49:1 for tkas, 4.38:1 for fkse and 4.49:1 for elma,
  under the 4.5:1 floor. Until design decides, the landing's brand sites fill strong bands and
  the promo hero with `primary-soft` in dark mode (`landing/brand-site/site-band.tsx`).
- Ask design for a dark external `primary-soft` that differs from `card`. The default Accordion
  item fills with `primary-soft`, and every external dark sheet except ngfi sets it equal to
  `card` (`external-dark-palettes.ts`, `segment-sheets.ts`), so a default accordion inside a Card
  loses its box in dark mode.
- Ask design for light tones that hold `muted-foreground` at 4.5:1 on `primary-soft`, the default
  Accordion item's fill. It measures 4.43:1 on the internal default, 3.84:1 on fkas and 4.17:1 on
  fkse, so a muted description inside the item falls under the text floor. `contrast-matrix.test.ts`
  holds the pair in dark only.
- Confirm the external Button numbers with design. They come from the sales flow's own button
  recipe, not a published brand spec: the comfortable label inset of 16px at `sm` and 32px at
  `md` and `lg` (`theme/tokens/density-metrics.ts`) and the 2px outline in `--foreground`
  (`EXTERNAL_VARIANT_LAYER`). Also confirm the comfortable icon edge, three quarters of that
  inset (12px at `sm`, 24px at `md` and `lg`), and pick a comfortable `xs` inset and icon edge,
  which keep the 12px and 10px control values.
- Confirm the external disabled selection row's grey with design. `EXTERNAL_VARIANT_LAYER`
  keeps the card fill without stripes and greys the title and other label row text through
  `--selection-disabled-foreground: var(--muted-foreground)`, beside the control's 50% face.
  Ask whether that grey is the right value, and tune it together with the Central Text input's
  grey disabled fill and text below, so fields and rows share one disabled look.
- Drop the old disabled-hatch string, `rgb(0_0_0/0.02)` stripes, from the
  `elmera/no-primitive-colors` allowlist in `@elmeragroup/internal/oxlint`. The selection row's
  hatch now reads `--selection-disabled-hatch`, so no class carries that literal any more.
- Confirm with design the external selection row title weight, for `CheckboxItem` rows as well
  as `RadioItem` rows. `--selection-title-weight` is 500 in `EXTERNAL_VARIANT_LAYER`, from the
  radio card the sales flow used before `RadioItem` (`text-base/5 font-medium`), and internal
  themes keep the 400 the internal row was ported with.
- Ask design whether external themes keep the reference's 4px corner on the standalone
  `Calendar` (`styles/corner-radius.ts`), or round it from the brand radius. Internal themes
  round it with `--radius`.
- Ask design about the remaining Central Text input deltas at comfortable density: 8px
  inline padding (Fuse 14px), 16px input text (Fuse 18px), a darker border on hover, grey
  disabled fill and text instead of the 50% dim, and an error icon inside the box.
- Ask design whether a `legend`-variant `Field.Legend` should step up at comfortable density.
  It stays 16/24px at both densities, which now equals comfortable label text (`--label-text`),
  so a fieldset title no longer reads above its field labels when comfortable.
- Ask design whether toolbar items round concentrically with the bar. `Toolbar.Root` publishes
  `--inner-corner`, but its items render Fuse controls, such as Button and Toggle, that keep their
  own corners, and `shadcn/no-restyle` keeps `rounded-inner` off those controls in consumer code.
  Rounding them would take a Toolbar rule for the controls inside it.
- Ask design for a light field border of at least 3:1. Light `--input`, the border of Input,
  Textarea, Select and the other field boxes, measures 1.08–1.70:1 against the page and card, an
  accepted deviation on the accessibility page. Except ngfi's M3 `outline-variant`, the values are
  converted shadcn stock colours. `Checkbox` and `Radio` draw their unchecked edge, and `Switch`
  its unchecked edge and thumb, in `muted-foreground` until then, and could return to `--input` once it
  clears 3:1.
- Ask design to confirm the two `--border` hairlines that sit well above the 1.19:1 page floor
  in `contrast-matrix.test.ts`. ngfi light, M3 `outline-variant` #BEC9C3, measures 1.62:1 on
  the page and 1.70:1 on card; every other light theme sits at 1.19–1.30:1 on the page. The
  provisional external dark `#454746` (`dark-defaults.ts`) measures 1.93–2.02:1 on the page and
  1.61–1.83:1 on card.
- The interim GridList selection box (`react-aria/internal/checkbox.ts`) draws its unchecked edge in
  `--border`, under the 3:1 non-text floor that `Checkbox`, `Radio` and the unchecked `Switch`
  edge and thumb now meet in `--muted-foreground`. Its pressed edge is already `--muted-foreground`, so
  raising the resting edge needs a new pressed one.
- Decide whether `PhoneNumberField` and `NumberField` name their wrapper `group` from the field's
  label or drop the role. The controls inside have names; the groups around them have none.
- Ask design whether the `NumberField` steppers keep their own fill. In internal dark the
  stepper buttons draw `bg-background` (`oklch(0.145 0 0)`) inside a field box that draws
  `bg-card` (`oklch(0.205 0 0)`). In external light every brand's steppers draw the tinted page
  `--background` (guen `oklch(0.95469 0.01887 279.53)`) inside a white `--card` field box. Only
  internal light matches. Is that intended, or should the steppers follow the field-box fill?
- Decide with design whether `Item` gets an unclamped description variant. `Item.Description`
  clamps to two lines, matching shadcn, and funnel needed an unclamped one for full instructions.
  `shadcn(no-restyle)` rejects `line-clamp-*` on `ItemDescription` and points to a variant in
  `components/item/index.ts`, so the docs show no `className` override. Until then, consumers
  render their own element for long text. `SelectionItem.Description` is already unclamped,
  because it is part of a control's label.
- Confirm the shared overlay-close dictionary and the docs' client-demo rule and
  three non-public import exceptions with the owner; these remain implemented defaults.
- Dialog's backdrop blur samples shifted content inside a transformed scope, such as a theme
  studio artboard. The fix needs a Fuse option that drops `backdrop-blur` for scoped dialogs.

- Put the visible dial code in `PhoneNumberField`'s country trigger name (WCAG 2.5.3 label in
  name). The trigger is named "Select country" and describes the selected country and dial code,
  so screen readers hear the country, but voice-control users see "+47" and must say the name.
  Naming it after the country renames the trigger every test queries by "Select country", so the
  axe pass in `phone-number-field.browser.test.tsx` leaves out `label-content-name-mismatch`
  until then.
- Triage the fourteen jsx-a11y rules `.oxlintrc.json` turns off, one rule per change: fix the
  hits, or keep the rule off with a reason.

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
- Scope the within-target focus faces to the group's own control. `withinFocusRingClass`
  still matches any descendant `data-focus-ring-control`, so a focused NumberField nested
  in an InputGroup addon also rings the outer group. The state
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
  checks over translucent fills, such as the Alert action's, throw `InvalidColor` until it does.
  Meanwhile `alert.browser.test.tsx` approximates the info action's hovered fill as `info` at 0.9
  alpha composited in sRGB; switch it to the parsed fill then. Also correct the notation list in
  `packages/color/src/css-color.ts`, which names only `rgb()`, `oklch()` and `lab()` as Chromium's
  computed serializations.
- No select demo shows `Select.Content alignItemWithTrigger`; only browser tests and the landing
  exercise it. Add a demo beside the page and list it in the component inventory.
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
- Report to Base UI that an anchored popup stays put when its anchor shrinks in place. The
  positioner watches the anchor with an IntersectionObserver whose threshold is the anchor's last
  box, so a transform that shrinks the anchor inside that box, such as a zoom out around a point
  in it, never repositions the popup. The studio's theme toolbar
  (`apps/docs/src/studio/components/theme-toolbar/theme-toolbar.tsx`) hands `Popover.Content` a
  new virtual anchor on every camera move. Once Base UI follows such a change, drop that, drop
  the shrink caveat from `PopoverContent`'s `anchor` JSDoc
  (`packages/fuse/src/components/popover/popover.tsx`) and the popover page
  (`apps/docs/src/app/(docs)/components/popover/page.mdx`), and regenerate the popover `api.json`.
- Report two toast bugs to Base UI. `Toast.Provider` subscribes to a manager in its own effect,
  so the manager drops calls made before then, including calls from a child's mount effect.
  `promiseToast` overwrites a `type` that the success or error state returns with `"success"`
  or `"error"`. The Fuse workaround for the first is a call queue in `createToastManager()`
  that a bridge rendered first in `Toast.Provider` replays. For the second, Fuse runs
  `promise()` over its own `add` and `update`. Remove each workaround once Fuse installs a
  fixed release.
- Finish the read-only field fill. Select's trigger (`components/select/select.tsx`) and
  Combobox's chips box (`components/combobox/combobox.tsx`) take no read-only fill, so
  `SelectField` takes no `isReadOnly` until the trigger has one, and
  `TextField variant="card"` still paints the borderless input's disabled band across the card
  (`components/text-field/text-field-variants.ts`) where the read-only fill now paints the card.
- `Item.Root hidden` stays visible in a host without Tailwind's preflight. The user-agent rule
  `[hidden] { display: none }` loses to the item's `flex` class; preflight makes `[hidden]`
  `display: none !important`. Decide whether `Item.Root`, and the other parts whose root sets
  `display`, carry a `hidden` reset.
- `Sidebar.Menu` keeps the user agent's 40px list indent in a host without Tailwind's preflight,
  so its rows sit 40px in from the group. Reset the list's padding on the part itself.
- `Badge` (`components/badge/badge.tsx`) renders a `div`, which is invalid inside the `<p>` of
  `Item.Description` and `SelectionItem.Description`. Render it as a `span` and change
  `BadgeProps` to `HTMLAttributes<HTMLSpanElement>`, then drop the
  `:where(:not([data-slot="badge"]))` exclusion from the `rich-text-block` variant in
  `styles/fuse.css` and the Badge sentence in the comment above it. #277 deferred this.
- Ask Base UI for a way to let a `Form` submit while its Fields are invalid. Its submit handler
  validates its enabled Fields and calls neither `onSubmit` nor `onFormSubmit` while one is
  invalid, so a schema-validated form, where a change elsewhere clears an error, cannot reach
  its schema again unless the consumer knows which `errors` key to drop. Fuse cannot add the
  opt-out as a pure wrapper. Until then the Form page sends
  such forms to a plain `<form>` with `isInvalid` and `errorMessage`, which gives up the errors
  routed by name and the focus on new errors (#170).
- The interim React Aria fields show Fuse `Form`'s `errors` (`react-aria/internal/form-errors.tsx`)
  but do not register as its Fields: their values are not in `onFormSubmit`'s, their own
  validation does not block a submit, and `Form` does not focus them for a returned error.
  Register them, or retire them with the date tier below.
- Native form reset, including React's reset after a form action, leaves Checkbox, Switch,
  CheckboxCard, RadioGroup and CheckboxGroup at their current selection: `useCheckedResetSync`
  only writes the shown state back into Base UI's hidden inputs, so an uncontrolled control does
  not return to `defaultChecked` or `defaultValue` the way a native checkbox does. Base UI 1.8's
  checked controls do not observe `reset`. Report it upstream; a Fuse-side restore means holding
  the uncontrolled value in Fuse and tracking each group's member inputs (#144).
- `useFormReset` (`hooks/use-form-reset.ts`) adds one capture `reset` listener per subscriber, and
  every Checkbox, Switch, CheckboxCard and radio now subscribes, so a DataTable with a `SelectRow`
  checkbox per row adds a listener per row. Pool subscribers per root, with one listener that
  dispatches to the subscribers whose control is in the reset form.
- NumberField writes optional props such as `name`, `min` and `aria-label` as plain attributes,
  against the optional-prop rule in AGENTS.md. The `WIRING_PARTS` source contract flags only raw
  spreads, so it misses them. Spread them through `definedProps`.
- A light theme rule declares only `EXTERNAL_RESET_KEYS`, so `--destructive` and
  `--destructive-foreground` resolve their `var()` on `:root`. A host that overrides `--error` on a
  nested theme scope does not move them there. `--sidebar-ring` is a reset key now, so it follows
  a scope's `--ring`. The theme studio restates the aliases on each artboard and in its CSS export
  (`apps/docs/src/studio/lib/artboard-style.ts`). Decide whether the light rules restate every
  alias, as the dark rules do.

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
- Remove or tier `racDialogShellClass`'s padding (`p-6`, placed `p-4`) in
  `styles/inner-corner/picker.ts`. It never renders: the only shipped consumer, `PickerShell`,
  overrides it with `pickerDialogShellClass`'s `p-0`, and the Calendar and presets inside pad
  with the small surface tier themselves.
- Checkbox, Radio and Switch build their hit target from rem `after:-inset-*` offsets, so it
  scales with the root font size and has no fixed-px 24px floor. At a 14px root, Checkbox and
  Radio targets are 26px tall and the small Switch 33px. Checkbox and Radio drop below 24px only
  under a root smaller than 13px, so this is about consistency, not a current failure. Use
  Slider's centred fixed-px target instead.

## Figma token sync

- Add a CI job running `figma:check` once a service account owns a personal access token.
- Add named Figma variables for the private corners in `styles/corner-radius.ts`, such
  as the compact corner that caps `rounded-md` at 10px in external themes, when the
  component pilot needs them. The sync sends only the plain radius rungs, `radius-step`
  and the density metrics.
- Remove the unused `--radius-popover` rung from `fuse.css` and `RADIUS_RUNGS` in a
  separate change. No component uses it, Fuse popups use `rounded-md`, and the Figma sync
  already leaves it out.
- After the first axes sync of a file that already holds `Fuse density`, move the `Auto`
  column all the way to the left of the variables view in Figma by hand, by dragging its header
  or through the header's right-click menu. The left-most mode is the default. The REST API
  appends the mode and cannot reorder modes, so `Dense` stays the file's default until someone
  does.

## Figma component sync

- Confirm on a real file that an instance's glyph fill override goes with the glyph when the
  plugin draws an icon again, as `plugin/src/fake-figma.ts` assumes. Change one icon's markup,
  run Apply, and check that the next Plan lists nothing.
- Publish the library, edit it in place and check that instances in a second file follow with
  their ids intact. Then delete and recreate the set and record what those instances show.

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

## Data table filter

- Run `DataTableFilter` on real touch hardware, with VoiceOver and TalkBack, and in RTL before v1.
  Check the on-screen keyboard over an open menu, and check that a fresh Backspace in an empty RTL
  submenu search closes the submenu, since `closeSubmenuOnBackspace` re-dispatches ArrowRight there
  (`packages/fuse/src/components/data-table-filter/searchable-menu.ts`).
- A value list scans every option label with a collator compare when a query matches nothing. Past
  about 100k options, precompute normalized labels in the field config and match them with
  `includes`, as row filtering does (`option-list.ts`).
- The add menu and the value popover open and close with the shared overlay keyframes, which
  cannot be interrupted (`packages/fuse/src/components/overlay/overlay-classes.ts`). Make them
  interruptible in the overlay owner, for every overlay at once.
- In a narrow bar, a move of the value popover from one chip to another shows it clamped at the
  viewport's 8px edge for two frames. The chip strip scrolls the new chip into view while the
  popover still anchors to the old one, which has scrolled away. To reproduce, open Status's
  value popover at 414px wide with Status and Customer chips, press Customer's value, and sample
  the positioner's `left` each frame: 40, 8, 8, then 110. Anchor the move after the strip
  scrolls, or keep the old anchor in view until it does.
- Base UI's menu filtering parts are a preview API. When they leave preview, rename them in
  `searchable-menu.ts`, the one module that reads them.
- Add `endsWith` and an exact-match text `is` when a consumer needs them. Make both opt-in like
  `startsWith` (`filter-model.ts`).
- Hide a value list's search below some option count, for every list kind at once. A boolean's Yes
  and No list shows it for two rows (`data-table-filter-content.tsx`).

## Command

- `CommandVirtual.List` renders flat item lists only, so `virtualized` beside `grouped` throws. Add
  grouped virtual lists. They need a row per group label in the virtualizer's index space, and
  Base UI's item indexes kept separate from the row indexes.
- Give `CommandVirtual` a committed API artifact. A docs page reads only its own entry, and the
  `command-virtual` entry has no page, so the API diff and drift checks miss changes to
  `CommandVirtual.List`. Add a `command-virtual` page, or let one page read several entries.
- The palette insets its input, rows and footer with `--surface-gap-sm`, a surface gap used as an
  inset, because no padding tier is 8px dense and 12px comfortable. Ask design whether menus,
  Select, Combobox and the other `sm` shells want that inset too. If they do, add a padding tier
  with those values and move the palette onto it. A new tier also needs the Figma `Fuse density`
  collection, the studio and CONTEXT.md.

## Landing stand-ins

The hero window's Dashboard (`apps/docs/src/app/(landing)/landing/app-shell/`), the brand sites
(`landing/brand-site/`) and the nav's theme picker (`landing/theme-picker/`) compose these pieces
locally because Fuse has no part for them. Replace
each stand-in once Fuse ships the part.

- Replace `app-shell/kbd.tsx` with Fuse's `Kbd` and `KbdGroup`, which now ship. The stand-in
  draws the shortcut caps in the sidebar, the tooltips and the order detail.
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
- Add a Fjordkraft Företag logo to Fuse. Until then the landing's `brand-wordmark.tsx` draws
  that brand from a mask of `public/landing/logos/fkab.svg`.
- Give the outline `Button` the ink of the `background` it paints. It inherits the text colour,
  so on a block filled with `primary` its label is light on light. The promo hero in
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
- Under Cache Components, the interim React Aria Calendar, RangeCalendar, DateField and
  DatePicker cannot prerender: React Aria and React Stately read the clock as they render
  (`useDateSegment` calls `new Date()`; `useDateFieldState` and `useCalendarState` call
  `@internationalized/date`'s `now()` and `today()`). A host wraps them in Suspense, and they
  render on the client. Decide whether Fuse's wrappers own that boundary or document it in their
  JSDoc. The docs app's boundaries are in `demo-frame.tsx` and the studio's `checkout-screen.tsx`.
- The studio's address writes can cancel a client navigation. The debounced write (300 ms after
  an edit) and the link-click follow loop in `apps/docs/src/studio/components/studio-persistence.ts`
  call `replaceState` on the old pathname, and Next's app router treats that as an external history
  change and drops the pending navigation. An edit followed by a page link within the delay can
  leave the visitor on the old page. The opening restore no longer races. Coordinate address
  writes with the router's navigation. Found by source inspection; not reproduced.
- When a product commits to charts, ship the deferred chart entry and decide its optional peer.
- When a product needs density preferences, define persistence and pre-paint stamping in the host.
- When a theme should choose its own density, rather than the host stamping it on the document
  root, design theme-driven density as its own change. Subtree theming never rescopes the density
  metrics today, and the density coverage test assumes one density per document.
- Add brands and locales on product demand; reconsider locale subsetting near ten locales.
- When behavioral tests miss a visual regression or manual theme review stops scaling,
  add visual regression coverage over demos to the publish gate.
- When measured icon weight becomes a problem, reconsider Phosphor core code generation.
- Revisit a source registry or separate playground when consumer demand or docs limitations justify it.
- The docs DTCG export still emits light modes only; the Figma sync in `packages/fuse-figma`
  writes both schemes. Retire the export after the first real Enterprise sync, once designers
  work from the synced variables.

OrderModule application migrations remain outside this repository's work.
