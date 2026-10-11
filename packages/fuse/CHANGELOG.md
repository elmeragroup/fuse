# @elmeragroup/fuse

## 0.1.0

### Minor Changes

- 771c6c4: `Accordion.Trigger` takes an `indicator` prop. It defaults to the caret that rotates while the
  item is open. Pass `null` to render no indicator, or any node to render it in the caret's place.
  Every variant places a custom indicator where it places the caret, including the right edge in
  `infodropdown`. Without an indicator the trigger packs its children at the start, so a leading
  chevron passed as a child sits beside the label. A custom indicator styles its open state from
  the trigger's `data-panel-open` attribute.

  `accordionVariants` has a new `indicator` slot that places a custom indicator's wrapper the way
  the `icon` slot places the caret.

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

- cb57e39: Inner parts round concentrically with the surface they sit in: a part laid against a padded
  surface's edge takes the surface's corner less the padding and border between them, never
  below 0. Outer corners keep their rung.

  Visible changes, by family:

  - Menus: DropdownMenu, Combobox, Select and NavigationMenu rows. Internal rows round 2px
    (NavigationMenu 0px) instead of 6px, and external rows follow their brand's radius. A Select
    row outside a `Select.Group` rounds like the popup.
  - Fields: InputGroup addon buttons, the phone country trigger and the SearchField clear button
    round 1px internal and 0px external; the DatePicker trigger 5px internal and 3px external;
    a kbd, Combobox chips, the chip remove button and date segments 0px.
  - Tabs: the list pads 4px instead of 3px, and a trigger rounds with the list's corner less 4px
    (2px internal). The `line` variant keeps its corners.
  - Frame: a panel in a Frame rounds with the Frame's corner less its 4px padding (2px internal),
    and so does a Table body in a Frame. Stacked panels keep their joined edges.
  - Sidebar: in a floating Sidebar, menu buttons and group labels round with the surface's
    corner less 8px (0px internal), and menu actions 4px inside that. Other variants keep their
    corners.
  - DatePicker presets round with the popover's corner less 9px (0px internal).
  - An InputGroup addon that holds both a kbd and a button now insets like a button addon.

  The new public `rounded-inner` utility rounds a custom row or block the same way. Card, Dialog,
  Popover, Tooltip, Toast, Item, SelectionItem, Empty, the rounded Accordion items, the
  standalone Calendar and the parts above publish the `--inner-corner` it reads; elsewhere it
  rounds with `--radius`. An element with theme attributes, such as a `ThemeScope`, resets
  `--inner-corner`, so a part in a nested scope rounds with that scope's radius.

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

- bf524c7: `DatePicker` takes `triggerPlacement`. Set it to `"start"` to put the calendar button before the
  date segments, so the button comes first in the field box, in tab order and on screen. Clicking
  the label then focuses the button. The default, `"end"`, keeps the button after the segments.
  `DateRangePicker` keeps its button at the end and does not take the prop.
- 306904d: `DateRangePicker` (`@elmeragroup/fuse/react-aria/date-range-picker`) takes a `presetGroup` and
  shows it beside the range calendar inside the popover, as `DatePicker` does. Build the pane
  from the new `DateRangePickerPresetGroup` and `DateRangePickerPresetItem` parts. Each preset
  reports its `value`, and your `onChange` maps that value to a range. When a preset commits a
  range in another month, the open calendar moves to the range's start month. If the user has
  picked only the first date and then moves to the presets, the picker drops that date instead
  of committing a one-day range.

  `DatePicker` now opens on a `placeholderValue` that comes through `DatePickerContext`. Before,
  an empty picker configured that way opened on the current month. `DateRangePicker` still opens
  on a `placeholderValue` from `DateRangePickerContext`.

  The calendar inside a `DatePicker` popover no longer draws its own shadow and fill when the
  picker has no presets. The popover already draws the card, so the calendar keeps only its
  inset.

- e0f6aba: `@elmeragroup/fuse/theme` now exports `DENSITIES`, the `["dense", "comfortable"]` axis tuple.
  Hosts, pickers and test matrices can iterate the densities from the library instead of
  re-deriving the list.
- e0f6aba: Every part now has a density role, and density changes every part that has one. A part is a
  `data-slot` the library writes. Its role names the metrics it reads:

  - `control`: an interactive single-line box.
  - `row`: one line of a collection.
  - `surface`: a shell that pads content, or a stack that spaces groups.
  - `label`: the words that describe a control.
  - `layout`: sized by its children.
  - `fixed`: the same at both densities.

  `PART_DENSITY` declares every part's role, and the workspace theme catalog carries it. The docs
  check every rendered part against its role at both densities. The tokens handbook page lists the
  metrics and the parts for each role.

  New metrics, in px dense/comfortable:

  - Row metrics: `--row-h` 32/36, `--row-h-header` 40/44, `--row-px` 8/12, `--row-py` 6/8. A row
    keeps its text size and grows in height and padding only.
  - Surface gaps: `--surface-gap-sm` 8/12, `--surface-gap-md` 12/16, `--surface-gap-lg` 16/24,
    `--surface-gap-xl` 24/32.
  - Label metrics: `--label-text` 14/16 and `--label-leading` 20/24. They replace the unreleased
    `--control-text-row` and `--control-leading-row`.
  - The Figma sync exports them as `Fuse density` variables, and the theme catalog gives every
    density metric the role that reads it.

  What now follows density:

  - **Rows.**
    - Menu, Select, Combobox, NavigationMenu content and default Sidebar rows read the row metrics.
    - `Table` and `DataTable` heads and cells, `VerticalTable` keys and values, `GridList` rows,
      `DescriptionList` terms and details, `Sidebar.Input` and `Combobox.Empty` follow too.
    - In a Frame, a table's first and last cells keep their 2px extra edge inset over `--row-px`.
  - **Item.**
    - `default` pads every side with `--surface-pad-md` and gaps its parts by `--surface-gap-md`.
    - `sm`, and so every `Alert`, keeps that inline edge and pads its block with `--row-px`.
    - `xs` is a list row on the row metrics.
    - `sm` and `xs` gap their parts by `--surface-gap-sm`.
    - A compact `Item.Group` pads default Items with `--surface-pad-md` and `sm` Items with
      `--row-px`.
  - **Field text.**
    - `Field.Label`, `Field.Title`, `Field.Description`, `Field.Error`, a `variant="label"`
      `Field.Legend`, and the React Aria fields' label, description and error read the label
      metrics.
    - A `variant="legend"` `Field.Legend` stays 16/24px.
    - `SelectionItem.Title` and `SelectionItem.Description` read them too. They now write their own
      `selection-item-title` and `selection-item-description` slots in place of `item-title` and
      `item-description`.
  - **Group gaps.**
    - `Field.Root` uses `--surface-gap-md`. `Field.Set` and `Field.Group` use `--surface-gap-xl`,
      with `md` or `lg` around nested groups.
    - Checkbox, Radio and selection-item option groups stack by `--surface-gap-sm` and line up by
      `--surface-gap-lg`.
    - `Item.Group` uses `--surface-gap-lg`, or `--surface-gap-sm` for `sm` and `xs` rows.
    - FieldFrame's 4px between a label and its control stays fixed part spacing.
  - **Sheet.**
    - The header, body and footer pad with `--surface-pad-lg` and stack by `--surface-gap-lg`.
    - Body blocks are spaced by `--surface-gap-xl`.
  - **Accordion.** An open panel sits `--surface-gap-lg` below its trigger. The gap moved from the
    trigger's bottom padding into the panel, so it opens and closes with the panel.
  - **Siblings of density-following parts.**
    - The `Pagination` ellipsis is the md control square.
    - `InputGroup.Button` reads the xs rung, or the sm square for `icon-sm`; the `Combobox` caret
      follows.
    - `InputGroup.Addon` pads with the md control icon inset or the md inset, and its text and
      `InputGroup.Text` take the md control type.
    - The `Combobox` chips box takes the md control type, gap and `--row-py`.
    - `Tooltip` pads with `--surface-pad-md` and `--row-py`.
    - The React Aria picker dialog stacks its content by `--surface-gap-lg`.
  - **Sidebar.**
    - `Sidebar.Header`, `Sidebar.Footer` and `Sidebar.Group` pad with `--row-px`; the collapsed
      icon rail keeps 8px.
    - `Sidebar.GroupAction`, and `Sidebar.MenuAction` on a default row, are the xs control square,
      centred on their row.
    - `Sidebar.MenuBadge` stays centred on the default row.

  Other changes:

  - `Button` writes its `size` as `data-size`.
  - `Card`'s root, header, content and footer write their `direction` as `data-direction`, and so do
    `CheckboxGroup`, `RadioGroup` and the selection-item list, from their `orientation`.
  - TextField, NumberField and PhoneNumberField roots write `data-spacing="part"`, and the other
    labeled composites `data-spacing="group"`: the first stack their label 4px above the control at
    either density.
  - `Sidebar.MenuButton` reserves the menu action's square plus 8px at its end, so a truncated
    label stops before the action at either density.
  - `Item.Group`'s `sm` and `xs` row gaps now match only its Item rows, not a Button of that size
    inside one.
  - When comfortable, an internal theme's InputGroup addon buttons and the PhoneNumberField country
    trigger round at 0, their concentric corner.
  - A Menu, Select, Combobox or NavigationMenu row that wraps is 4px taller when comfortable.

  Dense moves:

  - Tables:
    - A one-line body row is 32px (was 30px).
    - A head inside a Frame is 40px (was 36px).
    - A row with an `icon-sm` button, such as DataTable's row actions, is 44px (was 48px).
    - A framed body row is 32px including its rule (was 33px).
  - A one-line `GridList` row is 32px (was 28px).
  - `Combobox.Empty` pads 6px on the block axis (was 8px) and 8px inline (was 0).
  - `DescriptionList` terms and details pad 6px on the block axis (was 8px).
  - A one-line `VerticalTable` row is 33px (was 37px).
  - Item:
    - A default `Item` pads 12px on the block axis (was 14px) and gaps by 12px (was 14px).
    - An `sm` Item pads 8px on the block axis (was 10px) and gaps by 8px (was 10px), so a one-line
      `Alert` is 38px (was 42px).
    - An `xs` Item pads 8px inline (was 10px) and 6px on the block axis (was 8px); a one-line `xs`
      Item is 32px (was 36px).
  - A standalone `Field.Description` has a 20px line height (was 21px).
  - `Field.Group` gaps by 24px (was 28px), and a group of `sm` Items by 8px (was 10px).
  - `Sidebar.GroupAction` sits 2px higher. `Sidebar.MenuAction` sits 2px higher on every row size.

