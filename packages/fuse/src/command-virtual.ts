// Source entry facade for `@elmeragroup/fuse/command-virtual`. Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. Subpath-only: it imports the optional `@tanstack/react-virtual` peer, so the
// root barrel leaves it out (OPTIONAL_PEER_ENTRIES in scripts/entries.ts). No public recipe.
export { CommandVirtual } from "./components/command-virtual";
export type {
  CommandVirtualListProps,
  CommandVirtualRootProps,
} from "./components/command-virtual/command-virtual";
