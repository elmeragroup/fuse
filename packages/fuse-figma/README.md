# @elmeragroup/fuse-figma

Syncs the Fuse design tokens into a Figma file's local variables. The repository is the master for theming data, so the sync writes code into Figma and never reads design decisions back. It is a private workspace package with no build step. Node runs the TypeScript directly.

## What lands in Figma

The sync owns four variable collections, matched by name.

| Collection        | Modes                  | Variables                                                                                                                                                  |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fuse tokens`     | `Light`, `Dark`        | 84 variables, one per contract token such as `primary` or `radius` and one per radius rung such as `radius-md`. Designers bind these.                      |
| `Fuse themes`     | One per theme slug, 20 | 168 variables, `light/<token>` and `dark/<token>` for each `Fuse tokens` variable. They are hidden from pickers and only feed `Fuse tokens`.               |
| `Fuse primitives` | `Value`                | 23 variables, the neutral ramp and the brand accents. Primitive tokens are public API with the same value in every theme, so designers can bind these too. |
| `Fuse density`    | `Dense`, `Comfortable` | 18 variables, one per control metric such as `control-h-md`. Designers bind these.                                                                         |

To preview a theme, a designer sets three modes on a frame. `Fuse themes` gets the theme slug, such as `external-fkas-private`, `Fuse tokens` gets `Light` or `Dark`, and `Fuse density` gets `Dense` or `Comfortable`. Figma resolves each alias with the frame's mode for the target collection, which is how the independent choices combine. A frame that sets no density mode gets `Dense`, the first mode. Apps default internal themes to dense and external themes to comfortable, so set `Comfortable` on frames that preview an external theme.

The token values come from `resolveThemeCatalog` in `@elmeragroup/fuse/theme-catalog`. It resolves every theme in both schemes from `composeTheme`, the same composition that generates `themes.css`, and hands the sync each value already read: an sRGB color, a length in pixels or a font family, plus the one `var()` hop when the value is a reference. The catalog throws on a token value it cannot read, because token values are Fuse source, and a Fuse test resolves every theme and scheme so CI catches such a value first. The sync maps the resolved values as follows.

- A color becomes an sRGB color, with alpha kept and the channels unrounded. The tokens write `oklch()` or `#rrggbb` literals, and the catalog reads exactly those two forms through `@elmeragroup/color`, which clips a color outside the sRGB gamut.
- `var(--name)` becomes an alias to the matching variable. A role reference points at the same scheme's role in `Fuse themes`, and a primitive reference points into `Fuse primitives`.
- A `rem` length becomes the catalog's pixels at a 16px root.
- A radius rung becomes the pixels `fuse.css` computes for it, such as `--radius-md: calc(var(--radius) - var(--radius-step))`, because Figma variables cannot compute. The catalog computes each rung per theme from the theme's `radius` and `radius-step` and the rung's step count, and the sync writes those pixels per theme mode. Internal themes step 0px, so every rung equals `radius`. External themes step 2px, so `external-fkas-private` with a 12px radius gets 6, 8, 10, 12 and 16px from `radius-xs` to `radius-xl`. CSS clamps a negative `border-radius` to 0, and so does the catalog. The sync leaves out `radius-popover`, because no component uses that rung and Fuse popups use `radius-md`.
- A control metric comes from the catalog in pixels per density, read from the same metrics the `fuse.css` density blocks must equal. Heights get the width and height picker, padding and gaps the gap picker, and `control-text` and `control-leading` the font size and line height pickers.
- A font stack becomes its first family name, which the catalog reads.
- A derived role, such as `secondary-hover`, becomes the literal color that composition computes, because Figma variables cannot mix colors.
- The `Fuse tokens`, `Fuse primitives` and `Fuse density` variables carry web code syntax. A token, primitive or metric carries its `var()`, such as `var(--primary)`. A radius rung carries the `calc()` that `fuse.css` declares, such as `calc(var(--radius) - 3 * var(--radius-step))`. `fuse.css` declares the rungs in `@theme inline`, so Tailwind inlines them into its utilities, and the built CSS declares no `--radius-sm` property. A test requires every `var()` in the code syntax to name a property that the built `styles.css` or `themes.css` declares.
- Colors and font families appear in every picker. Figma's REST documentation says scopes currently apply only to FLOAT and COLOR variables, so font families do not get the font picker scope yet.
- Each length token names its picker scope in a table in `fuse-variable-set.ts`, so a new length token does not compile until someone picks one. `radius`, `radius-button` and the radius rungs get the corner radius picker.
- `radius-step` gets no picker scope. It is a length, but it spaces the radius rungs and switches between the internal and external variants, so no layer rounds with it. It keeps its code syntax, `var(--radius-step)`.

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
- A mode keeps its id only while the tokens keep its name. The sync deletes a mode the tokens no longer name and creates the modes they add, and it never renames one into another, because a dropped theme and an added one are unrelated. Frames pinned to a deleted mode lose that pin. Renaming a theme slug in code is therefore a delete and a create in Figma, and designers repin the frames that used the old slug.
- The sync orders mode changes so that no collection goes over Figma's 40 modes or runs out of modes while the batch applies. It deletes the stale modes before creating new ones. When no existing mode survives, it keeps the last stale mode until the first new mode exists. The only mode it renames is the one Figma gives a new collection, which becomes the collection's first mode.
- Inside the four Fuse collections, the tokens are authoritative. The sync deletes any mode or variable the tokens do not define, and the next sync resets any value a designer edited.
- It never touches another collection in the file. The sync skips library collections, collection extensions and deleted variables that layers still reference, even when their names match.
- It refuses to change a variable's type, because Figma can only do that by deleting the variable and unbinding every layer that uses it. The error names the variable to delete by hand.
- Renaming a token in code is a delete and a create in Figma, so layers bound to the old name lose their binding.
- It refuses to sync tokens whose aliases form a cycle. A cycle counts even when each alias closes it in a different mode, because the modes a layer combines decide whether Figma would loop.
- It writes the values of each alias target before the values that alias it. Figma applies values in order and does not say whether it checks for a cycle after each one, and this order never passes through a cycle, even when the tokens reverse an alias.
- A value shape or variable type newer than the sync does not stop a read. A variable the sync owns gets such a value rewritten, and a type it does not know is a type conflict.
- It sets web code syntax on the `Fuse tokens`, `Fuse primitives` and `Fuse density` variables, and sends no code syntax for the `Fuse themes` variables, which only feed aliases. Figma does not document whether an update merges code syntax or replaces it. When the sync sets the web entry, it sends the file's Android and iOS entries with it, so they survive either way.
- The sync retries a read that hits a rate limit, a server error or a network failure. It waits as long as `Retry-After` asks and logs a warning for each retry. It retries a write only after a 429, because a write that failed on the server may still have been applied. When `Retry-After` asks for more than 60 seconds, the sync fails at once and reports the wait.

