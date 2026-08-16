# Local-markdown tracker — wayfinding operations

This repo has no external issue tracker; the wayfinder map and its tickets live here as markdown.

- **Map**: `wayfinder/MAP.md` (the issue labelled `wayfinder:map`).
- **Tickets**: one file per ticket at `wayfinder/tickets/NNN-slug.md`. The `NNN` is the issue id; the `title` in frontmatter is the ticket's name — always refer to tickets by name, linking the file.
- **Ticket frontmatter**:
  ```yaml
  ---
  id: NNN
  title: <name>
  type: research | prototype | grilling | task
  status: open | closed
  assignee: null | <who claimed it>
  blocked-by: [<ids>]
  ---
  ```
- **Claiming**: set `assignee` before doing any work. Open + unassigned = unclaimed.
- **Blocking**: `blocked-by` lists ticket ids. A ticket is unblocked when every listed ticket has `status: closed`.
- **Frontier query**: `grep -l 'status: open' wayfinder/tickets/*.md` then filter to `assignee: null` and all `blocked-by` closed.
- **Resolution**: append a `## Resolution` section to the ticket, set `status: closed`, and add one line to the map's *Decisions so far*.
- **Assets**: research findings and prototypes live under `wayfinder/research/` (or `prototypes/`), linked from the ticket — never pasted into it.
