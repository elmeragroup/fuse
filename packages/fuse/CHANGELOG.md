# @elmeragroup/fuse

## 0.1.0

### Minor Changes

- 643f7cb: `Avatar` ships `Avatar.Group`, which stacks its avatars and separates them with a background-coloured
  ring. A stack no longer needs `flex -space-x-2` on a wrapper plus `ring-2 ring-background` on every
  avatar: render `Avatar.Root` children inside `Avatar.Group`.

  The group's ring rule wraps the whole parent-and-child selector in `:where()`, so it scores zero
  specificity and your explicit ring utility on a child avatar (`ring-0`, `ring-1`, `ring-foreground`, …)
  still wins.

- ac3ad25: `Button` `isPending` keeps the button in the focus order and stamps `aria-busy`, so a keyboard user who activated an async action is still on the button when the result arrives; before, the native `disabled` attribute dropped focus to the document. Activation stays blocked. Pass `focusableWhenDisabled={false}` for the old native `disabled` behaviour. While pending, Button shows a spinning `SpinnerGap` in the leading icon position and hides its own leading and bare SVG children so the spinner takes their place (a trailing `data-icon="inline-end"` icon stays), so a call site only passes `isPending`; remove hand-placed pending spinners. The new `pendingIndicator` prop replaces the spinner with your own node, or with `null` renders no indicator and hides nothing, for brand buttons that centre their own spinner over unchanged content. `ConfirmButton` inherits all of it. Announce progress through the label or a `role="status"` region, since `aria-busy` alone says nothing.
- 667f993: `@elmeragroup/fuse/button` exports `LabelButtonProps`, `IconButtonProps`, `ButtonSize`, `LabelButtonSize` and `IconButtonSize`. `ButtonProps` is now the union of the first two. A wrapper that supplies its own label types its props as `Omit<LabelButtonProps, "children">`, which keeps icon sizes out and the size list in sync with the recipe, where `Omit<ButtonProps, …>` collapsed the union and let `size="icon"` through without an `aria-label`.
- 643f7cb: `Collapsible.Content` now ships the open/close height transition (150 ms ease-out, keyed on Base UI's
  starting/ending styles) shared with `Accordion`, which previously never animated. Your `className` is
  merged last, so a conflicting utility wins; a full opt-out is
  `h-auto data-starting-style:h-auto data-ending-style:h-auto overflow-visible transition-none`.

  The panel keeps `overflow-hidden` in every state, including while open, so content that escapes the
  settled panel box — an absolutely positioned child, a popover, a focus ring past the edge — is
  clipped. The opt-out above releases the clipping along with the animation.

- fc85c72: `@elmeragroup/fuse/theme` now exports `COLOR_SCHEMES`, the `["light", "dark", "system"]` axis
  tuple. Hosts and pickers can iterate the color schemes from the library instead of
  re-deriving the list.
- f535185: `Combobox.Input` accepts `triggerLabel` to name its auto-rendered caret trigger, like `clearLabel`
  names the clear button.
- f3540a1: Disabled `Checkbox`, `RadioGroupItem` and `RadioIconButton` now dim to 50%. A disabled `Button` that renders another element or sets `focusableWhenDisabled` dims too. Its tooltip still opens, but hover and press no longer restyle it.

  External standalone buttons round with `--radius-button`, so Fjordkraft, Fjordkraft Företag and Telinet buttons become pills. Buttons in a group, a field or a preset list keep their corner. Internal themes round every element with `--radius`. Override `--radius` on `<html>` or a `ThemeScope` to move buttons, cards and fields together.

  New `--radius-step` and `--secondary-hover` roles. `Badge` has no hover styles.

