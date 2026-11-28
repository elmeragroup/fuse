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

- ab5a41a: New `ActionBar` (`@elmeragroup/fuse/action-bar`): a toolbar of actions on a selection, such as the
  checked rows of a `DataTable`, that floats at the bottom of its nearest positioned ancestor while
  `ActionBar.Root`'s `count` is above zero. It rises into place and falls away, only fading with
  reduced motion, and `offset` sets its distance from that ancestor's bottom. It is one Tab stop
  with arrow-key focus between its items, named "Bulk actions" in the reader's locale unless it gets
  an `aria-label`, and a polite live region announces the count each time it changes.
  `ActionBar.Count` shows the count, `ActionBar.Clear` is the localized "Clear selection" button,
  and `ActionBar.Button` with `ActionBar.ButtonLabel` shows its icon alone in a container narrower
  than 28rem. When the selection empties with focus in the bar, focus returns to where it came from.
- 0169bd6: `Alert.Root` and `Alert.Icon` take `variant="info"`: an informational alert on the `info-soft`
  fill with an `info` border, the `Info` glyph in `info`, and an action button on the `info` fill.
  Its focus ring takes `info-soft-foreground`, as the warning alert's does, so it holds 3:1 on the
  fill in the dark scheme.

  `Badge` takes `variant="soft-destructive"`, `variant="soft-success"` and `variant="soft-warning"`
  beside `soft-info`: the soft status fill, its soft foreground and a 20% status border.
  `soft-destructive` keeps the `destructive` name, like `outline-destructive`, and draws the
  `error` roles. `Badge` also takes `variant="outline-info"`, an `info` border and text like
  `outline-success` and `outline-warning`. Every status now has a filled, an outline and a soft
  arm. The status roles as text (`error`, `info`, `success`, `warning`) are now gated at 4.5:1 on
  `background`, `card` and `card-soft` in every theme and color scheme.

  Migration: `Badge`'s soft blue arm is renamed from `variant="info"` to `variant="soft-info"`,
  beside `soft-destructive`, `soft-success` and `soft-warning`. `variant="info"` now draws a
  filled badge on `info` with `info-foreground` text, like `success` and `warning`. Replace
  `variant="info"` with `variant="soft-info"` to keep the soft look; the type checker does not
  flag it, because `info` is still a valid value.

- 1e4f692: Themes no longer set fonts. Before, every theme named Roboto, and the external Fjordkraft themes
  named Neo Sans for headings. Fuse still sets body text in `--font-sans` and headings in
  `--font-heading`. Both default to the system font stack in the `theme` layer, so an app sets them in
  its own CSS without `!important`. An app now loads its fonts and sets both variables, Fjordkraft's
  Neo Sans headings included:

  ```css
  :root {
    --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
    --font-heading: var(--font-sans);
  }

  [data-theme-identity="branded"][data-theme-brand="fkas"] {
    --font-heading: var(--font-neo-sans), var(--font-sans);
  }
  ```

  The theme catalog drops the `font-sans` and `font-heading` tokens and the `fontFamily` token kind.
  The standalone `styles.css` now puts Tailwind's theme variables in the `theme` layer, as a
  Tailwind-source build does. The fonts handbook page has recipes for Next.js, `@fontsource` and
  `@font-face`.

- ef50282: Add `AspectRatio` and `Attachment`.

  - `AspectRatio`, from `@elmeragroup/fuse/aspect-ratio`, is a server component that keeps its
    child at one of seven ratios. `ratio` is required and takes `"1:1"`, `"4:3"`, `"3:4"`, `"3:2"`,
    `"2:3"`, `"16:9"` or `"9:16"`, and the type check rejects a number or any other string. A
    consumer `aspect-*` class, such as `aspect-[7/5]`, replaces the ratio. A direct `img` or `video`
    child is a block, so it fills the frame without growing it in a host without preflight.
  - `Attachment`, from `@elmeragroup/fuse/attachment`, shows a file or an image with its upload
    state and actions. `Root` takes `state` (`idle`, `uploading`, `processing`, `error` or `done`),
    `size` (`default`, `sm` or `xs`) and `orientation` (`horizontal` or `vertical`). `Media` frames
    an icon or a square image, and an `AspectRatio` part inside it sets another shape. `Title`
    shows a moving highlight while the file uploads or processes and stays still under reduced
    motion. `Description` carries the readable status. `Action` is an icon `Button` that needs an
    `aria-label`. It is `secondary` on a vertical tile and `ghost` in a row. `Trigger` turns the
    whole attachment into one button or link under its actions. `Group` is a list that scrolls
    sideways, snaps to each attachment and fades an edge while more lies past it. Picking files and
    uploading them stay in your app.

  `fuse.css` gains a `shimmer` utility with an `--animate-shimmer` theme variable, which the
  reduced-motion rules turn off.

- 2316569: Add `AutocompleteField` and `ComboboxField`, labeled fields laid out like `TextField` and
  `SelectField`: the label 4px from the input at both densities, the input filling the field's width,
  then the error ahead of the description.

  - `AutocompleteField`, from `@elmeragroup/fuse/autocomplete-field`, submits the text in its input.
    `ComboboxField`, from `@elmeragroup/fuse/combobox-field`, submits the option the user selected and
    takes one selection. Both are in the root barrel and render on the server, since they own no state.
  - Both take `label`, `description`, `errorMessage`, `isInvalid`, `isRequired`, `isDisabled` and
    `name`, the input's `placeholder`, `showTrigger` and `showClear`, `inputClassName`, and a `ref`
    to the input. The props they do not name themselves go to the Root, such as `value`,
    `defaultValue`, `onValueChange`, `itemToStringValue`, `filter` and `id`, which the label points
    at.
  - `items`, flat or grouped, gives `itemToStringValue` and the other callbacks the item type, as
    `Autocomplete.Root` and `Combobox.Root` do, and `filteredItems` does without `items`. For `ComboboxField`, the item
    type is also the selected value's type.
  - Inside a `Form`, the field shows the error `Form` holds under its `name`, also in the first
    server-rendered HTML, until the user edits the text or changes the selection.
  - Pass the popup's content, such as `Autocomplete.Empty` and `Autocomplete.List`, as children.
    `AutocompleteField`'s `status` renders in `Autocomplete.Status` beside the input, which stays
    mounted while the popup opens and closes.
  - Compose `Field.Root` and the parts for multiple selection, chips or a layout of your own, such as
    a label row with an info button or a horizontal field.

- 961c7d4: Add `Autocomplete`, a form field whose value is the text in its input.

  - `Autocomplete`, from `@elmeragroup/fuse/autocomplete` and the root barrel, wraps Base UI's
    Autocomplete with Combobox's look. Its list only suggests: picking an item fills the input with
    the item's text, and the user can go on editing it. Text that matches no item is kept on blur.
  - `Root` takes Base UI's `value`, `defaultValue`, `onValueChange`, `name`, `itemToStringValue`,
    `filter` and the rest, and filters in the locale of `LocaleProvider`. The input carries `name`,
    so the form submits the text, once, under the enclosing `Field.Root`'s name, or under `name`
    outside one.
  - Inside a `Field.Root`, the label, description and `Form` errors reach the input, and editing
    clears an error. Set `id` on the Root so `Field.Label` points at the input.
  - `Input` renders no caret by default, since the list opens as the user types. `showTrigger` and
    `showClear` add the caret and a clear button, named from the locale dictionary or from
    `triggerLabel` and `clearLabel`. The popup is as wide as the field box.
  - `Empty` takes children for the empty list's states, such as loading, an error or no results.
    `Status` is a visually hidden live region for the rest of a search's state. Place it beside the
    input, where it stays mounted while the popup opens and closes.
  - `Item`'s `onClick` runs on a click and on Enter, so a picked item can fill another field.

- 643f7cb: `Avatar` ships `Avatar.Group`, which stacks its avatars and separates them with a background-coloured
  ring. A stack no longer needs `flex -space-x-2` on a wrapper plus `ring-2 ring-background` on every
  avatar: render `Avatar.Root` children inside `Avatar.Group`.

  The group's ring rule wraps the whole parent-and-child selector in `:where()`, so it scores zero
  specificity and your explicit ring utility on a child avatar (`ring-0`, `ring-1`, `ring-foreground`, …)
  still wins.

- eb01d3c: Add the `--brand-ink` token and its `text-brand-ink` utility: the brand color as text, at 4.5:1
  contrast or more on the page and on a card in every theme and color scheme. A brand color that
  already reaches 4.5:1 on both keeps the `var(--brand)` alias. For another brand, Fuse adjusts the
  lightness in 0.01 steps and keeps the hue until the color passes on both backgrounds, as
  `--sidebar-brand` does on the sidebar. A host that skips `themes.css` and declares only `--brand`
  gets brand text in `--brand`. A Tailwind-source host that maps `--color-brand` in its own
  `@theme` gets it in that color, and one that clears `--color-brand` gets it in `--brand`.

  The Palettes handbook now lists `--brand-ink` on the page and on a card, and the two sidebar brand
  pairs, among the pairs held at 4.5:1 in every theme and color scheme.

  `variant="brand"` on `Heading`, `Text`, `Link` and `Span` now sets `text-brand-ink` in place of
  `text-brand`, so brand text passes 4.5:1. Its color changes in Fjordkraft, Fjordkraft Företag and
  TrøndelagKraft light themes, which get a darker tone, and in Gudbrandsdal Energi, Telinet, Elmera
  and Nordic Green Energy dark themes, which get a lighter one. `--brand` keeps the brand color for
  fills.

  **Breaking:** in the themes listed above, and under a `--brand` override on a plain wrapper inside
  a theme element in any theme, `--brand` no longer recolors `variant="brand"` text. Set
  `--brand-ink` as well. The build computes the stepped tones, so the stylesheet declares them as
  literal colors. To restyle brand text in a theme, override `--brand-ink` on the element that
  carries the theme attributes, in a rule after the Fuse stylesheet, with a second rule for the dark
  scheme, as the theming handbook shows for `--sidebar-brand`. A Tailwind-source host that resets
  the color namespace (`--color-*: initial`) and maps its own colors maps `--color-brand-ink` too.

- 13553e5: Every theme now declares the brand neutral ramp, `--brand-neutral-50` to `--brand-neutral-950`, with
  50 the lightest. Each step is a grey at the hue of the brand's `--feature` colour with chroma 0.01, and
  Fjordkraft's company segment uses its teal. The ramp has one value per brand and segment in light and
  dark and in both identities, and every brand's ramp uses the same lightness at each step. `:root`
  declares an untinted grey ramp. The Tailwind utilities `bg-brand-neutral-100`, `border-brand-neutral-300`
  and the rest read it. The theme catalog, the Figma sync and the DTCG export carry the 11 new tokens.

  Branded light themes now tint their neutral roles with the brand hue instead of using untinted or
  unrelated greys. `--sidebar` and `--right-panel` point at step 50, `--muted` and `--accent` at 100,
  `--input`, `--sidebar-accent` and `--sidebar-border` at 200, and `--border` at 300. Each role is
  declared as an alias such as `var(--brand-neutral-100)`, so overriding a step on the theme element
  moves every role that reads it. The lightness stays close to the old values except in these cases:

  - `--border` is 0.88, so it keeps 1.19:1 on the darkest brand page tint.
  - `--muted` and `--accent` are 0.965.
  - Nordic Green Energy's border and input are lighter than its former Material outline-variant.

  Telinet's `--muted-foreground` darkens slightly, so it still reaches 4.5:1 on the tinted `--muted`.
  Neutral themes and branded dark themes are unchanged.

- 5bf335e: Every theme now declares two brand palettes, `--brand-1-50` to `--brand-1-950` and `--brand-2-50` to
  `--brand-2-950`, with 50 the lightest. They share the brand neutral ramp's lightness at each step, so a
  step means the same lightness in every palette. Each palette passes through its seed colour, a curated
  brand tone, at the step nearest the seed's lightness, so that step holds the seed exactly. The other steps
  sit on the shared lightness table at the seed's hue and chroma, with chroma lowered only where sRGB
  cannot hold it at that lightness.

  - Palette 1 is the brand colour, seeded by the brand's `--feature`. Fjordkraft's company segment and
    Fjordkraft Företag use its teal.
  - Palette 2 is a second brand colour: Telinet's green `#36C275` and Gudbrandsdal Energi's orange
    `#FF9100`. Every other brand has one colour, so each `--brand-2-N` is `var(--brand-1-N)`.

  The palettes have one value per brand and segment in light and dark and in both identities. `:root`
  declares untinted greys. The Tailwind utilities `bg-brand-1-800`, `text-brand-2-400` and the rest read
  them. The theme catalog, the Figma sync and the DTCG export carry the 22 new tokens.

  Telinet's branded light `--feature-foreground` is now `var(--brand-2-400)`, the step that holds its
  green, so it still paints `#36C275`. No other role changes value.

- ac3ad25: `Button` `isPending` keeps the button in the focus order and stamps `aria-busy`, so a keyboard user who activated an async action is still on the button when the result arrives; before, the native `disabled` attribute dropped focus to the document. Activation stays blocked. Pass `focusableWhenDisabled={false}` for the old native `disabled` behaviour. While pending, Button shows a spinning `SpinnerGap` in the leading icon position and hides its own leading and bare SVG children so the spinner takes their place (a trailing `data-icon="inline-end"` icon stays), so a call site only passes `isPending`; remove hand-placed pending spinners. The new `pendingIndicator` prop replaces the spinner with your own node, or with `null` renders no indicator and hides nothing, for brand buttons that centre their own spinner over unchanged content. `ConfirmButton` inherits all of it. Announce progress through the label or a `role="status"` region, since `aria-busy` alone says nothing.
- 667f993: `@elmeragroup/fuse/button` exports `LabelButtonProps`, `IconButtonProps`, `ButtonSize`, `LabelButtonSize` and `IconButtonSize`. `ButtonProps` is now the union of the first two. A wrapper that supplies its own label types its props as `Omit<LabelButtonProps, "children">`, which keeps icon sizes out and the size list in sync with the recipe, where `Omit<ButtonProps, …>` collapsed the union and let `size="icon"` through without an `aria-label`.
- f8f357c: `Card` and a `card`-variant `Accordion.Item` draw their 1px edge in a new theme role,
  `--card-border`. Internal themes alias it to `--border`, so they look as before. External themes
  draw no edge: `--card-border` is a zero-alpha colour, `oklch(0 0 0 / 0)`, in light and dark, so a
  white card stands on the page tint by its fill. Before, every
  external card was outlined in the grey `--border`. The border keeps its width, so the layout and
  inner corners do not move. On a `--card`-coloured surface, such as a nested `Card`, an external card
  now has no outline. `CheckboxCard`, the TextField `card` box, the Field label card, `Table`,
  `DescriptionList`, `Separator` and the overlay edges keep `--border`. A border colour class on a
  `Card` still wins. A box you build from `cardVariants().base()` or the `card` item of
  `accordionVariants` takes `--card-border` too, so add `border-border` where it must keep a visible
  edge, as `CheckboxCard` and the TextField `card` box do. A plain wrapper that overrides `--border`
  no longer recolours cards; override `--card-border` instead. A host that maps its own tokens onto
  Fuse roles can set the role directly; without it cards fall back to `--border`.
- 51d7b39: A Card now pads its sections, the gaps between them and a horizontal card with the medium surface
  tier, `--surface-pad-md`: 16px comfortable and 12px dense, down from 24px and 16px. The card's
  text then starts on the same edge as the Items and Accordion items around it. CheckboxCard and the
  TextField `card` box follow, because both sit on a default card.

  `Card.Root` takes `size="lg"` for the previous large tier, `--surface-pad-lg`, for a card that holds
  long prose or acts as a page's main panel. The root writes the size as `data-size`, and
  `cardVariants` takes the same `size` axis. Inner corners stay concentric at both sizes.

- 24fa58e: `Card.Section` splits a vertical card's body into stacked sections of equal weight, under one
  optional `Card.Header`. Each section pads every side with the card's tier, so it follows the card's
  `size`, and a 1px line runs above every section that has a part above it, from edge to edge. The
  first and last sections round with the card's corners, so a fill or a hover fill follows them, and
  hidden sections are skipped. `Card.SectionMedia` adds an icon column, centred beside a
  `Card.Content`, which is the unpadded content column inside a section. `Card.Section` is a static,
  server-rendered part.

  `Card.SectionButton` makes a whole section one `<button type="button">`, with a hover fill, a pointer
  cursor, the disabled face and an inset focus ring. `render={<a href="…" />}` makes it a link, and a
  trigger composes it as it composes `Button`: `<Dialog.Trigger render={<Card.SectionButton />}>`.

  The line between sections is a new colour role, `--card-section-divider`. Internal themes draw it in
  `--border` and external themes in the page tint, `--background`, so a card reads as split into
  segments. Override it where you override `--card-border`.

- aa87ad7: `Card` casts its `shadow-xs` in a new theme role, `--card-shadow`. Internal themes set it to
  Tailwind's own `shadow-xs` colour, black at 5%, so they look as before. External themes cast no
  shadow: `--card-shadow` is a zero-alpha colour, `oklch(0 0 0 / 0)`, in light and dark, as the
  external order flows draw their cards. Before, every external `Card` cast the 5% black shadow. The
  shadow keeps its geometry, so a brand or host can tint it back by setting `--card-shadow`.
  `CheckboxCard` and the TextField `card` box keep the plain `shadow-xs`. A shadow size class on a
  `Card`, such as `shadow-md`, still replaces the shadow, and a shadow colour class tints it. A box you build from
  `cardVariants().base()` takes `--card-shadow` too, so add `shadow-xs` where it must keep its
  elevation, as `CheckboxCard` and the TextField `card` box do. A host that maps its own tokens onto
  Fuse roles can set the role directly; without it cards fall back to the 5% black shadow.
- cfaabc8: Add `Carousel`, and the `Pause` and `Play` icons.

  - `Carousel`, from `@elmeragroup/fuse/carousel` and the root barrel, scrolls its slides with the
    browser's own scroll snapping, so a swipe, wheel, trackpad or arrow key works as on any
    scroller and a flick stops at the next slide. It adds no runtime dependency.
  - `Root` is a region with the role description "carousel" and requires `aria-label` or
    `aria-labelledby`. It takes `index`, `defaultIndex`, `onIndexChange(index, { reason })` and
    `orientation`. `Viewport` holds the `Slide`s. Each slide is a group named by its place, such as
    "3 of 6", and a slide out of view is `inert`.
  - `Controls` lays out `Previous`, `Indicators` and `Next` in one centred row. Previous and Next
    disable at the ends and stay focusable. `Indicators` renders one `Indicator` per page, a dot
    that becomes a pill on the current page, `aria-disabled` there as the APG grouped carousel asks;
    map your own `Indicator index={i}` for thumbnails. `Status` shows "3 of 6" in the locale.
  - `Autoplay delay={ms}` rotates the pages and renders the APG rotation control. Rotation starts
    paused under reduced motion, pauses on hover and a hidden tab, and stops for good on keyboard
    focus anywhere in the carousel, the rotation control included, and on a swipe, a drag, a wheel
    turn or a control press. Only the rotation control starts it again; after that press, focus and
    hover no longer stop or pause it. A new `delay` keeps the user's choice. An `Autoplay`, mounted
    with the carousel or later, starts paused under a pointer already over the carousel, hover from
    before hydration included where the primary pointer can hover, and stopped with keyboard focus
    already inside it, an `autoFocus` field's included. Keyboard focus inside a portal, a
    same-origin frame's included, or a custom element's open shadow root counts as focus in the
    carousel.
  - A consumer `onClick` on `Previous`, `Next`, `Indicator` or `Autoplay` can cancel the control's
    own action with `event.preventBaseUIHandler()`.
  - `useCarousel()` gives custom controls the carousel's `state`, `actions` and `meta`.
  - The strings come in all four locales. The slides do not loop.
  - `@elmeragroup/fuse/icons` adds `Pause` and `Play`.

- e9aa0f8: A new preview entry, `@elmeragroup/fuse/chart`, ships Fuse's chart family. Its names and props can
  change until Fuse's first stable release, so it stays out of the root barrel and every export is
  tagged `@beta`. The cartesian parts, every `Bar` form, lines, areas, Panels and `Sparkline` render.

  - `Chart` with its aliases `AreaChart`, `BarChart` and `LineChart`, plus `PieChart`, `RadialChart`
    and `RadarChart`. Each starts at `Root`, which reads every series from `config` and never inspects
    its children. Shared parts such as `Tooltip`, `Legend`, `Table` and `Empty` sit under every name.
  - `Sparkline`, a hook-free static chart with `role="img"` that a server component renders.
  - `useChartPoint`, and the pure `formatChartValue` and `formatChartSlot`, which print the chart's own
    value and slot labels outside the chart, on the server or the client.
  - Every prop is serialisable data, so a server component composes a chart. A format is Intl options
    or a Fuse preset, and a colour is a chart role, never a CSS string.

  Import `@elmeragroup/fuse/chart.css` once, beside Fuse's own stylesheet. It works for
  Tailwind-source and standalone consumers, before or after Fuse's CSS.

  The central reduced-motion rule in `fuse.css` now also resets `transition-delay`, so a fade starts
  at once instead of waiting on a stagger meant for movement, and it turns the chart keyframe
  variables `--animate-chart-ping`, `--animate-chart-dash` and `--animate-chart-shimmer` off.

  The cartesian chart renders under a `LocaleProvider`, which it reads for the locale and the time
  zone. Every mark is SVG drawn in pixels once the browser measures the plot, so bars, rules and the
  crosshair land on whole device pixels at any width and zoom. The server sends the figure, its axis
  labels, legend and table, and a skeleton in the plot, which keeps its height. Bars draw one SVG
  element each up to 100 slots, and vertical bars draw one path per colour step above that, with M4
  decimation past 2,000 slots. A series sets its bars' look with config `barVariant`, not a `Bar`
  prop, such as `"hatched"` or `"isometric"`, and its legend swatch reads the same look, so the server
  HTML already shows a hatched swatch. Above 100 slots only the `"default"` and `"gradient"` looks
  draw, and the rest fall back to the default. Stacks, groups, expand, horizontal bars, emphasis,
  projection and quality states all render, and so do `Tooltip`, `Legend`, `LegendToggleGroup`,
  `Crosshair`, `ReferenceLine`, `ReferenceArea`, `ActiveValue`, `Headline`, `Table`, `Empty`,
  `Skeleton`, `Glow` and `Background`. A data update moves the bars over 480 ms, and a second update
  during the move continues from where each bar is drawn. A change of `xRange` alone snaps, and
  reduced motion snaps every update. The entry now depends on `d3-array` and `d3-shape`.

  `Line` draws every d3-shape curve, with `step-after` and `step-before` running each reading across
  its whole slot, and the `dashed`, `flowing` and `quiet` looks. `Area` fills from 0, alone or stacked
  under either offset, in six looks. A missing reading leaves a gap, or a dashed bridge under config
  `missing: "connect"`, a lone reading draws a dot, and the segments of estimated readings and the
  tail from `projectedFrom` draw dashed on a line and hatched on an area. A scale colour paints the
  value through a gradient along the value axis, so a stacked line or area, or one under
  `stackOffset="expand"`, throws `scale-color-on-stack`. A second `Line`, `Area` or `Bar` on the same
  `dataKey` throws `series-drawn-twice`. `Dots`, `ActiveDot` and `Marker` with a `ValueLabel` sit on
  the line's vertices, and `Glow`, `Reveal` and Root's `data-intro` wipe work on lines and areas. On a
  data update a line tweens its vertices, slides when the window moves by whole slots, pairs by
  position when no slot is shared and crossfades otherwise, with its dots and markers on it in every
  frame. Bars in the path form move the same way. Above 2,000 slots a line draws the M4 vertices of
  each pixel column. `Sparkline` draws its line, area or bars on the server, and its name ends in a
  sentence that names its lowest and highest values. The `time-seconds` preset prints `13:42:04` in
  nb-NO and `13.42.04` in fi-FI.

  `Chart.Panel` stacks rows on one Root. Each Panel takes its own value axis, `yBaseline` and
  `yInclude`, and every Panel shares Root's x grid, surface, tooltip, table and motion, so one listbox
  walks every Panel and Up and Down move the series focus from one Panel into the next. A Panel that
  lists only some keys of a stack throws `stack-across-panels`. The Panels align their plots through
  CSS subgrid, so every slot lands on the same device pixels in each. A config entry's `interval` may
  be coarser than Root's, such as hourly usage under quarter-hour prices: its bar spans its quarters,
  its line's vertex sits at its hour's middle, the band crosshair spans its hour, the option and the
  tooltip name its hour, and the table spans its cell over its rows. A series interval that does not
  nest in Root's throws `interval-not-nested`, and a value off the series' grid warns `off-grid-x` in
  production.

  `Chart.SlotLabel` inside a `Crosshair` prints the active slot as a pill on the x axis, in the axis's
  format, and fades the tick labels under it. Each part of the label, such as the day or the month,
  rolls to its next value, so a part that stays the same stays still. Above 60 labels it prints one
  label. The line crosshair fades out at both ends, `fade` picks the ends, and
  `--chart-crosshair-width` sets its width. The line crosshair, the pill and the tooltip glide on
  springs and move at once under reduced motion. The line crosshair's spring quickens with the
  pointer, and `ActiveDot` glides with it along its series' line.

  Data that breaks a rule throws in development. In production each rule warns once per column, or
  once for the x axis or a stack, naming the first row and the count.

- c36ca96: Add `xScale="linear"` to `Chart.Root` in the preview chart entry, `@elmeragroup/fuse/chart`, for a
  number x column whose values are unevenly spaced, such as an EV's charging power by state of charge
  or a capacity tariff's steps over kW. Each row sits at its x number over a nice x domain, and stays
  one keyboard step, one tooltip readout, one table row and one spoken item, in ascending x order.
  Rows may arrive in any order, a repeated x keeps its first row (`duplicate-x`), and an x that is
  not a finite number is `invalid-x`.

  Under `xScale="linear"`, `xFormat` takes a `ValueFormat` and prints the x numbers on the axis, in
  the tooltip, the options, the description and the table. `xLabel` names the x measure in the options
  and the table's header, and `xInclude` lists values the x domain must reach, as on `ScatterChart`.
  TypeScript rejects the time-axis props and `orientation="horizontal"`, and `ChartPoint["x"]` reports
  the number.

  - `XAxis` labels d3 nice numbers over the x domain, and `Grid` draws its x lines there.
  - `Line` and `Area` draw their vertices at their x numbers. `curve="step-after"` holds each reading
    from its x to the next one's, the last to the plot's end, and `"step-before"` from the x before.
  - `Bar` centers each bar on its x, every bar as wide as the closest two x values' distance less the
    band gap, clipped to the plot.
  - The pointer picks the row whose x lies nearest, and `ReferenceLine` and `ReferenceArea` mark any x
    number at its true place.
  - A data update tweens or crossfades. A shifted window never slides, since its rows lie unevenly.
  - Root throws `horizontal-linear-axis` under `orientation="horizontal"`.

  The new types `ChartXScaleProps`, `ChartSlotScaleProps` and `ChartLinearScaleProps` let a wrapper
  type the x scale props.

- e9aa0f8: The chart roles are now one validated palette, shared by every brand. `--chart-1` to `--chart-8`
  take new values: a categorical set in a fixed cyclic order of blue, orange, aqua, magenta, green,
  violet, yellow and red. Each slot holds 3:1 on the page, card, card-soft and modal surfaces of
  every theme. Neighbouring slots, including slot 8 beside slot 1, stay distinguishable in normal
  vision and under simulated protanopia and deuteranopia. The internal dark theme drops its five
  greens and uses the same set.

  New roles:

  - `--chart-seq-1` to `--chart-seq-7`, a one-hue ramp for magnitude, step 1 the least.
  - `--chart-diverging-1` to `--chart-diverging-7`, a blue and orange scale for values that cross
    zero, with step 4 the grey midpoint.
  - `--chart-sentiment-positive` and `--chart-sentiment-negative`, favourable and unfavourable to
    the reader, such as a low and a high price.
  - `--chart-other`, a grey for the series folded together past the slot count.
  - `--chart-1-foreground` to `--chart-8-foreground` and `--chart-other-foreground`, the text of a
    direct label on the mark. Each is white or neutral 950, whichever contrasts more, at 4.5:1 or
    more. The theme build computes each one from its slot, so a host that overrides a slot
    also sets that slot's foreground.

  `fuse.css` maps each role in `@theme`, so utilities such as `bg-chart-seq-3` and
  `text-chart-1-foreground` exist.

- 88040c2: A cartesian series can take a threshold colour (`@elmeragroup/fuse/chart`), which paints its values
  in one role above a number and in another at or below it, such as a spot price above and below the
  period's average:

  ```ts
  color: {
    threshold: average,
    below: { color: "chart-sentiment-positive", label: "Below average" },
    above: { color: "chart-sentiment-negative", label: "Above average" },
  }
  ```

  A line and an area change colour where they cross the threshold, and a bar, an emphasis box, a dot,
  a marker, the active dot, the tooltip swatch and `Glow`'s halo take their own value's side. The legend shows one entry per side
  with its label, and the tooltip, the table and spoken text keep the series' own `label`. Pass the
  same number to a `ReferenceLine` to show the split. On a stacked `Line` or `Area` a threshold throws
  `scale-color-on-stack`, as a scale does. A threshold that is not a finite number throws
  `non-finite-threshold` in development, and production paints every value in the `below` role. Pie,
  radial and radar config reject a threshold at the type level. The new types are
  `ChartThresholdColor` and `ChartThresholdSide`.

  On a series coloured by a scale, dots, markers, the active dot, a path-form bar's emphasis box and
  `Glow`'s halo take their own value's step too, not the scale's middle step.

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
- 38075e5: `ComboboxField` and `AutocompleteField` take `isReadOnly`, which forwards `readOnly` to
  `Combobox.Root` and `Autocomplete.Root`. The input stays focusable, takes the muted read-only fill
  and its popup still opens to show the options, but choosing one, typing or the clear button keeps
  the value, which still submits under `name`.
- 2316569: `Combobox.Root` takes its item type from `items`, as `Autocomplete.Root` and `ComboboxField` do.

  - With `items`, flat or grouped, the value, `itemToStringValue`, `onValueChange` and the other
    callbacks take one item without an annotation, and a callback annotated to another type is an
    error. Without `items`, `filteredItems` sets the type, and without either, `value`,
    `defaultValue` or an annotated callback does.
  - The Root's type parameters are now `Items`, `Filtered`, `Value` and `Multiple`, in that order.
    Drop explicit type arguments such as `<Combobox.Root<Fruit, true>>`: `items`, `value` and
    `multiple` set them.
  - `items` takes an array, flat or of groups. A Base UI `createItems()` collection no longer
    type-checks there.

- f535185: `Combobox.Input` accepts `triggerLabel` to name its auto-rendered caret trigger, like `clearLabel`
  names the clear button.
