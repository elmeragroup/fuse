---
name: fuse-deck
description: Write and edit fuse-deck presentations, Fuse-themed slide decks in MDX. Use when a directory holds a deck.json, or when asked to make a talk or slides with fuse-deck.
---

# fuse-deck

A deck is a directory: `deck.json` holds the settings and the slide order, and each slide is
`slides/<id>.mdx`. `fuse-deck describe --json` lists the layouts, the components a slide can use
without an import, the frontmatter keys, the settings and every command. Read it before writing a
slide; this file does not repeat it.

1. If the deck has a `BRIEF.md`, read it for what the talk is for.
2. Plan the slides as ids, then create each one with `fuse-deck slides add <id> --title <text>`,
   passing `--after <id>` to place it and `--layout <name>` for a layout other than `content`.
3. Write each slide's content in its file. The first heading is the slide's title.
4. Reorder with `fuse-deck slides move`, and drop a slide with `fuse-deck slides remove`. Leave
   `deck.json`'s `order` to these commands.
5. Run `fuse-deck check --json` after each round of edits. The deck is done when it exits 0. On exit
   1 its document lists each problem with a hint.

Pass `--json` to every command: stdout then holds exactly one JSON document, and failures carry
`_tag`, `message` and usually `hint`. Exit 2 means the command line did not parse.
