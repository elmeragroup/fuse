# Skill evals

`pnpm skill-evals` measures what each skill in `apps/mcp/skills/` adds. It runs every task twice,
once with the skill and once without it, checks the app each run leaves behind, and writes a report
with both arms side by side.

You run it by hand, before a skill changes and before the server is announced. It is not a test
project, no turbo task runs it, and CI never does. Each run costs money, and its results vary from
run to run.

## Before you run it

- A `claude` CLI on `PATH`, logged in. The runner starts it headless with `claude -p`, and the runs
  bill to that login.
- Network access, because each run installs its app from the npm registry with `pnpm install`.
- The server bundle and the docs catalog it reads:

  ```sh
  pnpm exec turbo run generate --filter=docs
  pnpm --filter mcp build
  ```

  The runner copies the bundle, the catalog, the skills and `tasks.json` into the run's folder
  when the pass starts, so a rebuild during a pass changes neither arm. The report names the
  checkout's commit at run time and every file changed since it, so generate the catalog from
  that checkout.

## Run it

```sh
pnpm skill-evals                                  # every task, both arms, once
pnpm skill-evals --task build-ui-toggle-group     # one task
pnpm skill-evals --task theming-scope --arm baseline --repeat 3
pnpm skill-evals --skip-agent                     # set up and check the untouched fixtures, free
```

| Option              | Default             | What it sets                                                                                       |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `--task <id>`       | every task          | A task from `tasks.json`. Repeat it for more.                                                      |
| `--arm <arm>`       | `both`              | `with-skill`, `baseline` or `both`.                                                                |
| `--repeat <n>`      | 1                   | How many times each task and arm runs.                                                             |
| `--model <model>`   | `claude-sonnet-5-5` | The model both arms run.                                                                           |
| `--concurrency <n>` | 1                   | How many runs go at once.                                                                          |
| `--max-budget-usd`  | 2                   | The most one agent run may spend. The CLI stops it there.                                          |
| `--timeout-minutes` | 20                  | How long one agent run may take before the runner stops it.                                        |
| `--out <dir>`       | a new temp folder   | A new folder for the run. It must not exist yet, and it must be outside this repo, links resolved. |

## What it costs

With `claude-sonnet-5-5` in November 2026, one agent run of these tasks cost between $0.05 and
$0.22, and a full pass of five tasks and two arms cost $1.26 to $1.33. The report sums what every
run cost, and `--max-budget-usd` caps each run.

## What a pass does

1. Makes the run's folder. It fails when the folder exists, so a pass never scores an app another
   pass left behind.
2. Copies the server bundle, the catalog, the skills and `tasks.json` into `inputs/`, and hashes
   each file. Both arms read this copy.
3. Installs each fixture the tasks use once, keeps its `pnpm-lock.yaml` in `inputs/fixtures/`,
   and runs every check on the untouched install. A check the untouched fixture already passes
   cannot separate the arms, so the report shows it apart from the task's own checks.

## What one cell does

1. Makes a temporary folder of its own, outside the checkout and away from every other cell,
   copies the fixture there and installs it with `pnpm install --frozen-lockfile` from the pass's
   lockfile, so both arms start from the same packages. A setup task's own `pnpm add` still
   resolves on its own, so the report lists each arm's installed Fuse version.
2. Starts the server from the snapshot on a free port, with a new value in `FUSE_COMMIT`, and waits
   until `/healthz` answers that value, so it talks to its own server. The with-skill arm's server
   serves the skills. The baseline's server reads an empty folder, so it declares no Skills
   extension and its instructions name no skill. Effect's MCP client reads both servers' listings,
   and a cell whose server serves the wrong skills does not start.
