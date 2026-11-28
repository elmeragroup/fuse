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
  pnpm --filter docs generate
  pnpm --filter mcp build
  ```

  The runs read the catalog as it is, so generate it from the commit you want to measure. The
  report names that commit and any file changed since it.

## Run it

```sh
pnpm skill-evals                                  # every task, both arms, once
pnpm skill-evals --task build-ui-toggle-group     # one task
pnpm skill-evals --task theming-scope --arm baseline --repeat 3
pnpm skill-evals --skip-agent                     # set up and check the untouched fixtures, free
```

| Option              | Default             | What it sets                                                    |
| ------------------- | ------------------- | --------------------------------------------------------------- |
| `--task <id>`       | every task          | A task from `tasks.json`. Repeat it for more.                   |
| `--arm <arm>`       | `both`              | `with-skill`, `baseline` or `both`.                             |
| `--repeat <n>`      | 1                   | How many times each task and arm runs.                          |
| `--model <model>`   | `claude-sonnet-5-5` | The model both arms run.                                        |
| `--concurrency <n>` | 1                   | How many runs go at once.                                       |
| `--max-budget-usd`  | 2                   | The most one agent run may spend. The CLI stops it there.       |
| `--timeout-minutes` | 20                  | How long one agent run may take before the runner stops it.     |
| `--out <dir>`       | a new temp folder   | Where the apps and the report go. It must be outside this repo. |

## What it costs

One agent run of these tasks cost between $0.05 and $0.50 with `claude-sonnet-5-5` in November 2026.
A full pass of five tasks and two arms costs a few dollars. The report sums what every run cost.

## What one run does

1. Copies the task's fixture from `fixtures/` to its own folder under `--out` and installs it.
2. Starts the server from `apps/mcp/dist/main.mjs` on a free port. The with-skill arm's server
   serves `apps/mcp/skills/`. The baseline's server reads an empty skills folder, so it has no
   Skills extension and its instructions name no skill. The runner records what `skills/list`
   answers for each, `method not found` for the baseline, and stops a run whose server serves the
   wrong skills.
3. Runs `claude -p` in the app with file edits, a shell and the server's tools, with no web tools,
   no subagents, `--strict-mcp-config` and no user settings. Both arms send the task's prompt and
   the same rules. The with-skill arm also tells the agent to read `skill://<name>/SKILL.md` first,
   because a headless run loads no skills. The CLI leaves the MCP resource tools out of a session
   whose servers serve no resources, so the baseline's session lacks them.
4. Stops the agent's and the server's process groups, then checks the app.

## The checks

The runner decides these from the app's files after the agent stops:

- `pnpm exec tsc -b` exits 0.
- `pnpm run build` exits 0. It runs on a clean `dist`.
- The built `index.html` has the task's theme and density attributes on its `<html>` start tag,
  so they hold before any script runs.
- The app loads Fuse's CSS the way its build calls for: `@elmeragroup/fuse/css` with an `@source`
  that reaches the installed package in a Tailwind v4 app, `@elmeragroup/fuse/styles.css` in an app
  without Tailwind, and `themes.css` in both.
- Every `@elmeragroup/fuse` import in the app resolves through the installed package's `exports`.
- Each of the task's source checks: a pattern that one file under `src/` must match, or that none
  may match.

It also records turns, tool calls by tool, the skills the agent read, duration and cost from the
CLI's stream, and the `@elmeragroup/fuse` version each app installed.

## The output

The run's folder holds:

- `report.md`, one table per task with both arms side by side.
- `results.json`, every run's record: the prompt, the server's listings, the checks, the numbers,
  the model, the installed Fuse version and the catalog's commit.
- `<task>/<arm>-<n>/`, each run's app, its `cell.json`, the agent's `transcript.jsonl` and its
  stderr.

The runner rewrites `report.md` and `results.json` after each run, so a stopped pass keeps what
it finished.

## Add a task

Add an entry to `tasks.json`. A task names its skill, the skills that skill hands over to, a
fixture, the prompt, the theme and density the built document must carry, the stylesheet mode the
fixture calls for, its source checks and the expectations a reviewer reads the result against.
The fixtures are `vite-plain` (no Tailwind), `vite-tailwind` (Tailwind v4 through `@tailwindcss/vite`
and the split sheets) and `vite-tailwind-fuse` (the Tailwind app with Fuse set up for Fjordkraft's
private customers, branded, at comfortable density).