- ad1332b: New `@elmeragroup/fuse/data-table` entry for TanStack Table v9. Install `@tanstack/react-table` 9.2 or
  later beside Fuse; it is an optional peer, and the entry is not in the root barrel.

  - `DataTable.*` parts take a plain `useTable` table: `Content`, `Header`, `Body`, `Row`, `Pagination`,
    `SortButton`, `ColumnToggle`, `SelectAll`, `SelectRow`, `RowActions`, and the `Text`, `Number`, `Date`,
    `DateTime` and `Currency` cells.
  - `createFuseTableHook` wraps `createTableHook` and registers the same parts as `table.Content`,
    `table.Row`, `table.Pagination`, `table.ColumnToggle`, `header.SortButton` and the default cells.
    It passes the app's `features` and options through unchanged. An app component registered under a
    Fuse key replaces Fuse's, props included.
  - `selectColumn(columnHelper, { getRowLabel })` builds a page-scoped selection column.
  - `actionsColumn(columnHelper, { getRowName, items })` builds a row-actions column around
    `DataTable.RowActions`. Each trigger is named from its row ("Actions for …"), the header is named
    "Actions" without visible text, and the column cannot sort or hide. The app supplies the menu items.
  - `Pagination` takes `total` as `{ kind: "known", pageCount }` or `{ kind: "unknown", hasMore }`.

  `@elmeragroup/fuse/icons` adds `CaretDoubleLeft` and `CaretDoubleRight`.

- fc85c72: `DropdownMenu.RadioGroup` now ties `value`, `defaultValue` and `onValueChange` to one
  string union instead of Base UI's `any`. The selected value and the change handler agree
  by type, so `onValueChange` receives the group's own union rather than `any`. Item values
  are not checked against it; `DropdownMenu.RadioItem` keeps Base UI's `any`. A group is
  controlled or uncontrolled, never both: `value` and `defaultValue` are mutually exclusive
  in the type.
- 1936fdd: External buttons now match the customer-facing reference button.

  At comfortable density, `Button` labels pad 16px at `sm` and 32px at `default` and `lg`, up from 14px. The side
  of a leading or trailing icon pads 12px at `sm` and 24px at `default` and `lg`, up from 10px and 12px. New
  `--control-px-button-*` and `--control-px-button-icon-*` density families hold those values. Dense matches the
  other controls, so dense buttons do not move, and `xs` keeps its comfortable values. Text fields, `Select`,
  `Toggle` and `InputGroup.Button` keep their padding. Components that borrow the Button recipe move too,
  including `Pagination` Previous/Next, the `DatePicker` presets and `FileTrigger`. A `px-*` class in
  `className` still replaces the label inset, but not the side of an icon, which keeps its icon padding; a
  `has-data-[icon=inline-start]:pl-*` or `has-data-[icon=inline-end]:pr-*` class replaces that.

  The `outline` variant takes its border from two new theme roles, `--button-outline` and
  `--button-outline-width`. External themes draw a 2px ring in `--foreground` with no shadow, in light and dark.
  Internal themes keep the 1px `--border` hairline and its `shadow-xs`.

- fc85c72: Add dark palettes for all ten external brand/segment themes, activated by `data-theme="dark"`.
  Nested scopes and portaled overlays receive their own brand palette. Fjordkraft company uses the
  Bedrift palette, while Fjordkraft Företag keeps the Fjordkraft private alias. The dark marker
  resolves both variants; `.changeset/internal-dark-palette.md` describes the shared internal palette.

  Brand colors follow the custom Figma dark collections. Gudbrandsdal Energi and shared support-role
  mappings are provisional. Dark text, input and focus contrast are checked alongside scope isolation.

- 643f7cb: `Field.Label` now owns the row treatment when a `Checkbox` is its direct child: the row centers and
  shows a pointer cursor, so demos no longer restate `items-center cursor-pointer`. The label keeps the
  shared heading weight; a `font-*` class in your `className` merges last and wins as on any other
  label. A label beside a control (the `Field.Root orientation="horizontal"` pattern) is unchanged.
- e38a8b5: Curated Phosphor icons now follow the same accessible-naming contract as bespoke artwork: pass `title` to render `role="img"` with a `<title>`, or omit it for a decorative icon (`aria-hidden="true"`, `focusable="false"`). `ElmeraIconProps` gains `title` and drops Phosphor's `alt`.

  Migration: replace `alt` with `title`. Icons named with `aria-label` and no `title` are now hidden; pass `title` instead. `Alert.Icon` accepts neither `alt` nor `title`: its status glyph is always decorative, and the alert's text names the status.

