/**
 * Server-visible namespace for `Pagination`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Content, Item, Link, Previous, Next, Ellipsis } from "./index.parts";

export const Pagination = {
  Root,
  Content,
  Item,
  Link,
  Previous,
  Next,
  Ellipsis,
};
