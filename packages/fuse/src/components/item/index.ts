/**
 * Server-visible namespace for `Item`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ItemRoot, ItemGroup, ItemSeparator } from "./item";
import {
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
} from "./item-markup";

export const Item = {
  Root: ItemRoot,
  Media: ItemMedia,
  Content: ItemContent,
  Actions: ItemActions,
  Group: ItemGroup,
  Separator: ItemSeparator,
  Title: ItemTitle,
  Description: ItemDescription,
  Header: ItemHeader,
  Footer: ItemFooter,
};