- dc400ed: Initial release of Fuse, the Elmera Group React component library.

  - Typography, layout, forms, selection controls, overlays, feedback, navigation, and the application sidebar.
  - Theme and locale providers, brand tokens, light and dark color schemes, and dense and comfortable controls.
  - Tailwind v4 integration and a standalone stylesheet for consumers without Tailwind.
  - Localized component labels in English, Norwegian Bokmål, Swedish, and Finnish.
  - Packaged flags, icons, logos, illustrations, and emoji assets.
  - Interim date, collection, and routing components under the `react-aria/*` entry points.
  - Typed public entry points with documented props and React Server Component boundaries.

- fc85c72: Add a shared neutral dark palette for all internal themes, selected by `data-theme="dark"` with the existing variant, brand and segment attributes. Keep brand sidebar accents, supply missing library roles, and strengthen input/chart contrast. Correct alpha compositing in contrast measurements and verify dark first paint and nested scope isolation.
- f92e164: `@elmeragroup/fuse` ships `NavigationMenu`, a site navigation bar built on Base UI's navigation
  menu. It has eight parts: `Root`, `List`, `Item`, `Trigger`, `Content`, `Link`, `Viewport` and
  `Indicator`. `NavigationMenu.Root` renders the `<nav>` landmark and the one popup that every
  `Content` opens into. `side` and `align` place that popup against the open trigger, under it by
  default, and `container` sets the portal target. A Root nested in a `Content` is a submenu:
  `side="right"` opens it beside its trigger, and `inline` renders no popup, so its content shows
  in a `NavigationMenu.Viewport` placed inside it. A trigger in a vertical Root is a full-width row.
  A `Trigger` opens on hover, click, Enter or ArrowDown. Its caret points to the side its popup
  opens on and turns while open in a bar; a trigger in an `inline` Root has no caret.
  `NavigationMenu.Link` with `active` marks the current page with `aria-current="page"`.
- d0ce3b2: `NumberField` treats an absent `value` as uncontrolled, matching React's convention. Pass `NaN` for a controlled empty field.

  - A bare `<NumberField label onChange />` (no `value`, no `defaultValue`) now steps from empty instead of being locked as a controlled empty field that could not step.
  - Migration: a controlled field that starts empty should use `useState<number>(NaN)` rather than `useState<number>()`; `value={undefined}` no longer means controlled-empty.

- d0ce3b2: NumberField stepper buttons are now named in the provider locale (Norwegian Bokmål, Swedish, English, Finnish) instead of always in English. New optional `increaseLabel` and `decreaseLabel` props override the built-in names.
- c1c82bb: Server components can render `CheckboxItem` and `RadioItem` with their `Title`, `Description`, `Content`, `Actions` and `SubSection` parts, and a `SubSection` stays outside the row label when the server renders the row. `SelectionItem.Shell` accepts an optional `subSections` prop for bands partitioned by the caller.
- 09cf8f7: `TextareaField` now merges `className` onto the field root, like `TextField`, `NumberField` and `PhoneNumberField`. Move classes meant for the textarea itself to the new `textareaClassName` prop.
- fc85c72: Add the curated `SlidersHorizontal` icon for settings menu triggers.

### Patch Changes

- e21c78e: An explicit `aria-label` on an icon-only `Toast.Close` now names the button. Before, the icon-only
  close button kept its `label` or the dictionary `toast.close` name and ignored `aria-label`.

  An explicit `aria-label` on `BrandLogo` (`@elmeragroup/fuse/icons`) now names the logo. Before,
  `title` or the brand display name replaced it.

- ad14f3f: `Alert.Root`: the default variant's action button hovers to the `muted` fill instead of Button's
  translucent primary fill, which left its `foreground` label at low contrast while hovered.
- 070c391: `AlertDialog.Root` now runs Base UI's alert-dialog mode, so every alert dialog is modal and a
  backdrop click no longer dismisses it. Escape still closes it. `modal` and
  `disablePointerDismissal` are no longer accepted on `AlertDialog.Root`.