- 7502cb0: Density now sets shell padding as well as control sizes. Three surface metrics,
  `--surface-pad-sm`, `--surface-pad-md` and `--surface-pad-lg`, sit beside the `--control-*`
  metrics: 4/4px, 12/16px and 16/24px dense/comfortable. Each shell pads with one tier and
  subtracts the same tier from the inner corner it publishes. Outer corners do not change.

  - Small: DropdownMenu, Select groups, Combobox lists and Frame keep 4px. NavigationMenu
    content, the floating Sidebar's sections, Calendar, the DateRangePicker's calendar and the
    date-picker presets pad 4px instead of 8px. A floating Sidebar collapsed to icons keeps 8px.
  - Medium: Popover (PopoverInfoButton's too), Toast, every Accordion item and Item's default
    inline padding pad 12px dense, down from 16px, and 16px comfortable. The Field label card
    stays 12px dense and grows to 16px comfortable.
  - Large: Card sections, the gaps between them and a horizontal Card's gap, Dialog, and Empty
    pad 16px dense, down from 24px, and 24px comfortable. Frame panels pad 16px dense and 24px
    comfortable, from 20px. Frame headers and footers change only their inline padding, 16px
    dense and 24px comfortable from 20px; their block padding stays 16px. Empty pads 32px dense
    and 48px comfortable from `md` up, where it padded 48px. The TextField `card` box pads 16px
    dense and 24px comfortable inline, from 24px. CheckboxCard stays 16px dense inline and grows
    to 24px comfortable.

  Menu, Select, Combobox, NavigationMenu and default Sidebar rows read the row metrics,
  `--row-h` and `--row-px`. They stay 32px tall with 8px inline padding when dense
  and become 36px with 12px when comfortable. The Sidebar menu skeleton matches the default row.
  The Figma density collection gains the three surface metrics.

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

- c670d11: External field boxes now round at 4px for every brand, the corner of the Central design system's text input.

  A new theme role, `--radius-field`, rounds `Input`, `Textarea`, the `Select` trigger, `NumberField`, `InputGroup`,
  the `Combobox` chips box, `DateField`, `DatePicker`, `SearchField` and the other React Aria field groups. External
  themes set it to `0.25rem`, down from the brand radius minus 2px (10px for Fjordkraft and Telinet, 14px for
  TrøndelagKraft, 6px for Gudbrandsdal Energi). Nothing inside a field rounds more than the field: the `InputGroup`
  addon buttons and `<kbd>`, the `SearchField` clear button, the `DatePicker` trigger, the focused date segments, the
  `Combobox` chips and their remove buttons and the `PhoneNumberField` country trigger take at most the field corner.
  A `ButtonGroup` rounds both outer ends with `rounded-md`, so a field at one end matches a button at the other.
  Internal themes alias `--radius-field` to `var(--radius)` and do not move, and internal fields still follow a
  `--radius` override on a plain wrapper.

  A host without `themes.css` keeps rounding fields with its own `--radius`. For the external corner, set
  `--radius-step: 2px` and `--radius-field: 0.25rem`. The Figma sync adds `radius-field` with the corner radius picker.

- cb04489: `Field.Description` now works outside a `Field.Root`. Inside a `Field.Set`, it describes
  the fieldset through `aria-describedby`, after any `aria-describedby` you pass to the set, so a
  description can follow a `Field.Legend`. Elsewhere it renders the same paragraph without wiring.
  Before, it threw "FieldRootContext is missing" outside a `Field.Root`. Inside a `Field.Root` it
  still describes the field's control.
- 139b867: `Field.Error` without children now shows the field's own validation message, as Base UI's
  `Field.Error` does: an error from Base UI's `Form` under the field's name, a `validate` result or
  the browser's constraint message, as a list when there are several. Before, it rendered nothing, so
  a field could turn invalid without a message. TextField, NumberField, TextareaField, CheckboxGroup
  and RadioGroup do the same when `errorMessage` is falsy. PhoneNumberField shows its visible input's
  constraint message, but a `Form` error under its `name` still has to be passed as `errorMessage`.

  Fields that relied on an empty `Field.Error` staying silent now show the browser's message, in the
  browser's language, once they validate: after Enter, on blur with `validationMode="onBlur"`, or
  when a Base UI `Form` submits. Pass children or `errorMessage` to keep your own copy. Like Base
  UI's, an empty `Field.Error` must sit inside `Field.Root`; outside one it used to render nothing
  and now throws.

- 643f7cb: `Field.Label` now owns the row treatment when a `Checkbox` is its direct child: the row centers and
  shows a pointer cursor, so demos no longer restate `items-center cursor-pointer`. The label keeps the
  shared heading weight; a `font-*` class in your `className` merges last and wins as on any other
  label. A label beside a control (the `Field.Root orientation="horizontal"` pattern) is unchanged.
- 2628849: New `Form` (`@elmeragroup/fuse/form`), a wrapper over Base UI's `Form`, so validation errors such as a server's response to a submit reach the fields inside it without importing `@base-ui/react` directly. `errors` maps control names to one message or several; `Field.Error` without children and `TextField` without `errorMessage` show them, editing a field clears its error, and after a submit the first field the errors mark gets focus. `onFormSubmit` receives the values of the controls inside a `Field.Root`, typed by `Form`'s type parameter. The interim react-aria fields read React Aria's own form context, so they do not see `errors` and their values are not in `onFormSubmit`'s values.
- 1ef5309: `CheckboxGroup`, `CheckboxItemGroup`, `RadioGroup` and `RadioItemGroup` take `isLabelHidden`. The
  legend stays the group's accessible name but is visually hidden, and the first option moves up into
  its place. Use it when a section heading above the group already names it. A pending radio group
  keeps its spinner row visible. A `description` still renders.
- e38a8b5: Curated Phosphor icons now follow the same accessible-naming contract as bespoke artwork: pass `title` to render `role="img"` with a `<title>`, or omit it for a decorative icon (`aria-hidden="true"`, `focusable="false"`). `ElmeraIconProps` gains `title` and drops Phosphor's `alt`.

  Migration: replace `alt` with `title`. Icons named with `aria-label` and no `title` are now hidden; pass `title` instead. `Alert.Icon` accepts neither `alt` nor `title`: its status glyph is always decorative, and the alert's text names the status.

- 7e2fdae: Curated Phosphor icons from `@elmeragroup/fuse/icons` now default to the `bold` weight, so they
  match the stroke weight products drew with before. Phosphor's `regular` weight draws a thinner
  stroke at every size. `ElmeraIconProps["weight"]` and `Alert.Icon`'s `weight` accept `"bold"`
  alongside `"regular"` and `"fill"`. Pass `weight="regular"` to keep the previous look.

  `DoubleCheck` is removed. Import `Checks` instead: the Phosphor glyph draws the same double tick
  and follows the `weight` prop.

  `Sun`, `Moon` and `Monitor` join the curated roster for light, dark and system color-scheme
  controls.

- ccb628f: `@elmeragroup/fuse/icons` adds eleven Phosphor glyphs to the curated roster: `ArrowsLeftRight`,
  `ChatCircle`, `ChatText`, `ClockCounterClockwise`, `FlagPennant`, `Flask`, `FunnelSimple`,
  `ListMagnifyingGlass`, `PlugCharging`, `PuzzlePiece` and `SquaresFour`. Each one takes the same
  props as the existing icons. Replace local copies and substitute glyphs with these imports.
- dc400ed: Initial release of Fuse, the Elmera Group React component library.

  - Typography, layout, forms, selection controls, overlays, feedback, navigation, and the application sidebar.
  - Theme and locale providers, brand tokens, light and dark color schemes, and dense and comfortable controls.
  - Tailwind v4 integration and a standalone stylesheet for consumers without Tailwind.
  - Localized component labels in English, Norwegian Bokmål, Swedish, and Finnish.
  - Packaged flags, icons, logos, illustrations, and emoji assets.
  - Interim date, collection, and routing components under the `react-aria/*` entry points.
  - Typed public entry points with documented props and React Server Component boundaries.

- 8f9c43e: `Input` and `InputGroup.Input` take `filter="numeric"`, the digits-only guard `TextField` already had. Non-digits are stripped before `onChange` and Field validation read the value. On input types with a selection API, such as `text` and `tel`, `maxLength` counts digits, so a pasted `912 34 567` fits `maxLength={8}` whole; `type="email"` and autofill that sends no cancelable `beforeinput` keep the browser's own length handling. `inputMode` defaults to `numeric`. A digits-only field can now carry an `InputGroup` prefix or suffix, such as `+47` before a phone number.

  `TextField` forwards its `filter` to `Input` and behaves as before, except that its development warning for a non-digit `value` or `defaultValue` now reads `Input: … is not a number`.

- fc85c72: Add a shared neutral dark palette for all internal themes, selected by `data-theme="dark"` with the existing variant, brand and segment attributes. Keep brand sidebar accents, supply missing library roles, and strengthen input/chart contrast. Correct alpha compositing in contrast measurements and verify dark first paint and nested scope isolation.
- d38f9ff: `Item.Footer` now animates its height when `mode` switches between `hidden` and `visible`, with
  its fade and a short slide, over 150 ms ease-out. `SelectionItem.SubSection`, `RadioItem.SubSection`
  and `CheckboxItem.SubSection` are this footer, so a sub-section that opens a form pushes the rows
  below it down smoothly instead of in one frame, and closing it pulls them back the same way.
  Before, the row snapped both ways, and the slide never ran. Under `prefers-reduced-motion: reduce`
  the height still snaps and the fade remains.

  A `hidden` or `visible` footer clips its content in both modes, since the row is shorter than its
  content while it animates. The clip edge sits 4px outside the content on every side, so the shared
  focus ring paints whole, and the footer's own box keeps its size. The 4px belongs to the content
  element's box, so an item with no inset flush against a scroll container's edge should keep 4px of
  inset there, or the room adds scrollable overflow. A `default` footer never clips,
  and switching to it snaps.

- 49b5e06: `Item.Group` takes `variant="compact"` to draw its rows as one connected list. The group drops
  its gap, rows take 12px padding (8px at `size="sm"`), and `Item.Separator` loses its vertical
  margin. Outline rows share one border between them, and only the first and last visible rows
  round their outer corners, so a `hidden` row at either end leaves the list closed. A row rendered as a link or button joins the list the same way. The
  default variant keeps the spaced look.
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
- fcd286a: Add Nordic Green Energy as brand `ngfi`, for the private and company segments in both variants.
  The external palette maps the Nordic Green Energy Material 3 scheme in light and dark, and the
  `brand-ngfi` and `brand-ngfi-foreground` primitives back the internal brand pointer and the
  `bg-brand-ngfi` utility. `NordicGreenEnergyLogo` joins `@elmeragroup/fuse/icons`, and
  `BrandLogo` draws it for `ngfi`.

  The new code widens `BrandCode`, `ThemeInput` and `ThemeSlug`, and `LEGAL_THEMES` grows from 20
  to 24 themes. An exhaustive `switch` or `Record` over `BrandCode` needs an `ngfi` case.

- d0ce3b2: `NumberField` treats an absent `value` as uncontrolled, matching React's convention. Pass `NaN` for a controlled empty field.

  - A bare `<NumberField label onChange />` (no `value`, no `defaultValue`) now steps from empty instead of being locked as a controlled empty field that could not step.
  - Migration: a controlled field that starts empty should use `useState<number>(NaN)` rather than `useState<number>()`; `value={undefined}` no longer means controlled-empty.

- d0ce3b2: NumberField stepper buttons are now named in the provider locale (Norwegian Bokmål, Swedish, English, Finnish) instead of always in English. New optional `increaseLabel` and `decreaseLabel` props override the built-in names.
- ad3f4f8: `PhoneNumberField` accepts `aria-required` and forwards it to the visible number input only. A phone number that a schema requires only in some cases can now be announced as required without the native `required` constraint. Before, the prop was not in the type and never reached the input.
- 3b12f4b: `PhoneNumberField` takes a `countries` list of the ISO codes its picker offers, so a consumer no longer trims the metadata, which also stops it parsing the numbers it leaves out. Detection selects only listed countries: a pasted number from another one stays in international form beside the selected country. Codes outside the catalog, without a flag or in the product exclusions are ignored, a list that leaves none throws, and a list that drops the selected country keeps the shown number's international identity, reading a national entry by its own country's rules (a controlled `raw` value, which names no country, reads again in the one that remains), while one that only adds or removes other countries leaves the number as entered. With one country, from the list or from the metadata, the field shows the flag and dial code as plain context, with the country's name for assistive technology, instead of a picker with a trigger, popup and tab stop. The picker trigger also drops the browser's default button border and fill, which showed where the host has no preflight reset.
- 34e1f63: `PhoneNumberField` takes a `defaultValue`, so an uncontrolled field can start from a saved number without a controlled parent. It is read on mount the way `value` is, and a native form reset restores it, read again under the current props: a field that turned on `formatOnType` in between shows the default formatted. A reset that returns to a default in another country calls `onCountryChange`; `onChange` stays silent, as before. `defaultValue=""` restores an empty number in the default country. A later `defaultValue` change leaves the shown number alone and becomes the next reset's target, and a controlled `value`, even `""`, wins over it. Without a default, reset still clears the digits and keeps the country.
- 85f449f: `PhoneNumberField` takes part in `Form` under its `name`. It shows `errors[name]` when it gets no `errorMessage`, marks the number input invalid, clears the error when the number it submits changes (an edit, or a country that changes it, but not a search in the picker), and gives `onFormSubmit` that number in its `outputFormat` under `name`, where the callback used to get the display text under `${name}-display-value`. After a submit, `Form` focuses the number input for an error it marks. Native form data is unchanged: one `name` and one `${name}-display-value` entry. The country picker no longer joins the field's label, description, error or registration: the field's description and error describe the number input alone, the picker's trigger and search no longer share an id with each other or with the number input, and in server-rendered markup the label names the input before hydration.
- c1c82bb: Server components can render `CheckboxItem` and `RadioItem` with their `Title`, `Description`, `Content`, `Actions` and `SubSection` parts, and a `SubSection` stays outside the row label when the server renders the row. `SelectionItem.Shell` accepts an optional `subSections` prop for bands partitioned by the caller.
- 7910d20: A checked `RadioItem` or `CheckboxItem` row draws its border in a new theme role,
  `--selection-checked-border`. Internal themes keep the `--primary` edge. External themes set it to
  `var(--border)`, so a checked row keeps its resting border and the control alone shows the
  selection, as the external radio card does. Before, every theme outlined the checked row in
  `--primary`. A host that maps its own tokens onto Fuse roles can set the role directly; without
  it the row falls back to `--primary`.
- 96b76d8: `CheckboxItem`, `RadioItem` and `SelectionItem.Shell` rows now follow density. The label metrics,
  `--label-text` and `--label-leading`, set the row's type: 14/20px dense, as
  before, and 16/24px comfortable, the external default. `SelectionItem.Title` and
  `SelectionItem.Description` take the size and keep their own line heights, and plain text in
  `SelectionItem.Actions` or a `SelectionItem.SubSection` takes both. The control now centres on the
  title's first line at either density, which moves it by up to 1.4px in a dense row. `Item` and
  `Alert` keep `text-sm`. The Figma sync exports the pair as two more `Fuse density` variables.
- 8db002e: `CheckboxItem`, `RadioItem` and `SelectionItem.Shell` take `isSubSectionSelectable`. With it, a
  click on a `SelectionItem.SubSection`'s text, its band or the padding beside it toggles the
  control, so a card whose option is described in a SubSection selects from anywhere on the card.
  Links, buttons, form fields, labels and other focusable elements in the SubSection keep their
  own clicks, and a click that ends a text selection does nothing. The control's accessible name
  stays the label row. The click focuses the control, as a click on the label row does, so the
  keyboard carries on from the chosen row. It is off by default, because a SubSection that reveals
  fields under a checkbox should not clear it when the user clicks between them.
- de4c3b2: A `RadioItem` or `CheckboxItem` row title takes its weight from a new theme role,
  `--selection-title-weight`. External themes set it to 500, the weight of the group legend and a
  `CheckboxCard` title, and internal themes keep 400. Before, every theme set row titles at 400. A
  `className` weight on the title still replaces the theme's. A host that maps its own tokens onto
  Fuse roles can set the role directly; without it titles stay at 400. The theme catalog gains a
  `fontWeight` token kind, which the Figma sync writes as a number variable with the font weight
  picker.
- 42f5d68: Add `Slider`, a labeled range control built on Base UI. Import it from
  `@elmeragroup/fuse/slider`. It takes NumberField's field props (`label`, `description`,
  `errorMessage`, `isInvalid`, `isDisabled`, `minValue`, `maxValue`, `step`, `formatOptions`),
  plus `largeStep`, `orientation` and `showValue`. An array of two or more numbers renders one
  thumb per entry, and `onChange` reports an array of the same length. A vertical slider fills
  its parent's height. Range thumbs take localized "minimum" and "maximum" names, which
  `thumbLabels` overrides. A native form reset returns an uncontrolled slider to its
  `defaultValue`.
