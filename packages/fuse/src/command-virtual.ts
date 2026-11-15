// The source entry for `@elmeragroup/fuse/command-virtual`. It holds explicit named re-exports only,
// with no `export *`, no local declarations and no directives. The exports and barrel generators
// find this file, so never edit `package.json#exports` or `src/index.ts` by hand.
// It is a subpath only. It imports the optional `@tanstack/react-virtual` peer, so the root
// barrel leaves it out, through `OPTIONAL_PEER_ENTRIES` in `scripts/entries.ts`. It exports no
// public recipe.
export { CommandVirtual } from "./components/command-virtual";
export type { CommandVirtualListProps } from "./components/command-virtual/command-virtual";