- 48ff71d: `Button` and `ConfirmButton` keep Base UI's `aria-disabled` when they stay focusable while disabled (`focusableWhenDisabled` with `disabled` or `isPending`) or render a disabled non-native element. Before, the attribute was dropped and assistive tech announced an enabled button.
- 2f620c6: `Button` shows the pointer cursor, like Fuse's other interactive controls. Disabled, pending and visually disabled buttons keep the `not-allowed` cursor from the state face. Hosts that added their own `[data-slot="button"] { cursor: pointer }` rule can remove it.
- 768108b: `Combobox.Input` now honors `disabled` on `Combobox.Root`. Before, a disabled Root left the native input focusable and typeable.
- d0ce3b2: `Combobox.Content` now insets an owned search group with popup padding instead of a margin on the group, so a `w-full` search group (the `PhoneNumberField` country picker) no longer overflows and clips its right edge. Popups without a search group keep the menu family's single `p-1` list inset.
- d0ce3b2: `Button` stops measuring a button and drops the shared `pointermove` listener as soon as its `onIntent` callback has fired, instead of at unmount.
- 09cf8f7: Pressing Escape on an armed `ConfirmButton` inside a Dialog, Sheet or Popover now only disarms the button; a second Escape closes the overlay.
- a85ab61: `ConfirmButton` ignores presses while `isPending` or `isVisuallyDisabled` is set, as it already did for `disabled`, and disarms when either turns on. A visually disabled button no longer confirms after two presses, and a button armed before it went pending no longer confirms on the next press after pending clears.
- d17a9b9: A size utility in your `className` now wins on `Select.Trigger` and on a segmented `ToggleGroup.Item`
  (`spacing={0}`), as it already did on `Button` and `Toggle`. Before, the trigger's height, gap,
  padding and type and the segmented item's padding sat behind heavier `data-*` selectors, so
  `<Select.Trigger className="h-12">` or `<ToggleGroup.Item className="px-4">` changed nothing.
  Without a `className`, both render as before.
- d808c58: The md and lg control sizes now set their type with the typed utilities `text-(length:--control-text)` and `leading-(--control-leading)` instead of arbitrary properties. tailwind-merge groups the typed forms with `text-*` and `leading-*`, so a consumer `text-*` or `leading-*` class in `className` now replaces the density type through `cn` on `Button`, `Toggle`, `ToggleGroup.Item`, `Select.Trigger`, `Tabs.Trigger`, `Sidebar.MenuSubButton` and the text-entry boxes. Before, `cn` kept both classes and `<Button className="text-sm">` rendered at `--control-text`.
- fc85c72: `themes.css`: the external dark company rule (`fkas` + `company`) now materializes the complete
  dark reset set like every other dark rule, and every segment that departs from its brand base in
  either scheme gets its dark rule, so the four-attribute dark segment selector always outranks the
  three-attribute light segment selector and the cascade never falls back to emission order. No token
  values changed — the added declarations repeat values the adjacent dark brand rule already
  supplies. The emitted sheet grows by about 2.9 KB raw / 29 bytes gzip, which changes the bytes
  consumers cache.
- 491906d: `DatePicker` opens its calendar on the `placeholderValue` month when there is no value, instead of the current month. A set value still wins, and clearing the value returns the calendar to the placeholder month.
- de1c90c: `DateField` centers its segment row in the field box again. The recipe's `input` slot carried `block`, which won the display conflict against the flex the shared field group applies, so the row sat flush against the top of the box: at `dense` the suite measured 15px of slack below the row and none above. Dropping `block` restores the centring at both densities.

  `DateRangePicker` keeps one md inline inset between the en-dash and each date. Each date input inherited `DateField`'s 150px minimum width, so the start date's box grew past its content and the en-dash sat 84px from the date instead of 10px. The floor now applies only to a `DateField` that paints its own box.

- e39eb2f: Refresh runtime dependencies to the latest admitted versions. React and
  React DOM are 19.3.0. Base UI is 1.8.0, React Aria is 3.52.1, and React
  Aria Components is 1.21.1; their exact published pins move with the
  catalog. `@internationalized/date` is 3.12.4, `libphonenumber-js` is
  1.13.13, and `sugar-high` is 2.4.1 (published range `^2.4.0`).

  `Code` and the docs renderer highlight through sugar-high's granular `core`
  and `lang/javascript` entries instead of the root barrel, so the `code`
  entry measures 12855 gzip bytes — under the 17634-byte ceiling it had
  before the upgrade — instead of paying for every language preset.

  sugar-high v2 changes token classification for at least one pattern: in
  `const html = "<div>" + a + "</div>";`, `a` renders as
  `sh__token--property` where v1 emitted `sh__token--identifier`, so
  highlighted markup and its colors can differ from v1.