- 59f38a5: `TextField variant="card"` now stretches the input across the card. Before, the input kept its
  intrinsic width, so a long value scrolled inside a box narrower than the card and the
  description sat mid-row instead of at its end. The description now ends the row and takes at
  most half of it, so a long one wraps instead of squeezing the input. `textFieldVariants` gains an
  `inputContainer` slot for the input's wrapper, which fills the row under the card variant.
- 09cf8f7: `TextareaField` now merges `className` onto the field root, like `TextField`, `NumberField` and `PhoneNumberField`. Move classes meant for the textarea itself to the new `textareaClassName` prop.
- fc85c72: Add the curated `SlidersHorizontal` icon for settings menu triggers.
- 89f6a01: A manager from `Toast.createToastManager()` queues calls made before its `Toast.Provider` connects and
  replays them in call order once it does. Before, a toast raised before the provider mounted, or in a
  mount effect inside it, never showed. `add` still returns the toast id at once, so a queued toast can
  be updated or closed.
- 8b4b96a: `Toast.Viewport` takes a `placement` prop: `"top-left"`, `"top-center"`, `"top-right"`, `"bottom-left"`,
  `"bottom-center"` or `"bottom-right"`, the default. Placement applies from the `sm` breakpoint up. A top
  placement stacks toasts downward from the top edge and slides them in from above. Toasts dismiss by
  swiping toward the edge they sit on and toward their side, or right for a centered stack. An explicit
  `swipeDirection` on `Toast.Root` still wins. Below `sm` every placement keeps today's layout: the stack
  sits at the bottom, spans the screen width and swipes down or right. If you moved the stack by overriding
  inset classes such as `className="sm:inset-x-0"`, remove the override and pass `placement`.

  Toasts now stay inside the viewport column when you use the standalone CSS without Tailwind's
  preflight. Before, the toast's padding widened it 32px past the column, which pushed it off the left
  edge of a narrow screen.

