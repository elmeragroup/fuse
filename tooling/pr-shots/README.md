# @elmeragroup/pr-shots

`pnpm shots` takes the before and after screenshots CONTRIBUTING.md asks of a visual change. It
opens a route on the real docs site twice, once on the base and once on the change. It finds an
element by role and accessible name and writes a padded clip of its demo stage for each theme,
density, engine and window size. A page without a component demo, such as the landing page, gets the
window or the whole page instead. Then it writes a Markdown table of the pairs and prints the `gh`
command that uploads them to a pull request, or runs that command with `--pr`.

The shots come from the docs site, with Tailwind preflight and the docs fonts. The base comes from
prod, so the working tree stays on your branch. The local server writes to its own output
directory, so `docs#test:browser` can run beside it.

## Usage

```text
pnpm shots <name> --route <path> [--target <role>:<accessible name>] [options]
```

`<name>` is lowercase letters, digits and dashes. It names the output directory and the PR-body
markers. `pnpm shots --help` prints every flag with its default.

A command line that does not parse prints the help and the error, then exits 2. A run that fails
after parsing prints its message and exits 1.

To find the role and accessible name, see [Finding the target](#finding-the-target).

| Flag                         | Default                     | Does                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--route <path>`             | required                    | The docs path to open, such as `/components/phone-number-field`. It starts with a single `/` and has no backslash, so it stays on the source's origin.                                                                                                                                                                                            |
| `--target <role>:<name>`     | none                        | The element, by ARIA role and exact accessible name. Only the first colon separates them. Without it the shot covers the page: see [Pages other than component demos](#pages-other-than-component-demos).                                                                                                                                         |
| `--nth <n>`                  | `0`                         | Which match to take when several share the role and name.                                                                                                                                                                                                                                                                                         |
| `--click <role>:<name>[@n]`  | none                        | Clicks an element before the shot, found like `--target`. Repeat it for more steps; they run in order. A trailing `@n` picks the match, counting from 0, as `--nth` does. A name that itself ends in `@` and digits keeps them with `@0` after it: `--click 'button:Seat@3@0'` clicks `Seat@3`. See [Clicking first](#clicking-first).            |
| `--fill <text>`              | none                        | Clicks the target, types the text and blurs it before the shot.                                                                                                                                                                                                                                                                                   |
| `--frame <frame>`            | `auto`                      | `stage` clips the closest `[data-demo-stage]` ancestor, which holds the label and description. `target` clips the element alone. Both take in a popup a control in them holds open. `viewport` is the window: at the top of the page, or with `--click` where the steps and the fill left it. `page` is the whole page. `auto` picks one of them. |
| `--pad <px>`                 | `12`                        | CSS pixels added on every side of the frame. The clip stops at the page edges.                                                                                                                                                                                                                                                                    |
| `--themes <slug,...>`        | the page's preview theme    | Theme slugs such as `external-tkas-company`. The run picks each one in the header's theme settings menu by its roles and names. The stage then takes the deployment-default density for the variant.                                                                                                                                              |
| `--densities <list>`         | the theme's default density | `dense`, `comfortable` or both. An override: see [Overrides](#overrides).                                                                                                                                                                                                                                                                         |
| `--engines <list>`           | `chromium`                  | Any of `chromium`, `webkit`, `firefox`. Install a missing engine with `pnpm exec playwright install <engine>`.                                                                                                                                                                                                                                    |
| `--viewports <WxH,...>`      | `1280x900`                  | Window sizes in CSS pixels, such as `1280x800,390x844`. Each size is an axis of the matrix, like engines.                                                                                                                                                                                                                                         |
| `--scale <n>`                | `2`                         | The device scale factor, above 0 and at most 4.                                                                                                                                                                                                                                                                                                   |
| `--color-scheme light\|dark` | `light`                     | The color scheme the browser reports to the page.                                                                                                                                                                                                                                                                                                 |
| `--before <source>`          | `prod`                      | Where the base comes from: `prod`, `local` or a URL.                                                                                                                                                                                                                                                                                              |
| `--after <source>`           | `local`                     | Where the change comes from: `prod`, `local` or a URL.                                                                                                                                                                                                                                                                                            |
| `--threshold <0..1>`         | `0.1`                       | pixelmatch's matching threshold for the diff. Smaller counts fainter changes.                                                                                                                                                                                                                                                                     |
| `--no-diff`                  | diff on                     | Skips the pixel diff and leaves the Diff column out of the table.                                                                                                                                                                                                                                                                                 |
| `--pr <n>`                   | none                        | Uploads the shots to pull request `<n>`.                                                                                                                                                                                                                                                                                                          |

A source is one of three things.

- `prod` is `https://fuse.elmeragroup.no`, which deploys on every merge to main.
- `local` runs `next dev` for `apps/docs` from this checkout on a free port and stops it when the
  run ends.
- A URL, such as `http://127.0.0.1:3000`, reuses a server that is already running. The run keeps
  only its origin.

When the route answers 404 on the before source, the component is not deployed yet. The run says
so, skips the before shots, and marks the before column in the table.

Each shot prepares the page in one order: theme, click steps, density override, fill. Before each
shot the run waits for network idle and `document.fonts.ready`. On a Next page it also waits for
hydration, as the landing tests do, and after a theme picker closes it waits for the page's scroll
lock to be released. It finishes running animations and takes the shot with reduced
motion, animations stopped and the caret hidden.

## Output

The run writes to `.scratch/shots/<name>/`. Before it changes anything it takes that directory's
lock, `.pr-shots.lock`, and holds it through the upload, so a second run with the same name fails at
once and names the pid that holds it. Then it clears the PNGs, `table.md` and `pr-body.md` an
earlier run of the same name left there. Each PNG is named
`<before|after>-<theme>-<density>-<scheme>-<engine>-<width>x<height>-<frame>.png`. `<theme>` is
the slug or `default-theme`. `<density>` is `<density>-override`, or without an override
`stage-density` for a stage or target frame and `page-density` for the window or the page.
`<frame>` is the resolved frame: `stage`, `target`, `viewport` or `page`.

For each pair with both images, the run compares the two with
[pixelmatch](https://github.com/mapbox/pixelmatch) and writes
`<theme>-<density>-<scheme>-<engine>-diff.png`. The diff paints changed pixels red and
anti-aliasing yellow over the faded before shot. The count leaves anti-aliased pixels out.

`table.md` has one row per theme, density and engine, with the before and after images side by
side. Each image's alt text names the target, the route, the click steps, the fill, the theme, the density, the
scheme and the engine. The Diff column holds the diff image and the changed pixels as a count and
a share, such as `312 px (0.4%)`. A share below 0.1% reads `<0.1%`, so a 1px shift never reads as
no change.

- When the two images differ in size, the cell gives both sizes and the row has no diff. A size
  change is a finding of its own.
- A row without a before shot has no diff.
- `--no-diff` leaves the column out.

Images are referenced as `./<file>`. gh rewrites each reference to the uploaded asset, so the `gh`
command runs from the output directory.

Without `--pr`, the run prints the `gh pr edit '<pr>' --body-file pr-body.md --attach ...`
command. Write `pr-body.md` yourself from the PR body with `table.md` in it, then run the command.

With `--pr <n>`, the run reads the body with `gh pr view` and puts the table between
`<!-- pr-shots:<name> -->` and `<!-- /pr-shots:<name> -->`, each on a line of its own. A body that
already has the block gets it replaced in place. Otherwise the block goes at the end of
`## Verification`, and a body without that section gets one appended. The run saves the result as
`pr-body.md` and runs `gh pr edit` with it and one `--attach` per image, diffs included. A re-run
with the same name replaces its own block and leaves other runs' blocks alone.

Runs that upload to the same pull request from this checkout take turns. Each holds
`.scratch/shots/.pr-<n>.lock` from reading the body to `gh pr edit`, so a second run waits instead
of writing back a body without the first run's block. It waits while a live run holds the lock, for
at most two minutes, then gives up. A lock that needs a person to delete a file fails at once and
says which file. Runs on other machines, or in another checkout, are not covered.

`gh pr edit` attaches at most 50 files. Each row adds a before shot, an after shot and, with diffs
on, a diff image, so the run counts them from the plan before any shot. With `--pr`, a run over 50
fails at once and asks you to split the matrix across runs with different names. Without `--pr`,
the run prints a warning beside the command.

## Examples

The phone field before and after a fix, filled and shown at both densities:

```sh
pnpm shots phone-dial --route /components/phone-number-field --target textbox:Mobile \
  --fill 123123 --densities dense,comfortable --pr 182
```

A theme matrix in two engines, with each theme at its own default density:

```sh
pnpm shots button-themes --route /components/button --target button:Save \
  --themes internal-fkas-private,external-tkas-company,external-fkse-private --engines chromium,webkit
```

## Finding the target

`--target` needs the element's role and exact accessible name. When the docs source doesn't make
them obvious, read them from the page's accessibility tree with
[agent-browser](https://github.com/vercel-labs/agent-browser). It is optional, and `pr-shots` does
not depend on it.

```sh
npx agent-browser open https://fuse.elmeragroup.no/components/phone-number-field
npx agent-browser snapshot -i
npx agent-browser close
```

`--click` takes a role and name the same way. Snapshot again after a click that changes the page,
such as a tab that reveals another panel, to read the next step's element.

`snapshot -i` lists the interactive elements, one per line, as
`- <role> "<accessible name>" [ref=…]`. The line `- textbox "Mobile" [ref=e12]` becomes
`--target textbox:Mobile`. Pass `--nth` when several lines share the role and name, counting from 0
in the order the snapshot lists them. A component that is not on prod yet has no page there to
snapshot. Read its demo's label in the source instead.

## Pages other than component demos

A landing page, a handbook page or the docs shell has no demo stage, and maybe no element to name.
Leave out `--target`, and the run shoots the window, or the whole page with `--frame page`:

```sh
pnpm shots landing --route / --viewports 1280x800,390x844 --frame page
```

- `--frame auto`, the default, resolves once per run on the after source, and both sides use that
  frame. It prepares the page as for the run's first shot, theme, density and fill included, so a
  target that only one theme renders is found. It takes `stage` for a target inside a
  `[data-demo-stage]`, `target` for a target outside one, and `viewport` without a target. File
  names and alt text name the resolved frame.
- `--frame stage` or `--frame target` fails, naming the frame and the route, when the page has no
  matching element.
- `--viewports` takes one or more window sizes, written without leading zeros; a size given twice
  counts once. Each is an axis of the matrix, like `--engines`, and adds a pair to the table and
  to the 50-attachment count. `viewport` shoots the window
  scrolled to the top, or with `--click` where the steps and the fill left it; `page` shoots the
  whole document at the window's width.
- `--themes` drives whichever theme picker the page has, by roles and names: the docs header's
  "Theme settings" menu, which themes demo stages, or the landing's "Theme" chip in its banner,
  which themes the whole page. A page with neither fails, naming `--themes` and the route, before
  any screenshot is written.
- `--densities` stamps the frame's closest `[data-density]` element, which is the demo stage for a
  component, or the document root when there is none. It stays an override.
- `--fill` needs `--target`, the element it types into.

## Clicking first

Some changes show only after an interaction, such as a Select's open list or a tab's panel.
`--click` puts the page into that state. The steps run after the theme is picked and before the
target is looked up, so a step may be what renders the target. Each step waits up to 15 seconds
for its element to show, then clicks it once and leaves it as it is: nothing blurs it or presses
Escape, so what it opened stays open for the shot. A step whose element never shows fails the run,
naming the step's number, the element and the route.

A step that clicks a collapsed control, one with `aria-expanded="false"`, also waits up to 15
seconds for it to open: for it to hold open a popup that the clip takes in, by the `stage` and
`target` rule below. Expanded alone is not enough, because a control may report it before its popup mounts.
A Base UI submenu opens after a delay, so without the wait the shot would show it closed. A
control that never opens fails the step, naming it, so a closed state never stands in for the
open one. A control without `aria-expanded`, such as a tab, is only clicked. When the click
re-renders the control as a new node, the wait follows the node that now has the step's role and
name.

The landing's Rows per page Select is in the Order search view of the hero window's Internal side,
and the page opens on External:

```sh
pnpm shots landing-page-size --route / \
  --click button:Internal --click 'button:Order search' --click 'combobox:Rows per page' \
  --target 'combobox:Rows per page' --frame target --viewports 1280x800
```

How the steps meet each frame:

- `stage` and `target` take in the popups a control holds open. A control in the frame, the frame
  itself included, with `aria-expanded="true"` adds the box of each visible element its
  `aria-controls` names. Base UI's Select trigger names its list only while it is open. A control
  that names no visible element adds every visible listbox, menu and dialog on the page instead.
  Each popup found is searched the same way, so a submenu an open menu's item holds open counts
  too. Visible means painted: a closed popup that keeps its layout under `visibility: hidden` or
  `opacity: 0` does not count. The padding goes around the union, and the clip stops at the page
  edges.
- After clicks, the target is looked up by its accessible name as usual. When nothing in the
  accessibility tree matches, the lookup falls back to the elements visible on screen, including
  those hidden from the tree, so `--target` can name the button that opened a modal dialog,
  which hides the rest of the page. In the fallback `--nth` counts those elements too, and a
  name takes in its aria-hidden text, such as a shortcut hint.
- `viewport` keeps the scroll position the steps and the fill left. Clicking scrolls each element
  into view, so what it opened is in the window. A run without clicks shoots the top of the page.
- `page` shoots the whole document, popups included.
- `--frame auto` replays the steps when it resolves, as it does the theme and the fill, so a
  target that a step renders is found.
- `--fill` runs after the steps. It blurs the target, which closes a popup the target opened.

## Overrides

Two flags render a stage the docs page itself never shows. File names and alt text say so.

- `--densities` stamps `data-density` on the target's demo stage after the theme is set. On the
  docs page a stage always takes the deployment default for its variant: `dense` for internal
  themes, `comfortable` for external ones. A run that passes `--themes external-tkas-company
--densities dense` shows an external theme at a density no deployment uses.
- `--color-scheme` sets the color scheme the browser reports. The docs site follows it until a
  visitor picks Light or Dark in the menu, so the page matches what a visitor with that system
  setting sees.

## The local server

`local` serves `apps/docs` with `next dev` and sets `DOCS_DIST_DIR`, which
`apps/docs/next.config.ts` reads as `distDir`, to `node_modules/.cache/pr-shots-next`. Next writes
there instead of `apps/docs/.next`, and the cache there keeps later starts fast. `next dev`
rewrites `apps/docs/next-env.d.ts` to point at that directory, so the run restores the file when it
stops, also on Ctrl-C. On stop the run signals the server's whole process group, so the worker that
holds the port goes too, and sends SIGKILL to whatever is left after five seconds. It does this
even when the `next dev` launcher has already exited, and restores the file only once the group is
empty.

Only one run at a time may use `local` on a checkout. A run with a `local` side takes
`pr-shots.lock` in the server's output directory before it clears its own output or takes any shot,
and frees it once the server is gone and the file is restored. A second run fails at once and names
the pid that holds the lock.

Both locks work the same way (`src/file-lock.ts`). A lock file holds its owner's pid and a token,
and a run links it into place whole, so no run ever sees a lock without its owner. A lock whose pid
is no longer running is stale, and the next run takes it over, after checking that the file still
holds the stale record. A lock file without a complete owner record, or a `.reclaim` directory a
crashed run left beside one, is never cleared automatically: the run stops and names the file to
delete by hand if no run is active.

A run killed with SIGKILL skips its cleanup, so its `next dev` keeps running in its own process
group and `next-env.d.ts` stays rewritten. To recover from that, a running server keeps a crash
record beside the checkout lock, `pr-shots.lock.server.json`, with its process group and what
`next-env.d.ts` held before it started. A normal stop removes it. When the next run finds a record:

- If the recorded group is still running, the run stops, names the group, and prints the command
  that stops it, `kill -TERM -<group>`. It reclaims nothing.
- If the group is gone, the run puts `next-env.d.ts` back as the record holds it, deletes the
  record, and goes on.

A run deletes the record only once `next-env.d.ts` is back. When the file can't be written, for
example after a permission change, the run says so, names the file and keeps the record, and the
next local run restores the file from it.

One write into `apps/docs/.next` remains. Next's launcher learns the output directory only when the
server is ready, so a Ctrl-C in the first seconds of a start can leave a telemetry file,
`.next/_events_<pid>.json`. Telemetry being off does not stop it, and no setting moves it. It is
not a build output, and `docs#test:browser` ignores it. `src/docs-server.ts` has the details.

`next dev` serves the source as it is on disk, so it shows uncommitted changes. It compiles the
Fuse components from source, but the docs stylesheet imports the theme CSS from
`packages/fuse/dist`. Run `pnpm --filter @elmeragroup/fuse build` first when the change touches
theme or density CSS, and `pnpm --filter docs generate` when it touches generated docs content.

## Code

The package is an Effect program. `src/main.ts` is the entry point. It runs `src/cli.ts` under
`NodeRuntime.runMain`, which turns Ctrl-C into an interruption, so the local server and the
browsers close through their finalizers. `cli.ts` declares the flags as an `effect/unstable/cli`
command and maps failures to exit codes. `run-shots.ts` sequences one run.

Each adapter is a service with a layer: `Capture` in `capture.ts` drives Playwright, `DocsServer` in
`docs-server.ts` runs `next dev`, and `Gh` in `gh.ts` calls the GitHub CLI. The pure modules need no
services. `options.ts` holds the schemas that decode each flag, `shot-plan.ts` names the files,
`pixel-diff.ts` compares a pair with pixelmatch, `shot-table.ts` writes the Markdown, and
`pr-body.ts` edits the PR body. Their tests sit beside them.

`test/` holds the tests that need a browser or a process. `pnpm test` runs everything but
`*.browser.test.ts`, so it needs no Playwright browser. `pnpm test:browser` runs
`capture.browser.test.ts`, which captures fixture pages in Chromium and checks each PNG's pixel
size against the fixture's fixed geometry, including the clip of a control and the portaled popup
it opened.

- `docs-server.test.ts` runs a fake `next dev` with a launcher and a worker. It checks that an
  interrupt stops both and restores `next-env.d.ts`, and covers a failed spawn, a server that never
  answers, an unreadable `next-env.d.ts`, an overlapping run, a stale lock, and a launcher that
  exits, by code or by signal, while its worker keeps the port.
- `gh.test.ts` runs a fake `gh` and checks that an interrupted upload kills it.
- `run-shots.test.ts` runs whole runs with stub services. It checks the attachment limit, that a
  second run with the same name changes nothing, and that a run refused the local server takes no
  shot.
- `file-lock.test.ts` races two runs for one lock and for one stale lock, and checks that an
  incomplete owner record and a lock created during a reclaim are left alone.
- `node-entry.test.ts` runs the `shots` script under plain Node.

Node runs the TypeScript by stripping types, so there is no build step.