- fc85c72: `@elmeragroup/fuse/dialog` now exports `DialogTitleProps`, so a host wrapping `Dialog.Title`
  can type its own props — including the `isFocusable` opt-in the docs page already documents.
- 6a3e5d2: External `elma` themes now carry the Elmera palette from the brand's Figma
  role sheet instead of a grayscale copy of the defaults: teal-tinted
  `background`, `foreground`, `primary`, `secondary`, the soft pairs and the
  `feature` triple all change. `--brand-elma` moves to the same P-20 tone as
  the elma foreground.

  `--primary-soft` for fkas and tkas is now P-95, byte-identical to their
  `--secondary-soft`, so every brand backed by a role sheet follows one rule.
  Surfaces using `bg-primary-soft` in those brands render a slightly more
  saturated tint.

  External `--muted-foreground` is documented as an accepted contrast
  deviation (≈ 2.7–2.9:1, non-essential text only) in the accessibility
  spec; no values changed for that token.

- d0ce3b2: Bespoke icons, logos, and illustrations now render as decorative (`aria-hidden="true"`) when `title` is an empty string, instead of an unnamed `role="img"`.
- f535185: An explicit `aria-label` now wins on `Combobox.Clear` and `DatePickerPresetGroup`. When a wrapper
  forwards `id` or `aria-labelledby` as `undefined`, `TextareaField` keeps its Field label and
  `TextField` keeps its `aria-labelledby` wiring.
- 03260e8: Unmounting the last `ForceColorScheme` before `ThemeProvider` finishes mounting no longer overwrites the color scheme the host's bootstrap script applied.
- d0ce3b2: A form whose `onReset` handler stops propagation no longer blocks native reset for an uncontrolled `NumberField`, `PhoneNumberField`, or `TextareaField`. An uncontrolled `NumberField` focused inside a shadow root also keeps focus through the reset remount, and a suspended update no longer disables reset for a field that is still displayed as uncontrolled.
- 0eca8ed: Field wiring survives props forwarded as `undefined`. Before, an `aria-labelledby={undefined}` on `Input`, `Field.Control`, `Combobox.Input`, `Combobox.ChipsInput` or `Combobox.Trigger` dropped the Field label reference, and on `Field.Set` it dropped the legend name. An undefined `aria-labelledby`, `aria-describedby` or `role` on `Sheet.Content` dropped the dialog's name, description and role.

  `TextareaField` inside a disabled `Field.Set` is now disabled. Before, it stayed editable.

- d0ce3b2: Hidden sidebar panels and item footers are no longer reachable from the keyboard.

  - Collapsed offcanvas `Sidebar` contents leave tab order and the accessibility tree. `Sidebar.Rail` stays a mouse-only control for reopening the panel.
  - `Item.Footer` with `mode="hidden"` — and `SelectionItem.SubSection`, which forwards that mode — renders `inert` until the mode changes.

- 616f97e: The published `package.json` now carries a `bugs` link to the issue tracker, so npm and
  package tooling show consumers where to report problems.
- 09cf8f7: `Meter` now resolves a value above the default `maxValue` of 100 to the exceeded level, the same as an explicit `maxValue`.
- d0ce3b2: Native form reset now restores an uncontrolled `NumberField`'s `defaultValue` (or clears it when there is none) without calling `onChange`, matching the other field composites. A controlled `value` stays parent-owned.
- 16954d8: `NumberField` steppers now sit side by side as full-height minus and plus buttons, so each meets the 24px minimum target size at both densities.
- d0ce3b2: `TextField` with `filter="numeric"` now restores its `defaultValue` on native form reset instead of keeping the edited digits. `onChange` is not called for the reset.

  Mixed input such as a pasted `12a3` is now stripped to `123` instead of the whole edit being rejected.

- 09cf8f7: `PhoneNumberField` now forwards `required` to its input so an empty required field cannot submit, and an unnamed field no longer adds a `phone-number-display-value` entry to form data.
- d0ce3b2: Native form reset now clears an uncontrolled `PhoneNumberField` number while keeping the selected country. `onChange` and `onCountryChange` are not called; a controlled `value` stays parent-owned.
- fc85c72: `fuse.css`: the RAC popover width clamp now reserves React Aria's `containerPadding` in pixels
  (`calc(100vw - 24px)`) instead of `1.5rem`, which only matched the 12px gutter per side at a 16px
  root font size — a smaller root left the popover wider than the positioning gutter allows.