### Patch Changes

- e21c78e: An explicit `aria-label` on an icon-only `Toast.Close` now names the button. Before, the icon-only
  close button kept its `label` or the dictionary `toast.close` name and ignored `aria-label`.

  An explicit `aria-label` on `BrandLogo` (`@elmeragroup/fuse/icons`) now names the logo. Before,
  `title` or the brand display name replaced it.

- ad14f3f: `Alert.Root`: the default variant's action button hovers to the `muted` fill instead of Button's
  translucent primary fill, which left its `foreground` label at low contrast while hovered.
- aee8e9a: `Alert.Description` now renders a `div` instead of a `p` and no longer clamps its text to two
  lines. An alert can hold several paragraphs or a list, and every line stays visible.
  `Alert.Description` puts an 8px gap between consecutive block children, so a list sits apart
  from the paragraph above it. `AlertDescriptionProps` now takes `div` props. `Item.Description`
  keeps its `p` element and two-line clamp.
- 070c391: `AlertDialog.Root` now runs Base UI's alert-dialog mode, so every alert dialog is modal and a
  backdrop click no longer dismisses it. Escape still closes it. `modal` and
  `disablePointerDismissal` are no longer accepted on `AlertDialog.Root`.
- 266cbd8: The light external `--border` hairline is darker for Fjordkraft (with Fjordkraft Företag), TrøndelagKraft and Gudbrandsdal Energi, so `Card`, `Table`, `DescriptionList` and the other bare borders show on their tinted pages. It now measures at least 1.19:1 against `--background` in every theme. Each brand keeps its hue and chroma, and `--input` is unchanged.
- 09ce5fb: Bare borders draw in the `--border` role instead of the text colour, so `DescriptionList`, `Card`, `Table`, `Sheet`, the outline `Badge` and the other parts with an uncoloured border show a quiet divider in every theme. The `Sidebar` rail edge uses `--sidebar-border` and the `NumberField` stepper divider uses `--input`. The default is a base-layer rule on every element, host markup included, and any border colour utility still wins; hosts with their own `border-border` base rule can remove it. A preflight-free Tailwind build that imports Tailwind's sheets into layers declares `@layer theme, base, components, utilities;` before them.
- 48ff71d: `Button` and `ConfirmButton` keep Base UI's `aria-disabled` when they stay focusable while disabled (`focusableWhenDisabled` with `disabled` or `isPending`) or render a disabled non-native element. Before, the attribute was dropped and assistive tech announced an enabled button.
- 2f620c6: `Button` shows the pointer cursor, like Fuse's other interactive controls. Disabled, pending and visually disabled buttons keep the `not-allowed` cursor from the state face. Hosts that added their own `[data-slot="button"] { cursor: pointer }` rule can remove it.
- 5390191: `Checkbox`, `Switch`, `CheckboxCard`, `RadioGroup` and `CheckboxGroup` now submit what they show after a native form reset, including React's reset after a form action. Before, the reset put their hidden inputs back to their mount-time state while the controls kept showing the user's choices, so the next submit sent different data from what was on screen. The controls keep their current selection on reset; an uncontrolled one does not return to `defaultChecked` or `defaultValue`.
- 2b288bd: `Combobox.Chip`: the remove button now fits inside the 22px chip at both densities. It rendered
  Button's `icon-sm` square, 32px at dense and 36px at comfortable, which overflowed the chip. It
  now renders the `icon-inline` square as tall as the chip's text line, with a 12px glyph, and its
  hit area keeps the pointer target at 24px without reaching the next chip.
