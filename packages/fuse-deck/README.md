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
fuse-deck check
```

From this checkout, `pnpm exec node packages/fuse-deck/src/bin.ts <command>` runs the CLI from
source through Node's type stripping. `skill/SKILL.md` ships in the package for agents.

## Exit codes

| Code | Means                                                  |
| ---- | ------------------------------------------------------ |
| 0    | The command did what it says.                          |
| 1    | A domain failure, such as a broken deck or a bad edit. |
| 2    | The command line did not parse.                        |

## Tests

`pnpm --filter @elmeragroup/fuse-deck test` builds the bin first, because the process tests spawn
`dist/bin.mjs`, the file the packed tarball ships.