3. Runs `claude -p` in the app with file edits, a shell and the server's tools, with no web tools,
   no subagents, `--strict-mcp-config`, no user settings and
   `permissions.blockReadsOutsideWorkingDirectories`, which refuses a read outside the app by the
   file tools and by the shell. The agent's environment has no variable that names the checkout or
   the run's folder. Both arms send the task's prompt and the same rules. The with-skill arm also
   tells the agent to read `skill://<name>/SKILL.md` first, because a headless run loads no
   skills. The CLI leaves the MCP resource tools out of a session whose servers serve no
   resources, so the baseline's session lacks them.
4. Stops the agent's and the server's process groups, checks the app, and copies the app without
   `node_modules`, the transcript and `cell.json` into the run's folder. The temporary folder is
   then deleted.

## What counts

A cell ends in one of four states:

- `not-started`: the install, the server, the agent's launch or the session's connection to the
  Fuse server failed.
- `unfinished`: the agent ran but stopped at the budget or the timeout, exited with an error, or
  ended on a result that is not a success.
- `finished`: `claude` exited 0 after a successful result.
- `agent-skipped`: the pass ran with `--skip-agent`.

A cell is also set apart when the with-skill agent never received the skill's text, or when any
agent's tool call names the checkout, the run's folder, another cell's folder, or a `SKILL.md`
outside a `skill://` read. Only `finished` and `agent-skipped` cells that nothing set apart are
samples. Every check ratio and mean counts samples alone, and the report lists the other cells with
their reasons. A run stopped by the timeout reports no cost, so the pass's cost is then a subtotal.

## The checks

The runner decides these after the agent stops. Scripts are read with `oxc-parser` and stylesheets
without their comments, so a commented-out line never counts.

- `pnpm exec tsc -b` exits 0.
- `pnpm run build` exits 0. It runs on a clean `dist`.
- The built `index.html` has the task's theme and density attributes on its first `<html>` start
  tag outside a comment, each written once, so they hold before any script runs.
- The build ships Fuse's CSS. The built page links a stylesheet that styles every `data-slot` the
  installed `styles.css` styles, and that has theme rules. In a Tailwind v4 app, a stylesheet the
  entry reaches imports `@elmeragroup/fuse/css`, and a positive `@source` in such a sheet reaches
  the installed package. In an app without Tailwind, a module the entry reaches imports
  `@elmeragroup/fuse/styles.css`. Both reach `themes.css`.
- Every `@elmeragroup/fuse` import resolves to a file, by Node's resolver from the app's folder.
- Each of the task's source checks: an element of a component imported from `@elmeragroup/fuse`
  renders, such a component carries a prop with a given value, or no stylesheet declares a given
  custom property.

It also records turns, tool calls by tool, the skill reads and whether each returned the skill's
text, duration and cost from the CLI's stream, and the `@elmeragroup/fuse` version each app
installed.

## The output

The run's folder holds:

- `report.md`, one section per task with both arms side by side: the checks that hold before the
  agent runs, then the task's own checks with their total, then the numbers.
- `results.json`, every cell's record and the untouched fixtures' checks, with the model, the
  `claude` version, the installed Fuse versions, the checkout's commit and the hash of every input.
- `inputs/`, the snapshot both arms read.
- `<task>/<arm>-<n>/`, each cell's app without `node_modules`, its `cell.json`, the agent's
  `transcript.jsonl` and its stderr.

One writer rewrites `report.md` and `results.json` after each cell, replacing each file whole, so
a stopped pass keeps what it finished.

## Add a task

Add an entry to `tasks.json`. A task names its skill, the skills that skill hands over to, a
fixture, the prompt, the theme and density the built document must carry, the stylesheet mode the
fixture calls for, its source checks and the expectations a reviewer reads the result against. Name
each source check after the fact it establishes.
The fixtures are `vite-plain` (no Tailwind), `vite-tailwind` (Tailwind v4 through `@tailwindcss/vite`
and the split sheets) and `vite-tailwind-fuse` (the Tailwind app with Fuse set up for Fjordkraft's
private customers, branded, at comfortable density).
