# @elmeragroup/fuse-figma

Syncs the Fuse design tokens into a Figma file's local variables. The repository is the master for theming data, so the sync writes code into Figma and never reads design decisions back. It is a private workspace package with no build step. Node runs the TypeScript directly.

## What lands in Figma

The sync owns six variable collections, matched by name.

| Collection        | Modes                          | Variables                                                                                                                                                                    |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fuse tokens`     | `Light`, `Dark`                | 98 variables, one per contract token such as `primary` or `radius` and one per radius rung such as `radius-md`. Designers bind these.                                        |
| `Fuse variant`    | `Internal`, `External`         | 235 variables: `<scheme>/<token>` for each `Fuse tokens` variable, and `density/<metric>` for each density metric. Hidden from pickers.                                      |
| `Fuse segment`    | `Private`, `Company`           | 392 variables, `<scheme>/<variant>/<token>` for each `Fuse tokens` variable. Hidden from pickers.                                                                            |
| `Fuse brand`      | One per brand, 7               | 784 variables, `<scheme>/<variant>/<segment>/<token>` for each `Fuse tokens` variable. They hold the theme values. Hidden from pickers.                                      |
| `Fuse primitives` | `Value`                        | 25 variables, the neutral ramp and the brand accents. They hold the same value in every theme. The neutral ramp is hidden from pickers, and the brand accents stay bindable. |
| `Fuse density`    | `Auto`, `Dense`, `Comfortable` | 39 variables, one per density metric: control (`control-h-md`), row (`row-h`), surface (`surface-pad-lg`, `surface-gap-md`) and label (`label-text`). Designers bind these.  |

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

## Code map

| Module                 | Role                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `fuse-variable-set.ts` | Projects the theme catalog into the six collections                   |
| `variable-set.ts`      | The desired variables by name, checked once by `makeVariableSet`      |
| `file-variables.ts`    | What the file holds, with Figma ids, and the changes one write makes  |
| `sync-plan.ts`         | Diffs a variable set against a file and builds the batch. It is pure. |
| `figma-api.ts`         | The REST adapter: auth, decoding, encoding, retries and errors        |
| `token-sync.ts`        | Plans, applies and verifies a sync against a `FigmaApi`               |
| `cli.ts`, `main.ts`    | The command line and its Node entry point                             |
| `plural.ts`            | Counted nouns for the messages of `cli.ts` and `token-sync.ts`        |

The tests run the whole command line against `test/in-memory-figma.ts`. That fake file applies batches with the REST API's documented rules, stores numbers as 32-bit floats and resolves aliases the way Figma renders them. Where the documentation is silent, the fake does what a real Enterprise file did on 2026-10-16. It replaces code syntax on an update, it checks for an alias cycle after each value a batch sets, and it refuses any cycle, even one that closes only across modes. It deletes a collection with its modes and variables and keeps an alias into it until a later value in the batch replaces it, as a real Enterprise file did on 2026-10-19 when one batch deleted `Fuse themes` and then rewrote the `Fuse tokens` aliases into it. It also applies the scope rules on the REST API's [variable types page](https://developers.figma.com/docs/rest-api/variables-types/). It rejects a scope the page does not list for the variable's type, such as `GAP` on a color, `ALL_SCOPES` beside another scope, and `ALL_FILLS` beside another fill scope. It follows a real Enterprise file where that file departed from the page on 2026-10-16. It keeps `FONT_STYLE` on a number variable and stores `FONT_WEIGHT` there as `FONT_STYLE`. It stores a description with `&`, `<`, `>`, `"` and `'` HTML-escaped, as a real Enterprise file did on 2026-10-19. Tests can also make it answer with a status, drop a connection, or hold values and types newer than the sync.
