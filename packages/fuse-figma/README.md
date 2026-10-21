# @elmeragroup/fuse-figma

Syncs the Fuse design tokens into a Figma file's local variables. The repository is the master for theming data, so the sync writes code into Figma and never reads design decisions back. It is a private workspace package with no build step. Node runs the TypeScript directly.

It also builds the Fuse components plugin, a proof of concept that creates Button component sets from the Button recipe and an icon library from Fuse's icons. [Components plugin](#components-plugin) describes it.

## What lands in Figma

The sync owns six variable collections, matched by name.

| Collection        | Modes                          | Variables                                                                                                                                                                                                     |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fuse tokens`     | `Light`, `Dark`                | 106 variables: one per contract token such as `primary` or `radius`, one per radius rung such as `radius-md`, one per role tint such as `error/10`, and the two outline shadow lengths. Designers bind these. |
| `Fuse variant`    | `Internal`, `External`         | 251 variables: `<scheme>/<token>` for each `Fuse tokens` variable, and `density/<metric>` for each density metric. Hidden from pickers.                                                                       |
| `Fuse segment`    | `Private`, `Company`           | 424 variables, `<scheme>/<variant>/<token>` for each `Fuse tokens` variable. Hidden from pickers.                                                                                                             |
| `Fuse brand`      | One per brand, 7               | 848 variables, `<scheme>/<variant>/<segment>/<token>` for each `Fuse tokens` variable. They hold the theme values. Hidden from pickers.                                                                       |
| `Fuse primitives` | `Value`                        | 25 variables, the neutral ramp and the brand accents. They hold the same value in every theme. The neutral ramp is hidden from pickers, and the brand accents stay bindable.                                  |
| `Fuse density`    | `Auto`, `Dense`, `Comfortable` | 39 variables, one per density metric: control (`control-h-md`), row (`row-h`), surface (`surface-pad-lg`, `surface-gap-md`) and label (`label-text`). Designers bind these.                                   |

Each theme axis is one collection, so a designer previews a theme by picking each axis in the frame's Appearance panel, as in the docs theme picker. `Fuse tokens` gets `Light` or `Dark`, `Fuse variant` gets `Internal` or `External`, `Fuse segment` gets `Private` or `Company`, and `Fuse brand` gets the brand, such as `Fjordkraft`. A frame that sets no mode for a collection gets its first mode, so an unset frame shows internal Fjordkraft private in light. Figma resolves an alias that crosses into another collection with the frame's mode for the target collection, inherited from any ancestor. A child frame can therefore change one axis and keep the others.

Every `Fuse tokens` variable takes the same four hops. `primary` in `Light` aliases `light/primary` in `Fuse variant`, which aliases `light/external/primary` in `Fuse segment` under `External`, which aliases `light/external/company/primary` in `Fuse brand` under `Company`. That variable holds each brand's value for the external company theme. The path segments are the lowercase code values, so the hidden variables keep their names whichever axes a token varies on.

A brand mode is the brand's display name. Telinet allows only the private segment and Fjordkraft Företag only the company segment, so their modes read `Telinet (private only)` and `Fjordkraft Företag (company only)`. Figma cannot disable a mode, so such a brand holds its only segment's values under the other segment too: Telinet in `Company` shows Telinet private. The docs picker moves the segment instead.

`Fuse density` defaults to `Auto` in a file the sync creates. `Auto` aliases `density/<metric>` in `Fuse variant`, which holds the metric in the variant's default density, so a frame follows its variant the way apps do: internal themes dense and external themes comfortable. `Dense` and `Comfortable` hold their own pixels for frames that pin a density.

A file synced before `Auto` existed already has `Dense` and `Comfortable`. The REST API appends a new mode and cannot reorder modes or change the default, so `Auto` lands last there and `Dense` stays the default. Figma's default mode is the left-most column of the variables view, so move the `Auto` column all the way to the left, by dragging its header or through the header's right-click menu, to make it the default.

Earlier syncs wrote a `Fuse themes` collection with one mode per theme slug, such as `external-fkas-private`. The sync deletes a local collection with that name, and `check` reports it as drift. Frames pinned to a `Fuse themes` mode lose that pin, and designers set the four axis modes instead. The sync never deletes a library collection or a collection extension with that name.

The token values come from `resolveThemeCatalog` in `@elmeragroup/fuse/theme-catalog`. It resolves every theme in both schemes from `composeTheme`, the same composition that generates `themes.css`, and hands the sync each value already read: an sRGB color, a length in pixels, a font family or a font weight, plus the one `var()` hop when the value is a reference. The catalog throws on a token value it cannot read, because token values are Fuse source, and a Fuse test resolves every theme and scheme so CI catches such a value first. The sync maps the resolved values as follows.

- A color becomes an sRGB color, with alpha kept and the channels unrounded. The tokens write `oklch()` or `#rrggbb` literals, and the catalog reads exactly those two forms through `@elmeragroup/color`, which clips a color outside the sRGB gamut.
- `var(--name)` becomes an alias to the matching variable. A role reference points at the role with the same scheme, variant and segment in `Fuse brand`, and a primitive reference points into `Fuse primitives`.
- A `rem` length becomes the catalog's pixels at a 16px root.
- A radius rung becomes the pixels `fuse.css` computes for it, such as `--radius-md: calc(var(--radius) - var(--radius-step, 0px))`, because Figma variables cannot compute. The catalog computes each rung per theme from the theme's `radius` and `radius-step` and the rung's step count, and the sync writes those pixels per brand mode. Internal themes step 0px, so every rung equals `radius`. External themes step 2px, so `external-fkas-private` with a 12px radius gets 6, 8, 10, 12 and 16px from `radius-xs` to `radius-xl`. CSS clamps a negative `border-radius` to 0, and so does the catalog. The sync leaves out `radius-popover`, because no component uses that rung and Fuse popups use `radius-md`.
- A density metric comes from the catalog in pixels per density, read from the same metrics the `fuse.css` density blocks must equal. Heights, including `row-h`, get the width and height picker. Paddings, including the `row-px`, `row-py` and `surface-pad-*` paddings, and gaps, including the `surface-gap-*` tiers, get the gap picker. The type pairs, `control-text` and `control-leading` for controls and `label-text` and `label-leading` for labels such as selection row text, get the font size and line height pickers.
- A font stack becomes its first family name, which the catalog reads.
- A font weight, such as `selection-title-weight`, becomes its number, from 1 to 1000, and gets the font weight picker. The sync sends that picker as `FONT_STYLE`. Figma's REST documentation lists `FONT_WEIGHT` for number variables, but a real file stores `FONT_WEIGHT` as `FONT_STYLE`, so a sync that sent it would never read back what it wrote.
- A derived role, such as `secondary-hover`, becomes the literal color that composition computes, because Figma variables cannot mix colors.
- A role tint, such as `error/10`, holds its role's color at the tint's alpha in every theme. A Figma paint takes its opacity from the alpha of the variable it binds, so a component cannot bind `error` at 10%, and `bg-error/10` binds `error/10` instead. The tint's code syntax is the `color-mix(in oklab, var(--error) 10%, transparent)` that Tailwind compiles the utility to. `ROLE_TINTS` in `fuse-variable-set.ts` lists the tints the component kit binds. A tint appears in its role's pickers, and its description names the role and the percent, since the catalog has no entry for it.
- The outline Button's shadow lengths, `button-outline-shadow-blur` and `button-outline-shadow-spread`, hold what `max(0px, 4px - 2 * var(--button-outline-width, 1px))` and `min(0px, 2px - 2 * var(--button-outline-width, 1px))` give for each theme's outline width: blur 2 and spread 0 at the internal 1px outline, which is Tailwind's `shadow-xs`, and blur 0 and spread -2 at the external 2px outline, which paints nothing outside the border. Figma variables cannot compute, so `OUTLINE_SHADOW_LENGTHS` in `fuse-variable-set.ts` computes them, and their code syntax is the formula, which the kit binds. They get the effect picker.
- The `Fuse tokens`, `Fuse primitives` and `Fuse density` variables carry web code syntax. A token, primitive or metric carries its `var()`, such as `var(--primary)`. A radius rung carries the `calc()` that `fuse.css` declares, such as `calc(var(--radius) - 3 * var(--radius-step, 0px))`. `fuse.css` declares the rungs in `@theme inline`, so Tailwind inlines them into its utilities, and the built CSS declares no `--radius-sm` property. A test requires every `var()` in the code syntax to name a property that the built `styles.css` or `themes.css` declares.
- A color appears only in the pickers for where Fuse paints it. The catalog gives each color role and primitive its paints from `TOKEN_PAINTS` and `PRIMITIVE_PAINTS` in `@elmeragroup/fuse`, and a source contract holds the library's own color classes to them. A `surface` gets the frame and shape fill pickers, an `ink` gets the text fill, shape fill and stroke pickers, because icons take the text color, and a `line` gets the stroke picker. A role with every fill gets `ALL_FILLS`. `feature-foreground` is a surface only, so the text fill picker leaves it out.
- The neutral ramp gets no picker scope. It holds one value in every theme and scheme, so a layer bound to it breaks dark mode and brand switching. It stays an alias target, as the hidden collections do. The brand accents keep the fill pickers and their foregrounds the text pickers, for artwork that shows several brands.
- Font families get the font family picker. Figma's REST documentation says scopes currently apply only to FLOAT and COLOR variables, but a real file keeps `FONT_FAMILY` on a STRING variable.
- Each length token names its picker scope in a table in `fuse-variable-set.ts`, so a new length token does not compile until someone picks one. `radius`, `radius-button`, `radius-field` and the radius rungs get the corner radius picker, and `button-outline-width` gets the stroke picker.
- `radius-step` gets no picker scope. It is a length, but it spaces the radius rungs and switches between the internal and external variants, so no layer rounds with it. It keeps its code syntax, `var(--radius-step)`.
- Every `Fuse tokens`, `Fuse primitives` and `Fuse density` variable carries the catalog's description, which Figma shows when a designer hovers the variable. The descriptions live beside the tokens in `@elmeragroup/fuse`, and the docs tokens page shows the same text. The hidden variables carry an empty description. A real file stored `&`, `<`, `>`, `"` and `'` in a description HTML-escaped on 2026-10-19, through the REST API and the Plugin API alike, so the sync refuses a description that holds one of them.

## Running it

The Variables REST API needs an Enterprise plan. Create a personal access token under Settings → Security in Figma. The token needs the `file_variables:read` and `file_variables:write` scopes and belongs to a Full seat with edit access to the target file. Figma caps these tokens at 90 days, and a plan access token cannot write variables.

Put the token and the file key in `packages/fuse-figma/.env`, which git ignores:

```sh
FIGMA_TOKEN=figd_...
FIGMA_FILE_KEY=AbCdEf123   # the part after /design/ in the file URL
```

Then run one of these commands from the repository root:

```sh
pnpm --filter @elmeragroup/fuse-figma figma:check   # print the plan, write nothing, exit 2 when Figma differs
pnpm --filter @elmeragroup/fuse-figma figma:sync    # apply the plan
```

`--file-key <key>` overrides `FIGMA_FILE_KEY`, and a branch key targets a Figma branch. `figma --help` lists every flag.

`check` exits 2 when the file differs from the tokens and 1 when it cannot run, for example when the token has expired, so a CI job can tell the two apart. It groups the plan by collection and kind of change. A group of up to 10 changes lists each variable and mode, and a larger group prints its count.

The token travels in the `X-Figma-Token` header. The sync masks that header on the trace spans Effect's HTTP client records, and a failed request keeps only its method and URL.

After a sync, publish the library in Figma. The REST API cannot publish, so consuming files see the new values only after someone publishes by hand.

## How a sync decides what to write

The sync reads the file, plans one change batch and sends it. Figma applies a batch completely or rejects all of it. The sync then reads the file again and fails unless the plan is now empty, so a successful run means the file was checked.

- It matches collections, modes and variables by name and updates them in place. Ids survive, so every layer bound to a Fuse variable stays bound.
- A mode keeps its id only while the tokens keep its name. The sync deletes a mode the tokens no longer name and creates the modes they add, and it never renames one into another, because a dropped brand and an added one are unrelated. Frames pinned to a deleted mode lose that pin. Renaming a brand's display name in code is therefore a delete and a create in Figma, and designers repin the frames that used the old name.
- Mode order does not matter to the plan. A collection whose modes the file holds in another order than the tokens counts as in sync, because the REST API cannot reorder them.
- The sync orders mode changes so that no collection goes over Figma's 40 modes or runs out of modes while the batch applies. It deletes the stale modes before creating new ones. When no existing mode survives, it keeps the last stale mode until the first new mode exists. The only mode it renames is the one Figma gives a new collection, which becomes the collection's first mode.
- Inside the six Fuse collections, the tokens are authoritative. The sync deletes any mode or variable the tokens do not define, and the next sync resets any value a designer edited.
- It never touches another collection in the file, except that it deletes a local collection named `Fuse themes`, which earlier syncs wrote. The sync skips library collections, collection extensions and deleted variables that layers still reference, even when their names match.
- It refuses to change a variable's type, because Figma can only do that by deleting the variable and unbinding every layer that uses it. The error names the variable to delete by hand.
- Renaming a token in code is a delete and a create in Figma, so layers bound to the old name lose their binding.
- It refuses to sync tokens whose aliases form a cycle. A cycle counts even when each alias closes it in a different mode, because the modes a layer combines decide whether Figma would loop.
- It writes the values of each alias target before the values that alias it. Figma applies values in order and refuses a batch that passes through a cycle after any one value, even when the batch ends without one. This order never passes through a cycle, even when the tokens reverse an alias.
- A value shape or variable type newer than the sync does not stop a read. A variable the sync owns gets such a value rewritten, and a type it does not know is a type conflict.
- It owns every variable's description, so the next sync resets a description a designer wrote. It sets web code syntax on the `Fuse tokens`, `Fuse primitives` and `Fuse density` variables, and sends no code syntax for the `Fuse variant`, `Fuse segment` and `Fuse brand` variables, which only feed aliases. An update replaces a variable's code syntax, so when the sync sets the web entry, it sends the file's Android and iOS entries with it.
- The sync retries a read that hits a rate limit, a server error or a network failure. It waits as long as `Retry-After` asks and logs a warning for each retry. It retries a write only after a 429, because a write that failed on the server may still have been applied. When `Retry-After` asks for more than 60 seconds, the sync fails at once and reports the wait.

The alternative was kumo-figma's approach, which deletes every variable and recreates it on each run. That gives every variable a new id and breaks the bindings in existing designs.

## Components plugin

The plugin creates an icon library and two component sets from the Button recipe on a page named `Fuse components`, and edits them in place on every later run. It binds each field it can to the variables `figma:sync` writes.

- `Icons` holds one 16px component per icon `@elmeragroup/fuse/icons` publishes that takes the color of the text around it: the 130 Phosphor icons in their bold default weight and the 5 bespoke icons that paint with `currentColor`. The other bespoke icons are artwork with colors of their own, such as the Vipps mark and the Signing illustration, which read as blots at 16px or vanish on a light fill, so they stay out with the brand logos.
- `Button` holds every variant the recipe declares at the default, xs, sm and lg sizes, in 5 states (rest, hover, focus, disabled and pending) and with no icon, a start icon or an end icon: 420 variants. Its `Label` text property sets the label, and its `Start icon` and `End icon` swap properties pick the icons, Plus and ArrowRight to begin with.
- `Icon button` holds every variant at the four square sizes in the same 5 states, 140 variants, each an icon with no label, which its `Icon` swap property picks.
- `icon-inline` stays out, because it takes its size from the surrounding text line.
- Twelve preview frames below them pin three themes at both densities for each set.

### Running it

1. Run `figma:sync` on the file first. The plugin binds only the variables the sync owns, and it stops before writing anything when one is missing. The role tints arrived on 2026-10-19 and the outline shadow lengths on 2026-10-20, so a file synced before then needs another sync.
2. Build the plugin from the repository root:

   ```sh
   pnpm --filter @elmeragroup/fuse-figma figma:plugin
   ```

   The build writes `plugin/dist/code.js`, the kit spec `plugin/dist/spec.json` and the coverage table `plugin/dist/coverage.md`.

3. In the Figma desktop app, open the file, choose Plugins → Development → Import plugin from manifest, and pick `packages/fuse-figma/plugin/manifest.json`. Figma runs a development plugin only in the desktop app.
4. Run the plugin and press Plan. It lists every change an apply would make, and writes nothing.
5. Press Apply. The plugin writes the changes, then plans again and shows any change that remains. A clean run shows none.
6. Publish the library by hand, as for the variables.

### How the spec is built

The build calls the Button recipe from the workspace-only `@elmeragroup/fuse/recipe-catalog` entry for each cell of the matrix. It sorts every class by its variants and maps them onto the cells as `button.tsx` renders them. `fuse.css` and Tailwind fix most of what a variant means, so one shared table in `components/state-table.ts` holds that meaning for every component set. A definition such as `button-kit.ts` adds only the variants its own states render, facts for variants only it uses, and its own omissions. The build stops when a definition gives a shared variant a second meaning.

- `enabled-hover:` holds on hover and `focus-visible:` on focus.
- `disabled:` holds on disabled. A pending Button stays focusable, so Base UI marks it `aria-disabled` instead, and `data-disabled:` holds in both.
- `data-[pending-indicator]:` holds while pending.
- `has-data-[icon=inline-start]:` holds while an icon of the cell carries `data-icon="inline-start"`. A start icon does, and so does the spinner's span while pending. `has-data-[icon=inline-end]:` holds with an end icon.

A shared state variant holds only where the set's `state` axis has the value that renders it. When the axis lacks that value, the variant stays unmodelled and its classes land in the coverage table as unmapped, so the gate fails instead of the variant holding in no cell. `enabled-active:`, `aria-invalid:`, `data-invalid:` and `aria-expanded:` describe states no standalone component shows, and the build drops them, as it drops Button's group corners. A class with any other variant is unmapped. A child selector styles the icons it reaches, each with its own cascade. `[&_svg]` reaches every icon. `[&>svg:not([data-icon=inline-end])]` reaches only the root's own leading icon, which `hidden` leaves out while pending, so the spinner takes its place and an end icon stays.

Tailwind's own compiler compiles each utility against `fuse.css`, and the build reads the rules from the syntax tree Tailwind returns. The build applies the declarations in cascade order, plain classes first and then the classes whose variants hold, each group in Tailwind's output order. A value that equals the web code syntax of a synced variable binds that variable, so `px-(--control-px-button-md)` binds both side paddings to `control-px-button-md`. A radius rung compiles to the same `calc()` that the sync writes as its code syntax, so it binds too. A `color-mix()` toward `transparent` binds the role tint whose code syntax it equals, so `bg-error/10` binds `error/10`. A mix without a synced tint stays unmapped. A `max()` of a variable and a length binds the variable when the variable holds at least that length in every mode. xs uses `max(var(--control-h-xs), 24px)` as its 24px target floor, and `control-h-xs` is 24px or more at both densities, so it binds `control-h-xs`. A shadow's blur and spread bind the same way, so the outline shadow binds the two outline shadow lengths. Values compare with the fallbacks of synced variables dropped, as Tailwind's own substitution leaves them. Any other value must evaluate to a number or a color, or it stays unmapped. `@elmeragroup/color` reads both the comma form of `rgb()` and the space form Tailwind compiles an arbitrary color to, such as `rgb(0 0 0/0.05)`.

The label inherits the text color and font family of the host page. The build applies the `font-sans text-foreground` that the docs layout sets on `<body>` before any recipe class, so the outline Button's label binds `foreground`.

`underline` underlines the label, and `underline-offset-*` sets the underline's offset in pixels. A cell that draws no underline drops the offset.

The icon library comes from the same React components apps render. Node cannot load the bespoke icons' TSX, so the build bundles a small module with rolldown that renders each icon with `react-dom/server`. A Phosphor icon renders at 16px. A bespoke icon renders at its own size, and the plugin scales it to fit 16px. The library keeps an icon only when it paints with `currentColor` alone. Figma cannot read `currentColor`, so the markup paints the icon black and the plugin binds its color.

`coverage.md` lists every declaration with what became of it. Bound and literal declarations reached a Figma field. A dropped declaration has no Figma form, such as a cursor or a transition, or belongs to a state no cell shows. An unmapped declaration is one the build cannot express yet, and a test holds the count at zero.

### How the plugin decides what to write

- Plan and Apply run the same planning pass. The pass checks the kit against the file, matches each node and records every write as an operation, and it writes nothing. Plan lists the operations. Apply finishes the pass and loads every font the text writes need, so a duplicate key, a missing variable, a variable of the wrong type or a font this machine cannot load stops the run before any write. Then it performs the operations in order. Plan loads the fonts too, so it fails where Apply would. A label the run creates takes its family from the file's variable, which the pass resolves through the modes the new label will read.
- Each field planner compares the node with the spec and records an operation only when they differ, so a second run over an applied file plans nothing. A fill, stroke or shadow matches only with the `NORMAL` blend mode the plugin writes. A text field counts as bound only when every character binds the variable.
- Writes that depend on each other share one operation. A height write resets the sizing modes, so its operation writes them again. A label's font write comes first among its writes and needs only the new font, so the plugin can replace a font this machine lacks. The spec sets the style as a literal, so the font write also clears any variable a character binds to `fontStyle` or `fontWeight`. A new node is one operation that creates the node and everything the spec puts inside it, so Plan lists it once.
- A bound paint matches by its binding alone, because Figma sets a bound paint's opacity from the variable's alpha. Two runs on a real file, on 2026-10-19, wrote `error` at 10% and read it back at 100%, which is why the kit binds role tints.
- Every variant root clips its content, because Figma draws a drop shadow's spread only from a frame that clips and has a visible fill. A fill at alpha 0 does not count: on 2026-10-20 the focus rings of ghost and link held their 2px spread over one and drew nothing. A root with a spread shadow and no fill therefore gets black at alpha 0.0015, which Figma counts and which changes no 8-bit channel. The plugin also sets a shadow's geometry again after it binds the shadow's color. Two runs stored the spread as 0, and the third, which did this, kept it.
- A bound shadow is written with the color its variable takes in the node, and matches only while it stores that color. Figma draws the color a binding stores. A new binding stores the variable's value, but an effect written again with the binding it already holds keeps the color written. On 2026-10-20, 28 focus rings bound to `ring` drew black where `ring` is gray.
- Each axis lists the recipe's default first, and the plugin keeps each set's variants in spec order. Figma makes the top-left variant the set's default, so an instance a designer places starts as the default Button.
- Figma keeps a variant property's values in an order of its own, which the plugin cannot change. A new value goes last, and moving the variants or renaming a value leaves it where it is, as a real file showed on 2026-10-20. A set the plugin creates lists its values in spec order. The test file's Button set gained xs and lg in a later run, so its size menu reads default, sm, xs, lg until the set is created again.
- The plugin draws each icon component from its markup with `createNodeFromSvg`. A run on a real file on 2026-10-20 showed that this returns a frame the size of the SVG, painted white and clipping, whose layers take their names from the elements' `id`s. The plugin moves the layers into the component, scales them to fit and centers them, and keeps a hash of the markup in shared plugin data, so a changed icon is drawn again. Each icon flattens to one vector named `glyph`, whose fill binds `foreground`, and the glyph scales with its component. The plugin sets an icon's size with `resize`, which applies the glyph's constraints, so an icon a designer scaled comes back to 16px with its glyph. Figma's reference pages say `resizeWithoutConstraints` leaves the children as they are, which would leave the glyph at the scaled size.
- An icon layer is an instance of an icon component, linked to the set's swap property, so a designer swaps the icon from the properties panel. The swap properties offer every icon in the library. The layer overrides its glyph's fill with the label's color, as a Fuse icon takes `currentColor`. Every glyph has the same name, so the override holds across a swap: on 2026-10-20 a destructive Button swapped from Plus to Star kept its glyph bound to `error`. The swap leaves the instance with explicit overrides of the icon's name and the glyph's fill, even after swapping back. Resetting the overrides of the nested icon through the Plugin API also drops the variant's color, and the glyph reverts to `foreground`.
- A change line shows what the layer holds after `holds`, so the list Apply shows for a field that does not stick tells what Figma kept.
- The variant grids and the page layout read sizes when their operations run. A plan that changes a component set therefore lays out its grid again. A plan that changes anything on the page places the sets and the icon library in a row again and stacks the previews below them.
- The plugin reads only the variable collections the kit names, and stops when two local collections share one of those names.
- Every node the plugin creates carries a key in shared plugin data under the `fuse` namespace. The plugin finds a node by its key first, so a designer can rename a layer. A node without a key matches by name once, and the plugin then writes the key onto it.
- The plugin stops when two nodes share a key, such as after a designer duplicates a variant. It never deletes a node without a key, and warns about one that sits among the kit's variants, layers, icons or preview instances. It deletes a keyed node the spec no longer lists.
- It edits the component set and its variants in place, so their node ids and component keys survive and instances in other files keep following them.

`plugin/src/reconcile.fake.test.ts` runs `reconcileKit` with the real kit against `plugin/src/fake-figma.ts`, an in-memory file seeded with the synced variables. The fake models the Figma behaviours above that real runs showed, and the ones the typings and reference pages document, such as `MIN` and `SCALE` constraints on `resize`, and a font, size, line height and bindings per character of a text layer, a weight binding included. It throws for any Plugin API call it does not model. The tests check that a second Plan after Apply lists nothing, that renamed layers keep their keys, that a duplicated variant stops the run before any write, that a deleted variant comes back alone, and that a changed icon, a scaled icon and a stale ring color each converge in one Apply. The planners' unit tests run against small files from `plugin/src/fake-fixtures.ts` on the same fake.

These behaviours have not run against a real file yet:

- whether a glyph's fill override goes with the glyph when the plugin draws the icon again, which the in-memory fake assumes
- whether Figma measures an underline offset from the same line as CSS's `text-underline-offset`
- whether a published in-place edit reaches instances in another file with their ids intact, and what those instances show after a delete and recreate

### Comparing with the browser

`figma:compare` checks the kit against the real Fuse components. It renders every instance in the preview frames with its Fuse component in Chromium and compares the two pictures cell by cell.

1. Build Fuse when `packages/fuse/dist` is missing or older than its sources, with `pnpm --filter @elmeragroup/fuse build`. The comparison renders the components and loads `styles.css` and `themes.css` from that build, and it warns when the sources are newer.
2. Run the plugin and press Export snapshots. The plugin exports each preview instance as a PNG at 2x, cut to its render bounds so that a focus ring outside the box is included. It records each instance's box and render bounds and the modes its preview frame resolves. The UI downloads the result as `fuse-kit-snapshots.json`. The export writes nothing to the file.
3. Run the comparison. pnpm runs the script in this package's directory, so pass an absolute path:

   ```sh
   pnpm --filter @elmeragroup/fuse-figma figma:compare ~/Downloads/fuse-kit-snapshots.json
   ```

   The report goes to `.cache/figma-compare/` in this package, or to the directory `--out` names. `--threshold` sets pixelmatch's threshold, 0.1 by default. The run needs Playwright's Chromium, which `pnpm --filter @elmeragroup/fuse-figma exec playwright install chromium` installs.

The browser renders one page per preview:

- The page stamps the preview's theme the way Fuse applies one: `data-theme` and `data-density` on `<html>`, and `data-theme-variant`, `data-theme-brand` and `data-theme-segment` on `<body>`. A brand mode maps to its brand by display name, and `Auto` density maps to the variant's default.
- It loads Fuse's standalone `styles.css`, Tailwind's preflight in the `base` layer and `themes.css`, and sets `font-sans text-foreground` on `<body>` as the docs layout does. Roboto comes from `@fontsource/roboto`, which serves Google's Roboto, the family Figma renders. The run checks every element in a cell that holds text, and stops when a face that text uses has not loaded, so the text never falls back to a system font.
- The run parses each variant key against the definitions in `components/kit-registry.ts`. Each cell is the element its definition's renderer builds from the Fuse build, rendered to static HTML. The page turns off animations and transitions, so a spinner stays at 0°.
- The page measures, forces and crops one element per cell: the slot's direct child whose `data-slot` is the definition's `slot`.
- The page forces `:hover` for `state=hover`, and `:focus` and `:focus-visible` for `state=focus`, through the Chrome DevTools Protocol. It compares the styles of each forced element and its descendants with the same cell at `state=rest`. When forcing changed nothing, it hovers or focuses that element for real before the screenshot.

The Button renderer, `compare/button-cell.ts`, renders both Button sets. `icon=start` adds `<Plus data-icon="inline-start" />` and `icon=end` adds `<ArrowRight data-icon="inline-end" />`. An icon button holds `<Plus />` and has an `aria-label`. Disabled sets `disabled` and pending sets `isPending`.

To compare a new component set:

1. Add its definition and preview cells to `KIT` in `components/kit-registry.ts`. Name its interactive axis `state`, with `rest` among its values, so the page can force hover and focus and find the resting twin.
2. Add a renderer module beside `compare/button-cell.ts`. It exports a `CellRendering` whose `element(cell)` returns the real Fuse element for a parsed cell. Set the states the markup draws, such as disabled, pressed or checked, through props.
3. List the module in `compare/cell-renderers.ts` with the definition's key and the `dist/` entry the module imports. The run checks that the entry exists before it loads the module.
4. Add a markup test beside the renderer whose oracle is the component's public contract, as `compare/button-cell.test.ts` does. `compare/cell-renderers.test.ts` already checks that every definition has a renderer and that each preview cell renders one measured element.

`report.html` opens from disk. It starts with a summary per preview and then lists every cell worst first. Each cell shows three pictures: Figma's export, the browser's crop, and the diff, which marks differing pixels red and anti-aliasing yellow. Figma's export and the browser's crop sit over the theme's background with the boxes' top-left corners aligned. Filters select a preview, a value of each variant axis, or only the flagged cells. `report.json` holds the same rows.

- Check box sizes first. Δ is Figma's box minus the browser's, in pixels. The `size` flag marks a side that differs by half a pixel or more, and such a cell goes to the top. `subpixel-size` marks a smaller difference, beyond Chromium's 1/64 px layout rounding.
- Mismatch is the percentage of the browser box's area, at 2x, whose pixels differ. The tolerant count leaves out the pixels that pixelmatch takes for anti-aliasing, and the raw count includes them. Figma and Chromium draw text differently, so a matching cell still shows some mismatch along the label. Mismatch away from text and edges points at a real difference.
- `png-size` marks an export whose size differs from its render bounds. `state-by-interaction` marks a cell that needed a real hover or focus. `state-missing` marks a cell whose state the browser could not show, so its browser picture is wrong. `no-figma-image` marks an instance Figma drew nothing for.
- The report lists an instance it cannot render as skipped, such as one whose variant has an axis the comparison does not know.

The first comparison of the test file, on 2026-10-20, covered 756 cells in the 12 previews:

- Every height matched, and every Icon button matched to the pixel apart from anti-aliasing.
- Every Button was wider in Figma, by less than a pixel: 0.41px at 12px type, 0.47px at 14px and 0.61px at 18px. Figma rounds an auto-width text layer up to a whole pixel. Its Roboto matches the browser's, so three labels in a row are 125px wide in Figma and 124.59px in Chromium. The rounding moves the right edge and nothing else. The worst cell differs by 2% of its pixels, all of it that edge and text anti-aliasing.
- A fixed label width could match the fraction, but then the label would not grow when a designer edits it, so the kit keeps auto width.

`figma:compare --self-check` tests the comparison itself. It renders every cell of the kit's preview frames in each of two themes and saves them as a fake snapshot whose render bounds reach 3 pixels past each box. It paints a square into the kit's first hover cell and widens the box of its first focus cell by a pixel, in registry order, and then it compares the snapshot with a second render. It passes when those two cells lead the report and every other cell matches exactly.

## Code map

| Module                                       | Role                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `fuse-variable-set.ts`                       | Projects the theme catalog into the six collections                                                                                     |
| `variable-set.ts`                            | The desired variables by name, checked once by `makeVariableSet`                                                                        |
| `file-variables.ts`                          | What the file holds, with Figma ids, and the changes one write makes                                                                    |
| `sync-plan.ts`                               | Diffs a variable set against a file and builds the batch. It is pure.                                                                   |
| `figma-api.ts`                               | The REST adapter: auth, decoding, encoding, retries and errors                                                                          |
| `token-sync.ts`                              | Plans, applies and verifies a sync against a `FigmaApi`                                                                                 |
| `cli.ts`, `main.ts`                          | The command line and its Node entry point                                                                                               |
| `plural.ts`                                  | Counted nouns for the messages of `cli.ts` and `token-sync.ts`                                                                          |
| `components/build-kit.ts`                    | Builds the components plugin's kit spec and coverage table                                                                              |
| `components/component-spec.ts`               | Turns a recipe into a component set, cell by cell, and records coverage                                                                 |
| `components/utility-css.ts`, `css-values.ts` | Compile utilities against `fuse.css` and read the values as Figma fields                                                                |
| `components/kit-registry.ts`                 | The kit's component sets and the cells their preview frames place, read by the build and the comparison                                 |
| `components/button-kit.ts`                   | The Button and Icon button matrices, the variants they model and the icons each cell renders                                            |
| `components/icon-library.ts`                 | Renders every Fuse icon to SVG markup for the icon library                                                                              |
| `components/kit-spec.ts`                     | The kit spec the plugin bundles                                                                                                         |
| `plugin/src/`                                | The plugin: the plan and its operations, the kit check, identity, field planners, the icon library, the component sets and the previews |
| `scripts/build-plugin.ts`                    | Builds the kit spec and bundles the plugin                                                                                              |
| `compare/`, `scripts/compare.ts`             | Renders the kit's cells with the real Fuse components and diffs them against a Figma snapshot export                                    |
| `compare/cell-renderers.ts`                  | One renderer per kit definition: the Fuse element for a cell, the element to measure, and the build entry it imports                    |

The tests run the whole command line against `test/in-memory-figma.ts`. That fake file applies batches with the REST API's documented rules, stores numbers as 32-bit floats and resolves aliases the way Figma renders them. Where the documentation is silent, the fake does what a real Enterprise file did on 2026-10-16. It replaces code syntax on an update, it checks for an alias cycle after each value a batch sets, and it refuses any cycle, even one that closes only across modes. It deletes a collection with its modes and variables and keeps an alias into it until a later value in the batch replaces it, as a real Enterprise file did on 2026-10-19 when one batch deleted `Fuse themes` and then rewrote the `Fuse tokens` aliases into it. It also applies the scope rules on the REST API's [variable types page](https://developers.figma.com/docs/rest-api/variables-types/). It rejects a scope the page does not list for the variable's type, such as `GAP` on a color, `ALL_SCOPES` beside another scope, and `ALL_FILLS` beside another fill scope. It follows a real Enterprise file where that file departed from the page on 2026-10-16. It keeps `FONT_STYLE` on a number variable and stores `FONT_WEIGHT` there as `FONT_STYLE`. It stores a description with `&`, `<`, `>`, `"` and `'` HTML-escaped, as a real Enterprise file did on 2026-10-19. Tests can also make it answer with a status, drop a connection, or hold values and types newer than the sync.