- 35c902a: Add `Kbd`, `Command` and the opt-in `@elmeragroup/fuse/command-virtual` entry.

  - `Kbd`, from `@elmeragroup/fuse/kbd`, renders one key cap as `<kbd>`, and `KbdGroup` renders the
    caps of a combination in an outer `<kbd>`. Both are server components with one size at both
    densities. A cap renders the glyph it is given and never detects the platform. In an
    `InputGroup` addon a group rounds its caps with the addon's inner corner.
  - `Command`, from `@elmeragroup/fuse/command`, is a command palette built on Base UI's
    Autocomplete. Every palette starts at `Root`, which holds the dialog's open state, the page stack
    and, in a palette without pages, the search. It types its props as Base UI's flat Autocomplete
    Root overload, or as the grouped one with `grouped`. `Trigger` and `Content` place the palette in
    a dialog near the top of the viewport, and each opening starts with the uncontrolled query and
    stack reset. The other parts are `Input`, `Back`, `List`, `Empty`, `Status`, `Group`,
    `Label`, `Collection`, `Item`, `Shortcut`, `Footer`, `Hint` and the key hint presets
    `NavigateHint`, `SelectHint`, `CloseHint` and `BackHint`. With `defaultPages`, or `pages` and
    `onPagesChange`, the Root holds a stack of pages. Each `Page` holds its own search,
    `PageTrigger` opens one, and Backspace in an empty field and `Back` go back a page. Names, the
    placeholder, the empty message and the hint labels come from the locale dictionary.
  - `CommandVirtual`, from `@elmeragroup/fuse/command-virtual`, renders long flat lists with TanStack
    Virtual. Pass `virtualized` to the Root or a `Page`, and `render={<CommandVirtual.List />}` to
    `Command.List`. Install `@tanstack/react-virtual` 3.14 or later beside Fuse. It is an optional
    peer, and the entry is not in the root barrel.

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
  - Fields: InputGroup addon buttons and the phone country trigger round with the field corner
    less their inset, 5px dense and 9px comfortable (1px internal); the DatePicker trigger with the
    field corner less 1px (5px internal); a kbd, Combobox chips, the chip remove button and date
    segments with the field corner less their deeper insets (0px internal).
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

- 326c588: `DataTable` columns can be resized. Register `columnSizingFeature` and `columnResizingFeature`, and
  render `header.ResizeHandle`, or `DataTable.ResizeHandle` with a `header`, in a column's header with
  the column's name as `columnName`. A table with `columnSizingFeature` lays out from a `<colgroup>`
  of the columns' `size` in px under `table-layout: fixed`, is as wide as its columns together, and
  scrolls sideways in its container. A cell or header cell cuts content wider than its column short
  with an ellipsis, and `DataTable.SortButton` now truncates its label to fit its header cell.

  The handle is a focusable vertical `separator` at the header cell's end edge, with a 24px hit area
  at both densities. Arrow keys change the width by 10px, Home and End jump to the column's `minSize`
  and `maxSize`, and a double-click resets the width. Key chords with Alt, Control or Meta stay with
  the browser. The handle does not narrow a column below 32px, which its target needs. A pointer
  press focuses the handle, and a drag previews and announces the width without rendering any row
  and commits `columnSizing` once, on release, so `onColumnSizingChange` fires once per drag or key
  press that changes the width. Clicks on the handle do not reach the header around it, and the handle stays
  beneath a host's sticky bar. Turn a column's handle off with `enableResizing: false`.
  `selectColumn` is now 48px and `actionsColumn` 76px wide in a sized table, and neither can be
  resized. A table without `columnSizingFeature` renders as before.

- 33213a2: `DataTable.ColumnToggle` and `table.ColumnToggle` take `open`, `defaultOpen` and `onOpenChange`
  for their menu. `DataTable.Pagination` and `table.Pagination` take `pageSizeOpen`,
  `defaultPageSizeOpen` and `onPageSizeOpenChange` for the Rows per page list. Each change callback
  takes Base UI's signature, the next open state and the change details. Before, neither popup
  could be controlled, so a host that had to close one remounted it.
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

- 7327905: New `@elmeragroup/fuse/data-table-filter` entry, a filter bar for TanStack Table v9 tables. Install
  `@tanstack/react-table` 9.2 or later beside Fuse. It is an optional peer, and the entry is not in the
  root barrel.

  - `DataTableFilter.Root` reads and writes the table's `columnFilters`. Each filter value is a plain
    `{ kind, operator, values }` object for an option, multi-option, text, number, date or boolean
    field.
  - `defineFilterFields<Row>()` describes the filterable columns, keyed by column id and checked against
    the row type. `createDataTableFilterFn({ timeZone })` returns the one filter function every column
    uses.
  - `Bar` holds the Trigger, a chip per filter and Clear. `Content` is the add menu, with a field
    search, value submenus, quick search across option values, and text, number and date editors that
    open in place. `ValueContent` is the popover a chip's value opens.
  - The bar stays one line high at every width. Its chips sit in one strip that scrolls sideways,
    also under a vertical mouse wheel, and an end of the strip fades only while chips hide past it.
    The fades are scroll-linked animations that never finish, so a test helper that waits for
    animations should wait only for those on the document timeline. The Trigger is a square icon button named "Filter" at every width. Below a 36rem bar width Clear
    shows only its icon and keeps its accessible name.
  - A list of values shows its first 50 matches and asks for more typing.
  - A `boolean` field kind filters `true` and `false`. `toggle: true` makes it an on/off scope with a
    checkbox row in the add menu and a chip that is its name and Remove.
  - Text fields can opt in to `startsWith` and `doesNotStartWith`. `formatOperator` receives the
    field id, so one field can relabel an operator.
  - A field's `operators` bound every filter the bar writes. An option field without a multi-value
    operator is single-select, and a date field without `isBetween` offers only its one-day presets,
    written as `is`.
  - A date field picks its presets from a catalog with `presets`. Each period preset covers its whole
    calendar period, with weeks starting on the locale's first day.
  - With `manualFiltering`, pass server counts and ranges through `facets`. `parseColumnFilters` and
    `matchesFilter` parse and match the same values on a server.
  - `DateEditor` takes a function child that replaces its date inputs, for example with a calendar. On
    a viewport 40rem wide or more, the presets stand in a column beside the child, and the popup widens
    to fit.
  - `useDataTableFilter().actions.edit(fieldId)` opens a field's editor, and `onActiveFieldChange`
    reports the field whose submenu or editor opens.

- 8cb195b: `DataTableFilter` value lists can end in a footer of actions. `DataTableFilter.ValuesFooter`
  holds `SelectAllValues`, `ClearValues` and `Done`. Render one footer component in
  `DataTableFilter.FieldList`'s children for the add menu's value submenus, and in
  `DataTableFilter.OptionEditor`'s children for a chip's value popover. Its `fields` prop names the
  fields whose lists show it, and an id the Root's `fields` lacks throws
  `DataTableFilterCompositionError` with the new `unknown-field` rule. A footer part outside a value
  list throws the new `outside-value-list` rule.

  Select all picks every option of the field, past the 50 rows the list shows. With a search it
  picks every option the search matches. It keeps the values already picked, and the operator
  follows the count, so `is` becomes `is any of` and a negated operator stays negated. It is disabled
  once every option in its scope is picked. A boolean or single-select field leaves it out. Clear
  all removes only that field's filter and keeps the list open. Done closes the add menu or the
  value popover. Disabled actions stay focusable, and the footer stays in view below the scrolling
  list. The dictionary has new `selectAll`, `clearValues` and `done` rows in every locale.

  `FieldList` now takes `children`, and `OptionEditor` now renders its children below its list.
  Without a footer, both lists render and behave as before.

- bf524c7: `DatePicker` takes `triggerPlacement`. Set it to `"start"` to put the calendar button before the
  date segments, so the button comes first in the field box, in tab order and on screen. Clicking
  the label then focuses the button. The default, `"end"`, keeps the button after the segments.
  `DateRangePicker` keeps its button at the end and does not take the prop.
- e0f6aba: `@elmeragroup/fuse/theme` now exports `DENSITIES`, the `["dense", "comfortable"]` axis tuple.
  Hosts, pickers and test matrices can iterate the densities from the library instead of
  re-deriving the list.
- e0f6aba: Every part now has a density role, and density changes every part that has one. A part is a
  `data-slot` the library writes. Its role names the metrics it reads:

  - `control`: an interactive single-line box.
  - `row`: one line of a collection.
  - `surface`: a shell that pads content, or a stack that spaces groups.
  - `label`: the words that describe a control, or a notice's text beside the controls.
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
    - `Table` and `DataTable` heads and cells, `VerticalTable` keys and values, `DescriptionList`
      terms and details, `Sidebar.Input` and `Combobox.Empty` follow too.
    - In a Frame, a table's first and last cells keep their 2px extra edge inset over `--row-px`.
  - **Item.**
    - `default` pads every side with `--surface-pad-md` and gaps its parts by `--surface-gap-md`.
    - `sm`, and so every `Alert`, keeps that inline edge and pads its block with `--row-px`.
    - `xs` is a list row on the row metrics.
    - `sm` and `xs` gap their parts by `--surface-gap-sm`.
    - A compact `Item.Group` pads default Items with `--surface-pad-md` and `sm` Items with
      `--row-px`.
  - **Field text.**
    - `Field.Label`, `Field.Title`, `Field.Description`, `Field.Error` and a `variant="label"`
      `Field.Legend` read the label metrics.
    - A `variant="legend"` `Field.Legend` stays 16/24px.
    - `SelectionItem.Title` and `SelectionItem.Description` read them too. They now write their own
      `selection-item-title` and `selection-item-description` slots in place of `item-title` and
      `item-description`.
  - **Group gaps.**
    - A horizontal `Field.Root` uses `--surface-gap-md`. `Field.Set` and `Field.Group` use
      `--surface-gap-xl`, with `md` or `lg` around nested groups.
    - Checkbox, Radio and selection-item option groups stack by `--surface-gap-sm` and line up by
      `--surface-gap-lg`.
    - `Item.Group` uses `--surface-gap-lg`, or `--surface-gap-sm` for `sm` and `xs` rows.
    - A vertical `Field.Root`'s 4px between a label and its control stays fixed part spacing.
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

- 97fb537: `DescriptionList.Content` takes `dividers={false}` to drop the rules a responsive list draws between
  its Items, chosen once for the whole list instead of a `border-t-0` class on every Item. It reaches
  only that list's own Items, so a list nested inside keeps its own rules. The default `true` leaves
  existing lists unchanged. An inline list draws no rules either way, so `dividers` has no effect
  there. A list with `dividers={false}` writes `data-dividers="false"`.
- 41bf4f2: `DescriptionList.Content` takes `layout="inline"` for label/value rows in receipts, order summaries
  and price boxes. The details align to the end of the row. Inline rows take the label type and follow
  density, are spaced by the small surface gap and draw no rules.
  The term is not muted, and a colour class on a term still applies. Consecutive inline lists are
  spaced by the large surface gap, so each list is one group. The default `layout="responsive"` is
  unchanged, and the list writes its layout as `data-layout`.
- e82a3bf: `DescriptionList.Item` wraps one name-value group: a `<div>` around its terms and details that takes
  attributes such as a `data-testid`. **Breaking:** every description list is now made of Items. Wrap
  each term and its details in a `DescriptionList.Item`; HTML doesn't allow a list to mix Items with
  bare terms and details. The inline layout styles terms and details only inside an Item, and both
  layouts draw rules between Items only.

  Each inline Item now shares its own row between its term and details, whatever the other rows hold,
  instead of every row sharing one details column capped at 60% of the list. The details sits beside
  its term, at the end of the row. When the two don't fit on one line, both wrap within the row: each
  keeps its longest word and they share the rest, so an email address stays whole beside a term that
  can wrap. Only when the two longest words can't share the row does the details move under its term,
  still at the end, and it breaks a word only when that word is wider than the row. Override
  inline cells with a `[:where([data-layout=inline]>*)>&]:` class, which replaces
  `[:where([data-layout=inline])>&]:`, and an inline Item's row with a `[:where([data-layout=inline])>&]:`
  class.

  A responsive list draws its rules between Items only, so a rule no longer splits the terms or details
  of one group, and its Items share the list's columns through a subgrid. A later details of one term
  now stays in the details column from `sm` up, and details no longer take the browser's start margin in
  hosts without a CSS reset.

- 3042e88: `Dialog.Content`, `AlertDialog.Content` and `Sheet.Content` fill with a new theme role pair,
  `--dialog` and `--dialog-foreground`. Internal themes and every dark theme alias `--popover` and
  `--popover-foreground`, so they look as before. External light themes fill a modal with the page
  tint, `--background`, and set its text in the page's `--foreground`, so the white fields and
  selection rows inside it stand apart as they do on the page. Before, an external light modal was
  white, the same colour as those fields and rows, and its text took the neutral popover ink.
  Popover, Select, Combobox, DropdownMenu, NavigationMenu, Toolbar, Toast, `Command.Content` and the
  mobile `Sidebar` keep their fills. The theme rules resolve the role on the element that carries the
  theme attributes, so a `--popover` override on a plain wrapper no longer reaches a modal; set
  `--dialog` there instead. To keep one modal on the popover fill, pass
  `className="bg-popover text-popover-foreground"`. A host that maps its own tokens onto Fuse roles
  can set the pair directly; without it a modal falls back to `--popover` and `--popover-foreground`.
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
  Bedrift palette, as does Fjordkraft Företag. The dark marker
  resolves both variants; `.changeset/internal-dark-palette.md` describes the shared internal palette.

  Brand colors follow the custom Figma dark collections. Gudbrandsdal Energi and shared support-role
  mappings are provisional. Dark text, input and focus contrast are checked alongside scope isolation.

- c670d11: External field boxes now round with the brand radius, the corner of the cards and selection rows around them.

  A new theme role, `--radius-field`, rounds `Input`, `Textarea`, the `Select` trigger, `NumberField`, `InputGroup`,
  `SearchField`, the `Combobox` chips box, `DateField`, `DatePicker` and `DateRangePicker`. It aliases
  `var(--radius)` in every variant, so external fields round 2px more than before, when they took the brand radius
  minus 2px: 12px for Fjordkraft, Fjordkraft Företag and Telinet, 16px for TrøndelagKraft, 8px for Gudbrandsdal
  Energi and 6px for Elmera and Nordic Green Energy. Nothing inside a field rounds more than the field: the
  `InputGroup` addon buttons and `<kbd>`, the `SearchField` clear button, the `DatePicker` trigger, the focused date
  segments, the `Combobox` chips and their remove buttons and the `PhoneNumberField` country trigger take at most the
  field corner. A `ButtonGroup` rounds both outer ends with `rounded-md`, so a field at one end matches a button at
  the other. Internal themes do not move, and internal fields still follow a `--radius` override on a plain wrapper.

  Each theme rule resolves `--radius-field` against its own `--radius`, as it does `--radius-button`. Set
  `--radius-field` on the element that carries the theme attributes to give external fields a corner of their own;
  internal fields always round with `--radius`, so the override does not reach them. An external field does not
  follow a `--radius` override on a plain wrapper, so set `--radius-field` there too.

  A host without `themes.css` keeps rounding fields with its own `--radius`. With the external `--radius-step: 2px`,
  fields round with `--radius-field` where the host sets it, and with `--radius` otherwise. The Figma sync adds
  `radius-field` with the corner radius picker.

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
- 056bf1e: A vertical `Field.Root` now stacks its label, control, error and description 4px apart at both densities, the stack `TextField`, `SelectField`, `NumberField`, `PhoneNumberField` and `Slider` render. A field built from parts, such as one around an `Autocomplete` or an `InputGroup`, now lines up with them without a `gap-1` class. Before, its label sat 12px from its control at dense and 16px at comfortable. `TextareaField` takes the same stack. A horizontal `Field.Root` keeps `--surface-gap-md` between its control and its label, and a responsive one uses each where it applies. The card `TextField` keeps its own layout and writes `data-variant="card"`.
- 6697ef2: Every text-entry field takes `size`, `"default"` or `"sm"`, as `Select.Trigger` does: `Input`,
  `Textarea`, `TextField`, `TextareaField`, `SelectField`, `NumberField`, `PhoneNumberField`,
  `InputGroup.Root`, `Combobox.Input`, `Combobox.Chips`, `Autocomplete.Input` and `SearchField`.
  `"default"` is the md control size and renders as before. `"sm"` is the sm control size: the box
  is as tall as an sm `Button` or `Select.Trigger`, with the sm inset and a fixed 14px text, so a
  search field beside a row of sm controls lines up with them. Before, every field box was pinned to
  the md size. The input, steppers, addons, segment rows and inner buttons follow the box's size;
  on a touch screen the text keeps its 16px floor at both sizes. The box carries `data-size`.

  **Breaking:** on `Input`, `TextField`, `Combobox.Input` and `Autocomplete.Input`, `size` now takes
  `"default"` or `"sm"` in place of the native numeric `size` attribute, so `<Input size={20} />`
  no longer type-checks. Set the width with a class, such as `w-48`. `InputGroup.Input` keeps the
  native attribute, because its group's `size` sets its size.

  `SearchField`'s clear button is now a square as tall as the box's inner buttons, 32px in a dense
  default field, where it was 24px wide.

  In a host without Tailwind's preflight, `Combobox.Chips` now counts its border in its height and
  its input drops the browser's own border, padding and fill, so the chips box keeps the field height
  there too.

- f9ec179: `FileTrigger` is a permanent component at `@elmeragroup/fuse/file-trigger`, also in the root barrel,
  built on `FileUpload`, with FileUpload's prop names (`accept`, `multiple`, `directory`, `capture`,
  `disabled`). A pick runs the same `accept` and count check as
  `FileUpload`. It looks as before: a Fuse `Button` at `sm` with a leading paperclip, camera or
  folder icon.

  - `onSelect` receives a `File[]` of the files that pass, in a new array for each pick, which the
    next pick leaves intact.
  - The new `onReject` receives the files that fail, each with a `reason`. A file that fails
    `accept` is rejected with `"type"`. Without `multiple`, when more than one file passes
    `accept`, each of those is rejected with `"count"`.
  - It renders the button and a hidden file input and nothing around them, so it joins a
    `ButtonGroup`'s borders and corners as a `Button` does.
  - It takes a `button`'s props, such as `aria-describedby`, which land on the visible button, and
    `ref` is that button. The button carries `data-slot="file-trigger"`. `size` takes the label sizes
    `xs`, `sm`, `default` and `lg`.
  - A folder pick (`directory`) without `multiple` rejects its files with `"count"` once more than
    one of them passes `accept`, so pass `multiple` with `directory` to keep every file.

- cdeca34: `FileUpload` now works inside a `Field.Root`, with one `FileUpload.Trigger` as the Field's control;
  development logs an error for a second. `Field.Label` names the Trigger after its own text, such as
  "Choose file Meter photo", and a click on the label opens the picker. `Field.Description` and
  `Field.Error` describe the Trigger, after the ids in its own `aria-describedby` and before each
  `FileUpload.Description`. An invalid Field marks the Trigger `aria-invalid`, unless the Trigger sets
  its own, and the Trigger paints the shared invalid border and ring as the FileUpload's one invalid
  face; `FileUpload.Dropzone` paints none. A disabled `Field.Root` or `Field.Set` disables the
  FileUpload, which `useFileUpload()` reports as `state.disabled`. Outside a Field, the parts render
  as before.
- 0d8e5e0: `FileUpload.Root` can post its files with a native form. Give it a `name` and the controlled `files`
  it posts, and add each pick from `onSelect` to `files`; a submit or `new FormData(form)` then carries
  exactly that list under `name`. A rejected pick never changes what is posted, and a native form
  reset, including the one React runs after a form action, keeps the posted files. An enclosing
  `Field.Root`'s `name` takes the place of the Root's own. A disabled Root posts nothing, and a Root
  without `files` posts nothing as before; `name` without `files` is a type error.
- c37c35b: `FileUpload.Root` takes `required`, which asks for at least one file in the controlled `files`; an
  empty or missing `files` counts as no file. A native form's submit with no files then stops and moves
  focus to the first enabled `FileUpload.Trigger`. Inside a `Field.Root`, the FileUpload is now a Field
  control with `files` as its value: the Field validates it as its `validationMode` says, on the
  Trigger's blur in `onBlur` mode, and on a Base UI `Form` submit, which focuses the Trigger when no
  file is there. `Field.Error match="valueMissing"` then describes the Trigger and marks it
  `aria-invalid`, and `onFormSubmit` receives `files` under the Field's `name`.
- 14fc162: Add `FileUpload`.

  - `FileUpload`, from `@elmeragroup/fuse/file-upload` and the root barrel, takes files from the
    picker, a drop, a paste and `useFileUpload().actions.add`. Every source runs one check.
    `onSelect` receives the files that pass, in a new array for each call. `onReject` receives the
    rest, each with a `reason`: `"type"`, `"count"`, `"directory"` or `"unreadable"`.
  - `Root` takes `accept` in the attribute's syntax, `multiple`, `directory`, `capture` and
    `disabled`, and renders the hidden file input with no `name`. A Root without `multiple` rejects
    every file that passes `accept` with `"count"` when more than one does.
  - `Dropzone` sets `data-drop-target` while a file drag that can drop is over it, shows the
    not-allowed cursor when the drop is certain to fail, and opens the picker from a click on its
    empty surface. A dropped folder expands into its files, each with a `webkitRelativePath`.
  - `Trigger` is a `button` that opens the picker, and `render={<Button size="sm" />}` gives it the
    Fuse look. `Description` describes every Trigger in its Root.
  - A paste adds its files while focus is inside the Root, outside a text field.
  - While a Root is mounted, a file dropped outside every Dropzone no longer opens in the tab.

- 17fc8de: `@elmeragroup/fuse/icons` ships `FjordkraftForetagLogo`, the logo of the `fkab` themes.
  `variant="full"`, the default, draws the Fjordkraft face beside "Fjordkraft Företag";
  `variant="mark"` draws the face alone, the same mark as `FjordkraftLogo`'s. The whole logo paints in
  `currentColor`, as `FjordkraftLogo` does.

  `<BrandLogo brand="fkab" />` now draws the Fjordkraft Företag lockup. It drew `FjordkraftLogo`
  before, so a page that showed it gets a wider logo, about 7.6 wide to 1 tall instead of 4.5 to 1.
  Check the space its slot gives it. `<BrandLogo brand="fkab" variant="mark" />` is unchanged.

- 2628849: New `Form` (`@elmeragroup/fuse/form`), a wrapper over Base UI's `Form`, so validation errors such as a server's response to a submit reach the fields inside it without importing `@base-ui/react` directly. `errors` maps control names to one message or several; `Field.Error` without children and `TextField` without `errorMessage` show them, editing a field clears its error, and after a submit the first field the errors mark gets focus. `onFormSubmit` receives the values of the controls inside a `Field.Root`, typed by `Form`'s type parameter.
- 2793ab8: `Frame.Root` takes a `layout` prop: `"gutter"` (the default) keeps a 4px muted gutter between
  panels, `"stacked"` fuses adjacent panels into one card, and `"flush"` drops the Frame's padding so
  its panels and Tables run to its edges and round with its own corner, with the header and footer in
  its muted band. `@elmeragroup/fuse/frame` exports the union as `FrameLayout`. The Frame now draws
  a 1px border, and its panels round concentrically inside it. `Frame.Header` and `Frame.Footer` pad
  half the panel padding on the block axis, so they read as bars above and below the panels. Every
  text column in a Frame starts and ends on one inset, a panel's border and padding: the header and
  a header's collapsible trigger, the panels, the footer, and a framed Table's first and last columns
  and its caption, which now aligns to the start in a Frame. `Table.Head` aligns its text to the
  start, and `VerticalTable` draws its key divider on the logical end side, so both hold in
  right-to-left layouts.

  A panel or Table in a `Collapsible.Content` of a `Collapsible.Root` that is the Frame's direct child
  keeps the Frame's corner and layout, so panels can collapse. A `Collapsible.Trigger` directly in
  `Frame.Header` takes the whole band: it pads as the header does, draws the focus ring inside the
  band, and turns a trailing caret half a turn while its panel is open. The collapsible panel keeps
  its shadow: in a Frame, `Collapsible.Content` clips to its animating height with a clip-path that
  leaves room for the shadow. A panel in any other wrapper, such as a `div`, is a plain panel.

  A Table inside a `Frame.Panel` now renders as a plain table, without the framed cell borders. A
  panel whose only child is a `Table.Root` or `VerticalTable.Body` element drops its padding and
  writes `data-sole-table="true"`: the table runs to the panel's edges and clips to its corners, a
  `VerticalTable.Body` there drops its own border for the panel's, and the table's first and last
  columns take over the padding. Anything else keeps the padding, including text beside the table
  and a component that renders a table. Only a Table that is the Frame's own child, directly or in
  such a `Collapsible.Content`, keeps the framed look.

  Breaking: `stackedPanels` is removed. Replace `stackedPanels` with `layout="stacked"`; the type
  checker flags the old prop. A Table in a panel loses the framed cell borders it took before, and a
  panel whose only child is a Table element loses its padding.

- 204a034: Add `GaugeChart` to the preview chart entry, `@elmeragroup/fuse/chart`. Root takes one `value` on a
  dial from `min` to `max`, in the value's own unit and format, and names the dial as a meter with the
  value's spoken text, so the chart has no tab stop. With no value the figure carries that name, so an
  empty gauge among others still says which reading is missing. A value past either end draws at that end and
  sets `data-over-max` or `data-under-min`, while the centre and the meter keep the true number.
  `Track` draws 40 notches or a solid band, `Fill` and `Glow` light it up to the value, `Zone` marks a
  range at the rim, `Ruler` stands inside or outside the track with labels at its majors, and `Needle`,
  `Sector`, `ProgressRing` and `Dots` read the same value, so a gauge may leave the track out. Each
  coloured part takes a `ChartGaugeRole`, a categorical or sentiment role, which reads against the
  surface at 3:1 or more in every theme. The
  layers lay out from the rim inward with no radius to tune. `Center`, `CenterValue`, `CenterLabel`,
  `Empty`, `Skeleton`, `Headline` and `Takeaway` complete it. On first view the fill sweeps in from
  `min` and every part follows it in each frame, and a new value sweeps on from where the dial shows.
- 1ef5309: `CheckboxGroup`, `CheckboxItemGroup`, `RadioGroup` and `RadioItemGroup` take `isLabelHidden`. The
  legend stays the group's accessible name but is visually hidden, and the first option moves up into
  its place. Use it when a section heading above the group already names it. A pending radio group
  keeps its spinner row visible. A `description` still renders.
- a354a4b: A `Heading` at level 1, 2 or 3 takes its default size, line height and weight from nine new theme
  roles, `--heading-1-size`, `--heading-1-leading` and `--heading-1-weight` and the same for levels 2
  and 3. External themes set the external design's heading styles: an h1 is heading small, 24/32, and
  an h2 or h3 is heading xsmall, 20/32, all at 700. Before, an external h1 was 24/33, an h2 18/24.75 and
  an h3 16/22, all at 500. Internal themes keep those values, so nothing internal moves, and h4 to h6
  stay 16/22 at 500 in every theme. A `size` prop still replaces a level's size and line height, a
  `font` prop its weight, and a `className` size or weight still wins. A host that maps its own tokens
  onto Fuse roles can set the roles directly; without them headings keep the internal scale.
  `headingVariants()` on its own knows no level and keeps the plain scale. `TimelineList.Title` keeps
  its earlier type in every theme, 24/33 at level 1, 18/24.75 at level 2 and 16/22 below, all at 500,
  and the `Calendar` month title stays 18/24.75 at 500. The Figma sync offers the sizes in the
  font size picker, the line heights in the line height picker and the weights in the font weight
  picker.
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
  - Date fields, date pickers and calendars over Temporal values.
  - Typed public entry points with documented props and React Server Component boundaries.

- 8f9c43e: `Input` and `InputGroup.Input` take `filter="numeric"`, the digits-only guard `TextField` already had. Non-digits are stripped before `onChange` and Field validation read the value. On input types with a selection API, such as `text` and `tel`, `maxLength` counts digits, so a pasted `912 34 567` fits `maxLength={8}` whole; `type="email"` and autofill that sends no cancelable `beforeinput` keep the browser's own length handling. `inputMode` defaults to `numeric`. A digits-only field can now carry an `InputGroup` prefix or suffix, such as `+47` before a phone number.

  `TextField` forwards its `filter` to `Input` and behaves as before, except that its development warning for a non-digit `value` or `defaultValue` now reads `Input: … is not a number`.

- fc85c72: Add a shared neutral dark palette for all internal themes, selected by `data-theme="dark"` with the existing variant, brand and segment attributes. Keep brand sidebar accents, supply missing library roles, and strengthen input/chart contrast. Correct alpha compositing in contrast measurements and verify dark first paint and nested scope isolation.
- d38f9ff: `Item.Footer` now animates its height when `mode` switches between `hidden` and `visible`, with
  its fade and a short slide, over 150 ms ease-out. `SelectionItem.SubSection`, `RadioItem.SubSection`
  and `CheckboxItem.SubSection` are this footer, so a sub-section that opens a form pushes the rows
  below it down smoothly instead of in one frame, and closing it pulls them back the same way.
  Before, the row snapped both ways, and the slide never ran. Under `prefers-reduced-motion: reduce`
  the height still snaps and the footer fades in place, without the slide.

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
- 81d9b00: `Link` is a permanent component at `@elmeragroup/fuse/link`, also in the root barrel, built on Base
  UI's `useRender`. It renders an `<a data-slot="link">` and is underlined at rest
  by default. It takes the sentence's font, size, weight and line height and stays inline, so a long
  link wraps with its text. The underline's offset and thickness scale with the text, and the line is
  never thinner than 1px.

  The new `underline` prop sets the cue: `"always"` (the default) underlines at rest in a dimmed line,
  the link's colour at 35% in a light scheme and 65% in a dark one, and draws it in the full colour
  on hover; `"hover"` underlines only on hover; and `"none"` draws no underline at rest or on hover and
  keeps the text at full opacity. `variant` takes `default`, which inherits the text colour, `foreground`, `primary`, `brand`,
  `muted` or `error`. `weight` and `truncate` stay. An SVG child marked `data-icon="inline-end"` or
  `data-icon="inline-start"`, such as an external-link icon, is drawn one `em` square in the link's
  colour, and keeps the link on one line. The entry exports the `linkVariants` recipe.

  To route through an app's router, pass its link as `render`, such as
  `<Link render={<NextLink href="/invoices" />}>`. React Router's `Link` works the same way. An
  internal `href` on a bare `Link` is a full navigation.

- 0e6e17c: `ListDetail.Detail` takes `container`, the element its Sheet renders into, as on `Sheet.Content`.
- fcbc0e0: Add `ListDetail` (`@elmeragroup/fuse/list-detail`), a list beside the detail of its open item.
  From the root's `split` width, a container query, the detail is a complementary pane beside the
  list; below it, the detail opens in a Sheet over the list. `ListDetail.Title` names the pane and
  the dialog alike, and `ListDetail.Close` renders only in the Sheet. The server renders the pane,
  which its CSS hides in a root too narrow for it, and the client follows the same container
  query. A change of layout, from the root's width, the root font size or `split`, keeps the
  detail and focus where the user was.