- 29771c3: The `tailwindcss` peer range is now `^4.1`. Fuse's classes use the 4.1 utilities `wrap-anywhere`
  and `wrap-break-word`, which Tailwind 4.0 does not generate, so the published `^4` let a 4.0
  install drop them silently.

  Published dependency ranges now follow the versions Fuse is tested with: `tailwind-merge` is
  `^3.7.0`, `tailwind-variants` `^3.3.1`, `@internationalized/date` `^3.12.4` and
  `libphonenumber-js` `^1.13.13`. Base UI, React Aria, React Aria Components, Phosphor and
  `tailwindcss-react-aria-components` stay exact pins, and `sugar-high` stays at `^2.4.0`.

- fc85c72: Repair badge and secondary text colors across themes, wrap horizontal cards and pagination, and fit date pickers to narrow containers. Disabled InputGroup addon buttons no longer dim an editable field. Destructive confirmations focus Cancel, mobile sidebars expose a close button, and calendars follow the locale direction and choose weekday labels by width — a locale whose short names overflow a column falls back to narrow glyphs.

  Follow-up to the same review pass:

  - `Button` with `isVisuallyDisabled` now stamps `aria-disabled="true"` so the unavailable state is announced; an explicit `aria-disabled` prop still wins.
  - `Dialog.Title` accepts `isFocusable`, which stamps `tabIndex={-1}` and the shared focus ring — the supported way to hand a long-content title to `initialFocus`.
  - `AlertDialog.Content` honors a caller's `initialFocus` over its variant default, and the mobile `Sidebar` close button now sits in a normal-flow header row instead of an absolutely positioned overlay.
  - The typography `secondary` variant is deprecated: it is an identity alias of `foreground` (`--secondary` is a surface token, never a text role).

- 2918505: The radius rungs in `@elmeragroup/fuse/css` (`rounded-xs` to `rounded-xl`, `--radius-popover`) and the private corner classes read `--radius-step` with a `0px` fallback. A host that imports `fuse/css` without `themes.css` and keeps its own `--radius` now rounds every rung with that radius instead of getting an invalid `border-radius`. The package README documents what `fuse/css` changes in a host's Tailwind theme and how to keep your own tokens; the theming handbook page has the same recipe.
- 6891ded: `RangeCalendar` and `DateRangePicker` now paint dates blocked by `isDateUnavailable` in the muted text colour, matching `Calendar`.
- 1348923: Server components can read compound namespaces such as `Dialog.Root`. The namespace object is no longer a client-module reference, so dotting into a part does not throw. Alert stays server-rendered: the Item chrome it composes has no hooks. Item's markup parts (`Media`, `Content`, `Title`, `Description`, `Actions`, `Header`, `Footer`) and SelectionItem's `Description` and `Content` are server components. A function-form `render` on `Item.Root` now receives an empty state object; the root's `data-slot`, `data-variant` and `data-size` arrive as ordinary props instead.
- e178f6d: Component and localized-copy JSDoc no longer points at internal spec documents that ship
  outside the package. Each comment now says in its own words why the component is a client
  or server component, and which dictionary keys its default copy fills.
- 7bce83d: `Sidebar.Root` on mobile now forwards its element props (`id`, `aria-*`, `data-*`, handlers)
  to the sheet dialog and merges `style` with the mobile `--sidebar-width`; they were dropped on
  the sheet's provider before. A caller's `Sidebar.Rail` `onClick` now runs alongside the toggle
  instead of replacing it. The mobile breakpoint is `(width < 48rem)`, the exact complement of
  `md:`, so fractional widths and non-16px browser default font sizes no longer leave a range with
  no sidebar, and the Rail shows from `md:` instead of `sm:`, so it stays hidden inside the mobile sheet.