- 11abd31: `Combobox.Input` inside a `Field` no longer submits its text. It rendered through `Field.Control`, which named the visible input after the Field, or after `Combobox.Root`'s `name`. So FormData carried the selected item's label, or a half-typed search, ahead of the value, and `formData.get(name)` returned the label. The input is now a plain `<input>` with the same classes, and Base UI's hidden input alone submits the value.

  Inside a `Field`, the id that `Field.Label` points at is now `Combobox.Root`'s `id`, as in Base UI. Before, `Field.Control` replaced it with a generated id. An `id` set on `Combobox.Input` still names the input, but the label's `for` no longer reaches it, so move it to `Combobox.Root`.

- 768108b: `Combobox.Input` now honors `disabled` on `Combobox.Root`. Before, a disabled Root left the native input focusable and typeable.
- d0ce3b2: `Combobox.Content` now insets an owned search group 4px on each side with a width that fits inside the popup, so a `w-full` search group (the `PhoneNumberField` country picker) no longer overflows and clips its right edge. The List keeps the menu family's single `p-1` inset, with or without a search group.
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
- c1226f3: `DatePicker` and `DateRangePicker` now throw the missing-`LocaleProvider` error when they mount.
  Before, a picker rendered without the required provider worked until the user first opened its
  calendar, and only then fell to the nearest error boundary.
- 491906d: `DatePicker` opens its calendar on the `placeholderValue` month when there is no value, instead of the current month. A set value still wins, and clearing the value returns the calendar to the placeholder month.
- 8f149ae: `DateRangePicker`'s JSDoc now says how to keep the dates on one row inside a flex row. The
  picker takes no width from its content there, so give it `w-96 shrink-0`.
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
- 92351dc: External dark themes give `--muted` its own tone, 8% of the way from `--card` toward `--foreground`,
  the same step `--accent` takes from `--popover`. Before, `--muted` repeated `--card` and `--popover`, so
  `hover:bg-muted` painted nothing visible over them: a ghost Button in a Dialog or Popover, a Calendar day
  in the DatePicker, or a linked `Item`. A brand sheet that sets `muted` keeps its own value.
- 6f9889c: A focused `InputGroup` and the React Aria `DateField`, `DatePicker`, `DateRangePicker` and `SearchField`
  keep their `--input` border under the focus ring, as `Input`, `Textarea`, `Select` and `NumberField` do.
  They used to turn the border `--ring` as well, so a field with an active ring drew two ring-coloured
  lines with the offset gap between them. That covered every `InputGroup` field, including
  `Combobox.Input` and `PhoneNumberField`. Clicking into a date segment no longer turns the border
  `--ring` without drawing the ring. An invalid field keeps its `--error` border and invalid ring while
  focused.
- 1634ef4: `TextField`, `NumberField`, `TextareaField`, `PhoneNumberField`, `DateField`, `DatePicker`,
  `DateRangePicker` and `SearchField`: an error now sits directly under the control, and the
  description moves below it. Before, the description always sat between the control and the
  error. Without an error, the description stays directly under the control. A card `TextField`
  keeps its description beside the input, with the error under that row. `CheckboxGroup` and
  `RadioGroup` already put their error directly under the options, with the description under the
  label, and do not change. When `TextField`, `NumberField`, `TextareaField` or `PhoneNumberField`
  first renders with its error showing, screen readers now read the error before the description,
  in the order they appear.

  A hand-composed `Field.Root` keeps the order its children are written in. The docs now place
  `Field.Error` before `Field.Description`; reorder your own fields to match.

- 03260e8: Unmounting the last `ForceColorScheme` before `ThemeProvider` finishes mounting no longer overwrites the color scheme the host's bootstrap script applied.
- d0ce3b2: A form whose `onReset` handler stops propagation no longer blocks native reset for an uncontrolled `NumberField`, `PhoneNumberField`, or `TextareaField`. An uncontrolled `NumberField` focused inside a shadow root also keeps focus through the reset remount, and a suspended update no longer disables reset for a field that is still displayed as uncontrolled.
- 7711b62: `Form`'s JSDoc now says that every submit stops while an enabled Field inside it is invalid: an
  `errors` entry counts until its own field changes or a new `errors` object leaves it out, and
  `invalid` for as long as it is passed. When a change elsewhere can make a field valid, as with
  rules in a schema, pass a new `errors` object without the stale message, or use a plain
  `<form noValidate>` and pass each field `isInvalid` and `errorMessage`. The Form page shows
  that path.
- 0eca8ed: Field wiring survives props forwarded as `undefined`. Before, an `aria-labelledby={undefined}` on `Input`, `Field.Control`, `Combobox.Input`, `Combobox.ChipsInput` or `Combobox.Trigger` dropped the Field label reference, and on `Field.Set` it dropped the legend name. An undefined `aria-labelledby`, `aria-describedby` or `role` on `Sheet.Content` dropped the dialog's name, description and role.

  `TextareaField` inside a disabled `Field.Set` is now disabled. Before, it stayed editable.