- df3a474: Add `LiveLineChart` to the preview chart entry, `@elmeragroup/fuse/chart`. It draws one value over a
  time window that scrolls with the clock, its right edge always now, from a feed of timestamped
  readings the app owns: `data`, an optional `value` for the latest value, and `windowMs`. The window
  moves every frame, a new reading grows out of the last one on the chart's update curve, and the
  value axis eases to fit. `Grid`, `XAxis` with round wall-clock ticks that fade at the edges,
  `YAxis`, `Area` with a gradient fill, `Line`, `LiveDot` with a ping ring, `Badge` with rolling digits,
  `Crosshair`, `Tooltip` and `Table` complete it. The plot is one tab stop whose option walks the
  window's readings, and the loop stops while the chart is out of view or its tab is hidden. Under
  reduced motion each new reading redraws the window once, at rest. `paused` holds the window while
  the readings keep arriving.
- 74242c8: `Loader` now announces itself. It renders visually hidden text inside its `role="status"` region:
  the new `label` prop, then its `aria-label`, then the locale dictionary's "Loading" (nb-NO, sv-SE,
  en-US and fi-FI). Before, the region held only a decorative icon, so screen readers announced
  nothing. Loader stays a server component; without a `label` or `aria-label` it now needs the
  `LocaleProvider` that Fuse's other localized components already read.
- e9aa0f8: `LocaleProvider` takes an optional `timeZone`, an IANA name such as `"Europe/Oslo"`, and
  `useLocale()` returns it beside the locale. Pass the zone of the market your data describes. A
  server and a browser in different zones then write the same dates, and the page hydrates without
  a mismatch. An invalid name throws a `RangeError` when the provider renders.

  `DataTable.Date`, `DataTable.DateTime` and the registered `DateCell` and `DateTimeCell` format in
  the provider's zone. A cell's own `timeZone` still wins, and without either a cell formats in the
  runtime's zone as before. Number, currency and date cells now write every space as U+00A0, because
  Node and the browser engines write different spaces for the same text, such as before the en-US day
  period, and one differing space failed hydration. A test that matches a cell's text by a plain space
  needs U+00A0 there. A date-time cell joins its date and time itself with CLDR 48's pattern in en,
  nb, sv and fi, so Node and Safari write the same `at` and `kl.` there.

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
- 059881f: `NumberField` and `Slider` take `onValueCommitted`, which reports the value once the user
  finishes a change. `onChange` still reports every change.

  - `NumberField` commits when the input blurs after typing, when a stepper press ends, and on
    each arrow, Home or End key press. It reports a number, and `NaN` for a cleared input, as
    `onChange` does. Enter does not commit.
  - `Slider` commits when a thumb drag or a track press ends, and on each key press. It reports
    the same shape as `onChange`: a number for a single value, and an array of the same length
    for a range.

- 0e49ea8: A `Text` at `size="sm"`, the default size and `size="lg"` takes its line height from three new theme
  roles, `--paragraph-leading-sm`, `--paragraph-leading-base` and `--paragraph-leading-lg`. External
  themes set the paragraph styles of the external design, 14/20, 16/22 and 18/24, so a default Text
  has 22px lines instead of 26px. Internal themes keep the relaxed 1.625 ratio, so nothing internal
  moves. The `xs`, `xl` and `2xl` sizes stay relaxed in every theme, and, because a Text's descendants
  inherit its line height, a link or child paragraph inside it follows the role too. A `leading` prop
  or a `className` leading still replaces the theme's, and a `className` size such as `text-lg` drops
  it as it dropped `leading-relaxed` before. `Span` keeps its snug default. A host that maps its own
  tokens onto Fuse roles can set the three roles directly; without them a Text keeps the relaxed line
  height. The Figma sync offers the roles in the line height picker.
- ad3f4f8: `PhoneNumberField` accepts `aria-required` and forwards it to the visible number input only. A phone number that a schema requires only in some cases can now be announced as required without the native `required` constraint. Before, the prop was not in the type and never reached the input.
- fb2d8b1: `PhoneNumberField` takes a controlled `countryCode`, paired with `onCountryChange`, so a parent can
  steer the country, including that of an empty field. A new `countryCode` acts like a picker pick: it
  clears the digits unless `preserveOnCountryChange` keeps them, and proposes the cleared number
  through `onChange`. A controlled `value` that names its country with `+` or `00` keeps it: with
  `"+46…"` and `countryCode="NO"` the field shows Sweden and `onCountryChange` proposes it. A pick or
  detected country the parent does not accept returns the field to the parent's country, and an
  uncontrolled number reports a pick's number through `onChange` only once the field shows it.
  `onCountryChange` is never called for the code the parent just set, and only once per disagreement.
  A shallow copy of the same `metadata` document, such as `{ ...metadata }` written in a render, no
  longer counts as a replacement.
- 3b12f4b: `PhoneNumberField` takes a `countries` list of the ISO codes its picker offers, so a consumer no longer trims the metadata, which also stops it parsing the numbers it leaves out. Detection selects only listed countries: a pasted number from another one stays in international form beside the selected country. Codes outside the catalog, without a flag or in the product exclusions are ignored, a list that leaves none throws, and a list that drops the selected country keeps the shown number's international identity, reading a national entry by its own country's rules (a controlled `raw` value, which names no country, reads again in the one that remains), while one that only adds or removes other countries leaves the number as entered. With one country, from the list or from the metadata, the field shows the flag and dial code as plain context, with the country's name for assistive technology, instead of a picker with a trigger, popup and tab stop. The picker trigger also drops the browser's default button border and fill, which showed where the host has no preflight reset.
- 34e1f63: `PhoneNumberField` takes a `defaultValue`, so an uncontrolled field can start from a saved number without a controlled parent. It is read on mount the way `value` is, and a native form reset restores it, read again under the current props: a field that turned on `formatOnType` in between shows the default formatted. A reset that returns to a default in another country calls `onCountryChange`; `onChange` stays silent, as before. `defaultValue=""` restores an empty number in the default country. A later `defaultValue` change leaves the shown number alone and becomes the next reset's target, and a controlled `value`, even `""`, wins over it. Without a default, reset still clears the digits and keeps the country.
- 85f449f: `PhoneNumberField` takes part in `Form` under its `name`. It shows `errors[name]` when it gets no `errorMessage`, marks the number input invalid, clears the error when the number it submits changes (an edit, or a country that changes it, but not a search in the picker), and gives `onFormSubmit` that number in its `outputFormat` under `name`, where the callback used to get the display text under `${name}-display-value`. After a submit, `Form` focuses the number input for an error it marks. Native form data is unchanged: one `name` and one `${name}-display-value` entry. The country picker no longer joins the field's label, description, error or registration: the field's description and error describe the number input alone, the picker's trigger and search no longer share an id with each other or with the number input, and in server-rendered markup the label names the input before hydration.
- 5503400: `PieChart`, `RadialChart` and `RadarChart` in the preview chart entry, `@elmeragroup/fuse/chart`,
  now draw, and the entry adds `ClockChart`. Each starts at `Root`, reads its series from `config`,
  and shares `Tooltip`, `Legend`, `LegendToggleGroup`, `Table`, `Empty`, `Skeleton`, `Headline`,
  `Takeaway`, `Glow` and `Background` with `Chart`.

  - `PieChart` draws slices or a donut from one row per category, folds the smallest past
    `maxSlices` into Other, and keeps at least one device pixel of rim for every reading above 0.
    `Labels` sit inside a slice where they fit and outside with a leader otherwise. `Center` prints
    the total, or the active slice's value and share, `CenterName` prints the active slice's name,
    `Track` fills the sweep of a gauge, and the active slice pops along its bisector.
  - `RadialChart` draws one ring per category against `max`, in solid, dotted or segmented looks, with
    a `Track` under each ring and the same `Center` parts.
  - `RadarChart` draws series as polygons over spokes, with `Grid`, `AngleAxis`, `RadiusAxis`,
    `Area`, `Line`, `Dots` and `ActiveDot`, and a radius domain that may reach below 0.
  - `ClockChart` lays a day, a week or a year round a dial from Root's `cycle` and `interval`, in the
    data's time zone, so a 23- or 25-hour day keeps equal hours. `Line`, `Area`, `Column` and `Dots`
    draw its series, stacked through config `stack`, a series coarser than Root's interval draws one
    wedge per own slot, and a threshold or scale colour paints each wedge by its own value. `Grid`,
    `AngleAxis`, `RadiusAxis`, `ReferenceLine`, `ReferenceArea`, `Scrubber`, `Now`, `Center`,
    `ActiveValue`, `Marker`, `ValueLabel` and `TooltipTotal` complete it.

  The dial labels thin by one stride for the whole dial, a ring value shows only where it clears the
  marks and the angle labels, and Now's label shows past the rim only where it clears the cycle's
  labels. Each plot is one tab stop whose option walks the slices, rings, spokes or slots: arrows
  step, Home and End jump, and on a clock PageUp and PageDown move a label unit. A drag that starts on
  a dial scrubs round it and never scrolls the page, which scrolls from beside the dial.

  A clock's `Scrubber`, a radar's hand and every `ActiveDot` turn together on one follower. It keeps
  its speed from one pointer step to the next, never carries a mark faster than the pointer moves,
  and lands a step across the dial within 300 ms. The tooltip rests beside the dial, or below it when
  neither side holds its content, and never covers the dial, its labels, its title, the legend or the
  table toggle. A popup the pointer crosses within one frame never shows, and a closing popup fades
  out from the opacity it reached.

  The entrance plays once in view over `--chart-intro` with `--chart-stagger` between items, and a
  data update tweens over `--chart-update`, labels, leaders and active dots with their marks.
  Reduced motion and print draw every mark at rest, forced colours keep each series' colour, and the
  server sends every mark, so a chart reads with JavaScript off.

- 1988b03: `Popover.Content` takes `collisionPadding` and `collisionAvoidance` and passes them to its
  positioner. `collisionPadding` sets how far the popup stays from the viewport edge, such as
  `{ top: 64 }` to clear a sticky header. `collisionAvoidance` picks whether the popup flips or shifts
  when it would cross that edge. `DatePicker.Popup` and `DateRangePicker.Popup` take the same props.
- 995b311: **Breaking:** `@elmeragroup/fuse/css` no longer defines the `--radius-popover` theme variable or its
  `rounded-popover` utility. No Fuse component read it: Fuse popups round with `rounded-md`. Use
  `rounded-md` to match them, or declare the old rung in your own `@theme inline` block, as Fuse did,
  so a nested theme's radius still reaches it:
  `--radius-popover: calc(var(--radius) - 4 * var(--radius-step, 0px));`.
- c1c82bb: Server components can render `CheckboxItem` and `RadioItem` with their `Title`, `Description`, `Content`, `Actions` and `SubSection` parts, and a `SubSection` stays outside the row label when the server renders the row. `SelectionItem.Shell` accepts an optional `subSections` prop for bands partitioned by the caller.
- 656a3a1: Add `ScatterChart` to the preview chart entry, `@elmeragroup/fuse/chart`. It plots a number against
  a number from long rows: `xKey` and `yKey` name a row's two number columns, and `seriesKey` names
  the column that says which config series the point belongs to. `Points` draws a series as dots in
  named sizes and a `quiet` look, and `Line` joins a series' points in x order, so the same chart
  draws curves over an unevenly spaced numeric x. `Grid`, `XAxis`, `YAxis`, `ReferenceLine`,
  `ActiveDot`, `Tooltip`, `Legend`, `Table`, `Empty` and `Skeleton` complete it. The plot is one tab
  stop whose option walks every point by x, and the pointer finds the nearest point. Each series draws
  as one SVG path, so 100,000 points draw and update in about a tenth of a second.
- 8d5ee51: `Dialog.Content`, `AlertDialog.Content`, `Sheet.Content`, `Dialog.Overlay` and `Sheet.Overlay` take
  `backdropBlur`, which defaults to `true`. Set it to `false` for an overlay portaled into a
  transformed scope, such as a zoomable canvas or an artboard. There the scrim's blur samples shifted
  content, and the blurred copy no longer lines up with the page. The scrim keeps its tint either
  way.
- 823a7d9: Adds `ScrollArea.Viewport`, the viewport of `ScrollArea.Root` as a part, for an area composed from
  Base UI's `ScrollArea` parts. Tabbing into such an area now shows the same 2px focus outline as
  `ScrollArea.Root`, just inside the area's edge, including in forced-colors mode. A visible
  scrollbar thumb covers the outline where the thumb sits. With Base UI's own viewport, such an area
  shows only the browser's default outline. The two-axis scrolling example uses the new part.

  `Attachment.Group` draws the same outline inside its own edge. Its ring used to sit outside the
  group, so a parent that clips, such as one with `overflow: hidden`, cut it off.