- 895438e: Interactive controls now share one disabled and invalid look:

  - **Disabled.** A disabled control dims to 50% and shows the `not-allowed` cursor.
    `Button isVisuallyDisabled` now dims to 50% instead of 70%. It also gets the
    `not-allowed` cursor and no longer changes on hover or press, but it still activates.
    A button with `aria-disabled="true"` looks the same. The look now comes from
    `aria-disabled`, so `isVisuallyDisabled` with an explicit `aria-disabled={false}` shows no
    disabled look. A disabled `CheckboxCard` now dims to 50% instead of 75% and shows the
    `not-allowed` cursor.
  - **Tooltips.** Disabled controls no longer turn off pointer events, so a Tooltip on a
    disabled control opens on hover. That includes a natively disabled `Button` or `Toggle`.
    A disabled control still does not repaint, move or scale under the pointer. This fixes
    `RadioIconButton`, which used to change its fill on hover and shrink on press while
    disabled. `aria-disabled` Sidebar rows (including link rows such as
    `Sidebar.MenuSubButton href=… aria-disabled`) and `aria-disabled` Tabs triggers no longer
    block pointer events either, so a Tooltip on them opens. The Sidebar rows guard themselves:
    `Sidebar.MenuButton` and `Sidebar.MenuSubButton` with `aria-disabled="true"` cancel a click
    or a keyboard Enter, so a link row does not navigate and the row's `onClick` does not run.
    A middle-click on a link row opens no new tab either, and its `onAuxClick` does not run.
    An `aria-disabled` Tabs trigger now receives clicks; use its `disabled` prop, the supported
    way to disable a tab.
  - **Invalid.** Every invalid control paints an `--error` border and a 3px ring. `Toggle`
    and `RadioIconButton` now show that ring, and so do the React Aria date fields. A radio
    or checkbox inside an invalid group shows the same ring.
  - **Groups.** A disabled `InputGroup` dims once. Its input is no longer dimmed again inside
    the dimmed group. `InputGroup` now paints its invalid ring only when its input or textarea
    is invalid. An invalid addon, such as a Button or Select inside the group, no longer rings
    the whole group. The group reads its state from its own input or textarea, a direct child
    of `InputGroup.Root`, so a disabled or invalid field nested in an addon, such as a
    `NumberField`, does not dim or ring the group. `Combobox.Chips` now dims as a whole when
    its input is disabled. Each chip no longer dims itself. An `InputGroup` whose input is
    `aria-disabled="true"` dims once as a whole too. A disabled `NumberField` now dims once as
    a whole and shows the `not-allowed` cursor over its input and steppers. A stepper disabled
    at its bound no longer dims on its own; it keeps its muted fill and shows a muted caret.
  - **Other controls.** A disabled `Accordion.Trigger` and a disabled React Aria `Link` now
    dim, show the `not-allowed` cursor, and no longer underline or fade on hover. An
    `Accordion.Trigger`, `Select.Trigger`, `Input` or `Textarea` given `aria-disabled="true"`
    now dims and shows the `not-allowed` cursor as well. A disabled inline `TextField` no
    longer shows its border and fill when hovered.

- 5f023e9: `ThemeProvider` warns once about a coerced pinned segment in production. Before, it warned twice on
  mount and again whenever a color-scheme option changed.
- 079c1e6: `ThemeScope` now validates its theme once per axis change, so a production pinned-segment warning no longer repeats on every render. `ThemeProvider` stays mounted where `matchMedia` is missing or only supports the legacy `addListener` API.
- d0ce3b2: `ThemeProvider` now follows `localStorage.clear()` from other tabs by restoring the configured `defaultColorScheme`, and ignores `sessionStorage` events that reuse the color-scheme key.
- fc85c72: `Toast.Title` and `Toast.Description` on the error, info, success and warning statuses now render in
  the paired `<status>-soft-foreground` role over the soft fill: the title inherits the root's colour,
  and the description resolves the `--toast-copy` variable the root publishes. Titles no longer paint
  the raw `<status>` role and descriptions no longer fall back to the neutral `muted-foreground`, so
  both stay at the text-grade contrast the palette guarantees. Neutral and loading toasts keep
  `muted-foreground`, a consumer `className` on either slot still wins, and the status icons keep the
  raw `<status>` accent. Light themes look unchanged; dark copy may render a different colour.
- 643f7cb: `ToggleGroup.Root` types `style` as plain `CSSProperties`. A Base UI state callback was never
  applied at runtime because it was spread into an object. It is now a type error, making the
  silent drop visible at compile time.
