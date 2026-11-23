# @elmeragroup/fuse-deck

Builds slide decks from MDX, themed with Fuse. A deck is a directory with a `deck.json` and one
`slides/<id>.mdx` per slide. The `fuse-deck` command scaffolds a deck, keeps its order and files in
step, and checks it. Its output is written for agents first: `--json` prints exactly one JSON
document per run.

The package is private and packable. It is developed here and moves to its own repository before it
is published, so Fuse stays the one public package.

## Use

```sh
fuse-deck create talk --brief "What the talk is for"
cd talk
fuse-deck describe          # the layouts, components, frontmatter, settings and commands
fuse-deck slides add intro --title "Why Fuse"
fuse-deck check             # compiles every slide and validates the theme against Fuse
fuse-deck dev               # serves the deck with live reload
fuse-deck build             # writes the static deck to dist/
```

A slide change is a React view transition: the old slide blurs out and the new one blurs in.
`<Step>` reveals content one key press at a time, and `<Morph name>` moves one element to its partner on the next slide. Arrow keys, Space, Page Up/Down, Home and End
navigate; the URL hash names the slide and step, so links and Back work.

From this checkout, `pnpm exec node packages/fuse-deck/src/bin.ts <command>` runs the CLI from
source through Node's type stripping. It serves the built runtime in `dist/runtime`, so build first
with `pnpm exec turbo run build --filter=@elmeragroup/fuse-deck`, which builds Fuse before it.
`skill/SKILL.md` ships in the package for agents, and `describe` prints its path.

The package exports no modules (`"exports": {}`). The bin and Vite reach `dist/` by file path, so a
deep import such as `@elmeragroup/fuse-deck/dist/runtime/main.js` fails.

## Exit codes

| Code | Means                                                  |
| ---- | ------------------------------------------------------ |
| 0    | The command did what it says.                          |
| 1    | A domain failure, such as a broken deck or a bad edit. |
| 2    | The command line did not parse.                        |

## How it builds

Node never imports Fuse. fuse-deck resolves `@elmeragroup/fuse/theme` from this package and loads it
with Vite's `runnerImport`, rooted at the package directory, for the first-paint attributes, the
color-scheme bootstrap and the theme check. The CLI owns the whole Vite config: the deck directory
is the root, no `vite.config` loads, and the HTML shell and runtime come from the package. tsdown
builds two targets: `dist/bin.mjs` for Node and `dist/runtime/` for the browser, which keeps React,
Fuse and the deck manifest external.

## Tests

Run the suites through turbo, which builds Fuse and this package first:

```sh
pnpm exec turbo run build test test:browser --filter=@elmeragroup/fuse-deck
```

The process tests spawn `dist/bin.mjs`, the file the packed tarball ships, and the browser suite
drives a deck that bin built. A direct `vitest` run uses whatever `dist/` holds, so rebuild after
each change.