- 12cf820: `CheckboxGroup`, `RadioGroup`, `CheckboxItemGroup` and `RadioItemGroup`: a labeled group's
  `description` now sits directly under its label, with the 12px group gap before the options.
  Before, it sat 24px under the label, as far as the options. A group without a description keeps
  24px between its label and its options, and a group without a label keeps its spacing.
- d0ce3b2: Hidden sidebar panels and item footers are no longer reachable from the keyboard.

  - Collapsed offcanvas `Sidebar` contents leave tab order and the accessibility tree. `Sidebar.Rail` stays a mouse-only control for reopening the panel.
  - `Item.Footer` with `mode="hidden"` — and `SelectionItem.SubSection`, which forwards that mode — renders `inert` until the mode changes.

- 2548461: `InputGroup.Addon`: an inline addon holding a button drops its block padding, so an `xs` or
  `icon-xs` `InputGroup.Button` keeps its 24px target inside a dense field without overflowing it.
- 7b2e8ac: `InputGroup.Root` paints the field fill (`bg-card`) like `Input`. Before, it was transparent, so
  wherever `--background` and `--card` differ (every external theme and the dark themes) an
  InputGroup, and PhoneNumberField built on it, showed the page background while an `Input` beside
  it was filled. A group on a surface that should show through, such as a sidebar, takes a
  background class, for example `className="bg-background"`, which merges after the fill.
- dc10d26: `Item.Footer mode="hidden"`, and with it `SelectionItem.SubSection`, `CheckboxItem.SubSection`
  and `RadioItem.SubSection`, clips its content. The collapsed row was 0px, but its content kept its
  full height and overflowed invisibly, so a hidden form in the last option of a list added blank
  scroll past the end of the page, or a scrollbar with nothing to scroll inside a Sheet or Dialog.
- 5405a5e: An `Item.Root` with a `render` element inside `Item.Group` now keeps the rendered element's own
  role. Fuse wraps it in a `role="listitem"` element, so a link item reads as a link inside a list
  item. Before, `listitem` replaced the link or button role. The wrapper copies the `hidden` and
  `aria-hidden` the rendered element ends up with, set on `Item.Root` or on the `render` element, so
  a hidden item adds no list item or gap. An explicit `role` on `Item.Root` still replaces both and
  skips the wrapper.
- 4d7e5f3: The full logos of the energy brands in `@elmeragroup/fuse/icons` paint their lettering in
  `currentColor`, as `ElmeraGroupLogo` and `FjordkraftLogo` already did, so the name takes the text
  colour around it. Marks drawn in brand colours keep them. This changes the `variant="full"` artwork
  of the four logos below; the `variant="mark"` artwork and `TrumfLogo` are unchanged:

  - `TrondelagkraftLogo`: the letterforms and the lamp's ring and base were white. The lamp's
    yellow light stays yellow.
  - `GudbrandsdalEnergiLogo`: the lettering was white. The orange gradient mark stays.
  - `TelinetLogo`: "Telinet" was cyan and "Energi" navy. The dotted mark stays cyan.
  - `NordicGreenEnergyLogo`: the lettering was dark green. The five-leaf mark stays.

  Where a page relied on the old fixed ink, set that colour as the text colour around the logo, for
  example white on a dark brand surface.

- 616f97e: The published `package.json` now carries a `bugs` link to the issue tracker, so npm and
  package tooling show consumers where to report problems.
- 886c820: Menu rows show their highlight on dark external popups. The external dark sheets for Fjordkraft,
  Trøndelagkraft, Fjordkraft Sverige and Elmera set `primary-soft` to their card color, so `accent`
  matched `popover` and a highlighted item in `Select`, `Combobox` or `DropdownMenu` looked like the
  popup. A dark external theme whose sheet names no `accent` now lifts `popover` 8% toward
  `foreground`, the step internal dark takes. This also changes Gudbrandsdal Energi's dark `accent`.

  `NavigationMenu`: a link or vertical trigger inside a popup highlights with `accent` on hover and
  while open, as other menus do. Bar triggers and bar links keep the `muted` highlight.

- 09cf8f7: `Meter` now resolves a value above the default `maxValue` of 100 to the exceeded level, the same as an explicit `maxValue`.
- 87577ce: A `NumberField` with `minValue` and no `step` now submits a typed value such as `99.5` under `minValue={1}`. Base UI defaulted the omitted step to 1 on the hidden form input, so native validation rejected every value off the 1-step grid counted from `minValue`, and the form did not submit. Arrows and steppers still move by 1. An explicit `step` together with `minValue` still requires typed values to land on its grid, as a native number input does, and the `step` JSDoc now says so. Pass `step={1}` to keep accepting whole numbers only.
- d0ce3b2: Native form reset now restores an uncontrolled `NumberField`'s `defaultValue` (or clears it when there is none) without calling `onChange`, matching the other field composites. A controlled `value` stays parent-owned.
- 16954d8: `NumberField` steppers now sit side by side as full-height minus and plus buttons, so each meets the 24px minimum target size at both densities.
- 04d8860: `TextField` with `filter="numeric"` counts `maxLength` in digits. Before, the browser cut a pasted
  value to `maxLength` characters before the filter stripped the separators, so `912 34 567` pasted
  into a `maxLength={8}` field became `912345`. Now the digits that fit land at the caret. This
  covers insertions the filter can intercept: a cancelable `beforeinput` on an input type with a
  selection API, such as `text` or `tel`. Other paths keep the browser's own length handling and
  are stripped afterwards, so `type="email"`, or autofill that sends no cancelable `beforeinput`, is
  still cut to `maxLength` first.
- d0ce3b2: `TextField` with `filter="numeric"` now restores its `defaultValue` on native form reset instead of keeping the edited digits. `onChange` is not called for the reset.

  Mixed input such as a pasted `12a3` is now stripped to `123` instead of the whole edit being rejected.

- ac0b851: `PhoneNumberField` keeps the caret among the digits when an edit makes it rewrite the display, as `formatOnType` does on most keys. Correcting a digit in the middle of a number, deleting a space the formatter puts back, or deleting forward no longer sends the rest of the typing to the end, and an international display keeps the caret after the calling code it adds. The caret stays put when the parent's answer shows the display the edit proposed, even if the parent stores the number in another form; otherwise, including a proposal echoed only in a later render, the field leaves the caret where the browser puts it.
- 83967e0: `PhoneNumberField` lists the country picker's rows in the alphabetical order of their names in the active locale, so "Nederland" precedes "Norge" in Norwegian and "Åland" follows "Sydafrika" in Swedish. The rows sort as the picker opens, so a field resolves no country name before its first open, the selected country stays highlighted, and a locale change reorders the rows at the next open rather than under the highlight.
- 886c820: The `PhoneNumberField` country trigger now meets the 24px minimum target size at both densities. It was 22px tall. The field keeps its height.
- 147f2c6: The `PhoneNumberField` dial code now uses the number input's font size and the font's normal line height, so it lines up with the typed digits at both densities. It used a smaller fixed size and sat higher.
- 91ef204: `PhoneNumberField` keeps a number typed or autofilled before React hydrates. The field used to start from its own initial value and wrote it over the typed text in the first render after hydration, so the number vanished and the hidden input never held it. It now reads the typed number once, as hydration commits, and proposes it as an edit, so `onChange` reports it once and a controlled parent can accept it.
- 09cf8f7: `PhoneNumberField` now forwards `required` to its input so an empty required field cannot submit, and an unnamed field no longer adds a `phone-number-display-value` entry to form data.
- d0ce3b2: Native form reset now clears an uncontrolled `PhoneNumberField` number while keeping the selected country. `onChange` and `onCountryChange` are not called; a controlled `value` stays parent-owned.
- 573834d: `PhoneNumberField` keeps the trunk prefix of a national number on display as the user types, so a Swedish "0701234567" no longer loses its leading 0 on the next key. Without `formatOnType` the field shows the typed digits without separators; with it, libphonenumber's as-you-type format ("070-123 45 67"), which now also groups a partial number ("41 23 4"). A typed national number without its trunk prefix stays as typed rather than gaining one. A number detected from a `+` or `00` prefix keeps the national display it had, and a copied number that a space or parenthesis precedes, such as " +46 70…", is now detected too. The submitted value no longer counts a trunk prefix that libphonenumber read as part of the number behind the calling code, such as Kazakhstan's 8.
- 4013546: An open `DatePicker` or `DateRangePicker` calendar inside a `ThemeScope` that clips its overflow
  now moves to the side of the field with room when the viewport, the scope, the field or the
  calendar changes size. Before, it kept the side it opened on, so a viewport that shrank under an
  open calendar clipped its last rows.
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
- 112c5e8: An invalid `DatePicker`, `DateRangePicker`, `DateField` or `SearchField` now paints its label in
  the error colour, as an invalid `TextField` does. Before, those labels kept the normal text colour
  while the field box and error message showed the error.