- ed5220a: `SearchField` is a permanent component at `@elmeragroup/fuse/search-field`, also in the root
  barrel, built on Fuse's `Field` and `InputGroup`. It registers as a Base UI
  Field, so inside a `Form` it submits its value under its `name`, shows the `Form` error under that
  name, clears it on an edit or a clear, and takes focus when a submit returns an error for it. It
  renders an `<input type="search">` with a leading magnifying glass and a clear button, and its root
  carries `data-empty` while the value is empty.

  It takes `value`, `defaultValue`, `onChange(value)`, `onSubmit(value)`, `onClear`, `clearLabel`,
  `size`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired` and a node `errorMessage`. A plain
  Enter calls `onSubmit`. With `onSubmit` set, a held Enter's repeats and an Enter with a modifier
  also stop the form's submit without calling it. Escape empties a field that holds text and stops
  there, so a `Dialog` or `Sheet` around it stays open. The magnifying glass and the clear button sit
  in the field box's addons, as the `Combobox` clear button does, and the clear button's icon takes
  the addon's muted colour. `className` is a string merged onto the root, which fills its container's
  width. Native attributes such as `autoComplete` and `enterKeyHint`, and `style`, `data-*` and the
  other DOM attributes, reach the `<input>`, as on `TextField`. The field reads its locale from
  `LocaleProvider`.

- 75ddfd9: `SelectField` takes `isReadOnly`, which forwards `readOnly` to `Select.Root`. The trigger stays
  focusable and its popup still opens to show the options, but choosing one keeps the value, and the
  value still submits under `name`.

  `Select.Trigger` now takes the muted read-only fill (`bg-muted`) the other field boxes take while
  its `Select.Root` is `readOnly`. A disabled read-only trigger keeps its disabled face.

- 3176da7: Add `SelectField` (`@elmeragroup/fuse/select-field`), a labeled select laid out like `TextField`:
  the label, the trigger filling the field's width, then the error ahead of the description. It takes
  `label`, `description`, `errorMessage`, `isInvalid`, `isRequired`, `isDisabled`, `name` and
  `placeholder`, `Select.Root`'s `value`, `defaultValue`, `onValueChange` and `items`, and options as
  `Select.Item` children. Inside a `Form` it shows the error under its `name` until the selection
  changes. A `ref` and the remaining props go to the trigger. It takes one selection; compose
  `Field.Root` and the `Select` parts for multiple selection or a custom layout.
- a11e013: `Select.Content`: the list scrolls inside the popup now, where Base UI reads the scroll position.
  A long list in a popup that opens beside the trigger shows its scroll arrows, and hovering one
  scrolls the list. That covers `alignItemWithTrigger={false}` and the default whenever Base UI
  falls back from aligning, such as when the popup does not fit over the trigger. Before, that popup
  scrolled itself and its arrows never appeared. The arrows appear when a mouse or the keyboard opens
  the popup. On touch input, Base UI hides them, and the list scrolls natively.

  The arrows `Select.Content` renders now sit inside the list, so a wheel gesture over an arrow
  scrolls the list. The list also keeps scroll padding the height of an arrow, 24px, so the option
  the keyboard highlights stays clear of the arrow at either end. Before, in a popup aligned with the
  trigger, arrowing down a long list moved the highlighted option under the down arrow.

  **Breaking:** an `onScroll` or `onScrollEnd` on the element passed to `Select.Content`'s `render`
  no longer fires, because the popup no longer scrolls. Pass the listener to `Select.Content`'s
  `onScroll` or `onScrollEnd`, which fire when the list scrolls and when it stops. Their
  `event.currentTarget` is now the list, where it was the popup. `onScrollEnd` forwards the native
  `scrollend` event, which Chrome fires from 114 and Safari from 26.2, so it does not fire in
  Chrome 111 to 113 or Safari 16.4 to 26.1.

- bd7e2cf: A `RadioItem` or `CheckboxItem` row draws its 1px edge in a new theme role, `--selection-border`,
  and the line between the stacked rows of a vertical group in two more, `--selection-divider` and,
  above and below a checked row, `--selection-checked-divider`. Internal themes alias them to
  `--border` and the checked row's `--primary` edge, so they look as before. External themes draw no
  outer edge: `--selection-border` is a zero-alpha colour, `oklch(0 0 0 / 0)`, and a checked row
  keeps it, so the control alone shows the state. Stacked rows keep a grey `--border` separator
  between them, checked or not. Before, every external row was outlined in the grey `--border`. The
  border keeps its width, so rows join and inset as before. On a `--card`-coloured surface an external
  row now has no outline. `Item` outlines and `CheckboxCard` keep `--border`. A host that maps its own
  tokens onto Fuse roles can set the roles directly; without them the row and its dividers fall back
  to `--border`, and a checked row to `--primary`.
- 7910d20: A checked `RadioItem` or `CheckboxItem` row draws its border in a new theme role,
  `--selection-checked-border`. Internal themes keep the `--primary` edge. External themes set it to
  `var(--selection-border)`, so a checked row keeps its resting edge and the control alone shows the
  selection, as the external radio card does. Before, every theme outlined the checked row in
  `--primary`. A host that maps its own tokens onto Fuse roles can set the role directly; without
  it the row falls back to `--primary`.
- c3d38e9: A disabled `RadioItem` or `CheckboxItem` row fills with a new theme role,
  `--selection-disabled-background`, under a 45° hatch striped in a second,
  `--selection-disabled-hatch`, and its title and other label row text take a third,
  `--selection-disabled-foreground`. Internal themes keep `var(--muted)`, black stripes at 2% alpha
  and `var(--foreground)` text, so an internal row disabled itself looks as before. External themes
  keep the card fill of an enabled row, `var(--card)`, draw no stripes and grey the title to
  `var(--muted-foreground)`, so a disabled row is no longer a grey striped panel among white rows. A
  description keeps its own muted text, a `SubSection` keeps its colours, and the control keeps its
  50% face. The disabled fill replaces a checked row's `bg-muted` tint and leaves its border, and it
  wins over a background class such as `bg-background` on the row, which used to replace it; set
  `--selection-disabled-background` to change it. A row in a disabled `RadioItemGroup` or
  `CheckboxItemGroup`, or one whose own control is disabled, now shows the same look; before, only
  its control dimmed. A host that maps its own tokens onto Fuse roles can set the three roles;
  without them the row falls back to `--muted`, the 2% black stripes and `--foreground`.
- 96b76d8: `CheckboxItem`, `RadioItem` and `SelectionItem.Shell` rows now follow density. The label metrics,
  `--label-text` and `--label-leading`, set the row's type: 14/20px dense, as
  before, and 16/24px comfortable, the external default. `SelectionItem.Title` and
  `SelectionItem.Description` take the size and keep their own line heights, and plain text in
  `SelectionItem.Actions` or a `SelectionItem.SubSection` takes both. The control now centres on the
  title's first line at either density, which moves it by up to 1.4px in a dense row. `Item` keeps
  `text-sm`. The Figma sync exports the pair as two more `Fuse density` variables.
- 791b194: `CheckboxItem` and `RadioItem` now forward root attributes such as `id`, `style`, `data-testid`,
  other `data-*` attributes, ARIA attributes and event handlers to the row's `Field.Item` root,
  the element that carries `data-slot="checkbox-item"` or `"radio-item"`. Before, the row dropped
  them, so a test or an analytics hook had to rebuild the row from `SelectionItem.Shell`.
  `getByTestId("plan-fixed").getByRole("checkbox")` now reaches a row's control. The row keeps
  its own `data-slot` and wiring, and `isDisabled` stays the one way to disable it.
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
- a027e05: `Sidebar.Provider` takes a `bounds` prop, so a Sidebar can live in a box on the page, such as an
  embedded app pane or a demo. The default, `bounds="page"`, keeps today's behaviour. With
  `bounds="container"` the Provider fills its container's height instead of at least the
  viewport's, and the desktop rail sits in the container, as tall as it, instead of fixed to the
  viewport. The container clips the collapsed offcanvas rail at its edge. The Provider writes no
  `sidebar:state` cookie, so pass `open` and `onOpenChange` to keep the state yourself. ⌘B, or
  Ctrl+B, toggles it only from a keydown inside the Provider, and a page Sidebar around it keeps
  the shortcut everywhere else. The mobile Sheet still switches on the viewport's width. The new
  `SidebarBounds` type names the prop's values.

  Before, a Sidebar in a box needed `transform` or `contain: paint` on the box to hold the fixed
  rail, `h-full` on `Sidebar.Root`, and a capture-phase listener to stop ⌘B from toggling it
  anywhere on the page, and it wrote the page's cookie even when controlled.

- dbacc64: `Sidebar.Provider` takes `openMobile` and `onOpenMobileChange`, so a host can hold the phone Sheet's
  open state and close it from outside, such as after a navigation. The Trigger, ⌘B, the Sheet's own
  dismissal, `useSidebar().setOpenMobile` and `toggleSidebar` report a request through
  `onOpenMobileChange` and leave the Sheet as the host's `openMobile` says. Like the desktop `open`,
  the setter still takes a boolean or an updater. Without the props the Sheet keeps its state inside,
  as before. Before, the phone Sheet's state was private to the Provider.
- 05ef2d0: `Sidebar.Inset` takes a `render` prop. It still renders a `<main>` by default; a layout that
  already has its own `<main>` passes `render={<div />}` and keeps the inset's slot and look,
  including the inset card beside an `inset` Sidebar. Before, it always rendered a `<main>`.
- b49d98d: `SkeletonReveal` (`@elmeragroup/fuse/skeleton`) draws a loading skeleton from the real content
  instead of hand-placed `Skeleton` shapes. Pass `data`, an optional `sample` and a render function,
  or plain children with `loading`. While loading, the content renders unseen with the data on screen,
  the last data shown or the sample, and the skeleton draws a bar over each line of its text and a
  block over each control, avatar, badge or image, in exactly the content's space. `reveal` picks how
  the content replaces the skeleton: `smart` (the default), `together` or `sequence`. The reveal eases
  to the content's height when it differs from the skeleton's, except under reduced motion. The root
  is `aria-busy` while loading and reads `label`, by default the locale dictionary's "Loading", to
  screen readers. Form controls in the skeleton, and in content on its way out, are neither submitted
  nor validated with their form, and Fuse overlays in them open nothing. Mark consumer markup with
  `data-skeleton="block"` or `data-skeleton="ignore"` to draw it as one block or leave it out.
  `Skeleton` is unchanged.
- 42f5d68: Add `Slider`, a labeled range control built on Base UI. Import it from
  `@elmeragroup/fuse/slider`. It takes NumberField's field props (`label`, `description`,
  `errorMessage`, `isInvalid`, `isDisabled`, `minValue`, `maxValue`, `step`, `formatOptions`),
  plus `largeStep`, `orientation` and `showValue`. An array of two or more numbers renders one
  thumb per entry, and `onChange` reports an array of the same length. A vertical slider fills
  its parent's height. Range thumbs take localized "minimum" and "maximum" names, which
  `thumbLabels` overrides. A native form reset returns an uncontrolled slider to its
  `defaultValue`.
- 29c7f21: `SparklineHover`, a new client component in `@elmeragroup/fuse/chart`, wraps one or more
  `Sparkline`s and makes their hover glide instead of cross-fade. Once it hydrates, one dashed
  crosshair, one dot and, on a line or an area, one band that re-strokes the line move from value to
  value on the spring a chart's crosshair follows, which quickens with the pointer and picks up from
  wherever the marks show mid-glide. A hovered bar still lifts at once. Under
  `prefers-reduced-motion` the marks move at once, and turning it on ends a glide that is running.
  New data or a pointer that already rests on a value as the wrapper hydrates places the marks at
  once on the hovered value, and the marks glide in shares of the box, so a resize keeps them on it.
  A Sparkline inside nested wrappers follows the nearest one, and keeps its CSS hover until that one
  hydrates. A Sparkline with `data-hover="none"` has no hover to move, and the wrapper leaves it be.

  A server component can render it around server-rendered Sparklines: it reads each value's place
  from their markup, so the data never crosses to the client as props. Before it hydrates, or with no
  script, the Sparklines keep their CSS hover, and a Sparkline outside a `SparklineHover` still ships
  no client JavaScript. Each Sparkline with hover now writes one hidden set of glide marks beside its
  hover regions for `SparklineHover` to move, and the wrapper marks that group, never the svg, so
  hydration still checks the svg's own attributes, its accessible name included.

- 0858d1a: `Sparkline` gains motion, hover and finer marks, still with no client JavaScript. With motion
  allowed, a line or an area wipes in from the left as the svg enters the document and bars grow
  from the baseline; under `prefers-reduced-motion` nothing moves. Re-inserting the element, as a
  keyed reorder or a re-shown panel does, replays the entrance, and the new `data-intro="none"`
  turns it off. On a device that hovers, the pointer over a value
  shows a dashed crosshair and a dot there, fades the rest of the series and re-strokes the line
  around the value, or lifts its bar, all in CSS. Hover adds no tab stop and nothing to the
  accessible name.

  The marks cross-fade as the pointer moves from one value to the next, and a Sparkline of any
  length draws every value and its hover on the server. Hover adds about 660 bytes of uncompressed
  SVG markup per value to a line and about 450 to bars, so the new `data-hover="none"` leaves it out
  where many Sparklines render at once, such as one per row of a long table.

  An area now strokes its top edge and fades its fill from 0.3 at its values to nothing at 0, up for
  negative values, where the engine masks SVG elements; WebKit keeps the flat 0.3 fill. A bar rounds the corners of its far end by
  `--chart-bar-radius`, which a Sparkline takes from the identity's `--radius-xs` up to 2 px, below
  the baseline for a negative value. Bars now place by percentages of the box rather than a stretched
  viewBox, and the zero and reference lines and the emphasis dot by percentages in every variant.

- 6335204: A chart's cut-outs now paint the fill of the host it rests on instead of the page colour. The new
  `--surface` custom property is the colour of the opaque fill an element sits on. Card,
  `Frame.Panel`, the cells of a Table in a Frame, the default Alert, the bordered `VerticalTable` box, the outline Item, the muted CheckboxCard, the read-only card TextField, the card Accordion, Calendar,
  Dialog, AlertDialog, Sheet, Popover and the other anchored popups state their fill as `--surface`. Dot rings and halos, ring-dot
  holes, pie and ghost seams, isometric bar faces, reference-label halos, hollow legend swatches and
  the polar radius, Now and value chips read `var(--surface, var(--background))`, so a chart in a
  Card in a dark theme, or in a branded light theme, no longer shows rings in the page colour. Charts
  on the page look as before. Beside `--surface`, each host states `--surface-muted-foreground`, the
  muted text paired with its fill: the warning and info Alerts their soft foreground, every other host
  `--muted-foreground`. The polar radius values, the Now label and the reference lines and labels in
  the default and muted tones read it, so they keep 4.5:1 on the chip or halo they sit on, also in a
  warning or info Alert. A muted Now label keeps the full muted text, as a muted reference label
  does, and only the hand fades. The frosted chart tooltip's translucent fill keeps the surface beneath it. To put a chart on another opaque fill, set both beside it, as in
  `className="bg-muted [--surface:var(--muted)] [--surface-muted-foreground:var(--muted-foreground)]"`;
  `ChartStyle` types them for a `style`.

  The new `panel` role pair, `--panel` and `--panel-foreground` with the `bg-panel` and
  `text-panel-foreground` utilities, is `card` in light themes and `background` in dark ones.
  `Frame.Panel`, the cells of a Table in a Frame, the bordered `VerticalTable` box, the default
  Alert and the outline Item fill with it, so in light themes they are white like a Card, also where a branded page is
  tinted. Dark themes look as before.

  Text travels with each of these fills: a hovered or selected Table row and a hovered outline link
  Item set their text in `foreground` on the `muted` hover fill, a checked selection row in
  `foreground`, and a disabled one, its SubSection included, in `--selection-disabled-foreground`.
  A checked selection row states its `muted` fill as `--surface`, a disabled one its disabled fill,
  and a hovered outline link Item its `muted` hover.
  A text colour class on the part, such as `className="text-error"`, wins in every state.

- 97daa21: Adds `Calendar` from `@elmeragroup/fuse/calendar` and the root entry: a calendar built from parts
  whose values are `Temporal.PlainDate`s.

  ```tsx
  import { Calendar } from "@elmeragroup/fuse/calendar";

  <Calendar.Root
    aria-label="Delivery date"
    defaultValue={Temporal.PlainDate.from("2026-10-14")}
    visibleMonths={2}>
    <Calendar.Header>
      <Calendar.DecrementMonth />
      <Calendar.VisibleRangeHeading />
      <Calendar.IncrementMonth />
    </Calendar.Header>
    <Calendar.Months />
  </Calendar.Root>;
  ```

  - Date props take a `Temporal.PlainDate` object from any implementation, never its ISO text.
    A value is built in a client component: React passes a Temporal object from a server component
    to a client one as its ISO text, and every date prop refuses a string with a `TypeError` that
    names the component, the prop and the fix. `onValueChange` hands back this runtime's
    `PlainDate`. Import `@elmeragroup/fuse/temporal-polyfill` once where the engine lacks Temporal.
  - Fuse's declarations, the root entry's included, name the global `Temporal` types, which come
    from TypeScript's own lib: type-checking a consumer needs TypeScript 6.0 or later with a `lib`
    that includes `esnext` (or `esnext.temporal`). With an older compiler or lib, Fuse's
    declarations report "Cannot find namespace 'Temporal'", or, under `skipLibCheck`, the date props
    are typed `any`.
  - `visibleMonths` shows several months; `pageBehavior` pages them by every visible month or by one.
    Focus moves between the months' grids without paging.
  - `minValue` and `maxValue` take any Temporal date kind; `isDateUnavailable` refuses days the user
    can still focus. Day names, the bound suffixes and the month buttons' names match React Aria's in
    the four locales.
  - `onValueChange` and `onVisibleRangeChange` pass details with a `reason` and `cancel()`, which keeps
    the value or the months unchanged. `onValueChange`'s
    `getValidationError()` names a failure in `ValidityState`'s words, as the other date
    components do: `"rangeUnderflow"`, `"rangeOverflow"` or `"unavailable"`.
  - Today is read in an effect and moves at midnight, so a server render marks no today and the
    calendar prerenders. A server component renders the parts without a date value.
  - `fuse/css`'s shared `data-selected:` variant now matches a present `data-selected` that is not
    `"false"`, as `data-checked:` and `data-active:` do, rather than only `data-selected="true"`.
    The calendar's days write the bare attribute. A Tailwind-source consumer's own `data-selected:`
    utilities now also match an element with a bare `data-selected` or `data-selected=""`, the form
    Base UI's parts and Fuse's chart write, where they matched nothing before.

- 8cf4736: Adds `DateField` and the `DateInput` parts from `@elmeragroup/fuse/date-field` and the root entry:
  a segmented input for a date, a date and time, or a date and time in a zone, whose values are
  Temporal values.

  ```tsx
  import { DateField } from "@elmeragroup/fuse/date-field";

  <DateField label="Moving date" name="moving" defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
  <DateField label="Outage starts" granularity="minute" hourCycle={24} timeZone="Europe/Oslo" />;
  ```

  - `DateField` takes React Aria's prop names (`label`, `description`, `errorMessage`, `isInvalid`,
    `isDisabled`, `isReadOnly`, `isRequired`, `value`, `defaultValue`, `onChange`, `minValue`,
    `maxValue`, `isDateUnavailable`, `granularity`, `hourCycle`, `hideTimeZone`, `size`,
    `shouldForceLeadingZeros`), and adds `timeZone`, the zone an empty field's `ZonedDateTime` takes.
    Values are `Temporal.PlainDate`, `PlainDateTime` or `ZonedDateTime` objects from any
    implementation, never their ISO text; `onChange` hands back this runtime's value of the field's
    kind, which an emptied field keeps. A value is built in a client component, as for `Calendar`.
    The field holds no state, so a server component renders it without a date value.
  - The kind is typed without a type argument: a `value` or `defaultValue` names what `onChange` and
    `isDateUnavailable` receive, and without either `granularity` and `timeZone` do, as at runtime.
    No granularity or `"day"` gives a `PlainDate`, a time `granularity` a `PlainDateTime`, and a time
    `granularity` with `timeZone` a `ZonedDateTime`, so the second field above reports
    `Temporal.ZonedDateTime | null`. A `granularity` or `timeZone` whose type is a union gives the
    union of the kinds it could make.
  - Segments follow the locale's order and React Aria's editing rules: typed digits fill a segment
    and move on, the arrows step and wrap it (a zoned hour through the real hours of a DST night),
    Page Up and Page Down by a page, Home and End to its ends, Backspace removes a digit, and the day
    period takes its first letter. A key held with Ctrl, Cmd or Alt is left to the browser. A value
    commits once every segment is filled; February 30 waits for blur and commits as the month's
    last day.
  - `minValue` and `maxValue` take any kind, compared as React Aria compares them, and a failing
    value reports React Aria's words ("Value must be 10/31/2026 or earlier.", "Selected date
    unavailable.") in the `LocaleProvider`'s locale. A half-typed or empty required field reports
    itself too.
  - Inside `Form`, or a `Field.Root` of your own around `DateInput.Root`, the field is a Field: its
    ISO text reaches `onFormSubmit` and `FormData` under its `name`, its validity blocks a submit,
    and the form focuses its first segment for an error, a returned one included.
  - `DateInput.Root` and `DateInput.Segment` are the parts, with Base UI's names (`value`,
    `onValueChange`, `disabled`, `readOnly`, `required`, `invalid`, `render`). `onValueChange` passes
    details with a `reason` (`"input-change"`, `"input-clear"`, `"input-paste"`),
    `getValidationError()`, which names a failure in Calendar's words (`"rangeUnderflow"`,
    `"rangeOverflow"`, `"unavailable"`), and `cancel()`. Its children
    receive each segment as `DateInputSegmentData`, a literal, the zone's name or a unit:
    `isEditable` narrows `type` to a unit, and `type` tells the other two apart.
  - Segments are spinbuttons named by their unit and the label ("month, Moving date"), textboxes on
    iOS, with the numeric keyboard and a Next key, and the field handles Android's composition input.

- 8ee349e: Adds `DatePickerField` and the `DatePicker` parts from `@elmeragroup/fuse/date-picker`, and
  `DateRangePickerField` and the `DateRangePicker` parts from `@elmeragroup/fuse/date-range-picker`,
  both in the root entry: a date field with a calendar popup, and start and end fields with a range
  calendar popup, whose values are Temporal values.

  ```tsx
  import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";
  import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

  <DatePickerField label="Moving date" name="moving" defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
  <DateRangePickerField
    label="Maintenance window"
    startName="from"
    endName="to"
    granularity="minute"
    hourCycle={24}
    hideTimeZone
    timeZone="Europe/Oslo"
    visibleMonths={2}
  />;
  ```

  - The composites take React Aria's prop names (`label`, `description`, `errorMessage`, `isInvalid`,
    `isDisabled`, `isReadOnly`, `isRequired`, `value`, `defaultValue`, `onChange`, `minValue`,
    `maxValue`, `isDateUnavailable`, `granularity`, `hourCycle`, `hideTimeZone`, `firstDayOfWeek`,
    `presetGroup`, `triggerPlacement`, `startName`, `endName`, `size`, `isOpen`, `defaultOpen`,
    `onOpenChange`, `onBlur`, `aria-label`), and add `timeZone` and `visibleMonths`. Values are
    Temporal objects from any implementation, never their ISO text, built in a client component, as
    for `Calendar`. The composites hold no state, so a server component renders them without a date
    value.
  - The value kind is typed as `DateField`'s, with no type argument: a `value` or `defaultValue`
    names it, and without either `granularity` and `timeZone` do, so the range picker above reports
    ranges of `Temporal.ZonedDateTime`.
  - The trigger and the popup `dialog` are named "Calendar" and the label, as React Aria names them.
    Opening moves focus to the selected day, or today, and closing returns it; Alt+ArrowDown in the
    field opens the popup. Picking a day keeps the value's time and zone, and until a value names its kind,
    an empty picker follows `granularity` and `timeZone`, typed and picked alike. Escape in a range calendar
    drops a half-picked range first and closes the popup on the next press.
  - Each end of a range picker is a Field of its own under `startName` and `endName`, so a `Form`
    submits both ISO values and focuses the end whose error it returns; the label, the description
    and one merged error describe both. An end typed before its start, or a start typed past its
    end, reports "Start date must be before end date." on the end. A whole range that loses an end
    reports `null`, as React Aria does, and the other end stays in its input.
  - A disabled `Field.Root` or `Field.Set` around a picker disables it whole (trigger, calendar,
    presets), in server output too.
  - Presets: `DatePicker.Presets` and `DatePicker.PresetItem` (`DateRangePicker.Presets`,
    `.PresetItem`) are native radios inside their labels, with a controlled `value`, `disabled` items
    and `closeOnDoubleClick`. `onValueChange` passes the key and cancelable details
    (`reason: "preset-press"`).
  - The parts use Base UI's names (`value`, `onValueChange`, `open`, `onOpenChange`, `disabled`,
    `readOnly`, `required`, `invalid`, `render`). `onValueChange` and `onOpenChange` pass details
    with a `reason` (`"day-press"`, `"keyboard"`, `"input-change"`, … and Base UI Popover's
    `"trigger-press"`, `"escape-key"`, `"outside-press"`, plus `"preset-press"`) and `cancel()`;

- ca46084: The date components gain:

  - `DatePicker.TimeInput`, `DateRangePicker.StartTimeInput` and `DateRangePicker.EndTimeInput` edit
    the value's time in the popup under the calendar, and `DatePickerField` and `DateRangePickerField`
    show them for a time `granularity`. A day picked with `shouldCloseOnSelect={false}` in an empty
    picker commits at the time typed there, rather than at midnight.
  - A day picked in `DatePicker` or `DateRangePicker` over a value with a time moves the time as
    React Aria does: a wall time the zone repeats on the picked day, such as 02:30 on the night the
    clocks go back, takes the earlier instant, as a typed time does, rather than keeping the value's
    offset. A day picked again keeps its value as it is.
  - A preset's `dateValue` (`DatePicker.PresetItem`) sets the picker's value through `onValueChange`
    with the reason `"preset-press"`.
  - Typing a `DateRangePicker` start's last segment moves on to the end's first; Backspace and the
    arrow keys cross back.
  - A granularity change that removes the focused segment moves focus to the segment before it.
  - An empty zoned field names its zone as it is today, read once mounted.
  - Paste takes text in the field's own format, such as `10/05/2026` in en-US, beside ISO text.
  - A `Calendar` with neither `value` nor `defaultValue` renders its months' frame on the server and
    while hydrating, instead of no months.

- fe93e1b: Adds the opt-in `@elmeragroup/fuse/temporal-polyfill` subpath for the coming Temporal-based date
  components. Import it bare, once in each runtime that renders, before any of them runs:

  ```ts
  import "@elmeragroup/fuse/temporal-polyfill";
  ```

  It installs `temporal-polyfill` 1.0.8, now a pinned dependency, on `globalThis` only where no
  `Temporal` exists, and leaves an engine's own Temporal in place. Where it installs, it also replaces
  `Intl.DateTimeFormat` with the polyfill's. The root `@elmeragroup/fuse` entry never imports it.
  Fuse's Temporal code warns once in development in every engine when the subpath was not imported,
  and throws a `TypeError` that names the subpath in an engine without Temporal.

- 9ad3a8a: Adds `RangeCalendar` from `@elmeragroup/fuse/range-calendar` and the root entry: a calendar that
  selects a range of days, on `Calendar`'s parts, whose values are `Temporal.PlainDate`s.

  ```tsx
  import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

  <RangeCalendar.Root
    aria-label="Stay"
    defaultValue={{
      start: Temporal.PlainDate.from("2026-10-12"),
      end: Temporal.PlainDate.from("2026-10-16"),
    }}>
    <RangeCalendar.Header>
      <RangeCalendar.DecrementMonth />
      <RangeCalendar.VisibleRangeHeading />
      <RangeCalendar.IncrementMonth />
    </RangeCalendar.Header>
    <RangeCalendar.Months />
  </RangeCalendar.Root>;
  ```

  - The value is `{ start, end }`; each end takes a `Temporal.PlainDate` object from any
    implementation, as `Calendar`'s date props do, and `onValueChange` hands back this runtime's
    `PlainDate`s, earlier day first.
  - The first day pressed anchors the range, which then follows the hovered or focused day across
    every visible month until a second day completes it. Enter or Space anchors and moves focus on a
    day, Escape drops the anchor, and focus leaving the calendar or a press released outside it
    completes the range (`commitBehavior="select"`) or drops it (`"reset"`), as React Aria does. A
    touch that scrolls the page leaves the range open.
  - `isDateUnavailable` receives the anchored day, and an anchored range reaches only the available
    days around its anchor, looked for up to `visibleMonths` months each way, as in React Aria. A
    longer range can span an unavailable day further out; check it in `onValueChange`.
  - The range ends' names start with the whole range ("Selected Range: Monday, October 12 to Friday,
    October 16, 2026"), and the focused day describes what selecting it does, as React Aria's do in the
    four locales.
  - Its grids are `aria-multiselectable`. A range left open when the calendar turns read-only or
    disabled is dropped, never completed.
  - `onValueChange` passes details with a `reason` (`"day-press"`, `"keyboard"`, `"outside-press"`,
    `"focus-out"`) and `cancel()`. `getValidationError()` names a
    failing range in `ValidityState`'s words, as `Calendar` does: `"rangeUnderflow"`,
    `"rangeOverflow"` or `"unavailable"`.

  `Calendar.DayGridCell` now also writes its day's selection data attributes, bare and present only
  while they hold (`data-selected`, `data-in-range`, `data-selection-start`, `data-selection-end`,
  `data-highlighted`, `data-invalid`), as the day button does, so a range's band can be painted
  across the cells. In forced colors, `Calendar`'s selected day and a range's ends take the system's
  `Highlight`.

- 59f38a5: `TextField variant="card"` now stretches the input across the card. Before, the input kept its
  intrinsic width, so a long value scrolled inside a box narrower than the card and the
  description sat mid-row instead of at its end. The description now ends the row and takes at
  most half of it, so a long one wraps instead of squeezing the input. `textFieldVariants` gains an
  `inputContainer` slot for the input's wrapper, which fills the row under the card variant.
- 09cf8f7: `TextareaField` now merges `className` onto the field root, like `TextField`, `NumberField` and `PhoneNumberField`. Move classes meant for the textarea itself to the new `textareaClassName` prop.
- d7273e4: The theme's audience axis is now its **identity**, and a document always names its density.
  External customer dashboards can now take the brand look at dense density, and a promo page in
  the same app stays comfortable.

  **Identity replaces variant.** `ThemeInput.variant` is now `identity`, with `internal` renamed
  `neutral` and `external` renamed `branded`. The rename covers the attribute, the slugs and the
  exports, with no aliases for the old names:

  | Before                               | After                               |
  | ------------------------------------ | ----------------------------------- |
  | `{ variant: "internal", … }`         | `{ identity: "neutral", … }`        |
  | `{ variant: "external", … }`         | `{ identity: "branded", … }`        |
  | `data-theme-variant="internal"`      | `data-theme-identity="neutral"`     |
  | `data-theme-variant="external"`      | `data-theme-identity="branded"`     |
  | `internal-fkas-private` (theme slug) | `neutral-fkas-private`              |
  | `external-fkas-private` (theme slug) | `branded-fkas-private`              |
  | `ThemeVariant`, `THEME_VARIANTS`     | `ThemeIdentity`, `THEME_IDENTITIES` |

  Migrate host CSS that selects on the old attribute, such as a font rule for branded Fjordkraft
  headings:

  ```css
  /* Before */
  [data-theme-variant="external"][data-theme-brand="fkas"] {
    --font-heading: var(--font-neo-sans), var(--font-sans);
  }

  /* After */
  [data-theme-identity="branded"][data-theme-brand="fkas"] {
    --font-heading: var(--font-neo-sans), var(--font-sans);
  }
  ```

  Stored or URL slugs that start with `internal-` or `external-` no longer parse: `parseThemeSlug`
  returns `null` for them, so map them to `neutral-` and `branded-` when you read them.

  **Density is explicit.** `defaultDensityForVariant` is gone: no identity implies a density. Stamp
  the document root with the new `documentAttributes({ theme, density })`, which returns the
  `data-theme-*` attributes and `data-density` together, and pass the density the page needs.
  `densityAttributes(density)` stays for stamping density alone.

  ```tsx
  // Before
  <html {...themeAttributes(THEME)} {...densityAttributes(defaultDensityForVariant(THEME.variant))}>

  // After: what the old default gave, spelled out
  <html {...documentAttributes({ theme: THEME, density: "comfortable" })}>
  ```

  The old default was `dense` for internal themes and `comfortable` for external ones, so pass those
  to keep today's look. Density is per document, so an app with dense dashboards and comfortable
  promo pages gives each group of routes its own root layout. ThemeProvider and ThemeScope still
  never write density.

  **Branded dense buttons pad their labels at 12px.** A branded button rounds with the brand's
  button radius, often a pill. At dense density its label edges now take at least 12px of inline
  padding, so the label clears the curve. Icon edges, square icon buttons and ButtonGroup members keep
  their inset, as do the Fuse parts that render a Button with a corner of their own: DataTableFilter
  segments and header operator, and date-picker presets. Nothing changes for
  neutral themes or at comfortable density, where the padding is already 12px or more. This is the
  only visual change.

  **Corners no longer change in dark.** The radius roles, `--radius`, `--radius-button`,
  `--radius-field` and `--radius-step`, are emitted in their own light-only rules, one per identity
  and brand, and no dark rule restates them. The values are unchanged. A host `--radius` override on
  the theme element now holds in dark as well as in light, where a dark rule used to outweigh an
  override at the light rule's weight.

  **Theme catalog.** A `ResolvedTheme` no longer has `defaultDensity`, and its `attributes` carry no
  `data-density`.

  **Figma.** The sync renames the `Fuse variant` collection to `Fuse identity`, and its `Internal`
  and `External` modes to `Neutral` and `Branded`, in place, so frames keep their mode pins. The
  `Auto` mode of `Fuse density` is removed, since no identity implies a density. A frame that used
  `Auto` falls back to the collection's default mode, `Dense`, so repin branded frames that should
  stay comfortable to `Comfortable`. The kit draws Button labels at the density inset and not the
  branded dense 12px floor.

- fc85c72: Add the curated `SlidersHorizontal` icon for settings menu triggers.
- a74ac05: `TimelineList` composes each event from parts, and gains layouts, sizes and statuses.

  - A `TimelineList.Item` now holds its parts in this order: an optional `TimelineList.Opposite`,
    a `TimelineList.Indicator` and a `TimelineList.Content`, which holds the `Title`, `Time` and
    `Description`.
    - `TimelineList.Indicator` draws the rail: the line in and out and the lane between. Without
      children it shows the default `TimelineList.Mark`; with `null` it shows no mark and the line
      runs on to the text; with a node, such as an `Avatar`, it shows that node in the lane. Size
      the node to the lane; a default `Avatar` needs `lg`. It is decorative and hidden from
      assistive technology unless it gets `aria-hidden={false}`.
    - `TimelineList.Mark` without children draws the Item's status. With children, such as an icon,
      it fills the lane in the status's colors, or on a muted fill without a status.
    - `TimelineList.Opposite` holds content across the rail from the body, such as a
      `TimelineList.Time`. An empty Opposite takes no room.
  - `TimelineList.Root` takes `layout`: `vertical`, the default; `alternate`, with the body and the
    opposite content on either side of the rail, folding to one side under 32rem; and `horizontal`,
    which runs along the inline axis. Wrap a horizontal list in `ScrollArea.Root` with
    `orientation="horizontal"` so it scrolls when it is wider than its parent.
  - `TimelineList.Root` takes `spacing="compact"` for less space between Items, and `indicatorSize`
    of `dot`, the default, `md` or `lg`, a 24px or 32px lane that every Item shares.
  - `TimelineList.Item` takes `status`: `complete`, `current`, `upcoming` or `error`, each with its
    own mark. At `md` and `lg` the complete mark carries a check and the error mark a cross. The
    marks and glyphs show in forced-colors mode. `current` sets `aria-current="step"`. The other
    statuses add visually hidden text as the Item's first child, "Completed", "Upcoming" or "Error"
    in the reader's locale, which needs a `LocaleProvider`. `statusLabel`, which the types allow
    only beside `status`, replaces that text, and an empty `statusLabel` renders none. An Item
    without `status` keeps the 8.75px dot in an `md` or `lg` lane.

  **Breaking:**

  - An Item no longer draws a rail around its children. Put the Title, Time and Description in a
    `TimelineList.Content` beside a `TimelineList.Indicator`. Old markup still renders, but with no
    rail and no mark.
  - The `timeline-list-dot` slot is gone. The default mark is `timeline-list-mark`, which carries
    the skeleton role, inside a `timeline-list-lane` in the `timeline-list-indicator`, between two
    `timeline-list-connector` segments. The connector is no longer the Item's `::before`. A host
    stylesheet that targeted the dot or the pseudo-element needs the new slots.
  - The list no longer indents itself. The 24px start margin on each Item is gone, so the first rail
    starts at the list's start edge. Add a margin on `TimelineList.Root` to keep the old indent.
  - The line now runs through the gap between Items, with a 4px gap above and below each mark, and
    the text starts 12px after the rail. Items are 32px apart, in place of 40px.
  - `TimelineList.Root` writes `role="list"`, so Safari keeps the list semantics of the markerless
    list.

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

- 6f8488e: A pressed `Toggle` and `ToggleGroup.Item` fill with a new theme role, `--toggle-pressed`, and set
  their label in `--toggle-pressed-foreground`. Internal themes point the pair at `--muted` and
  `--foreground` again, the quiet face internal tools had before the primary fill, which turned
  their pressed segments black. External themes keep the `--primary` and `--primary-foreground`
  fill, which stands apart from the tinted brand pages. A host can set either role to change the
  pressed face; without them a toggle falls back to `--muted` and `--foreground`.
- ad281c7: Add `Toolbar`, a bar of controls built on Base UI's toolbar. Import it from
  `@elmeragroup/fuse/toolbar`. It has six parts: `Root`, `Button`, `Link`, `Input`, `Group` and
  `Separator`. The bar is one Tab stop, and the arrow keys move between its items, wrapping at the
  ends unless `loopFocus` is false. `Toolbar.Root` paints the bar: a bordered popover fill with
  `p-1`, a column when `orientation="vertical"`. It publishes `--inner-corner`, so an item that
  rounds with `rounded-inner` sits concentric in it. `Toolbar.Button`, `Toolbar.Link` and
  `Toolbar.Input` have no look of their own and render the control that shows them, such as
  `render={<Button variant="ghost" size="sm" />}`, a `Popover.Trigger` or a
  `DropdownMenu.Trigger`. A ToggleGroup inside the bar joins its arrow-key order. A disabled item
  stays focusable. `Toolbar.Separator` draws Separator's hairline across the bar.

  `Popover.Content` takes `anchor`, the element, ref or virtual element the popup is placed
  against in place of the trigger. A controlled popover with no trigger opens against it, and
  the popup follows the anchor as it moves or resizes.

- 163839e: Adds `Tour.Beacon` to `@elmeragroup/fuse/tour`: a small dot beside a feature that starts a tip when
  pressed. The beacon is the element of the tip's step, so `Tour.Popup` points at it, and it announces
  `aria-haspopup="dialog"` and `aria-expanded`. It renders nothing until storage answers and nothing
  once the tip is completed or dismissed, so a finished tip never flashes on load. Its pulse runs three
  times and only when the user allows motion.
- 249ce0f: Adds checklist tasks and `Tour.Ring` to `@elmeragroup/fuse/tour`.

  - `useTour` returns `startStep(step)`, which shows one step on its own as a task's tip, with a
    Done button that ends the run and writes no status; `completeStep(step)`, which marks a step
    done and completes the tour once every step is done; and `doneCount`.
  - `useTourStepDone(tour, step)` answers whether one step is done, and re-renders only when that
    answer changes.
  - Done steps sync across tabs and devices: a merge keeps every step either side marked done in
    the same version of the tour.
  - `Tour.Ring`, placed inside `Tour.Popup`, outlines the step's element while the page stays usable.
    It follows the element through scrolling and takes no pointer, so the element stays clickable.

- 530e05e: Adds the `@elmeragroup/fuse/tour` preview entry for product tours: a run of popups that point at
  parts of a page, one step at a time. Names and props can change until Fuse's first stable release.

  - `defineTour` declares a tour's id, version and steps. The step ids become a union type, so a part
    that names an unknown step fails to compile.
  - `Tour.Provider` holds the session and renders only its children. A run re-renders only the tour
    parts and hooks whose answer changes.
  - `Tour.Target` and `useTourStep` register a step's element with its words. A plain-HTML element
    takes `data-tour-step="<tourId>.<stepId>"`.
  - `Tour.Popup` is the coachmark, a labeled `dialog` with `Tour.Header`, `Tour.Progress`,
    `Tour.Close`, `Tour.Title`, `Tour.Description`, `Tour.Footer`, `Tour.Skip`, `Tour.Prev` and
    `Tour.Next`. The Arrow keys move between steps.
  - `useTour` reads a tour's state and starts it; `useAutoStartTour` starts it once it is due, by
    `priority` and the Provider's `autoStartCooldownMs`.
  - Records persist in localStorage by default. `memoryTourStorage`, `remoteTourStorage` and
    `layeredTourStorage` cover demos and backends, and `parseTourCookie` and `serializeTourCookie`
    let a server render finished tours from the first paint through `initialRecords`.
  - A tour never throws into the page. Only Done on the last step, Skip, Close and Escape write a
    status; an outside press or an error ends the run for the page only.

- 92e5d91: Adds `Tour.Spotlight` to `@elmeragroup/fuse/tour`. Placed inside `Tour.Popup`, it dims the page
  around the step's element with the overlay scrim's tint and leaves the element lit. The dim takes
  every press outside the popup, the lit element included, and such a press ends the run without
  writing a status. Pair it with `modal="trap-focus"` on `Tour.Popup` and a `Tour.Close`, which keep
  focus in the popup while the rest of the page is hidden from assistive technology. A development
  build warns when the popup has no `Tour.Close`.
- 524afff: `TrondelagkraftLogo`, and `BrandLogo` with `tkas`, paint the lamp's ring and base in the `--logo-mark-ink` custom property when it is set, in the full logo and the mark. Without it they keep `currentColor`, so nothing changes by default. Set it on the logo or an ancestor to colour the lamp apart from the name, for example `className="[--logo-mark-ink:var(--brand-tkas)]"` for a turquoise lamp beside a text-coloured name, or `white` for the look of the brand's hero.
- 74242c8: `VerticalTableItem` takes an optional `id`, which keys its row. Set it when `VerticalTable.Body`'s
  `data` can be filtered, reordered or have rows inserted, so a stateful `value` stays with its own
  item instead of the row that now sits at its old position.

### Patch Changes

- e21c78e: An explicit `aria-label` on an icon-only `Toast.Close` now names the button. Before, the icon-only
  close button kept its `label` or the dictionary `toast.close` name and ignored `aria-label`.

  An explicit `aria-label` on `BrandLogo` (`@elmeragroup/fuse/icons`) now names the logo. Before,
  `title` or the brand display name replaced it.

- c33c893: A default `Accordion.Item` now fills with the brand's soft tint, `primary-soft`, instead of the grey
  `muted`. The item's text, including the panel body, the trigger label and the caret, takes
  `primary-soft-foreground`. Focus rings inside the item take the same colour, so they hold 3:1 on the
  tint. The internal themes look almost the same. The external themes swap the grey box for the brand
  tint. Without preflight, the trigger no longer paints the native button's text and background colours.
  Stacked default items now sit 12px apart, as card items do, so their rounded corners no longer
  touch and leave a notch between items. Pass `className="space-y-0"` on `Accordion.Root` to keep
  them flush. To keep the grey look, pass `className="bg-muted text-foreground"` on `Accordion.Item`.
- 135d903: A wrapped `Accordion.Trigger` label now starts each line at the row's start, where the native
  button centered each line. A one-line label stays where it was.
- ad14f3f: `Alert.Root`: the default variant's action button hovers to the `muted` fill instead of Button's
  translucent primary fill, which left its `foreground` label at low contrast while hovered.
- aee8e9a: `Alert.Description` now renders a `div` instead of a `p` and no longer clamps its text to two
  lines. An alert can hold several paragraphs or a list, and every line stays visible.
  `Alert.Description` puts an 8px gap between consecutive block children, so a list sits apart
  from the paragraph above it. `AlertDescriptionProps` now takes `div` props. `Item.Description`
  keeps its `p` element and two-line clamp.
- a5fde48: `Alert.Description` now takes the variant's text colour from `Alert.Root`, as the title does. It
  forced `foreground`, so on the info, warning and destructive alerts the body sat in a different
  colour from its title. The body is now `info-soft-foreground` on info, `warning-soft-foreground`
  on warning and `error` on destructive; default and success keep `foreground`. A colour class on
  `Alert.Description` still wins.
- 95c55cb: `Alert.Description` no longer adds 8px above an inline-block child, such as a button, badge or
  `kbd`, that follows another element. Before, a `Popover.Trigger` inside the description made the
  alert grow 8px when the popover opened, and an inline button after a `strong` or link raised its
  line. The 8px gap now applies only to block children such as paragraphs, lists, headings,
  `details` and tables that follow another child, and to an image or other media right after one of
  those blocks. The gap weighs as much as one element selector: a margin reset such as
  `* { margin: 0 }` leaves it in place, and any consumer class rule overrides it, such as
  `className="[&>*+*]:mt-0"` on the description or `.my-description > p { margin-top: 0 }`.
  On a host without Tailwind's preflight, a paragraph or list in `Alert.Description` no longer keeps
  the browser's default margins, so it sits 4px below the title and 8px from the next block.
- 070c391: `AlertDialog.Root` now runs Base UI's alert-dialog mode, so every alert dialog is modal and a
  backdrop click no longer dismisses it. Escape still closes it. `modal` and
  `disablePointerDismissal` are no longer accepted on `AlertDialog.Root`.
- 74242c8: A neutral `AlertDialog.Content` with `isActionDisabled` now opens with focus on Cancel. Before,
  initial focus aimed at the disabled action, did nothing, and left focus on the trigger behind
  the modal.
- 4fb3909: An explicit `role` on `Alert.Root` now replaces its default `alert` role. Before, `Alert.Root`
  always rendered `role="alert"` and ignored the passed role. Pass `role="status"` for an
  informational alert that screen readers should announce politely instead of interrupting, on a
  status region that stays mounted while its message changes, or `role="none"` for a static
  notice. Without a `role`, `Alert.Root` still renders `role="alert"`.
- 4a7639e: `Alert.Title` and `Alert.Description` now follow density through the label text, `--label-text`,
  as selection rows do: 14px dense, as before, and 16px comfortable, where they were 14px beside
  16px body copy. The title keeps `font-medium` at `leading-snug` and the body regular weight at
  `leading-normal`. Beside a description the icon still centres on the title's first line.
  `Alert.Root` writes `data-alert`, and `PART_DENSITY` gives the alert's title, description and
  described icon media the `label` role.
- 45c26bd: An `Item.Root` or `Card.SectionButton` link announced `aria-disabled="true"` no longer navigates. A
  link takes no native `disabled`, so the part cancels its own activation: a click or a keyboard
  Enter neither follows the link nor runs `onClick`, and a middle-click neither opens a new tab nor
  runs `onAuxClick`, as Sidebar's menu rows already did. `Item.Root` cancels only on a `render` row,
  so the controls inside a plain row keep their clicks. Any `Item.Root` announced `aria-disabled` now
  dims with the `not-allowed` cursor, as a disabled button row does, and a link row's hover fill
  skips it.
- 66a976e: A press on a label or another element that owns its press, inside a custom `InputGroup.Addon` in
  `Autocomplete.Input`, now goes to that element. Before, the autocomplete input took focus and, with
  `openOnInputClick`, the popup opened and closed again before the label focused its own control.
- b669ea5: `Badge` now renders an inline-flex `span` instead of a `div`, so it is valid inside a
  paragraph such as `Item.Description` and `SelectionItem.Description`. Before, server HTML with a
  Badge inside one of those parsed with the badge outside the paragraph. `BadgeProps` now takes
  `span` props.
- 3e2a0df: Fuse now pins Base UI 1.9.0. These Base UI changes reach Fuse components:

  - A `Select` or `Combobox` given `actionsRef` now unmounts its popup after the close animation
    on its own. To keep it mounted until you call `actionsRef.current.unmount()`, call
    `eventDetails.preventUnmountOnClose()` in `onOpenChange`.
  - `Select` and `Combobox` accept readonly arrays as `multiple` values.
  - `DropdownMenu.Root` takes Base UI's `onItemHighlighted` callback.
  - An `aria-label` on a `Checkbox`, a `Switch` or a radio item now names the control ahead of an
    associated label.
  - `ScrollArea`'s viewport no longer carries `role="presentation"`.
  - `Accordion` and `Collapsible` triggers render the native `disabled` attribute when disabled.
  - A touch tap on a `Slider` track now fires Base UI's commit, and a drag ends on `touchcancel`
    and `pointercancel`.

  `Command` still sends the highlight back to the first match on each opening, including one that
  interrupts the close animation.

- 266cbd8: The light external `--border` hairline is darker for Fjordkraft (with Fjordkraft Företag), TrøndelagKraft and Gudbrandsdal Energi, so `Table`, `DescriptionList`, `CheckboxCard` and the other `--border` edges show on their tinted pages. It now measures at least 1.19:1 against `--background` in every theme. Each brand keeps its hue and chroma, and `--input` is unchanged.
- 09ce5fb: Bare borders draw in the `--border` role instead of the text colour, so `DescriptionList`, `Table`, `Sheet`, the outline `Badge` and the other parts with an uncoloured border show a quiet divider in every theme. The `Sidebar` rail edge uses `--sidebar-border`, the `NumberField` stepper divider uses `--input`, and `Card` and the `card` Accordion item use `--card-border`, which external themes make transparent. The default is a base-layer rule on every element, host markup included, except native form widgets outside Fuse parts, which keep their own border colour and native look. Any border colour utility still wins; hosts with their own `border-border` base rule can remove it unless it colours those widgets. A preflight-free Tailwind build that imports Tailwind's sheets into layers declares `@layer theme, base, components, utilities;` before them.
- dfd5c16: A `size-*` class on a `BrandLogo` mark (`@elmeragroup/fuse/icons`) now sizes the artwork, also in
  menu rows, select options and buttons. Before, a row or button drew the mark at 16px whatever the
  class said, and outside a row the mark kept its artwork size. An unsized mark still takes the row's
  or button's icon size, and elsewhere every `BrandLogo` mark keeps its artwork size. Before, the
  `ngfi` and `fkse` marks stretched to the width of their container there.
- a8cb272: The Fjordkraft and TrøndelagKraft marks in `@elmeragroup/fuse/icons` paint in `currentColor`, as their full logos already do, so `variant="mark"` shows on a light surface such as a white header or a menu. They were white:

  - `FjordkraftLogo` and `BrandLogo` with `fkas` or `fkab`: the face takes the text colour.
  - `TrondelagkraftLogo` and `BrandLogo` with `tkas`: the lamp's ring and base take the text colour, and its light uses the full logo's yellow, `#FCE300`, in place of `#FFF400`.

  The other marks keep their brand colours. Where a page drew one of these marks on a brand-coloured tile, set the tile's text colour with its background, for example `bg-brand text-brand-foreground`, to keep the mark white.