The alternative was kumo-figma's approach, which deletes every variable and recreates it on each run. That gives every variable a new id and breaks the bindings in existing designs.

## Code map

| Module                 | Role                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `fuse-variable-set.ts` | Projects the theme catalog into the four collections                  |
| `variable-set.ts`      | The desired variables by name, checked once by `makeVariableSet`      |
| `file-variables.ts`    | What the file holds, with Figma ids, and the changes one write makes  |
| `sync-plan.ts`         | Diffs a variable set against a file and builds the batch. It is pure. |
| `figma-api.ts`         | The REST adapter: auth, decoding, encoding, retries and errors        |
| `token-sync.ts`        | Plans, applies and verifies a sync against a `FigmaApi`               |
| `cli.ts`, `main.ts`    | The command line and its Node entry point                             |
| `plural.ts`            | Counted nouns for the messages of `cli.ts` and `token-sync.ts`        |

The tests run the whole command line against `test/in-memory-figma.ts`. That fake file applies batches with the REST API's documented rules, stores numbers as 32-bit floats and resolves aliases the way Figma renders them. Where the documentation is silent, the fake takes the stricter reading. It replaces code syntax on an update, it checks for an alias cycle after each value a batch sets, and it refuses any cycle, even one that closes only across modes. It also applies the scope rules on the REST API's [variable types page](https://developers.figma.com/docs/rest-api/variables-types/). It rejects a scope the page does not list for the variable's type, such as `GAP` on a color, `ALL_SCOPES` beside another scope, and `ALL_FILLS` beside another fill scope. Tests can also make it answer with a status, drop a connection, or hold values and types newer than the sync.