- fb48826: A read-only `Input`, `Textarea`, `TextField`, `TextareaField`, `InputGroup`, `PhoneNumberField`,
  `Combobox` or `SearchField` now paints the muted read-only fill (`bg-muted`) that `DateField`,
  `DatePicker` and `NumberField` already use. Before, it looked exactly like an editable field, so
  it invited typing that did nothing. Under `TextField variant="card"` the card takes the fill, and
  under `variant="inline"` the field keeps it at rest and on hover. The fill keys off the `readonly`
  attribute and leaves a disabled field its disabled fill.
- 1348923: Server components can read compound namespaces such as `Dialog.Root`. The namespace object is no longer a client-module reference, so dotting into a part does not throw. Alert stays server-rendered: the Item chrome it composes has no hooks. Item's markup parts (`Media`, `Content`, `Title`, `Description`, `Actions`, `Header`, `Footer`) and SelectionItem's `Description` and `Content` are server components. A function-form `render` on `Item.Root` now receives an empty state object; the root's `data-slot`, `data-variant` and `data-size` arrive as ordinary props instead.
- 08b402e: `ScrollArea.Root` now scrolls under a max height. Before, a root with only `max-h-*` let its
  viewport grow with the content and clipped the overflow, so the list could not scroll. The
  viewport now takes the root's resolved height under either a fixed height or a max height.
- 886c820: The `alignItemWithTrigger` docs on `Select.Content` now name a Base UI 1.8 limitation. An
  item-aligned popup is placed in viewport coordinates, so inside a portal target that is, or sits
  inside, the containing block for `position: fixed` content, such as a transformed or
  `contain: paint` scope, the list opens away from its trigger. Pass `alignItemWithTrigger={false}`
  there.

  The react-aria fields' error message has `role="alert"`, like Fuse `Field`'s error. `DateField`,
  `DatePicker`, `DateRangePicker` and `SearchField` now announce an error when it appears, and
  `aria-describedby` still ties it to the field.

  The calendars of `DatePicker` and `DateRangePicker` stay inside a `ThemeScope` or `container`
  that clips its overflow. React Aria 3.52.1 mixes page and containing-block coordinates when it
  measures the room around a popover in a positioned scope, so a calendar under a field near the
  scope's bottom edge opened downward and lost its last rows. Inside a clipping portal target,
  Fuse now measures the trigger and the visible part of the target as the calendar opens. It
  opens the calendar below the field when it fits there, above it otherwise, and keeps its
  alignment with the field. Other portal targets keep React Aria's placement.

- 9311267: An unchecked `Checkbox` or `Radio` draws its edge in `--muted-foreground` instead of `--input`, so the
  control stays visible at 3:1 or more against its fill, the page and a card in every theme and color
  scheme (WCAG 2.2 SC 1.4.11). Light `--input` measured 1.08–1.70:1, so a group with nothing selected
  showed almost no controls beside the labels. This also covers `CheckboxItem`, `RadioItem` and
  `CheckboxGroup` rows. Field boxes keep the `--input` border, which the accessibility page now lists
  as an accepted deviation until design sets a light field border of at least 3:1.
- bd7f3fd: `SelectionItem.Shell`, and with it every `CheckboxItem` and `RadioItem` row, paints the card fill
  (`bg-card`) like `CheckboxCard`, `Input` and the selection controls inside it. Before, it painted the
  page background, so wherever `--background` and `--card` differ (every external theme and the dark
  themes) a card list showed the page tint inside its border, and a checked row's `bg-muted` read as a
  lightening instead of a tint. A list on a surface that should show through takes a background class,
  for example `className="bg-background"`, which merges after the fill.
- f65a8c0: `CheckboxItem` and `RadioItem` now toggle from a click anywhere in the card's label row,
  including its side padding. Before, a click in that padding did nothing. A `px-*` utility in
  `className` still sets the side padding, and the whole of it stays clickable, so
  `<CheckboxItem className="px-6">` toggles from a click 1px inside its border. A
  `SelectionItem.SubSection` and the space beside the card stay outside the click target.
  Without a preflight `box-sizing: border-box` reset, the card's padding and border no longer
  push it past its container.
- 3b54ea6: `SelectionItem.Description`, and with it `CheckboxItem.Description` and `RadioItem.Description`,
  shows every line. It was `Item.Description`, which clamps to two lines, so on a phone an option's
  description was cut with an ellipsis while a screen reader still read the whole label. It is now
  the row's own part with the same props and the same `item-description` slot. `Item.Title`,
  `SelectionItem.Title` and `Alert.Title` drop a `line-clamp-1` that never applied, because `flex`
  overrode it, and with it the `overflow: hidden` it left behind.
- 2374b46: A `CheckboxItem`, `RadioItem` or `SelectionItem.Shell` row whose `SelectionItem.SubSection`
  children are all `mode="hidden"` now toggles from a click in its bottom 14px, like a row without
  a SubSection. Before, that inset sat outside the click target, so the reveal-on-check pattern,
  `<SubSection mode={checked ? "visible" : "hidden"}>`, had a dead strip along the bottom of an
  unchecked row. Once a SubSection shows, it keeps its own clicks as before. The row's size does
  not change.
- e178f6d: Component and localized-copy JSDoc no longer points at internal spec documents that ship
  outside the package. Each comment now says in its own words why the component is a client
  or server component, and which dictionary keys its default copy fills.