- 48ff71d: `Button` and `ConfirmButton` keep Base UI's `aria-disabled` when they stay focusable while disabled (`focusableWhenDisabled` with `disabled` or `isPending`) or render a disabled non-native element. Before, the attribute was dropped and assistive tech announced an enabled button.
- e3e70a7: Button's shipped doc strings now carry the usage rules the docs page used to state in prose.
  `children` documents the `data-icon` markers, the 16px icon size and its `size-auto` opt-out, and
  logos without a `viewBox`. `className` documents padding overrides, and `pendingIndicator` how a
  custom pending state fades its content. `variant` gains a description, and `variant` and
  `size` now declare their `"default"` value where Button reads them, so the API reference shows it.
  The types accept the same props as before, and rendering is unchanged.
- 509a7e5: The `ButtonGroup` docs now say that filled `default` and `secondary` Buttons need a `ButtonGroup.Separator` between them. Their fill runs under the transparent border, so without one the joined segments read as one button.
- a63fa91: `ButtonGroup.Separator` runs the full height of a horizontal group and the full width of a vertical one. Before, it stopped 1px short at each end and left a notch of page background between the buttons. The pale default line hid the notch, but a darker or brand color showed it. A `bg-*` class on the separator now recolors it with nothing else to override.
- f98fb3c: A `Button` no longer throws `NotFoundError` when it turns pending on a page that Chrome's built-in
  translation has translated. The pending indicator now renders after the children and still shows
  at the leading edge. Before, React inserted it before the label's text node, which translation had
  already replaced, and the error unmounted the tree up to the nearest error boundary.
- 2f620c6: `Button` shows the pointer cursor, like Fuse's other interactive controls. Disabled, pending and visually disabled buttons keep the `not-allowed` cursor from the state face. Hosts that added their own `[data-slot="button"] { cursor: pointer }` rule can remove it.
- 2c8acf3: A calendar day button rendered through `render` with its own `data-slot` now behaves like the
  default one. Opening a `DatePicker` or `DateRangePicker` focuses its tab-stop day, and a key move
  between such days keeps the calendar's focus through a remount of its day buttons.
- 9207567: `Calendar`, `RangeCalendar`, `DatePicker` and `DateRangePicker` hide the previous and next month's
  days instead of drawing them like unavailable dates. Their cells keep the weeks aligned, they leave
  the accessibility tree, and they remain pickable from their own month.
- 6e0c405: In forced-colors mode, `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` and `DateField`
  keep the system palette's colors:

  - An enabled unselected day and an enabled date segment that is not focused now take the system
    text color the browser supplies. Before, they kept the theme's text color, which was
    unreadable when a host pins a light theme under a dark contrast theme, or the reverse (about 1:1
    against the forced background).
  - A selected day that fails validation, and the selected start and end days of an invalid range, now
    paint the system `Mark` color with `MarkText`. Before, they kept the theme's error fill and error
    foreground. A valid selected day still paints `Highlight`.
  - A range's selected middle days stay `Highlight` while the pointer is over them. Before, hover
    painted the theme's translucent range fill, which on an invalid range's `Mark` band measured
    2.17:1.
  - A focused selected day shows a 2px outline in its text color inside its fill, in place of the
    theme's focus ring.

  Normal-mode colors are unchanged.

- 90af1bb: `Card.Root`, `Card.Header`, `Card.Tag`, `Card.Action`, `Card.Content` and `Card.Footer` now type
  `ref` as a `div` ref. React 19 already passed a `ref` through to the `div`, but the props type left
  it out, so `<Card.Root ref={ref} />` failed to compile.
- 65cbde9: A `Card.Content` or `Card.Footer` that opens a card now pads its top with the card's tier. Before,
  it dropped its top padding even with nothing above it, which put its content against the card's top
  edge. Host rules that restored that padding can go. A content or footer below another section still
  drops its top padding, so the tier stays the gap between sections. On such a section, a `pt-*`,
  `py-*` or `p-*` class that sets a top padding now needs `not-first:pt-*` beside it to win at the top.
- 310567f: `Card.Title` now sets `leading-snug`, as `Heading` and `Item.Title` do, so a card title that wraps
  has space between its lines. Before, `leading-none` made two wrapped lines touch. A horizontal
  card's title keeps the same leading through `text-xl/snug`. A single-line title grows by the extra
  leading, about 9px at the default `2xl` size.
- 1d62315: A `Carousel` inside an ancestor whose transform animates, such as an opening popup, now waits, for
  up to about half a second, for a reading of its slides at one consistent scale before it places its
  page or reads where a scroll ended, so it lands on and reports the right page. Before, WebKit could
  read the viewport and the slides at different points of the animation, and the carousel then
  stopped on the wrong page.
