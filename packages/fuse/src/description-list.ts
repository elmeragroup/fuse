// This file is the source entry for `@elmeragroup/fuse/description-list`. It contains only explicit named
// re-exports, with no `export *`, local declarations or directives. The exports and barrel generators read
// this file, so change `package.json#exports` and `src/index.ts` only through them. It exports no public
// recipe.
export { DescriptionList } from "./components/description-list/description-list";
export type {
  DescriptionListContentProps,
  DescriptionListDetailsProps,
  DescriptionListHeadingProps,
  DescriptionListItemProps,
  DescriptionListRootProps,
  DescriptionListTermProps,
} from "./components/description-list/description-list";