- 37d2955: `--sidebar-brand` and `--sidebar-brand-foreground` now reach 4.5:1 contrast in every theme and
  color scheme. Where the brand color falls short on the sidebar, the theme steps its lightness
  away from the sidebar's until it passes, keeping the hue. In light themes, Fjordkraft,
  Fjordkraft Företag and TrøndelagKraft get a darker sidebar tone. In dark themes, Gudbrandsdal
  Energi, Telinet and Elmera get a lighter one. In dark themes, text on a `bg-sidebar-brand` fill
  now takes the sidebar color for every brand, because white cannot reach 4.5:1 on a tone that
  reaches it on a dark sidebar. `--brand` keeps the brand color everywhere else.

  The build computes the stepped tones, so the stylesheet declares them as literal colors. In the
  themes listed above, a host override of `--brand` no longer moves `--sidebar-brand`, and in
  every dark theme `--sidebar-brand-foreground` no longer follows `--brand-foreground`. To keep a
  custom sidebar brand, override both sidebar tokens on the element that carries the theme
  attributes, in a rule after the Fuse stylesheet. The rule applies in both color schemes, so give
  the dark scheme its own pair. The dark rule lists two selectors: one for a theme element inside
  a dark ancestor, and one for an element that carries `data-theme="dark"` itself, such as a
  themed `<html>`:

  ```css
  .app-shell[data-theme-brand="tkas"] {
    --sidebar-brand: oklch(0.45 0.08 191);
    --sidebar-brand-foreground: oklch(1 0 0);
  }

  [data-theme="dark"] .app-shell[data-theme-brand="tkas"],
  .app-shell[data-theme="dark"][data-theme-brand="tkas"] {
    --sidebar-brand: oklch(0.75 0.08 191);
    --sidebar-brand-foreground: oklch(0.205 0 0);
  }
  ```

- 7bce83d: `Sidebar.Root` on mobile now forwards its element props (`id`, `aria-*`, `data-*`, handlers)
  to the sheet dialog and merges `style` with the mobile `--sidebar-width`; they were dropped on
  the sheet's provider before. A caller's `Sidebar.Rail` `onClick` now runs alongside the toggle
  instead of replacing it. The mobile breakpoint is `(width < 48rem)`, the exact complement of
  `md:`, so fractional widths and non-16px browser default font sizes no longer leave a range with
  no sidebar, and the Rail shows from `md:` instead of `sm:`, so it stays hidden inside the mobile sheet.
- 886c820: `Sidebar.MenuButton` no longer shows a stale tooltip when the rail collapses. Before, hovering or
  focusing a button with a `tooltip` while the rail was expanded opened its `Tooltip.Root` and only
  withheld the content, so collapsing the rail showed that tooltip at once. The root is now disabled
  while the rail is expanded or on mobile, so the tooltip opens only when the pointer or focus
  reaches the button in the collapsed rail. The button stays mounted across the toggle and keeps
  focus on ⌘B.
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

- 23d1502: The smallest controls keep their 24px target when the host's root font size is 14px. Before, a
  14px root shrank dense `Button` `icon-xs`, `Toggle` `xs`, `RadioIconButton` `icon-xxs`, the
  `NumberField` steppers and the `PhoneNumberField` country trigger to 21px, and the xs
  `InputGroup.Button` addons to 21px at both densities. Under a 16px root their sizes are unchanged.

  `Button` `icon-inline` keeps its visible square as tall as the line and now extends its hit area
  to at least a 24px square around it, border included. Before, the border came out of the hit area:
  a ghost or outline inline button on a 16px line reached 22px, and less under a 14px root. The
  `Combobox` chip remove button keeps its 24px target under a 14px root.

- 60eff08: `TelinetLogo variant="mark"` and `BrandLogo brand="fkse" variant="mark"` (`@elmeragroup/fuse/icons`)
  now crop to the dot cloud. Before, the mark kept the full wordmark's 655×93 viewBox, so the dots
  painted about 3px wide and 2px tall in a 24px box. The viewBox is now 83.397×64.796 and the artwork
  fills the box width.
- 63da3af: The 16px text-entry floor now also applies in iOS WebKit when it reports a fine pointer, so iOS Safari no
  longer zooms into a focused dense field on that path. Before, the floor applied only under a coarse pointer.
  The floor now applies when either condition holds: a coarse pointer, or a browser that supports
  `-webkit-touch-callout`, which only iOS-family WebKit does. Desktops with a mouse, Windows touch laptops and
  touchscreen Chromebooks report a fine pointer and keep 14px dense text. Tailwind-source consumers get the new
  `entry-floor` variant from `fuse.css`.
- 845f119: On a coarse pointer, text-entry fields now show text at 16px or larger. iOS Safari no longer zooms into a
  focused field in a dense app. Dense control text is 14px, and iOS zooms into a focused field whose text is
  under 16px, then stays zoomed after the field blurs. The floor covers `Input`, `Textarea`, `InputGroup.Input`,
  `InputGroup.Textarea`, `TextField`, `TextareaField`, `NumberField`, `PhoneNumberField`, `Combobox.Input`,
  `Combobox.ChipsInput`, `Sidebar.Input`, `SearchField`, `DateField`, `DatePicker` and `DateRangePicker`.
  Comfortable 18px text is unchanged, and a fine pointer keeps 14px dense text. A font-size class in `className`
  still sets the size on every pointer, the floor included, so a field given `text-sm` keeps 14px on touch
  screens.
- 5f023e9: `ThemeProvider` warns once about a coerced pinned segment in production. Before, it warned twice on
  mount and again whenever a color-scheme option changed.
- 079c1e6: `ThemeScope` now validates its theme once per axis change, so a production pinned-segment warning no longer repeats on every render. `ThemeProvider` stays mounted where `matchMedia` is missing or only supports the legacy `addListener` API.
- d0ce3b2: `ThemeProvider` now follows `localStorage.clear()` from other tabs by restoring the configured `defaultColorScheme`, and ignores `sessionStorage` events that reuse the color-scheme key.
- fbe689b: TrøndelagKraft's external radius is now `1rem` (16px), up from `0.95rem` (15.2px), for `--radius` and `--radius-button`.
  The old value came from an early theming commit in the sales flow and had no design source. Every corner that follows the
  brand radius moves by 0.8px or less: cards, badges and buttons round at 16px, and the `rounded-*` scale steps from 10px to
  20px.
- 6550e0f: `Toast.useToastManager()` now returns `add`, `update`, `close` and `promise` with the same identity
  across renders. Before, each method changed identity whenever a toast was added, updated or closed, so
  an effect that listed `add` as a dependency ran again after every toast and added toasts until React
  stopped with "Maximum update depth exceeded".
- 889ba74: `toastManager.promise` keeps the `type` that a `success` or `error` state returns and derives the
  priority from it. Before, Base UI replaced it with `"success"` or `"error"`, so a warning result
  rendered as a success. `loading` is now optional; without it, no toast shows until the promise
  settles.
- fc85c72: `Toast.Title` and `Toast.Description` on the error, info, success and warning statuses now render in
  the paired `<status>-soft-foreground` role over the soft fill: the title inherits the root's colour,
  and the description resolves the `--toast-copy` variable the root publishes. Titles no longer paint
  the raw `<status>` role and descriptions no longer fall back to the neutral `muted-foreground`, so
  both stay at the text-grade contrast the palette guarantees. Neutral and loading toasts keep
  `muted-foreground`, a consumer `className` on either slot still wins, and the status icons keep the
  raw `<status>` accent. Light themes look unchanged; dark copy may render a different colour.
- 67f24a9: `Toast.Viewport` now paints above an open `Dialog` or `Sheet`. Before, a toast raised from inside an
  open modal shared the modal's `z-50` layer and painted under it, because the modal's portal mounts
  later. The viewport now sits on its own `z-60` layer, so a `className="z-60"` override is no longer
  needed.
- 643f7cb: `ToggleGroup.Root` types `style` as plain `CSSProperties`. A Base UI state callback was never
  applied at runtime because it was spread into an object. It is now a type error, making the
  silent drop visible at compile time.
- 886c820: `TrondelagkraftLogo` (`@elmeragroup/fuse/icons`) draws the full logo from the brand's vector
  artwork. Before, it drew a bitmap trace whose edges wobbled and which carried invisible stroke
  layers. The viewBox is now `0 0 533.81 88.22` instead of `0 0 539 93`, cropped to the artwork, so at
  a fixed height the logo renders about 4% wider. The mark is unchanged.