- 5bd150f: After a same-origin iframe that shows a `Carousel` loads a document from another origin, the
  carousel's unmount no longer throws a `SecurityError`. The error stopped its cleanup, so the timer
  that waits for a scroll to settle kept running after an unmount under held input. The carousel no
  longer cancels animation frames through the iframe's window once it shows another document, where
  the cancel could hit one of that document's frames.

  `Chart.Tooltip` gets the same fix in the watch that opens a default item's popup while the plot is
  in view, and in the glide that moves the popup. An open tooltip can still throw from Base UI's
  popup positioning when it unmounts after such a navigation (#1134).

- 981365b: A `Carousel` whose page count shrinks while a finger holds it no longer jumps away from the
  finger. When a page was pressed before the carousel could measure itself, and the finger then
  swiped back before slides were removed or the viewport widened, the carousel jumped to the last
  remaining page under the finger and never reported the page the swipe ended on. It now stays
  where the finger left it and reports that page once the swipe ends, to a controlled parent too.
- a0e34c9: `Carousel.Indicator` keeps its 24px target when the host's root font size is below 16px. At a
  14px root it measured 21px. It still grows with a root above 16px.

  `Sidebar.MenuAction` and `Sidebar.GroupAction` keep their 24px target at a 14px and a 12px root,
  and under a Tailwind-source host whose `--spacing` is 2px, 2.5px or 3.5px, at both densities. The
  `sm` and `lg` menu actions still grow with a root above 16px.

  Each action's enlarged hit area now stays inside its own row: a menu action's covers its row's
  height and the menu button's end padding, and a group action's covers its label's height. Before,
  an action could cover the bottom of the action above it, a group action could cover the top of the
  first menu row, and a press near a truncated label's end could open the action instead of the row.
  An `sm` or `lg` row and the group label are never shorter than their action.

  `Sidebar.MenuBadge` stays centered on its row on an `sm` row at a 12px root and under a
  Tailwind-source host's `--spacing`.

  In the collapsed icon rail, a group's hidden label no longer catches presses on the last row of
  the group above it.

- a704ea6: Scrolling a `Carousel` no longer re-renders every part and every `useCarousel()` caller each time
  the slides in view change. Only the slides and indicators that show what is in view re-render. A
  carousel with many slides also spends less time per scroll and per content change: a slide finds
  its number, and a change inside a slide is told apart, without scanning every slide.
- 8634e3a: A trackpad or wheel gesture on a `Carousel` now counts as one held input, from its first turn to
  two frames after its last. Before, a gesture that turned every frame was released and held again
  every other frame, so the carousel took and dropped its document listeners for the whole gesture.
- 699f103: `Chart.Bar` draws a reading other than 0 at least one device pixel long along the value axis, at
  any pixel ratio and wherever the page places the plot. A reading far below the domain's maximum,
  such as 4 beside 1,000, could snap to 0 px and read as a zero while the tooltip showed its value.
  The kept pixel grows from the zero rule away from zero: up for a positive vertical bar, down for a
  negative one, and right or left on a horizontal chart. A zero reading stays flat. In a stack, the
  outermost segment with length on each side keeps the pixel, decided again in every frame of an
  update, and the inner segments snap as before, so the segments still meet with no gap or overlap. The path form above 100 categories, its emphasis boxes and the active
  overlay follow the same rule.
- 7dff888: Charts now render in full in the oldest browsers Fuse supports. In Chrome 111–122 and Safari
  16.4–17.4, which lack `light-dark()`, a `GaugeChart` track paints its notches, in the light tint in
  both colour schemes. Before, the track showed no notches at all. In Chrome 111–119, a gauge
  sector draws as its wedge instead of tinting the gauge's whole box. In the same versions, a
  `LiveLineChart` line fades out at the plot's left edge instead of running past it. In Chrome
  111–118, hovering a `Sparkline` shows its crosshair, its dot and the dimmed line instead of a
  highlight segment drawn off the line. Current browsers render charts as before.
- 47101fb: `@elmeragroup/fuse/chart.css` now carries the `-webkit-` prefixes the browser floor needs. Below
  Chrome 120 the crosshair keeps its faded ends, series past the active point dim, and the pie,
  radial, clock and gauge skeletons keep their holes. The sheet now asks Chrome 111 to 135 to keep
  chart colors when printing. The shipped sheet no longer carries the source's comments.
- 4c6f666: A chart now applies its default active item when that item first becomes available after mount.
  Before, `Chart.Root`, `ClockChart.Root`, `PieChart.Root`, `RadarChart.Root` and `RadialChart.Root`
  looked up `defaultActiveX`, `defaultActiveKey` or `defaultActiveName` once, at mount. A Root that
  mounted with no rows, as a page does while it loads, never showed the default item's active dot,
  readout or Tooltip, and the first Tab focused the first item. Now the default item turns active
  when the data first holds it, and focus enters on it. A dial with `now` or `period` can hold its
  default slot while its rows are still empty. On `Chart.Root` the slot must also lie inside the
  window, so a default outside `xRange` waits until the window holds it. While the default stays
  active on a polar chart, a row inserted before it keeps the same item active, where before the
  active index stayed and named the inserted row. If a reader moves the active item first, the Root
  never applies the default. Root reads the prop only at mount, as with `defaultValue`, so a
  default passed after mount does nothing.
- 8fcef5d: Open the Tooltip of an item active through `defaultActiveX`, `defaultActiveKey` or `defaultActiveName` only while at least half of the chart's plot is in view. Width and height are checked separately, and on an axis where the plot is larger than the viewport, half of the viewport's extent is enough. A chart below the fold, under `display: none` or scrolled out of a panel no longer paints its popup at the viewport's edge or at the page's top-left. When the plot leaves view, the popup stops painting at once, with no exit fade. The item stays active, and the popup opens in its place once the plot scrolls or moves into view, including a plot that mounts later because its first readings were all empty, and a chart rendered into a container that is attached to the page later. The rule ends when a reader takes over: a pointer pick, keyboard focus on the plot, even with the same item still active, or a pin. A popup that a pointer, a key or a pin opened behaves as before.
- cdd14c7: A default chart tooltip now opens or closes when resizing the plot takes it across the visibility threshold in a short scroll panel, even at a fixed scroll position.
- 1e056ce: Open the Tooltip of an item active through `defaultActiveX`, `defaultActiveKey` or `defaultActiveName` inside a scroll panel less than half the plot's height. Before, the popup never opened there, however the panel was scrolled. The plot's room is now the overlap of the viewport and the padding box of each ancestor that clips its overflow. Fuse caps the room's width and height at the plot's, and the popup opens once the plot shows at least half of each. The check runs again after a scroll or a resize. It takes a scaled panel at its painted size, follows the plot into a web component's open shadow root, and ignores a wrapper that a `position: fixed` or `position: absolute` plot escapes.
- 41b28b2: A key step in any chart family now moves the crosshair, the active dots, the slot label,
  `Chart.Reveal`'s edge, the polar hand and the tooltip to the next item at once, with no glide, and
  a tooltip that a key opens shows with no fade. A key that takes over the item a pointer is gliding
  to lands it at once. Pointer and touch steps glide as before. The Base UI tooltips of `Chart`,
  `ScatterChart` and the polar families still fade out when they close.
- a444a89: Chromium reported the focused chart point as selected, so a screen reader announced each point as
  "selected" while you browsed the plot or a tooltip was pinned. Chromium still reported a
  `LiveLineChart` point as selected after Escape dismissed its readout. The plot options of `Chart`,
  the polar charts, `ScatterChart` and `LiveLineChart` now state `aria-selected="false"`, and
  Chromium reports the focused point as unselected.
- 94ab3cb: The polar charts' tooltip now stays clear of a `Chart.Legend` or `Chart.Headline` that takes its
  own `data-slot`. Before, the popup's placement missed such a Legend or Headline and could rest over
  it.

  The polar charts' tooltip now opens as wide as its longest label when `Chart.TooltipLabel` takes its
  own `data-slot`. Before, it opened at the current label's width and widened as a key step reached a
  longer label. A `Chart.TooltipLabel` whose `format` changes its text, whose `children` or `render`
  element replace it, or whose `render` function prints other text, now sizes the popup by the text it
  prints. Before, the popup took the width of Root's labels. Text from `children` or a `render`
  element counts even when it matches a slice's name. A `format` the chart does not use, such as
  `format="date"` on a pie, keeps the width of Root's labels. The lane's width limits still apply, so
  a 300 px label wraps in a side lane capped at 256 px.

  `Chart.Reveal` now leaves a consumer's own SVG child alone when it carries the `data-slot` of a
  line, area or dots layer. Before, Reveal wrote the active slot's place, `--chart-active-x`, on that
  child too, and while a slot was active its mask replaced the child's own mask. It now writes and
  masks only the Line, Area and Dots it wraps.

  The ClockChart tooltip now stays clear of a `ClockChart.ReferenceLine` or `ClockChart.ReferenceArea`
  label past the rim. Before, a popup in a side lane could cover the label.

- 6c01c95: Under `xScale="linear"`, a `Chart.Table` caption over more than one row now prints its period as a
  linear `Chart.ReferenceArea` band does. A unit that both ends write after the number prints once,
  and readers hear each end's spoken form. With `xFormat={{ style: "unit", unit: "kilometer" }}` in
  en-US, the caption shows `Usage, 5–10 km` and reads `Usage, 5 kilometers to 10 kilometers`.
  Before, it showed `Usage, 5 km–10 km` and read `Usage, 5 km to 10 km`. Unlike a band, a caption
  whose two ends print alike prints one label, as before, and readers now hear its spoken form.

  A `ClockChart.ReferenceArea` sector with no `format`, whose `x1` and `x2` fall on the same slot of
  a dial with slots of a day or longer, now prints that slot's label once, as `Chart.ReferenceArea`
  does. On a year dial of months, `label="Peak {value}"` prints `Peak January 2026`, where it printed
  `Peak January 2026 – January 2026`.

- 1408814: A `Chart.Root` (`@elmeragroup/fuse/chart`) nested inside another chart's part now behaves as it
  does on its own. Before, it took on the outer chart's state:

  - Inside `PieChart.Root`, `RadialChart.Root` or `RadarChart.Root`, it rendered no legend,
    tooltip, table or empty state.
  - Inside a `Chart.Tooltip`, its `Chart.SeriesLabel`, `Chart.Swatch` and other readout parts
    followed its own pointer as if they sat in its tooltip.
  - Inside a `Chart.Headline`, its `Chart.ActiveValue` printed exposed headline text instead of
    its plot label.
  - Inside a `Chart.Crosshair`'s children, it showed a `Chart.SlotLabel` placed outside its own
    Crosshair.
  - Inside a `Chart.Marker` or `Chart.ActiveValueLine`, a `Chart.ValueLabel` placed outside its own
    Marker or ActiveValueLine printed a value, taking its series key and slot from the outer part.
    It now prints nothing, as it does outside a Marker or ActiveValueLine in a chart of its own.

- cc05ed1: A `Chart` data update that slides the window by whole slots, such as an append that drops the first
  row, now runs for the time since the previous `data` when that is shorter than 480 ms, in the
  preview chart entry, `@elmeragroup/fuse/chart`. A feed faster than 480 ms used to cut each slide
  short with the next one, so the line stuttered. Now each slide ends as the next reading arrives. Every
  mark the update moves, such as a line, an area, a bar and the dots and markers on them, runs for the
  same time. Any other
  data update still takes 480 ms, and reduced motion still draws the new data at once.
- e3e70a7: A chart's time axis lists at most 1,000,000 slots. An `interval` too fine for the data's range or
  the `period`, such as seconds over a year, now throws a `ChartCompositionError` with the rule
  `slot-limit`, naming the interval, the range, the slot count and the limit. A `period` with an
  invalid date throws the same rule, naming the period. Before, the axis built every slot and the
  page ran out of memory. A year of minutes, 525,600 slots, still renders.

  Unlike the other data-driven checks, `slot-limit` throws in production too, also when the rows'
  range rather than `period` sets the span: no fallback can draw such an axis.

- 444e7e4: `Chart.Table` and `Chart.ReferenceArea` now name a period of one slot once, in both the visible and
  the spoken text. `Chart.Table` with one category row captions itself `Usage, Jan`, and
  `Chart.ReferenceArea` with `x1` and `x2` on the same slot prints `Peak Jan` on a category axis and
  `Peak W2` on a week axis. Before, they printed `Usage, Jan – Jan`, `Peak Jan – Jan` and
  `Peak W2 – W2`. On an axis finer than a day, a one-slot band whose format prints a time of day still
  runs from the slot's start to its end, so in en-US `label="Peak {value}"` prints `Peak 5 PM – 6 PM`.
- c942487: A chart tooltip lets taps through to the plot from the first touch. Before, `Chart.Tooltip` and the
  polar charts' tooltips noticed a switch from mouse to touch only when the active point changed. A
  touch on the point a mouse already showed left the popup taking the next tap, not the plot.
  `ScatterChart` already followed the switch at once.
- 5390191: `Checkbox`, `Switch`, `CheckboxCard`, `RadioGroup` and `CheckboxGroup` now submit what they show after a native form reset, including React's reset after a form action. Before, the reset put their hidden inputs back to their mount-time state while the controls kept showing the user's choices, so the next submit sent different data from what was on screen. The controls keep their current selection on reset; an uncontrolled one does not return to `defaultChecked` or `defaultValue`.
- 28f34c3: A `ClockChart.ReferenceArea` band over `y1` and `y2` now prints its range as `Chart.ReferenceArea`
  does. When both ends write the same text after the number, it prints once, as in `5–10 kWh` rather
  than `5 kWh–10 kWh`, and the lower value prints first when `y1` is greater than `y2`. Before, it
  printed `y1` first, while readers already heard the range low to high.
- 2b288bd: `Combobox.Chip`: the remove button now fits inside the 22px chip at both densities. It rendered
  Button's `icon-sm` square, 32px at dense and 36px at comfortable, which overflowed the chip. It
  now renders the `icon-inline` square as tall as the chip's text line, with a 12px glyph, and its
  hit area keeps the pointer target at 24px without reaching the next chip.
- 0a70477: `Combobox.Chips` and `Combobox.ChipsInput` look like `Combobox.Input` beside them.

  - The chips box takes the shared field chrome, fill included, so it paints the `card` role
    rather than staying transparent. In external themes it is white on the tinted page, as the
    `Combobox.Input` box is. A disabled or read-only input in it gives the box the same disabled and
    read-only fills as `Combobox.Input`.
  - `Combobox.ChipsInput` paints its placeholder in `muted-foreground`, as `Combobox.Input` and the
    other field inputs do. It used to fall back to the reset's half-transparent text colour, so a
    chips placeholder read lighter than the placeholder of a `Combobox.Input` beside it.

- 11abd31: `Combobox.Input` inside a `Field` no longer submits its text. It rendered through `Field.Control`, which named the visible input after the Field, or after `Combobox.Root`'s `name`. So FormData carried the selected item's label, or a half-typed search, ahead of the value, and `formData.get(name)` returned the label. The input is now a plain `<input>` with the same classes, and Base UI's hidden input alone submits the value.

  Inside a `Field`, the id that `Field.Label` points at is now `Combobox.Root`'s `id`, as in Base UI. Before, `Field.Control` replaced it with a generated id. An `id` set on `Combobox.Input` still names the input, but the label's `for` no longer reaches it, so move it to `Combobox.Root`.

- 61415c8: The `Combobox.Content` popup under `Combobox.Input` now spans the whole field box, trailing caret
  and clear buttons included, as `Autocomplete.Content` does. Before, it was positioned against the
  `<input>` inside the box and was at least that input's width plus 28px, so its right edge stopped
  short of the box's. `Combobox.Input` now renders its InputGroup through Base UI's
  `Combobox.InputGroup`, so a press on the field box outside its controls focuses the input and,
  under `openOnInputClick`, opens the popup; a disabled `Combobox.Input` ignores it. A popup with an
  external `anchor`, such as `Combobox.Chips`, is unchanged.
- 768108b: `Combobox.Input` now honors `disabled` on `Combobox.Root`. Before, a disabled Root left the native input focusable and typeable.
- d0ce3b2: `Combobox.Content` now insets an owned search group 4px on each side with a width that fits inside the popup, so a `w-full` search group (the `PhoneNumberField` country picker) no longer overflows and clips its right edge. The List keeps the menu family's single `p-1` inset, with or without a search group.
- 396a08a: `Command.Root` starts fresh when `Command.Content` opens again before its close animation ends.
  Before, such an opening kept the previous query, page and highlighted row. Now an uncontrolled
  query goes back to `defaultValue`, an uncontrolled stack goes back to `defaultPages`, the
  highlight goes back to the first match and the parts passed as `Command.Content`'s children mount
  again, as after a finished close. The popup itself stays. `Command.Trigger` and anything else outside `Command.Content` keep their state.
  A controlled stack stays as the consumer sets it, so an app that sets it back to the first page in
  `onOpenChangeComplete` should do so in `onOpenChange` as the palette opens, which also covers an
  opening that interrupts the close.
- 74242c8: `CommandVirtual.List` no longer re-renders the rows that stay in its window as it scrolls; only
  the rows a scroll brings into view render.
- d0ce3b2: `Button` stops measuring a button and drops the shared `pointermove` listener as soon as its `onIntent` callback has fired, instead of at unmount.
- a8ffa1c: `Form` now documents its submit rules on the props they concern. `errors` lists which fields show
  the messages, when an error blocks the submit and when the form clears it. `onFormSubmit` lists the
  values it receives and when the form skips it.

  `ActionBar`, `Badge`, `ButtonGroup`, `ConfirmButton`, `Kbd`, `Link`, `Loader`, `Separator`,
  `AspectRatio`, `Emoji` and `Code` now document their rules on the props they concern, so the API
  reference and the markdown endpoint show them. `ActionBar.Root` documents its live announcement and
  focus return on `count` and its placement on `offset`. `Link` documents `href`, `target`, `render`,
  `underline`, `weight` and `truncate`. `Kbd` documents `aria-hidden` for a cap that repeats a
  shortcut. `Badge`, `ConfirmButton`, `Link` and `Loader` declare the defaults they already had, so
  the API reference shows them.

  `Heading`, `Text`, `Span`, `Card`, `Frame`, `Item`, `DescriptionList`, `Empty`, `Show`, `ScrollArea`
  and `TimelineList` now document their rules on the props they concern. `Heading` documents how
  `size` and `font` replace a level's theme type. `Card.Root` documents its parts on `children` and
  its edge and shadow overrides on `className`, and `Card.SectionButton` documents links, triggers
  and `aria-disabled`. `Frame.Root` and `Frame.Panel` document which children the Frame lays out and
  when a panel drops its padding for a table. `Item.Root` documents link rows and `aria-disabled`.
  `DescriptionList` documents its Item content model and long values on `children`. `ScrollArea.Root`
  documents fixed and max heights on `className`. `Text` and `Span` declare the `variant`, `size`
  and `weight` defaults they already had, and `Span` its `snug` leading, so the API reference shows
  them.

  `Alert`, `AlertDialog`, `Dialog`, `Sheet`, `Popover`, `PopoverInfoButton`, `Tooltip`, `Toast`,
  `DropdownMenu` and `Command` now document their rules on the props they concern. `Alert.Root`
  documents its live-region `role` and its text parts on `children`. `AlertDialog.Content`
  documents its initial focus on `variant` and when to close on `isAutomaticallyCloseOnActionEnabled`.
  `Dialog.Content` and `Sheet.Content` document each `size`, and `Sheet.Content` says the size applies
  only to the left and right sides from `sm` up. `Popover.Content` documents the trigger's role
  beside `anchor`. `PopoverInfoButton` documents its trigger `size` and its `label`. `Tooltip`
  documents shared and own delays. `Toast.Provider` documents one provider and viewport per app on
  `children`, `Toast.useToastManager` documents the `promise` lifecycle and its returned promise,
  and `Toast.Close` names the `overlay.close` dictionary entry it reads.
  `DropdownMenu.Group` documents its label on `children`, `inset` says it lines text up with items
  that start with an icon, and `DropdownMenu.RadioGroup` says its
  `value` type does not check item values. `Command` documents its search, stack, dialog, list,
  status and shortcut rules on `open`, `onOpenChange`, `pages`, `defaultPages`, `items`, `value`,
  `defaultValue`, `autoHighlight`, `virtualized`, `Command.Content`'s `aria-label` and `children`, `Command.Input`'s `aria-label` and
  `placeholder`, `Command.List`'s `children` and `render`, `Command.Empty`'s and `Command.Status`'s
  `children`, `Command.Item`'s `onClick` and `Command.Shortcut`'s `children`. `Dialog.Content` and
  `Sheet.Content` declare the `md` size default they already had, so the API reference shows it.

  `Accordion`, `Collapsible`, `Tabs`, `Breadcrumb`, `NavigationMenu`, `Pagination`, `Sidebar`,
  `Toolbar`, `Carousel` and `ListDetail` now document their rules on the props they concern.
  `Accordion.Root` documents each `variant` and `radius`, and `Accordion.Trigger` how to style a
  custom `indicator`. `Collapsible.Content` documents the `className` that turns off its clipping and
  height transition. `Tabs.List` documents `variant` and its `activateOnFocus` default.
  `Breadcrumb.Link` and `NavigationMenu.Link` document router links on `render`. `NavigationMenu`
  documents its landmark name on `aria-label`, its keyboard on `Trigger`'s `children`, its inline
  submenus on `inline` and its indicator on `children`. `Pagination.Content` documents wrapping in a
  narrow container. `Toolbar` documents its focus order on `loopFocus`, `disabled` and
  `orientation`, and how buttons, inputs, menus and tooltips join it on `render`. `Sidebar.Root`
  documents how to compose a right sidebar on `side`. `Sidebar.Provider`
  documents on `defaultOpen` that it reads the value once, so a flash-free restore reads the cookie
  in a server layout and passes it there, and it documents the mobile Sheet on `openMobile`, `Sidebar.Root` where its
  element props land on `style`, `Sidebar.Inset` its landmark on `render`, and `Sidebar.MenuButton`
  and `Sidebar.MenuSubButton` their `aria-disabled` rows and sizes. `Carousel` documents its name,
  parts, slide sizing, inert slides, controls order, thumbnails, page count, reduced motion and the
  full automatic rotation lifecycle on the props they concern, and `useCarousel` lists its state and actions.
  `ListDetail` documents its layout, server render and focus moves on `split` and `onOpenChange`, its
  empty state and remount on `Detail`'s `children`, and the Sheet-only `size`, `showCloseButton`,
  `closeLabel` and `Close` `render`. `Toolbar.Root` declares its `orientation`, `loopFocus` and
  `disabled` defaults, `Toolbar.Button` and `Toolbar.Group` their `disabled` default and
  `NavigationMenu.Link` its `active` default, `Carousel.Previous` and `Carousel.Next` their
  `icon-sm` size default and `Command.Root` and `Command.Page` their `virtualized` default, all values
  they already had, so the API reference shows
  them. The public types are unchanged.

  `Checkbox`, `CheckboxCard`, `RadioGroup`, `Switch`, `Toggle`, `ToggleGroup`, `SelectionItem`,
  `Slider`, `Meter` and `Avatar` now document their rules on the props they concern.
  `CheckboxGroup` and `RadioGroup` document `orientation`, `allValues` and the options they take on
  `children`, and on `value` and `defaultValue` that the group, not a member's `defaultChecked`,
  decides which members are checked. `CheckboxCard` says the same on `value`. `CheckboxItem`,
  `RadioItem` and `SelectionItem.Shell` document on `className` where to
  set the `--selection-*` theme roles, on `children` how a server component writes the row, and
  `SelectionItem.Shell` documents an icon beside the control on `control`. `CheckboxCard`,
  `Toggle` and `ToggleGroup` document `variant` and `size`. `Slider` documents vertical height,
  `onValueCommitted` for saving and a NumberField for exact values. `Meter` documents each `mode`
  and its levels. `Avatar.Root` documents `size-*` on `className`, `Avatar.Image` documents `alt`,
  and `Avatar.Group` its stacking on `children`. `CheckboxItem` and `RadioItem` declare their
  `isSubSectionSelectable` default, and `Slider` and `Meter` their range and step defaults, all
  values they already had, so the API reference shows them. The public types are unchanged.

  `Field`, `Input`, `InputGroup`, `Textarea`, `TextField`, `TextareaField`, `NumberField`,
  `SearchField` and `PhoneNumberField` now document their rules on the props they concern.
  `Field.Root` documents each `orientation`, and that a responsive root needs a `Field.Group`.
  `Field.Error` documents on `children` when it shows its own message and where to place it,
  `Field.Description` whether it describes a field or a set, `Field.Set` its `aria-describedby`
  and `disabled`, `Field.Legend` a native legend in a grid set on `render`, and `Field.Label` the
  choice row and choice card on `children`. `Input`, `Textarea` and `InputGroup.Input` document on
  `aria-label` how to give them a visible label, and `Textarea` that it takes a `Field.Root`'s
  wiring only through `Field.Control`'s `render`. `InputGroup.Root` documents on `children` that
  its state comes from its direct input or textarea, and `InputGroup.Addon` documents `align` and
  what an addon holds. `NumberField` documents `onChange` against `onValueCommitted` and the locale
  behind `formatOptions`, `SearchField` its Enter, Escape and clear button behavior, and
  `PhoneNumberField` country detection and how a controlled country answers a proposal.
  `TextField` declares its `size` default, and `PhoneNumberField` its `defaultCountryCode`,
  `autoDetectCountry`, `international`, `preserveOnCountryChange`, `outputFormat` and `formatOnType`
  defaults, all values they already had, so the API reference shows them. The public types are
  unchanged.

  `Select`, `SelectField`, `Combobox`, `ComboboxField`, `Autocomplete`, `AutocompleteField`,
  `Attachment`, `FileTrigger` and `FileUpload` now document their rules on the props they concern.
  `Select.Content` documents when `alignItemWithTrigger` places the popup over the trigger and when
  it falls back to `side`. `Combobox.Content` documents its default anchor on `anchor`, and
  `Combobox.Input` and `Autocomplete.Input` when their clear button shows. `SelectField`, `ComboboxField` and `AutocompleteField` document where the
  label, error and description sit, how `Form` errors under `name` show and clear, what read-only
  still submits, and when to compose `Field.Root` and the parts instead. `SelectField` documents its
  `ref`, which goes to the trigger. `Autocomplete.Root` documents its text value, the picked item's
  text, `name` and `id` inside a `Field`, and `filter={null}` for a search that runs on a server.
  `Autocomplete.Item` documents `onClick` for capturing the picked item, and `Autocomplete.Empty`
  and `Autocomplete.Status` their live regions on `children`. `AutocompleteField` documents the same
  on `value`, `onValueChange`, `filter` and `itemToStringValue`, and groups on `items` and
  `children`. `FileUpload.Root` documents every rejection reason on `onReject`, app limits on
  `onSelect`, posting with a form on `name` and `files`, Field validation on `required`, folders on
  `directory`, and paste, the document drop guard and `useFileUpload()` on `children`.
  `FileUpload.Trigger` documents its Field label, id, description order and invalid face, and
  `FileUpload.Dropzone` and `FileUpload.Description` their rules on `children`. `FileTrigger`
  documents on `children` that it joins a `ButtonGroup` as a `Button` does. `Attachment.Root`
  documents each `size`, `orientation` and `state` and its parts on `children`, `Attachment.Media`
  documents `variant`, `Attachment.Group` its name and scrolling, `Attachment.Action` and
  `Attachment.Trigger` their names, and `Attachment.Trigger` links and dialogs on `render`.
  `SelectField` declares its `size` default, a value it already had, so the API reference shows it.
  The public types are unchanged.

  `Calendar`, `RangeCalendar`, `DateField`, `DateInput`, `DatePicker`, `DatePickerField`,
  `DateRangePicker`, `DateRangePickerField`, `DataTable`, `DataTableFilter`, `Table`,
  `VerticalTable`, `Skeleton` and `SkeletonReveal` now document their rules on the props they
  concern. `Calendar.Root` and `RangeCalendar.Root` document their name on `aria-label` and
  `aria-labelledby`, their parts on `children`, the server render and today's month on
  `defaultValue`, and the bound names on `minValue` and `maxValue`. Every date component's `value`
  points to the Temporal polyfill and TypeScript lib setup in the quick start. The calendar parts document the
  live heading on `VisibleRangeHeading`'s `children`, a one-month heading on `MonthHeading`'s, the
  day names and keys on `DayButton`'s, the range flags on `DayGridCell`'s `className`, and canceling
  a page on the month buttons' `onClick`. `RangeCalendar.Root` documents choosing a range and its
  reasons on `onValueChange`, and its state attributes on `className`. `DateField`,
  `DatePickerField` and `DateRangePickerField` document their keys, kinds, time zones, bounds,
  `Form` posting and segment names on the props they concern, and `DateInput.Root` its `Field`
  wiring on `name` and its segments on `children`. `DatePicker.Root` documents its parts and
  `TimeInput` on `children` and focus on `onOpenChange`, and `DatePicker.Presets` who clears the
  checked preset on `value` and `defaultValue`. `DateRangePicker.Label`, `Description` and `Error`
  document their `children`. `DataTable.Pagination` documents a stable `data`, `total` and page size
  changes, and `DataTable.RowActions` its own `label`. `DataTableFilter.Root` documents the fields
  map, its parts and `actions.edit` on `fields` and `children`, the filter function on `table`, and `Bar`, `Content`, `Editor`,
  `ValuesFooter` and `DateEditor` their behavior on `children`. `Table.Row` documents
  `data-state="selected"`, `Skeleton` documents `aria-busy` on `className`, and `SkeletonReveal`
  documents how it draws, its focus and form rules and its markers on `children`. The month buttons
  declare their `icon` size and `ghost` variant, and `DatePickerField` and `DateRangePickerField`
  their `visibleMonths`, `pageBehavior` and `shouldCloseOnSelect` defaults, and
  `DateRangePickerField` its `size` default, values they already had, so the API reference shows
  them. The public types are unchanged.

  `Chart`, `BarChart`, `LineChart`, `AreaChart` and `ScatterChart` now document their rules on the
  props they concern. `Chart.Root` documents its keys on `defaultActiveX` and `orientation`, stacks,
  series intervals, scales and threshold colors on `config`, the server render on `data`, a late
  `Bar` on `data-intro`, references outside the data on `yInclude`, and `--surface` and
  `--chart-hover-dim` on `style`. `Chart.Panel` documents where each part goes, `Chart.Tooltip` its
  placement, glide and dismissal on `anchor`, `Chart.Crosshair` its width and glide on `variant`, and
  `Chart.ActiveDot`, `Chart.SlotLabel`, `Chart.LegendToggleGroup` and the table button their motion
  or keys. `Chart.Bar`, `Chart.Line` and `Chart.Area` document their looks, readings, updates and
  curves on `dataKey` and `curve`. `ScatterChart.Root` documents its keys on `children`, its option
  on `xLabel`, axis motion on `data` and references outside the domains on `xInclude` and
  `yInclude`, and `ScatterChart.Points` and `ScatterChart.Line` their paths and fitted lines on
  `dataKey`. The `curve` docs no longer promise a vertical tangent under `"monotone-y"`, the table
  button says the table stays out of the Tab order only while collapsed, and `Chart.Bar` and config
  `barVariant` say that only a vertical chart draws more than 100 slots as one path. The public types
  are unchanged.

  `LiveLineChart`, `PieChart`, `RadarChart`, `RadialChart`, `GaugeChart`, `ClockChart`, `Sparkline`
  and `SparklineHover` now document their rules on the props they concern. Each Root documents its
  keys and touch behavior on `children`, its entrance on `data-intro`, and its empty state and
  server render on `data`. `LiveLineChart.Root` documents its feed, clock and reduced motion on
  `data`, `value` and `paused`, and `LiveLineChart.YAxis` documents on `side` that a `Badge` takes
  the end column. `PieChart.Root` documents its gauge on `max` and its Other slice on `maxSlices`, and the
  center parts shared with `RadialChart` say what each prints with nothing active. `RadialChart.Root`
  documents ring order, maxima and values past them on `data`, `max` and `maxKey`. `RadarChart.Root`
  documents its four-series cap on `config`. `GaugeChart.Root` documents its meter on `valueFormat`
  and its sweeps on `value`. `ClockChart` documents comparing cycles on `Line`'s `dataKey`, stacks on
  `Column`'s, its labels on the axes' `format` and the threshold ring on `config`. `Sparkline`
  documents its hover on `data-hover`, its entrance on `data-intro` and its looks on `variant`, and
  `SparklineHover` declares `children` to document its glide. The public types are unchanged.

  The API reference now records these runtime defaults: `Alert.Icon` `weight="bold"`, every `Card`
  part's `direction="vertical"`, `ClockChart.Root`'s `stackOffset`, `yBaseline`, `innerRadius` and
  `radiusScale`, the `tone` and `variant` of `Chart`'s and `ClockChart`'s `ReferenceLine` and
  `ReferenceArea`, `ScatterChart.ReferenceLine`'s `tone`, and the options of `DatePicker.Root` and
  `DateRangePicker.Root`, such as `visibleMonths` and `pageBehavior`. Rendering is unchanged, except
  that `ScatterChart.ReferenceLine` now writes `data-tone="default"` when `tone` is unset, as
  `Chart.ReferenceLine` does.

  Fixed: in a horizontal `CheckboxGroup`, `RadioGroup`, `CheckboxItemGroup` or `RadioItemGroup`, each
  `CheckboxItem`, `RadioItem` or `SelectionItem.Shell` card filled the line, so the cards stacked.
  The cards now share the line in equal widths, and a `basis-*` class on a row sets the width below
  which it wraps. Vertical groups and `Item` are unchanged.

- 09cf8f7: Pressing Escape on an armed `ConfirmButton` inside a Dialog, Sheet or Popover now only disarms the button; a second Escape closes the overlay.
- a85ab61: `ConfirmButton` ignores presses while `isPending` or `isVisuallyDisabled` is set, as it already did for `disabled`, and disarms when either turns on. A visually disabled button no longer confirms after two presses, and a button armed before it went pending no longer confirms on the next press after pending clears.
- 0bb236b: `ConfirmButton` now swaps between its resting and armed labels on a page that Chrome's built-in
  translation has translated. Each run of text in `children` and `armedChildren`, across fragments,
  renders in one `<span>`. Before, swapping a text label for an element or a fragment threw
  `NotFoundError`, and a text-to-text swap left the translated old label showing.
- d17a9b9: A size utility in your `className` now wins on `Select.Trigger` and on a segmented `ToggleGroup.Item`
  (`spacing={0}`), as it already did on `Button` and `Toggle`. Before, the trigger's height, gap,
  padding and type and the segmented item's padding sat behind heavier `data-*` selectors, so
  `<Select.Trigger className="h-12">` or `<ToggleGroup.Item className="px-3">` changed nothing.
  Without a `className`, both render as before.
- d808c58: The md and lg control sizes now set their type with the typed utilities `text-(length:--control-text)` and `leading-(--control-leading)` instead of arbitrary properties. tailwind-merge groups the typed forms with `text-*` and `leading-*`, so a consumer `text-*` or `leading-*` class in `className` now replaces the density type through `cn` on `Button`, `Toggle`, `ToggleGroup.Item`, `Select.Trigger`, `Tabs.Trigger`, `Sidebar.MenuSubButton` and the text-entry boxes. Before, `cn` kept both classes and `<Button className="text-sm">` rendered at `--control-text`.
- fc85c72: `themes.css`: the external dark company rule (`fkas` + `company`) now materializes the complete
  dark reset set like every other dark rule, and every segment that departs from its brand base in
  either scheme gets its dark rule, so the four-attribute dark segment selector always outranks the
  three-attribute light segment selector and the cascade never falls back to emission order. No token
  values changed — the added declarations repeat values the adjacent dark brand rule already
  supplies. The emitted sheet grows by about 2.9 KB raw / 29 bytes gzip, which changes the bytes
  consumers cache.
- fdfa0f1: `DataTableFilter` now keeps the chip strip's scroll position when a React `Activity` hides and
  shows the filter while a chip's editor is open. Before, showing the filter again could scroll the
  edited chip back into view.
- 69cc780: A mouse press on a partly visible `DataTableFilter.Operator` opens its list.
- 9c064f4: A press on a `DataTableFilter` chip now lands on the segment it started on when applying an open
  editor's change resizes another chip that stays in the strip. The change applies as the press
  moves focus, before its click. Before, a chip that grew or shrank could move the pressed segment
  out from under the pointer, so an Operator's list opened and closed again, a Value opened no
  popover, or a Remove left its chip. The strip now holds the resized chip's width until the click,
  for a mouse press and a tap.
- 791a68f: Clicking a partly visible filter value in `DataTableFilter` moves the open value popover to that chip without jumping to the viewport edge.
- b9b13d7: The `DataTableFilter` field search is now an `<input type="search">`. Safari no longer opens its saved
  logins menu over the search when the add menu opens. Before, Safari took the search for a username
  field and ignored `autocomplete="off"`.
- 8030a47: After a two-finger tap or drag ends without a click, `DataTableFilter.Chips` scrolls the touched segment into view when it next receives focus.
- 74242c8: `DataTable.Pagination` keeps focus on a page button that becomes unavailable: pressing Next or
  Last through to the last page (or First or Previous back to the first) leaves the button focused
  with `aria-disabled` instead of dropping focus to the page. The page status is now a polite
  `role="status"` region, so each page change is announced.
- adfbe52: `DataTable.ResizeHandle`: Enter resets the column to its default width, as a double-click does.
  Before, no key reset it, so a keyboard user could not always return to the default width.
  Enter, Left Arrow, Right Arrow, Home and End on the handle no longer reach enclosing React
  `onKeyDown` handlers, such as a form's or a header's. A chord with Alt, Control or Meta, or a key
  that an input method is composing, still reaches them and leaves the width alone. During a pointer
  drag these keys do nothing, so the release commits the dragged width.
- 74242c8: A pressable `DataTable` row no longer presses through Fuse radios, slider tracks and thumbs, date
  segments, editable regions or other focusable elements in its cells, and a click that ends a text
  selection inside the row (copying an order number) no longer presses it.
- 7ac87e4: `DataTable.Content` and `DataTable.Header` accept a TanStack table under TypeScript 7.1. Before,
  TypeScript 7.1 rejected the table from `useTable`. The first type parameter of both components
  and of `DataTableContentProps` and `DataTableHeaderProps` is now the header group type, such as
  TanStack's `HeaderGroup<TFeatures, TData>`, instead of the header type. JSX usage infers it, so
  `<DataTable.Content table={table} />` needs no change.

  The declarations of `Alert`, `Card`, `DescriptionList`, `Empty`, `Frame`, `Table`, `VerticalTable`
  and `TimelineList` now type the `displayName` of each part as a string.

- fe544f8: Date inputs and pickers keep their focus behavior when a consumer gives a part a custom `data-slot`.
  For a `DateInput.Segment` with a custom `data-slot`, the left and right arrows move focus onto and
  off it, within an input and from a range's start to its end. A press on the box past the segments
  can focus it as it would any other segment, and an invalid form submission focuses the input's
  first segment when that segment has a custom `data-slot`. A granularity change that removes the
  focused segment moves focus to the surviving segment beside it, with or without a custom
  `data-slot`. A touch release on the segment leaves focus on it. A `DateRangePicker.Label` press
  focuses the first segment when the `DateRangePicker.Root` or its segments have a custom
  `data-slot`. A `DatePicker.Popup` with a custom `data-slot` no longer calls `onFocusLeave` when
  focus in the popup blurs with no next focus target.
- c1bc3df: A controlled `DateInput` and `DateField` now take part in a form reset. The reset drops a
  half-typed draft and clears the Field's error, touched and dirty state, a validation still pending,
  and the native validity a Field `validate` installed. The value stays the parent's, and the reset
  reports no change, as a controlled native input does. `DatePicker` and `DateRangePicker` reset
  their inputs this way instead of remounting them, so focus stays where it was.
- c1226f3: `DatePicker` and `DateRangePicker` now throw the missing-`LocaleProvider` error when they mount.
  Before, a picker rendered without the required provider worked until the user first opened its
  calendar, and only then fell to the nearest error boundary.
- 491906d: `DatePicker` opens its calendar on the `placeholderValue` month when there is no value, instead of the current month. A set value still wins, and clearing the value returns the calendar to the placeholder month.
- 2e99149: A keyboard-focused `DatePicker.PresetItem` or `DateRangePicker.PresetItem` now draws a focus outline
  in forced-colors mode. Before, the preset's focus ring was a `box-shadow`, which forced-colors mode
  drops, so a focused preset showed no focus indicator under Windows High Contrast. The preset now
  takes the shared focus ring, so in normal mode its ring is the 2px solid `--ring` that other
  controls draw, in place of a 3px ring at 50% opacity.
  The ring reads the preset's radio as the label's direct child, so a `render` element or callback
  that wraps the preset's children inside the label hides keyboard focus.
- 64b51c3: `DatePicker` and `DateRangePicker` now stay inside a parent that sizes to its content, such as an
  inline-block, when that parent has less room than the field's one line. The parent takes the room
  it has, down to the field box's minimum width. A `DateRangePicker` wraps its rows when one line
  does not fit, and a row scrolls its segments only when they are wider than the row. Before, such a
  parent kept the width of the field's whole line or its widest row, so a picker in a 256px panel that
  clips drew its trigger past the panel's edge. In a grid column sized `1fr`, a picker now takes the
  column's width down to the field box's minimum instead of widening the column.

  The Root of both pickers is now a grid of one column in place of a flex column. A flex direction or
  flex-wrap utility passed to the Root no longer applies, and a gap utility still does. `items-center`
  on the Root, or on `DateRangePickerField`, no longer centers the label, description and error across
  the field. Pass `justify-items-center` for that.

- 48d3334: `DateRangePicker`'s root now gives its parent the width of its content. Before, it measured 0px
  in a parent that sizes to its content, such as an inline-block or a `fit-content` box, and the field
  box drew 208px wide past the parent with its inputs cut off. A parent that sizes to its content and
  has the room, such as a roomy inline-block, now takes the two inputs, separator and trigger on one
  line. With less room, such a parent takes the room it has, down to the field box's 208px minimum.
- f059304: `DateRangePicker.Root` now tracks which Label, Description and Error it contains only through the
  parts' registration when they mount, as `DatePicker` does. The Error registers only while it shows.
  A Label wrapped in another component used to get different server HTML than one written inline. Now
  both get the same. The server writes no `aria-labelledby` or `aria-describedby` that points at these
  parts. The names and descriptions appear on mount.
- c36616c: A `DateField`, `DatePicker` or `DateRangePicker` box narrower than its segments now scrolls the
  segment row inline, with no scrollbar. Focusing a segment scrolls the row until the whole segment
  shows when it fits in the row, also under a scaled ancestor, and the row scrolls again when a paste
  or a resize moves the focused segment. The row scrolls back to its start when focus leaves and when the field is disabled. A segment cut off at the row's edge used to stay cut off, as did the AM/PM
  segment of a date and time to the second at the 150px floor.

  A `DateRangePicker` box now grows to hold its lines when its ends or its calendar button wrap, and
  keeps the field height when they fit on one line. From 24rem the box kept the field height, so a
  range with a time, or with large field text, cut off its end row and the calendar button. Below
  24rem a range box that fits on one line was 6px shorter than the field height at comfortable
  density.

- 03d86d9: Tabbing into a segment now shows the field box's focus ring in `DateField`, `DatePicker`,
  `DateRangePicker` and a picker popup's time input. An invalid field shows the error focus ring.
- de1c90c: `DateField` centers its segment row in the field box again. The recipe's `input` slot carried `block`, which won the display conflict against the flex the shared field group applies, so the row sat flush against the top of the box: at `dense` the suite measured 15px of slack below the row and none above. Dropping `block` restores the centring at both densities.

  `DateRangePicker` keeps one md inline inset between the en-dash and each date. Each date input inherited `DateField`'s 150px minimum width, so the start date's box grew past its content and the en-dash sat 84px from the date instead of 10px. The floor now applies only to a `DateField` that paints its own box.

- 11d3b38: Each editable segment of `DateField`, `DatePicker` and `DateRangePicker` is now at least 24px wide
  and 24px tall at both densities, with its text centered, so it meets the WCAG 2.5.8 target size.
  This holds when a `DateInput.Root` children callback wraps each segment in an element of its own.
  At dense density and a 16px root, a two-digit segment was 18px wide and a one-digit segment 11px,
  so a field can need more horizontal room than before, most of all when it shows values without
  leading zeros.
- e39eb2f: Refresh runtime dependencies to the latest admitted versions. React and
  React DOM are 19.3.0. Base UI is 1.8.0; its exact published pin moves with
  the catalog. `libphonenumber-js` is 1.13.13, and `sugar-high` is 2.4.1
  (published range `^2.4.0`).

  `Code` and the docs renderer highlight through sugar-high's granular `core`
  and `lang/javascript` entries instead of the root barrel, so the `code`
  entry measures 12855 gzip bytes — under the 17634-byte ceiling it had
  before the upgrade — instead of paying for every language preset.

  sugar-high v2 changes token classification for at least one pattern: in
  `const html = "<div>" + a + "</div>";`, `a` renders as
  `sh__token--property` where v1 emitted `sh__token--identifier`, so
  highlighted markup and its colors can differ from v1.

- 7d73f2e: `Dialog.Content`, `Field.Item` and `Select.Trigger` now drop props passed as `undefined`, because
  Base UI merged the `undefined` over the part's own value. Before, an `aria-labelledby={undefined}` on
  `Dialog.Content` removed the label that ties the dialog to its title. On `Select.Trigger` it removed
  the `aria-labelledby` link to its `Field.Label`: a native button trigger kept its name through
  `<label for>`, but a trigger rendered as another element lost it.
- fc85c72: `@elmeragroup/fuse/dialog` now exports `DialogTitleProps`, so a host wrapping `Dialog.Title`
  can type its own props — including the `isFocusable` opt-in the docs page already documents.
- 49c0fb7: In a host without Tailwind's preflight, such as one that loads Fuse's standalone `styles.css` or
  builds Tailwind without preflight, the check on a checked `DropdownMenu.CheckboxItem` or
  `DropdownMenu.RadioItem` and on a picked value in the `DataTableFilter` value list sat 3px above
  the center of its row. Both now render Base UI's indicator as one 16px `<span>` that holds the
  Check directly, so the check sits at the center of its row in every host. The row's width and the
  label's position do not change.

  The DropdownMenu indicator keeps `data-slot="dropdown-menu-checkbox-item-indicator"` or
  `data-slot="dropdown-menu-radio-item-indicator"`. Base UI mounts the indicator while the item is
  checked or the value is picked and removes it once its exit transition ends, so an unchecked row no
  longer keeps an empty indicator span.

- 6a3e5d2: External `elma` themes now carry the Elmera palette from the brand's Figma
  role sheet instead of a grayscale copy of the defaults: teal-tinted
  `background`, `foreground`, `primary`, `secondary`, the soft pairs and the
  `feature` triple all change. `--brand-elma` moves to the same P-20 tone as
  the elma foreground.

  `--primary-soft` for fkas and tkas is now P-95, byte-identical to their
  `--secondary-soft`, so every brand backed by a role sheet follows one rule.
  Surfaces using `bg-primary-soft` in those brands render a slightly more
  saturated tint.

- d0ce3b2: Bespoke icons, logos, and illustrations now render as decorative (`aria-hidden="true"`) when `title` is an empty string, instead of an unnamed `role="img"`.
- f535185: An explicit `aria-label` now wins on `Combobox.Clear` and `DatePickerPresetGroup`. When a wrapper
  forwards `id` or `aria-labelledby` as `undefined`, `TextareaField` keeps its Field label and
  `TextField` keeps its `aria-labelledby` wiring.
- 92351dc: External dark themes give `--muted` its own tone, 8% of the way from `--card` toward `--foreground`,
  the same step `--accent` takes from `--popover`. Before, `--muted` repeated `--card` and `--popover`, so
  `hover:bg-muted` painted nothing visible over them: a ghost Button in a Dialog or Popover, a Calendar day
  in the DatePicker, or a linked `Item`. A brand sheet that sets `muted` keeps its own value.
- 9471c47: External themes for Fjordkraft (`fkas`) in both segments, Fjordkraft Företag (`fkab`, which
  follows `fkas`), TrøndelagKraft (`tkas`), Gudbrandsdal Energi (`guen`), Telinet (`fkse`) and
  Elmera (`elma`) swap their primary and secondary color roles in light and dark, which they had
  the wrong way round. `--primary` now takes the text color and `--secondary` the brand color, so
  the default Button fills with the text color and the secondary Button with the brand color.
  `--primary-foreground`, `--primary-soft` and `--primary-soft-foreground` swap with their
  `--secondary-*` partners as well. `--secondary-hover` follows the new `--secondary`.

  Host apps that use `bg-primary`, `text-primary`, `bg-secondary` or the other primary and secondary
  utilities in these themes change color too. The link Button colors its text with `--primary`, so
  in these themes it reads as plain text until hover underlines it. Nordic Green Energy (`ngfi`) and
  the internal themes keep their colors.

- 6f9889c: A focused `InputGroup`, `DateField`, `DatePicker` and `DateRangePicker`
  keep their `--input` border under the focus ring, as `Input`, `Textarea`, `Select` and `NumberField` do.
  They used to turn the border `--ring` as well, so a field with an active ring drew two ring-coloured
  lines with the offset gap between them. That covered every `InputGroup` field, including
  `Combobox.Input` and `PhoneNumberField`. An invalid field keeps its `--error` border and invalid ring while
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

- 2196fc0: `PhoneNumberField` now names the group around its country picker and number after the field: its
  label, or its `aria-labelledby` or `aria-label` when it has no label. Screen readers read the
  "Select country" button in that field's context, which tells apart several phone fields in one form.

  `NumberField` no longer marks the box around its input and steppers as an unnamed `group`. The
  steppers are out of the tab order, so the input is the field's only tab stop and already carries
  its name. The box keeps its element, `aria-invalid` and styling.

- 51add90: A `Checkbox` or `Switch` that is a direct child of a vertical `Field.Root` now keeps its size when
  the field sits in a container that sizes to its content. Before, the field set it to the field's
  own width, so with no label a checkbox drew 2px wide and a default switch 18px. The field still
  stretches its other children to its width. In a `Field.Group` at least 28rem wide, a `responsive`
  `Field.Root` now also keeps a checkbox or switch at its size, as a horizontal one does.
- 054c783: The `Field.Separator` label and the inline `TextField`'s hover, focus and invalid fill now paint the
  fill of the host they rest on, `var(--surface, var(--background))`, instead of the page colour. In
  a Card, `Frame.Panel`, Dialog, Popover or any other host that states `--surface`, the "or" label no
  longer shows a tinted chip on white in branded light themes or a page-coloured chip on a lighter
  Card in dark themes, and a hovered or focused inline field no longer shows a page-coloured box.
  The label's text is the host's muted text, `var(--surface-muted-foreground, var(--muted-foreground))`,
  so it keeps 4.5:1 on the soft fill of a warning or info Alert. On the page both look as before.
- 830c045: `FileTrigger` spaces and pads its leading icon as a Button with a `data-icon="inline-start"` icon
  does, at both densities. Before, it set a fixed 8px gap between the icon and the label and padded
  the icon side as wide as the label side, so it differed from a leading-icon Button beside it, such
  as in a `ButtonGroup`. The gap now follows the density, and the icon side's padding narrows to
  Button's icon-side padding. With `withIcon={false}` nothing changes. A `className` passed to
  `FileTrigger` still reaches the button.
- 57d910c: `FileUpload.Root`'s `multiple` documentation now states the rule a pick, drop or paste follows:
  a file that fails `accept` is rejected with `"type"`, and `"count"` goes only to the files that pass
  `accept`, when more than one does.
- c714d81: External `fkab` (Fjordkraft Företag) now renders the Fjordkraft company look in light and dark, the same tokens as external `fkas` with `data-theme-segment="company"`. It previously took the orange Fjordkraft private palette, because the company segment sheets did not reach the `fkab` alias. `themes.css`, the theme catalog and the Figma variable values change for `branded-fkab-company`; `--brand` still reads `--brand-fkab`.
- e452cc2: The external Telinet (`fkse`) theme paints `--feature-foreground` in the Telinet green (`#36C275`)
  from the Telinet design. Before, it was a pale cyan (`#8FF2FF`).
- 177d30b: A keyboard-focused control now draws a focus outline in forced-colors mode, where the box-shadow
  focus ring is dropped. Before, no focus indicator showed under Windows High Contrast.
- 03260e8: Unmounting the last `ForceColorScheme` before `ThemeProvider` finishes mounting no longer overwrites the color scheme the host's bootstrap script applied.
- 84b9c43: The highlighted row of every list now shows in forced-colors mode, such as Windows contrast themes,
  under the pointer and the keyboard alike. Before, every row of `Select`, `Combobox`,
  `Autocomplete`, `Command`, `DropdownMenu` and the `DataTableFilter` add menu drew the same outline
  box, so the highlighted row looked like its neighbors.

  The highlighted row, a `destructive` `DropdownMenu.Item` included, now fills with the `Highlight`
  system color and takes `HighlightText` for its text, icons, shortcut and check. A `Kbd` cap in a
  `Command.Shortcut` drops its own background on the fill. The other rows no longer draw an outline
  box in forced-colors mode.

  `Select` and `DropdownMenu` move focus to the row, so a row the arrow keys reach keeps a keyboard
  focus outline, now drawn in `HighlightText` inside the fill, in a menu opened by the keyboard or
  the pointer. `Combobox`, `Autocomplete`, `Command` and the `DataTableFilter` add menu keep focus in
  their input, so their rows show the fill only. A focused `Select` option that loses its highlight
  while the pointer rests on the scroll arrow draws the same outline in `CanvasText`.

  In forced-colors mode a disabled row sets its text in `GrayText` at full opacity. A highlighted
  disabled row takes no fill and draws the outline in `CanvasText`. In `Combobox`, `Autocomplete` and `Command` the
  arrow keys can highlight a disabled row while focus stays in the input, and the outline marks that
  row too.

  A row whose submenu or panel is open keeps the same fill while focus is inside it: an open
  `DropdownMenu.SubTrigger`, an open field row in the `DataTableFilter` add menu, and an open trigger
  in a vertical `NavigationMenu`. A sub-trigger or trigger that becomes disabled while it is open
  drops the fill and shows its disabled face.

- 77cc477: Lines, dots and thumbs drawn only by a background fill now show in forced-colors mode, such as
  Windows contrast themes. Forced colors can turn such a fill into the color around it, so these marks
  now paint in the `CanvasText` system color there:

  - the `Separator` line, which `ButtonGroup.Separator`, `Toolbar.Separator`,
    `ActionBar.Separator`, `Sidebar.Separator`, `Field.Separator` and `Item.Separator` draw
  - the menu separator in `Select`, `Combobox`, `Autocomplete` and `DropdownMenu`, and the line between pinned and
    other values in a `DataTableFilter` value list
  - the `TimelineList` dot and connector
  - the active `Tabs` underline in the `line` variant
  - the `Switch` thumb, on and off, so the two states differ by the thumb's place and size
  - the `Radio` dot, so the checked radio differs from the others
  - the `Slider` fill, with an outline around the track. A disabled slider's fill takes `GrayText`.
  - the `Carousel` indicator dots, current, other and hovered
  - the `Tour.Beacon` dot. The beacon's pulse, which painted the page background over the dot
    there, is hidden in that mode.
  - the `DataTableFilter` dot on a field row that already has a filter

- 3012f4a: Pressed, checked, active, current, armed and selected parts now show their state in forced-colors
  mode, such as Windows contrast themes. Before, forced colors replaced the colors that show the
  state, so these parts looked like their resting siblings:

  - a pressed `Toggle` and `ToggleGroup.Item`, in the default and the outline variant, lost their
    pressed fill and text color;
  - the active `Tabs.Trigger` in a default `Tabs.List` lost its card fill, shadow and text color;
  - the checked `RadioIconButton` lost its fill and its primary border color;
  - the active `Sidebar.MenuButton` lost its fill and text color and kept only its weight, and the
    active `Sidebar.MenuSubButton` lost its fill and text color;
  - the active `NavigationMenu.Link` lost its text color and kept only its weight;
  - the checked `DatePicker.PresetItem`, and the pressed date preset of a
    `DataTableFilter.DateEditor` that shows its presets beside a custom editor, lost their accent
    fill and text color;
  - the current page's `Pagination.Link` draws a border where the other links draw none, but forced
    colors draw every link's border in the link color, so it looked like the others;
  - an armed `destructive` or `success` `ConfirmButton` lost its error or success fill and text
    color.

  They now fill with the `Highlight` system color and take `HighlightText` for their text and icons.
  The highlight recolors the borders a part already draws, its own in `Highlight` and those inside
  it in `HighlightText`, and adds none. A Kbd, Badge or Avatar inside one drops its own background,
  so its text stays readable. The active tab of a `line` list keeps its underline and gains no fill.

  Under keyboard focus they keep the fill and draw a 2px `HighlightText` outline inside it, 2px in
  from the edge. A `DatePicker.PresetItem` draws it while its radio has focus. An outline outside
  the part would be clipped by a scrolling container and would not show beside a pressed segment.
  A control focused inside one of these parts draws a `HighlightText` outline around itself. A
  `Sidebar.MenuAction` and a `Sidebar.MenuBadge` beside an active row draw their icon, text and
  count in `HighlightText` on the row's fill, a child that sets its own text color included, and
  the action draws its focus outline in `HighlightText`. A filled child, such as a secondary
  `Badge`, drops its background and draws its border in `HighlightText`, as inside a highlighted
  part. A mark drawn only by its `mark-fill-*` background, such as an unread dot, fills with
  `HighlightText`. A disabled active `Sidebar.MenuButton`
  draws a 2px `Highlight` frame on its edge in place of the fill, dimmed with the row, and the
  action and badge beside it keep the forced colors of any other row.

  A selected `Table.Row` lost its muted fill, in a plain table and inside a `Frame`. It now draws a
  2px `Highlight` frame on its edge, over its cells, and leaves the cells as they are, so a Meter's
  bar, a sticky cell's background and text selected inside the row keep their forced colors. A
  sticky cell with its own `z-index` covers the frame where it overlaps it. A row under keyboard
  focus, selected or not, draws a 2px `CanvasText` outline 4px in from its edge, inside the frame,
  where the table's scrolling container does not clip it.

  In forced colors a `Table.Header` made sticky with no `z-index` of its own stays above the frame
  and outline of a row that scrolls under it.

  The step dots of `Tour.Progress` no longer disappear in forced-colors mode: the other steps' dots
  draw in the text color and the current one in `Highlight`.

- d0ce3b2: A form whose `onReset` handler stops propagation no longer blocks native reset for an uncontrolled `NumberField`, `PhoneNumberField`, or `TextareaField`. An uncontrolled `NumberField` focused inside a shadow root also keeps focus through the reset remount, and a suspended update no longer disables reset for a field that is still displayed as uncontrolled.
- 0bb4f71: Uncontrolled checked controls and text fields now share one `reset` listener per document or shadow
  root to follow a native form reset. Before, each `Checkbox`, `Switch`, `CheckboxCard`, radio and
  field added a listener of its own, so a `DataTable` with a selection checkbox per row added one per
  row.
- 7711b62: `Form`'s JSDoc now says that every submit stops while an enabled Field inside it is invalid: an
  `errors` entry counts until its own field changes or a new `errors` object leaves it out, and
  `invalid` for as long as it is passed. When a change elsewhere can make a field valid, as with
  rules in a schema, pass a new `errors` object without the stale message, or use a plain
  `<form noValidate>` and pass each field `isInvalid` and `errorMessage`. The Form page shows
  that path.
- 0eca8ed: Field wiring survives props forwarded as `undefined`. Before, an `aria-labelledby={undefined}` on `Input`, `Field.Control`, `Combobox.Input`, `Combobox.ChipsInput` or `Combobox.Trigger` dropped the Field label reference, and on `Field.Set` it dropped the legend name. An undefined `aria-labelledby`, `aria-describedby` or `role` on `Sheet.Content` dropped the dialog's name, description and role.

  `TextareaField` inside a disabled `Field.Set` is now disabled. Before, it stayed editable.

- 2f2a6c8: `Table.Root`: when a table scrolls sideways and its viewport takes keyboard focus, the viewport's
  focus outline shows on all four edges in Chromium, over a framed body, sticky cells and a table with
  its own `z-index`. A table that sets its own `tabIndex` keeps that value on the table, and its
  viewport then leaves the tab order and draws no outline. Before, inside `Frame.Root`, the body
  covered the outline. The table now sits in a scrolling `table-viewport` inside `table-container`,
  and the viewport carries the tab stop, its role and its name. A selector written as
  `[data-slot="table-container"] > table` needs the viewport between the two. The container no longer
  scrolls, so a style that lets the table spill out sets `overflow: visible` on
  `[data-slot="table-viewport"]`, which also drops the stop. In a height-capped Frame the viewport
  scrolls both axes, and a sticky `Table.Header` stays at its top. In an inline-block parent, the
  table's box now aligns to the first baseline of its content, not to its bottom edge.
- 12cf820: `CheckboxGroup`, `RadioGroup`, `CheckboxItemGroup` and `RadioItemGroup`: a labeled group's
  `description` now sits directly under its label, with the 12px group gap before the options.
  Before, it sat 24px under the label, as far as the options. A group without a description keeps
  24px between its label and its options, and a group without a label keeps its spacing.
- f2a7a24: The comment on Heading's internal class helper, which an editor shows beside `HeadingLevel`, no
  longer says the Figma kit builds its text styles from it.
- d0ce3b2: Hidden sidebar panels and item footers are no longer reachable from the keyboard.

  - Collapsed offcanvas `Sidebar` contents leave tab order and the accessibility tree. `Sidebar.Rail` stays a mouse-only control for reopening the panel.
  - `Item.Footer` with `mode="hidden"` — and `SelectionItem.SubSection`, which forwards that mode — renders `inert` until the mode changes.

- 2548461: `InputGroup.Addon`: an inline addon holding a button drops its block padding, so an `xs` or
  `icon-xs` `InputGroup.Button` keeps its 24px target inside a dense field without overflowing it.
- 74242c8: A click on `InputGroup.Addon` chrome now focuses the group's own control, the Root's direct
  `InputGroup.Input` or `InputGroup.Textarea`. Before, it focused the first input anywhere in the
  group: nothing in a Textarea group, a field nested in an addon, or a PhoneNumberField's hidden
  country input, which sent focus to the country picker. A click on a button, label or field nested
  in the addon, or in a popup portalled from it, keeps its own focus.
- 25b6c60: `InputGroup.Addon` no longer renders `role="group"`. `InputGroup.Root` is the one group around the
  control, so Autocomplete, Combobox, Command, DataTableFilter, PhoneNumberField and SearchField no
  longer nest an unnamed group inside it. A test that found an addon by `role="group"` should query
  `[data-slot="input-group-addon"]` instead. When an addon groups several controls that need a shared
  name, pass `role="group"` and `aria-label` to it.
- 5a26dfb: A click on an `InputGroup.Addon` focuses `InputGroup.Input` and `InputGroup.Textarea` even when the
  control has a custom `data-slot`. A click on the addon of `Command.Input`, `Combobox.Input` or
  `Autocomplete.Input` focuses its input when the input has a custom `data-slot` or a `render`
  element.
- 7b2e8ac: `InputGroup.Root` paints the field fill (`bg-card`) like `Input`. Before, it was transparent, so
  wherever `--background` and `--card` differ (every external theme and the dark themes) an
  InputGroup, and PhoneNumberField built on it, showed the page background while an `Input` beside
  it was filled. A group on a surface that should show through, such as a sidebar, takes a
  background class, for example `className="bg-background"`, which merges after the fill.
- 16834bb: When `Command.Input`, `Combobox.Input` or `Autocomplete.Input` has a `render` element, its field
  box shows the keyboard focus ring again. The box also regains its disabled and read-only fills,
  and its error border and ring for an invalid input.
- c891fba: Internal themes now round with an 8px `--radius`, `0.5rem`, up from 6px. Cards, buttons, fields,
  `Frame` and the other outer corners round at 8px. The rows inside menus, `Select` and `Combobox`
  lists and `Frame` panels round at a concentric 4px instead of 2px. The `Checkbox` corner stops at
  4px in every theme, so the 16px box does not round into a circle that reads as a radio. An
  external `Checkbox` keeps its 4px corner. A `--radius` override above 4px no longer rounds the
  `Checkbox` with it. To keep the 6px corners, set `--radius: 0.375rem` on the element that carries
  the theme attributes.
- d5cc1f9: `Item.Footer` in its `hidden` and `visible` modes, and with it `SelectionItem.SubSection`, now clips
  absolutely positioned content that has no positioned ancestor inside the footer. Before, such content
  escaped the clip: the visually hidden input of a named form control in a collapsed footer, such as
  `DateField`'s or a named `Switch`'s, lengthened the page or scroll container below the collapsed row.
  In those two modes, that content now positions against the footer's content element instead of the
  footer's root, so an inset child such as `absolute top-0 right-0` moves to the content element's
  corner: 0.5rem down and 0.25rem out at the default root.
- dc10d26: `Item.Footer mode="hidden"`, and with it `SelectionItem.SubSection`, `CheckboxItem.SubSection`
  and `RadioItem.SubSection`, clips its content. The collapsed row was 0px, but its content kept its
  full height and overflowed invisibly, so a hidden form in the last option of a list added blank
  scroll past the end of the page, or a scrollbar with nothing to scroll inside a Sheet or Dialog.
- 37f5aff: `Item.Group` now takes its smaller gap only from its own `sm` or `xs` rows: direct child
  `Item.Root`s, with or without a `render` element. An `Alert` or a small `Item.Root` nested inside a
  row, or a row wrapped in another element, no longer changes the group's gap. A `gap-*` class in the
  group's `className` now replaces the gap even when its rows are `sm` or `xs`. A vertical
  `RadioItemGroup` or `CheckboxItemGroup` with an `Alert` in a row's `SubSection`, even a hidden one,
  keeps its rows joined, and a horizontal one keeps its usual gap.
- 5405a5e: An `Item.Root` with a `render` element inside `Item.Group` now keeps the rendered element's own
  role. Fuse wraps it in a `role="listitem"` element, so a link item reads as a link inside a list
  item. Before, `listitem` replaced the link or button role. The wrapper copies the `hidden` and
  `aria-hidden` the rendered element ends up with, set on `Item.Root` or on the `render` element, so
  a hidden item adds no list item or gap. An explicit `role` on `Item.Root` still replaces both and
  skips the wrapper.
- 9067606: `Alert`'s status icon now centres on the title's first line when the alert has a description.
  Before, it sat 2px below the line. Beside a description, `Item.Media` and `Item.Content` align to
  the row's top. `icon` media centres a glyph of any size on `Item.Title`'s first line, and `default`
  and `image` media top-align with the content, so tall media such as an avatar shares the content's
  top edge. A glyph that should sit on the title's line belongs in `icon` media. A height or size
  class sets the box of `default` and `icon` media, while `image` media keeps the size its row's
  size sets. `Item.Actions` stays centred on the row.

  `SelectionItem.Actions`, also `CheckboxItem.Actions` and `RadioItem.Actions`, centres text or a
  badge on the title's first line, and its text takes the title's line height. Wrapped text keeps
  its first line beside the title and grows the row. A plain-text `CheckboxItem` or `RadioItem` row
  centres its control on the text's first line at comfortable density.

  `Alert.Title`, `Item.Description` and `SelectionItem.Description` reset their block margins, so a
  host without Tailwind's preflight keeps the 4px title-to-description gap.

- 74242c8: `Item.Separator` inside `Item.Group` is now hidden from assistive technology, so the group's list
  owns only list items; outside a group it stays a `separator`. `Code` takes the `region` role only
  when it has an `aria-label` or `aria-labelledby`, and stays a keyboard-scrollable tab stop without
  one.
- 550bc43: Every JSDoc block in the package now reads in one style, so the API reference, the markdown
  endpoint and editor hovers describe each prop the same way. Boolean props open with "Whether",
  callbacks with "Called when", and props types with "Props for". Defaults the code declares are no
  longer repeated in prose, and the docs use US spelling. The public types and runtime behavior are
  unchanged.
- 9856f87: **Host overrides of light-only theme roles now hold in dark.** The roles a dark palette keeps
  from light, `--button-outline-width`, `--button-outline`, `--card-border`,
  `--card-section-divider`, `--card-shadow`, the `--selection-*` edge, divider, disabled and
  title-weight roles, `--toggle-pressed` and `--toggle-pressed-foreground`, the
  `--paragraph-leading-*` roles and the `--heading-*` scale, are no longer restated by the dark rules
  in `themes.css`. The light rules declare them in both schemes, so computed values are unchanged. A
  host override of one on the theme element, at the light rule's weight, now holds in dark as well as
  in light, where a dark rule used to outweigh it, as #466 already did for the corners.
- c891588: The light syntax-highlighting colors that `Code` paints now reach 4.5:1 on the `background`,
  `card`, `card-soft`, `dialog`, `panel` and `muted` fills, in all 24 themes. `Code` paints no fill of
  its own, so place it on one of those. The change darkens eight `--sh-*` syntax colors:
  `sh-keyword` `#b04500`, `sh-string` `#537000`, `sh-class` `#835aaa`, `sh-property` `#006e9a`,
  `sh-entity` `#9d5e00`, `sh-jsxliterals` `#007b5d`, `sh-sign` `#a24f21` and `sh-comment` `#696d73`.
  `sh-identifier` and the dark values are unchanged.
- 0c1446e: A `Link` with `underline="none"` no longer fades on hover and draws no underline at rest or on
  hover, in every variant. The 80% fade took `muted` text under 4.5:1 on the page: from 4.98:1 to
  3.35:1 in Fjordkraft's neutral light theme.
- e6ddad7: `Chart.Root` and the bar routes no longer ship the live line chart's words and its `value` data
  message, which saves about 0.9 kB of minified JavaScript on the `Chart.Root` route.
  `LiveLineChart` reads them from its own tables, and every string it prints and speaks is unchanged.
- 150a988: `LiveLineChart.YAxis` and `LiveLineChart.Grid` leave out a value tick and its grid line whose resting
  place is inside the 16px fade at the plot's top or bottom. A tick beyond the resting domain, which a
  contracting domain carries out, still fades at the edge it leaves by. A paused chart's ticks rest where
  they show, at the step of the domain it holds. `LiveLineChart.XAxis` leaves out a time tick inside the
  40px side fades while the window holds still: while the chart is `paused`, while the clock waits out a
  lead from readings stamped ahead of the wall clock, and under reduced motion, where the window redraws
  on a new reading and when `value` or `windowMs` changes. When that would leave the axis empty, it keeps
  the tick nearest the middle if its label fits at the axis's font size in any common sans. A tick at rest is opaque once its enter fade finishes,
  and holds `muted-foreground`'s contrast. Before, a tick could rest partly faded, under 4.5:1. Ticks
  still fade at the edges while the window scrolls or the domain glides, and value ticks and grid lines
  still fade in and out as they enter or leave.
- 153d74a: `LiveLineChart.XAxis` now accounts for the axis's font size when it picks its tick spacing, so a
  larger root font size or text zoom widens the step. Before, the step assumed 12px labels: at a 32px
  root, a 600px chart stepped 5s and left about 15px between labels.

  A still axis also leaves out a tick whose label would cross the plot's edge at that size. When no
  tick of its step fits, it keeps the tick nearest the middle whose label fits, of a finer step if
  need be, labeled in that step's format.

- 4d7e5f3: The full logos of the energy brands in `@elmeragroup/fuse/icons` paint their lettering in
  `currentColor`, as `ElmeraGroupLogo` and `FjordkraftLogo` already did, so the name takes the text
  colour around it. Marks drawn in brand colours keep them. This changes the `variant="full"` artwork
  of the four logos below; the `variant="mark"` artwork and `TrumfLogo` are unchanged:

  - `TrondelagkraftLogo`: the letterforms and the lamp's ring and base were white. The lamp's
    yellow light stays yellow.
  - `GudbrandsdalEnergiLogo`: the lettering was white. The orange gradient mark stays.
  - `TelinetLogo`: "Energi" was navy. The word "Telinet" and the dotted mark stay cyan.
  - `NordicGreenEnergyLogo`: the lettering was dark green. The five-leaf mark stays.

  Where a page relied on the old fixed ink, set that colour as the text colour around the logo, for
  example white on a dark brand surface.

- 141e501: From Chrome 111 to 119, on a page without a `dir` attribute, the `NavigationMenu` caret now turns
  toward a submenu that opens to the inline start or end, and the `Sidebar.Rail` toggle strip is
  centered on the sidebar edge again. Both used Tailwind's `ltr:` variant, which matches nothing
  there because it needs `:dir()` from Chrome 120 or a `dir="ltr"` attribute.
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
- 74242c8: `Meter`'s fill transitions only its width and colour instead of every property. An uncontrolled
  `TextareaField`'s `maxLength` counter now counts text typed into an empty field before
  hydration, instead of showing 0 until the next keystroke.
- 43ff83e: `Dialog.Title`, and the `AlertDialog.Content` title through it, grows from 16px on a 16px line to
  20px on a 28px line, the type `Sheet.Title` already had. At comfortable density the 16px title was
  the size and weight of a `Field.Label`, below the 18px controls in the same dialog, so it no longer
  read as the dialog's heading. All three titles now share one class, and a wrapped title keeps the
  28px line. `AlertDialog.Content` centres its icon on the title's first line. `Sheet.Title` no longer
  paints `--foreground`; it inherits the modal's `--dialog-foreground`, as `Dialog.Title` does, so a
  host that sets its own `--dialog-foreground` reaches the Sheet title too. The titles also reset the
  `h2` block margins that a host without Tailwind's preflight would otherwise keep. To put one
  `Dialog.Title` back on the old type, pass `className="text-base leading-none"`.
- b687abd: Light `--muted-foreground` is now an opaque colour that reaches 4.5:1 on `--background`, `--muted`,
  `--card` and `--card-soft` in every theme, so field and selection row descriptions, popover copy and
  other muted text meet WCAG 2.2 AA 1.4.3. The external palettes and the fkas company segment drew the
  brand foreground at 70% alpha, so the same text measured differently on each surface; each now sets
  an opaque tone of that foreground that matches the old colour on a white card. Telinet (`fkse`)
  darkens slightly, from 4.35:1 to 4.56:1 on `--muted`, and the internal light grey moves from
  `oklch(0.5555 0 0)` to `oklch(0.544 0 0)`, from 4.35:1 to 4.56:1 on `--muted` and 4.57:1 on
  `--card-soft`. Nordic Green Energy and every dark theme keep their values. The accessibility page no
  longer lists muted text as an accepted deviation. Muted text over a host's own tinted fill or image
  no longer lets that backdrop show through.
- c13ade0: A page whose document exposes a `host` property through named access, as it does for one
  `<form name="host">`, no longer freezes the tab. Before, Fuse read such a document as a shadow root.
  Its walks out of shadow roots stepped from the document to its `host` and back to the document
  without end. With two such elements, `document.host` is an `HTMLCollection` and the walk threw.
  Date picker and `RangeCalendar` focus handling, `ListDetail`, `Calendar` keyboard navigation,
  `ActionBar`, `Carousel` rotation, `DataTableFilter` and paste into `FileUpload` ran these walks.
  `FileUpload.Root` also took a paste while focus was outside it, when the element named `host` sat
  inside the Root.
- cb3e2b5: `NavigationMenu`: a hovered link row in a content panel, and a hovered or open vertical trigger,
  recolour their descendants to `--accent-foreground`, as Select, Combobox and DropdownMenu items
  do. A `text-muted-foreground` description inside such a row measured 4.43:1 on light `--accent`,
  under the 4.5:1 text floor (WCAG 2.2 SC 1.4.3). The vertical trigger's caret takes the same
  colour while the row is highlighted.
- 5aec735: A `CheckboxItem`, `RadioItem` or `SelectionItem.Shell` row no longer paints as checked when a row
  nested in its `SubSection` is checked. Before, an unchecked row took the checked fill, border and
  dividers from any checked row inside it, even inside a `mode="hidden"` SubSection. A row now reads
  only its own control.

  A title-only `Item` nested in a described `Item`'s `Item.Footer`, or in the `SubSection` of a
  `CheckboxItem` or `RadioItem` with a description, keeps its own centring. Before, the outer row's
  description top-aligned the nested row's media and content, so its title sat about 10px above its
  media's centre. Each row now aligns by its own `Item.Description`.

- 811e1c4: The focus ring is one neutral grey, `oklch(0.6 0 0)`, in every theme and both colour schemes, held to 3:1 against the page and card surfaces. It is a flush 2px ring with no offset gap. A keyboard-focused invalid control draws a solid 1px `--error` line between its border and the resting error halo, so focus stays visible on an invalid field. The `Button` fill now reaches its border edge, so no hairline of page shows between the fill and the ring. Every external theme rule declares `--ring` and `--sidebar-ring`, so a brand can tune its ring with a `ring` entry in its light palette and in each of its dark sheets, segment sheets included, and a host's `--ring` on one scope stops at a nested theme scope.
- d6f5465: The NumberField denomination now takes the xs control inset (`--control-px-xs`) on each side:
  8px at dense density and 12px at comfortable. Before, it was a fixed 8px at both densities.
- 87577ce: A `NumberField` with `minValue` and no `step` now submits a typed value such as `99.5` under `minValue={1}`. Base UI defaulted the omitted step to 1 on the hidden form input, so native validation rejected every value off the 1-step grid counted from `minValue`, and the form did not submit. Arrows and steppers still move by 1. An explicit `step` together with `minValue` still requires typed values to land on its grid, as a native number input does, and the `step` JSDoc now says so. Pass `step={1}` to keep accepting whole numbers only.
- d0ce3b2: Native form reset now restores an uncontrolled `NumberField`'s `defaultValue` (or clears it when there is none) without calling `onChange`, matching the other field composites. A controlled `value` stays parent-owned.
- 9be8046: `NumberField`'s steppers now show the field box's fill instead of painting the page `background`.
  Branded themes tint the page and keep the field box on `card`, so the steppers showed a band of
  page tint inside the white box. A read-only field's steppers showed the same page fill on its
  `muted` box in every theme. A resting stepper now matches its box. Hover and a stepper disabled at
  a bound keep the `muted` fill.
- 69bda40: NumberField's stepper buttons now name the field they change: each reads its own name and then the
  field's label, such as "Increase Quantity", or the field's `aria-label` when it has no visible
  label. `increaseLabel` and `decreaseLabel` still set the first part. Before, every stepper was
  named "Increase" or "Decrease" alone, so a touch screen reader user swiping through a form with
  several number fields could not tell which field a stepper changed.
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

- e363df9: The outline `Button` rests transparent rather than on the page fill, so it shows the surface
  beneath it: the page, a Card, a Dialog or a Popover. The `DataTableFilter` chip, which sits beside
  the outline Trigger, rests transparent too.

  - Inside a Card on an external light page, or inside a Card, Dialog, Sheet or Popover in dark, an
    outline Button no longer shows the page fill through the surface. It matches the surface.
  - On the page it looks as before. On the fkas private and guen pages its `muted` hover still
    lightens it, as the ghost Button's does, until design settles a light `muted`.
  - The parts that render the outline variant follow: the current Pagination page, the Toast action,
    the Dialog and Sheet footer Close, the DataTable pagination moves and column toggle, and the
    DataTableFilter Trigger and its Clear outside the bar.
  - The default `Alert`'s action, which borrowed the page fill too, now rests transparent on the
    Alert's own fill and looks the same.

- df88ebc: Overlays now reverse when they are opened or closed mid-transition. Popover, Select, Combobox,
  Autocomplete, DropdownMenu, Tooltip, Dialog, AlertDialog, `Command.Content`, the chart tooltips
  other than `LiveLineChart.Tooltip`, and the data table filter's menus open and close with CSS
  transitions, so a close during the opening, or an opening during the close, eases back from where
  the popup is. Before, the popup jumped to the start of its other animation. Dialog's backdrop
  reverses with its popup. The look is unchanged: the same fade, 95% zoom, entry slide from the
  trigger's side and durations. A popup that is already open when it mounts, such as one with
  `defaultOpen` or a Root first rendered with `open` set, now appears at rest without an entrance
  animation. Under reduced motion the popups still only fade.
- f96f32e: When React reveals an uncontrolled `PhoneNumberField` inside an `<Activity>`, the field no longer
  sends `onChange` a number it stopped submitting while hidden. Before, a props change made while the
  field was hidden, such as a new `countryCode`, kept its output for `onChange`, and a later
  `outputFormat` change did not replace it. An uncontrolled field now sends the number it submits at
  the reveal, and nothing when that number is the output from before the proposal. A controlled field
  still sends the number the change proposed. A later change that would call `onChange` replaces the
  queued call, so `countryCode` moved from `NO` to `SE` to `DK` while hidden, with
  `outputFormat="e164"` and `preserveOnCountryChange`, sends only `+4541234567` for `41234567`. A new
  `value` while the field is hidden cancels a call queued before it, so the parent no longer hears the
  old number on reveal.
- 5471aa0: Under a controlled `countryCode`, `PhoneNumberField` now judges a parent's answer to a waiting pick
  or paste against the output the parent heard, never against an output that a later format,
  metadata or catalog change gave the proposal. The same final props give the same display, output
  and notices whether such a change came before the answer or with it. Before, a parent's old value
  could match a carried output by chance: a format change alone then answered the number, or a held
  output was read again as a new value, so a picked Finnish number showed `0401234567` instead of
  `401234567`.
- 74242c8: `PhoneNumberField`'s country trigger now tells a screen-reader user which country the number goes
  with, without opening the picker. A read-only field's trigger no longer carries `aria-readonly`,
  which the button role does not support.
- 94e2768: `PhoneNumberField`'s country trigger is now named by the dial code it shows, then the selected
  country, such as "+47 Norway" ("+47 Norge" in Norwegian). A voice-control user can say the "+47"
  they see to open the picker (WCAG 2.5.3, label in name). "Select country", and a
  `selectCountryLabel` override, now describes the trigger and still names the country popup. Tests
  that find the trigger by role and the name "Select country" must look for the new name. A
  single-country field now reads its dial code before the country, in the same order.
- 11f18e2: `PhoneNumberField` now renders as one element, as `TextField` does. Its hidden form input used to
  follow the field as a sibling, so in a `space-y-*`, `divide-y` or `last:` container the phone field
  got a trailing margin or border that `TextField` did not. The input now sits inside the field, and
  form submission is unchanged.
- 74242c8: `PhoneNumberField`'s `metadata` JSDoc now says that custom or trimmed metadata does not shrink the
  bundle, since the field imports its full default metadata either way.
- ac0b851: `PhoneNumberField` keeps the caret among the digits when an edit makes it rewrite the display, as `formatOnType` does on most keys. Correcting a digit in the middle of a number, deleting a space the formatter puts back, or deleting forward no longer sends the rest of the typing to the end, and an international display keeps the caret after the calling code it adds. The caret stays put when the parent's answer shows the display the edit proposed, even if the parent stores the number in another form; otherwise, including a proposal echoed only in a later render, the field leaves the caret where the browser puts it.
- 83967e0: `PhoneNumberField` lists the country picker's rows in the alphabetical order of their names in the active locale, so "Nederland" precedes "Norge" in Norwegian and "Åland" follows "Sydafrika" in Swedish. The rows sort as the picker opens, so a field resolves no country name before its first open, the selected country stays highlighted, and a locale change reorders the rows at the next open rather than under the highlight.
- 886c820: The `PhoneNumberField` country trigger now meets the 24px minimum target size at both densities. It was 22px tall. The field keeps its height.
- 147f2c6: The `PhoneNumberField` dial code now uses the number input's font size and the font's normal line height, so it lines up with the typed digits at both densities. It used a smaller fixed size and sat higher.
- 91ef204: `PhoneNumberField` keeps a number typed or autofilled before React hydrates. The field used to start from its own initial value and wrote it over the typed text in the first render after hydration, so the number vanished and the hidden input never held it. It now reads the typed number once, as hydration commits, and proposes it as an edit, so `onChange` reports it once and a controlled parent can accept it.
- 55c27a2: `PhoneNumberField` no longer calls `onChange` when a proposal's output equals the value the parent
  already holds: the `value` prop of a controlled field, compared exactly, or the output an
  uncontrolled field already shows. Deleting the separator in "41 23 45 67" used to send
  `"+4741234567"` again; now it calls nothing, and the display re-formats with the caret where it was.
  A parent that stores another form of the number, such as national digits, still gets every call.
  The same rule covers typing, paste, country picks (a pick that clears an already empty number
  calls nothing) and the call as hydration commits.
- 09cf8f7: `PhoneNumberField` now forwards `required` to its input so an empty required field cannot submit, and an unnamed field no longer adds a `phone-number-display-value` entry to form data.
- d0ce3b2: Native form reset now clears an uncontrolled `PhoneNumberField` number while keeping the selected country. `onChange` and `onCountryChange` are not called; a controlled `value` stays parent-owned.
- 573834d: `PhoneNumberField` keeps the trunk prefix of a national number on display as the user types, so a Swedish "0701234567" no longer loses its leading 0 on the next key. Without `formatOnType` the field shows the typed digits without separators; with it, libphonenumber's as-you-type format ("070-123 45 67"), which now also groups a partial number ("41 23 4"). A typed national number without its trunk prefix stays as typed rather than gaining one. A number detected from a `+` or `00` prefix keeps the national display it had, and a copied number that a space or parenthesis precedes, such as " +46 70…", is now detected too. The submitted value no longer counts a trunk prefix that libphonenumber read as part of the number behind the calling code, such as Kazakhstan's 8.
- 3242aaf: `PhoneNumberField` shows the country a controlled `value` names after the parent echoes a pasted
  number, also when a tab or newline cut the previous value short. Before, a previous value of
  `"+46\n701234567"` under `countryCode="NO"` kept Norway after the parent echoed a pasted
  `"+46701234567"`, though the echoed value names Sweden.
- 7cafa6c: Under a controlled `countryCode`, a parent can answer a waiting pick or detected country with the
  output it heard, and `PhoneNumberField` now takes that answer as acceptance. This works even when a
  format or metadata change comes between the proposal and the answer, and the field shows the same
  result either way. A preserved pick keeps its digits as typed, so a picked Finnish number shows
  `401234567` rather than `0401234567`. Before, a change in between made the field read the parent's
  value again. The field could then show a different display, or read a pasted number in the parent's
  country.
- 55bb41b: Under a controlled `countryCode` that keeps resolving to the same country, `PhoneNumberField` now
  submits the same number whether a `metadata` change comes in a render before the parent stops
  controlling `value` or in the same render. Before, releasing the value with the change moved the
  number shown before by its international form, so a national `0401 234 567` under a catalog with
  no AU trunk prefix submitted `+61401234567` instead of `+610401234567`.
- 120cd68: `PhoneNumberField` calls `onCountryChange` a second time when it returns to a pasted number's
  country. This covers a paste the field already showed in that country, under a set `value` and a
  `countryCode` of another country. After a render that shows the `countryCode` country, the next render that shows the
  pasted number's country calls `onCountryChange` with it again.
- c1aadcb: While a country the user picked, pasted or typed waits for the parent and the picker still offers
  it, a new `countryCode` that accepts it or moves the field to another country now makes an
  uncontrolled `PhoneNumberField` compare its output with the output from before that proposal.
  Before, an `outputFormat` change during the wait moved the output it compared with. For the number
  `41234567` under `countryCode="NO"` with `preserveOnCountryChange`, picking Sweden, switching from
  `"e164"` to `"raw"` and then setting `countryCode="SE"` never called `onChange("41234567")`.
- 7247e69: `DatePicker` and `DateRangePicker` no longer dispatch a made-up `focusout` when focus leaves the
  picker after a visit to its popup, so an `onBlur` on an element around the picker sees only real
  blurs. The input's validation still waits while focus is in the popup and runs once focus leaves
  both. A commit that runs when focus leaves now reports the real focus event in `onValueChange`'s
  `details.event`.
- ac5291f: `DatePicker` and `DateRangePicker` no longer remount their calendar when the value changes from
  outside. The open calendar moves to the new value's month in place and keeps keyboard focus on its
  day, and a form reset still opens it on the reset value. A range the parent sets while the user is
  choosing one drops the half-chosen range. A parent that accepts the picker's own edit a render later,
  through a transition or a deferred value, no longer moves the month the user paged to.
- 4013546: An open `DatePicker` or `DateRangePicker` calendar inside a `ThemeScope` that clips its overflow
  now moves to the side of the field with room when the viewport, the scope, the field or the
  calendar changes size. Before, it kept the side it opened on, so a viewport that shrank under an
  open calendar clipped its last rows.
- fcd958e: A controlled `DatePicker` or `DateRangePicker` whose parent ignores a change, without calling
  `details.cancel()`, no longer carries that change into the next gesture. A later pick builds on the
  parent's value. A parent that accepts a change keeps it, even when a second gesture follows in the
  same task before the parent renders.
- 88f25d7: When new data drops a `PieChart` category's row while the pie has an Other slice, the category's
  slice collapses onto the start of the next slice that stays, or onto the sweep's end when no slice
  after it stays. Before, it always collapsed onto Other's start.
- 204a034: The polar charts share three fixes from `GaugeChart`'s review. `PieChart`'s, `RadialChart`'s and
  `ClockChart`'s centres split a value at the number Intl writes, so a whole unit such as
  `øre/kWh inkl. mva` reads small after it, a scientific `3.9E3`, a sign and a compact `1,2 mill.`
  stay in the number, and a long unit wraps before its VAT basis. `PieChart.Root` and
  `RadialChart.Root` throw `invalid-sweep` for a `startAngle` or `endAngle` that is not a finite
  number, where an infinite one hung the render. A print draws every chart at rest with no entrance,
  roll or fade still running.
- 7a3ab36: A polar chart's Tooltip now opens in its lane when the Root mounts with an item active through
  `defaultActiveX`, `defaultActiveKey` or `defaultActiveName`, and updates on the first pointer pass.
- f657d13: A pie, radial, radar or clock tooltip now sizes itself for the text a `TooltipLabel` `render`
  function or component prints. Before, one that printed the item's name on the first step, such as
  one that abbreviates only long names, made the popup as wide as the longest name it never printed.
  In a short viewport that popup took the lane above the chart and opened partly out of view. With a
  `render` function or component, the popup measures the content it shows, and measures it again
  whenever that content changes, such as a label that names the series as the focus moves between a
  radar's series. The popup keeps the largest width it has measured for the same chart data, across
  steps and reopenings. A popup in a side lane is at most 256 px wide, so a wider label wraps there.
  A `TooltipLabel` without `children` still opens as wide as the longest name when it has no
  `render`, or a `render` element of an HTML tag without children of its own, such as `<strong />`.
- c2a1571: `PieChart.Tooltip`, `RadialChart.Tooltip`, `RadarChart.Tooltip` and `ClockChart.Tooltip` no longer
  take `anchor`, which never moved them. Their shared props type is `ChartPolarTooltipProps`, which
  has no `anchor`. Remove `anchor` from these tooltips when upgrading from an earlier canary.
- f9fff6e: `PopoverInfoButton`'s popup now takes the button's `label` as its accessible name, defaulting to
  the localized "More information". A `Popover.Title` in the content still names the popup instead.
  Before, the popup opened as a dialog with no name unless the content held a `Popover.Title`.
- 8294432: `PopoverInfoButton` defaults to `size="icon-inline"` instead of `icon-sm`. Beside a `Field.Label`'s
  text the trigger now centres on the label's line and keeps the label one line tall. Before, the
  taller `icon-sm` square sat lower than the text and pushed the field's input down. Pass
  `size="icon-sm"` for the previous trigger.

  `Button` at `size="icon-inline"` inherits the font family, weight, size and line height of the
  line it sits in, so the square is as tall as that line without Tailwind's preflight too. Before,
  a native button in a preflight-free host kept the browser's own font and Button's medium
  weight, and could come out shorter or taller than the line. In running text the square aligns to the top of the line instead of the
  baseline, so it no longer makes the line taller. A consumer `font-*`, `text-*` or `leading-*`
  class still sets the square's line.

- dc81408: `PopoverInfoButton` now wraps its children in one body element, so inline content, such as a
  sentence with a `<strong>` or a link, renders as one paragraph in the popup. Before, every text run
  and inline element became its own row, 16px from the next. Consecutive block children, such as two
  `<p>`s, are now spaced by the small surface gap, `--surface-gap-sm` (8px dense, 12px comfortable),
  instead of the popup's 16px, and their user-agent margins are zeroed. Inline-block children, such as
  a button, stay on their line. A `<p>` wrapper at the call site is no longer needed.
- 722b914: `PopoverInfoButton` now passes its state, ARIA, handler and `disabled` props to
  `Popover.Trigger` and keeps the Button's presentation props and `disabled` on the Button. Before, every
  prop landed on the Button, whose props beat the trigger's, so a forwarded
  `aria-expanded={undefined}` erased the open trigger's `aria-expanded="true"`, and `disabled`
  reached the Button but not `Popover.Trigger`. `className` and `style` callbacks still read the
  Button's state, so a pending button and a disabled non-native trigger report `disabled`, and a
  disabled `focusableWhenDisabled` trigger stays in the Tab order.
- 98eed3e: In a host without Tailwind's preflight, such as one on the standalone stylesheet, Fuse's own
  elements no longer keep the browser's defaults. They now look as they do with preflight.

  - The elements that carry a `data-slot` take every element rule of preflight, scoped to them,
    from base-layer rules. Every Fuse element sizes with `box-sizing: border-box`, as under
    preflight, so a part with a width plus padding or border is that width overall. A button rests on no fill, border or padding of the browser's own, in the font
    and text colour around it. A heading keeps no size, weight or margin of its own. A text field
    takes the font around it. A link takes the colour and decoration around it. A list shows no
    markers, margin or indent.
  - The ghost and link `Button` variants, the Sidebar rows, actions and rail, `Toggle`, the
    Accordion and Collapsible triggers and a bare `Combobox.Trigger` no longer show the browser's grey
    button face, outset border or button font. An Accordion trigger no longer takes the size and
    margins of the `h3` around it. `Input` and `Textarea` no longer use the browser's control font.
  - Pagination links, `Breadcrumb.Link`, `Item` rendered as a link, the Attachment link trigger and
    `Link` no longer show link blue or an underline, and `Breadcrumb.List`, `Pagination.Content`,
    `Sidebar.Menu` and `Sidebar.MenuSub` no longer show markers or the 40px list indent.
  - `Table` outside a `Frame` collapses its borders, so its row dividers paint. `Field.Set` draws no
    fieldset frame. `Card.Description`, `Empty.Description`, `DescriptionList.Content` and `Code`
    keep no browser block margin. `Textarea` resizes only vertically. The PhoneNumberField country
    trigger takes the font around it. An `Item.Root` with `hidden` stays hidden.
  - The reset sits in the base layer, so every utility, a `render` element's own classes and the
    host's own unlayered reset still win over it, except `hidden`, which preflight makes
    `display: none !important` so it beats a part's display class. Under preflight it changes
    nothing.

- 29771c3: The `tailwindcss` peer range is now `^4.1`. Fuse's classes use the 4.1 utilities `wrap-anywhere`
  and `wrap-break-word`, which Tailwind 4.0 does not generate, so the published `^4` let a 4.0
  install drop them silently.

  Published dependency ranges now follow the versions Fuse is tested with: `tailwind-merge` is
  `^3.7.0`, `tailwind-variants` `^3.3.1` and `libphonenumber-js` `^1.13.13`. Base UI and Phosphor
  stay exact pins, and `sugar-high` stays at `^2.4.0`.

- fc85c72: Repair badge and secondary text colors across themes, wrap horizontal cards and pagination, and fit date pickers to narrow containers. Disabled InputGroup addon buttons no longer dim an editable field. Destructive confirmations focus Cancel, mobile sidebars expose a close button, and calendars follow the locale direction and choose weekday labels by width — a locale whose short names overflow a column falls back to narrow glyphs.

  Follow-up to the same review pass:

  - `Button` with `isVisuallyDisabled` now stamps `aria-disabled="true"` so the unavailable state is announced; an explicit `aria-disabled` prop still wins.
  - `Dialog.Title` accepts `isFocusable`, which stamps `tabIndex={-1}` and the shared focus ring — the supported way to hand a long-content title to `initialFocus`.
  - `AlertDialog.Content` honors a caller's `initialFocus` over its variant default, and the mobile `Sidebar` close button now sits in a normal-flow header row instead of an absolutely positioned overlay.
  - The typography `secondary` variant is deprecated: it is an identity alias of `foreground` (`--secondary` is a surface token, never a text role).

- 2918505: The radius rungs in `@elmeragroup/fuse/css` (`rounded-xs` to `rounded-xl`) and the private corner classes read `--radius-step` with a `0px` fallback. A host that imports `fuse/css` without `themes.css` and keeps its own `--radius` now rounds every rung with that radius instead of getting an invalid `border-radius`. The package README documents what `fuse/css` changes in a host's Tailwind theme and how to keep your own tokens; the theming handbook page has the same recipe.
- d904547: Escape on a `RangeCalendar` day now drops a range being chosen even when the day button renders
  through `render` with its own `data-slot`. As before, it goes no further while a range is open, so
  an enclosing popup stays open, and passes through when none is.
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
- b3da87a: `ScatterChart` builds its nearest-point index right after the paint that draws new data, so the
  first pointer move over a large chart no longer pays for the build. Before, the first move after
  each data update built it, about 7 ms at 100,000 points.
- 0c4ef88: `--chart-quiet-opacity` on `ScatterChart.Root` sets the opacity of the quiet points and of every
  quiet series' legend swatch. It is `0.45` by default, the opacity they drew at before.

  `Chart.Root` and the bar routes no longer ship the scatter chart's words and data messages, which
  saves about 1 kB of minified JavaScript on each. `ScatterChart.Root` no longer ships the cartesian
  data messages, about 2 kB.

- 198d3cf: Tabbing into a scrollable `ScrollArea.Root` now shows a 2px focus outline just inside the area's
  edge, including in forced-colors mode. The old ring drew outside the viewport, and in an area
  without padding the root's `overflow: hidden` clipped it away. The outline now also draws above
  sticky and other positioned content in the area.
- 08b402e: `ScrollArea.Root` now scrolls under a max height. Before, a root with only `max-h-*` let its
  viewport grow with the content and clipped the overflow, so the list could not scroll. The
  viewport now takes the root's resolved height under either a fixed height or a max height.
- c23bcef: The `ScrollArea.Bar` thumb now shows in forced-colors mode, in the `CanvasText` system color. Before,
  the browser painted it in the canvas color, so a `ScrollArea` or an `Attachment.Group` showed no
  scroll position.
- 727a0d7: A vertical `ScrollArea.Root` now lets its content truncate. Before, Base UI's `min-width:
  fit-content` made the content at least as wide as its longest line, so a `truncate` child
  overflowed the viewport instead of ending in an ellipsis. The content now fills the viewport's
  width; a horizontal root still grows its content to the widest line and scrolls across it.
- 886c820: The `alignItemWithTrigger` docs on `Select.Content` now name a Base UI 1.8 limitation. An
  item-aligned popup is placed in viewport coordinates, so inside a portal target that is, or sits
  inside, the containing block for `position: fixed` content, such as a transformed or
  `contain: paint` scope, the list opens away from its trigger. Pass `alignItemWithTrigger={false}`
  there.
- 2316569: `SelectField` forwards `name` to `Field.Root` rather than `Select.Root`, as `AutocompleteField` and
  `ComboboxField` do. A `Form` error under that name now shows in the first server-rendered HTML,
  rather than only after hydration.
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
- 39c3962: Selection items (`CheckboxItem`, `RadioItem` and `SelectionItem.Shell`) now pad inline with the
  medium surface tier, `--surface-pad-md`, instead of a fixed 16px. They look the same at
  comfortable density and pad 12px at dense, like Items and Accordion items, so their text lines up
  with the parts beside them at both densities. Their inner corner follows the same tier.
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
- 04adcbc: A `SelectionItem.SubSection` written in a server component now renders outside its row's label.
  Before, a server component that rendered `SelectionItem.Shell` with direct `SubSection` children,
  or a client component that rendered `CheckboxItem` or `RadioItem` around `SubSection` children a
  server component passed it, put the band inside the label: its text joined the control's accessible
  name and a click on it toggled the control. `SelectionItem.SubSection`, and so
  `CheckboxItem.SubSection` and `RadioItem.SubSection`, is now a server component, and its root
  carries `data-selection-item-sub-section`. A direct `SubSection` child with no children of its own
  no longer opens an empty band under the row.
- f776df7: A visible SubSection that takes its own `data-slot` or `data-mode` keeps the selection row's click
  target as it was. With `isSubSectionSelectable` off, a click in the row's bottom padding, or in its
  side padding beside the SubSection, no longer toggles the row. This holds in the default Shell
  layout for a `SelectionItem.SubSection` passed as a direct child of the row and for an
  `Item.Footer` passed through the Shell's `subSections` prop. With `isSubSectionSelectable` on, a
  click in the bottom padding reaches the row's SubSection click handling, so an `onClick` that
  calls `preventBaseUIHandler()` cancels the toggle.
- e178f6d: Component and localized-copy JSDoc no longer points at internal spec documents that ship
  outside the package. Each comment now says in its own words why the component is a client
  or server component, and which dictionary keys its default copy fills.
- 2db43f3: Date, time and category labels in `Chart.ReferenceArea`, `ClockChart.ReferenceArea` and
  `Chart.Table`'s caption, and `DataTableFilter` date chips, join the two ends of a range with the
  locale's range separator, as chart tooltips do. It is a spaced en dash in en-US and a bare one in
  nb-NO, sv-SE and fi-FI. Chart number bands keep a bare en dash, and `DataTableFilter` number chips
  keep Intl's range pattern, with its spaces written as no-break spaces.

  A `Chart.ReferenceArea` over the hourly slots that start at 17:00 through 19:00 now prints
  `5 PM – 8 PM` in en-US instead of `5 – 6–7 – 8 PM`, and `17–20` in nb-NO instead of `17–18–19–20`.
  Readers hear the same two ends, `5 PM to 8 PM`. `ClockChart.ReferenceArea` prints the same sector
  as `5:00 PM – 8:00 PM` instead of `5:00 PM–8:00 PM`. A `Chart.ReferenceArea` value band keeps each
  number whole and writes the text both ends share after their numbers once, so nb-NO's `1–2 000`
  prints as `1 000–2 000`, fi-FI writes `0,12–0,15 €/kWh alv 0 %`, and en-US writes `5–10%`.
  `Chart.Table`'s caption shows its period with the same join, such as `Usage, Jan – Apr`, and its
  accessible name still reads `Usage, Jan to Apr`. A `DataTableFilter` date chip writes both dates of
  a range in full, so en-US prints `Oct 2, 2026 – Oct 12, 2026` instead of `Oct 2 – 12, 2026`.

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

- e5c9ed5: `Sidebar`: collapsed to the icon rail, a `floating` or `inset` panel is now as wide as the gap that
  holds its place, 64px at the default `--sidebar-width-icon`. It was 2px wider, so its surface drew
  2px too wide with uneven margins, and a floating panel's container covered 2px of the adjacent
  edge of `Sidebar.Inset`. The surface is now as wide as `--sidebar-width-icon`, 48px by default,
  with 8px on each side.
- 1df4906: Beside an open right-side `inset` Sidebar, `Sidebar.Inset` now has an 8px left margin and no right
  margin, mirroring a left-side `inset` Sidebar. It had no left margin and 8px on the right.
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
- 781b3f4: `Sidebar.Separator` now ends 8px before the content's end edge, as it starts 8px after the start
  edge. Before, it took the full content width past its start margin, so it ran 8px past the end
  and the content clipped it.
- 74242c8: `Sidebar.Provider`'s keyboard shortcut now uses the platform's command modifier: ⌘B on Apple
  platforms and Ctrl+B elsewhere, so macOS keeps Ctrl+B for moving the caret. It also stands aside
  for a keydown another handler already prevented (an editor's bold), one mid-composition and one
  typed into a text field. `Sidebar.Trigger` declares the shortcut in `aria-keyshortcuts`.
- bf5f21b: `SkeletonReveal` no longer checks the document's fonts on every animation frame. Its bones redraw
  when a font it already saw finishes loading, even while another font is still loading. On a visible
  page it also checks once a second, which finds a font that a script added after loading it, or
  while another font was loading.
- c150942: A `SkeletonReveal` rendered into a same-origin iframe now unmounts without an error after the
  iframe loads a new document. Before, the unmount threw a `SecurityError` when the new document was
  from another origin, and the skeleton's resize and mutation observers and its `load` listener stayed
  connected. When the unmount came while the reveal eased its height, it threw after any new document,
  before it canceled the height ease and the pane fades. When the new document was same-origin, the
  unmount could also cancel one of that document's animation frames. A skeleton rendered into the
  iframe's initial `about:blank` now stops its once-a-second font check at unmount after the iframe
  loads a same-origin document. Before, when a script stopped the iframe's `visibilitychange` event,
  the check kept running and kept the old document in memory.
- dae86b8: A Fuse part inside `SkeletonReveal` keeps its skeleton role when it takes a custom `data-slot`. A
  `<Button data-slot="pay-invoice">` now draws as one block, as a Button with its own slot does,
  instead of a bar over its label. The same holds for every part the skeleton draws as one block or
  leaves out, such as `Avatar`, `Badge`, `Input`, `Switch` and `Loader`, and for Fuse parts that
  render one of them under their own slot, such as `Sidebar.Trigger`. These parts now write a
  `data-skeleton-part` attribute, except `Textarea`, `Emoji` and `Sparkline`, whose `textarea` or `svg`
  element the skeleton already draws as one block.
- 5dd88ea: Preserve native radio selections in outgoing `SkeletonReveal` content during a reload.
- 4884a01: `Slider`: a disabled thumb stays opaque, so the filled track no longer shows through its centre. The thumb keeps its `background` fill and draws its border in `muted-foreground`, the same tone as the disabled indicator.
- 74242c8: Dragging a `Slider` thumb no longer re-attaches each thumb's range input and rewrites its
  focus-ring attribute on every value change. `Button`'s `onIntent` prediction skips the layout read
  of every registered button far outside the viewport, so a long list of prefetching buttons costs
  a pointer move only for the ones on screen.
- 6db4706: The `Sparkline` `data-hover` docs now give hover's markup cost per value on a line and on bars,
  about 660 and 450 bytes of uncompressed SVG, measured on 168 hourly values.
- 8a20ed2: The standalone `styles.css` no longer uses native CSS nesting, so translucent colours now work in
  Chrome 111 and Safari 16.4, the oldest versions Fuse supports. Before, these browsers dropped every nested
  `@supports (color: color-mix(...))` block, and each `bg-*/<alpha>` utility painted its opaque
  fallback colour instead of the translucent one. The sheet now goes through the same Lightning CSS
  pass that a Tailwind production build runs, at the same browser targets. That pass also adds a few
  `-webkit-` prefixes and rewrites some values in shorter equivalent forms. Apps that build Fuse
  through Tailwind are unaffected.
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
    and `RadioIconButton` now show that ring, and so do the date fields. A radio
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
  - **Other controls.** A disabled `Accordion.Trigger` now
    dims, shows the `not-allowed` cursor, and no longer underlines or fades on hover. An
    `Accordion.Trigger`, `Select.Trigger`, `Input` or `Textarea` given `aria-disabled="true"`
    now dims and shows the `not-allowed` cursor as well. A disabled inline `TextField` no
    longer shows its border and fill when hovered.

- 040524e: Status toasts and the warning `Alert` draw the focus ring in their surface's foreground, so it
  keeps 3:1 contrast on the dark soft fills.
- 3acfb6b: On Chrome 111 to 116, which lack `subgrid`, the terms and details of a responsive DescriptionList
  with its default columns now line up across its Items, and each chart Panel's plot now fills the
  width its own value axes leave. A Panel's marks can still run into its axis labels or past its
  plot, and hovering a bar can report another.
- 18c63cf: A height or width in your `className` now wins on `Switch`, as a size utility already does on
  `Button` and `Toggle`. Before, the track's size sat behind `data-size` selectors, so
  `<Switch className="h-6">` changed nothing. The track caps its width at its size's, as `Checkbox`
  does, so it keeps its size as a direct child of a vertical `Field.Root`. Pair a wider width with a
  `max-w-*`, as in `<Switch className="w-11 max-w-11">`. Without a `className`, both sizes render as
  before.
- c820a9f: `Switch`'s `size` documentation calls its pixel-fixed sizes "not a control size", the term Fuse
  uses for the density-following control metrics, in place of "not a control-box density rung".
- 8c7b8ff: `Switch` keeps its thumb inside the track when a parent's zero-weight rule centres its children's
  content, such as `[:where(&>*)]:justify-center`. The track now sets `justify-start` itself, so the
  checked thumb no longer runs past the track's end.
- 1cbbcee: An unchecked `Switch` is now an outlined track: a 1px `--muted-foreground` edge, a
  `--muted-foreground` thumb and no fill, so the surface shows through. Before, the unchecked track was
  filled with `--input`, which measured 1.08–1.70:1 against light surfaces. The edge and thumb measure
  3:1 or more against the page, a card and card-soft in every theme and color scheme (WCAG 2.2 SC
  1.4.11). On versus off now reads as outline versus fill, as on `Checkbox` and `Radio`, so the state
  no longer depends on the thumb position alone. A checked switch is unchanged: a `--primary` fill
  with a `--background` thumb. A disabled switch keeps the shared 50% dim, and an invalid switch shows
  the error border.
- 425888e: A `Table.Root` table wider than its container is now reachable with Tab and scrolls sideways with
  the browser's scrolling keys. The focused container is a group with an inset focus outline. Its
  name comes from the table's `aria-labelledby` and `aria-label`, else from its `Table.Caption`, so
  name a table that may scroll. A control inside the table keeps the stop. A table that fits its
  container, a container a consumer style sets to `overflow: visible`, and a table that sets its own
  `tabIndex` add no stop. `DataTable` and `VerticalTable` tables follow the same rule.
- f3147c6: The active default `Tabs.Trigger` now fills with `--card` instead of the page fill, so it sits
  above its `--muted` list on tinted external light pages. Before, fkas private and guen painted
  the active tab darker than its list. Its label takes `--card-foreground`, the text role for that
  fill, which external light themes set darker than the page's `--foreground`. In dark the active
  tab stays darker than its list, one step closer to it (internal 1.31:1 to 1.19:1). The `line`
  variant keeps its transparent face and page text.

  Inactive triggers are now transparent in every variant. Before, a consumer of the standalone,
  preflight-free stylesheet saw the browser's grey button fill behind them.

- 2793ab8: `Tabs.Content` hides a closing panel on the render that closes it. Base UI kept it shown until its exit transition ended, at least one painted frame, so the closing and the opening panel showed stacked and the content below jumped.
- 271fb18: An inactive `Tabs.Trigger` now draws its label in `muted-foreground` instead of the foreground at
  60% opacity, so the label holds the WCAG AA 4.5:1 text contrast on the default list's `muted` track
  and on the page, card, card-soft and modal surfaces a `line` list sits on, in every theme and both
  color schemes. The light branded themes measured 3.38–4.45:1 before, with Telinet the lowest. Hover
  and the active tab still draw the foreground.
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
- f4d8a81: `TelinetLogo`, and `BrandLogo` with `fkse`, letter the word "Telinet" in the dots' cyan, `#2DC0D0`, as Telinet's own logo does. Only "Energi" paints in `currentColor` now; before, both words did. The mark is unchanged.
- d626f39: The `value` documentation of `Calendar.Root`, `RangeCalendar.Root`, `DateField`, `DateInput.Root`,
  `DatePicker.Root`, `DatePickerField`, `DateRangePicker.Root` and `DateRangePickerField` now links to
  the Temporal setup in the quick start, from the API reference and from an editor hover that renders
  Markdown. Before, it named the path `/quick-start#temporal` as code.
- 9a4929e: Links, `<strong>`, child paragraphs and other descendants of `Text` and `Span` now take the
  component's `leading`. In `<Text leading="snug">`, a nested link has 22px lines like the text around
  it. Before, each descendant fell back to its size's own line height, 24px at the default size, so a
  line containing a link or `<strong>` could grow taller than its neighbours, and child paragraphs of
  `<Text elementType="div">` ignored the Text's `leading`. Descendants are still set in the Text's
  font size, and a descendant's own `leading-*` class still wins.
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
- 5f68ba9: `ThemeProvider` no longer client-renders Suspense boundaries below it that are still streaming.
  Its context value used to change once the color scheme connected after mount. React then
  client-rendered any boundary that had not hydrated yet, and a boundary whose content was still
  streaming showed that content twice until the streaming runtime dropped the server's copy. The
  provider's value now stays the same, and `useColorScheme` subscribes on its own. A
  `useColorScheme` consumer that hydrates after the provider connected first renders the server's
  value, then updates.
- 079c1e6: `ThemeScope` now validates its theme once per axis change, so a production pinned-segment warning no longer repeats on every render. `ThemeProvider` stays mounted where `matchMedia` is missing or only supports the legacy `addListener` API.
- 5f68ba9: `ThemeScope` no longer re-renders with a changed portal container when a Suspense boundary
  around it hides and reveals its content. Each hide and reveal used to clear and set the
  container, which in some hosts fed an update loop until React threw "Maximum update depth
  exceeded". Attaching the scope element also no longer client-renders Suspense boundaries below
  it that are still streaming. Overlays that are open inside the scope stay in it while the
  boundary is hidden. A scope whose element is replaced provides the new element, and one whose
  element leaves the document stops providing it.
- d0ce3b2: `ThemeProvider` now follows `localStorage.clear()` from other tabs by restoring the configured `defaultColorScheme`, and ignores `sessionStorage` events that reuse the color-scheme key.
- 74242c8: `TimelineList.Time` now writes an HTML date or date-time `date` string to `dateTime` unchanged
  instead of converting it through the rendering machine's time zone, so a server and a browser in
  different zones render the same value and a date-only string stays a calendar date. A `Date`, or
  another string the JavaScript date parser reads, such as `June 15, 2024` or `2024-02-30`, is still
  normalized with `toISOString()`. Development builds warn about a date-time string without an offset.
- fbe689b: TrøndelagKraft's external radius is now `1rem` (16px), up from `0.95rem` (15.2px), for `--radius` and `--radius-button`.
  The old value came from an early theming commit in the sales flow and had no design source. Every corner that follows the
  brand radius moves by 0.8px or less: cards, badges and buttons round at 16px, and the `rounded-*` scale steps from 10px to
  20px.
- 6550e0f: `Toast.useToastManager()` now returns `add`, `update`, `close` and `promise` with the same identity
  across renders. Before, each method changed identity whenever a toast was added, updated or closed, so
  an effect that listed `add` as a dependency ran again after every toast and added toasts until React
  stopped with "Maximum update depth exceeded".
- 74242c8: `Toast.Viewport` names its region from the locale dictionary ("Varsler", "Aviseringar",
  "Notifications", "Ilmoitukset") instead of Base UI's fixed English "Notifications"; an explicit
  `aria-label` still wins. `NumberField` announces its input's role description in the provider
  locale instead of the fixed English "Number field".
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
- 1fc89a9: A `ToggleGroup.Item` takes the segmented look from its own group only. An item of a spaced group
  nested in a `spacing={0}` group keeps its rounded corners, shadow and press scale instead of
  squaring off as if it were segmented.
- 643f7cb: `ToggleGroup.Root` types `style` as plain `CSSProperties`. A Base UI state callback was never
  applied at runtime because it was spread into an object. It is now a type error, making the
  silent drop visible at compile time.
- 09fdc32: In external themes, a pressed `Toggle` and `ToggleGroup.Item` now fill with `--primary` and set
  their label in `--primary-foreground`, in both the default and outline variants. Before, a pressed
  toggle filled with `--muted`, the same tint as hover: it measured 1.03–1.09:1 against the tinted
  brand page or the card beside it, and a hovered toggle looked pressed. Hover still tints an
  unpressed toggle with `--muted`, apart from the pressed fill, and a pressed toggle keeps its face
  under the pointer.
- 87133a0: `Tour.Popup` glides from one step's element to the next instead of jumping. The popup keeps its
  place on screen while it moves to the new step, then eases there over 300ms. A second step change
  during a glide starts from where the popup is. Scrolling never eases the popup, and a user who asks
  for reduced motion sees it move at once.
- 886c820: `TrondelagkraftLogo` (`@elmeragroup/fuse/icons`) draws the full logo from the brand's vector
  artwork. Before, it drew a bitmap trace whose edges wobbled and which carried invisible stroke
  layers. The viewBox is now `0 0 533.81 88.22` instead of `0 0 539 93`, cropped to the artwork, so at
  a fixed height the logo renders about 4% wider. The mark is unchanged.
- 9a2a95e: Public strings now use US spelling. The chart composition error code `scale-colour-on-stack` is now
  `scale-color-on-stack`, the chart config type errors say "colors", and the skeleton reveal's
  `MotionOutcome` value `"cancelled"` is now `"canceled"`. The chart error and warning messages and
  the token and brand ramp descriptions use US spelling too. Code that matches the old error code or
  outcome string must update it.
- 65d019a: A field box's within focus ring now reads only its own control, the `data-focus-ring-control`
  element that is its direct child. Before, any focused control inside it counted, so a
  keyboard-focused NumberField in an `InputGroup.Addon` also ringed the outer `InputGroup.Root`.
- 8296f33: `InputGroup.Root` and `Combobox.Chips`: a group marked `aria-invalid` whose own control is valid
  keeps the plain focus ring. Before, it painted the invalid face only while focused. Mark the
  control (`InputGroup.Input`, `Combobox.ChipsInput`) `aria-invalid` to show the invalid face.
