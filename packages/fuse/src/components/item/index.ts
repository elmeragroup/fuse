/**
 * Server-visible namespace for `Item`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Media,
  Content,
  Actions,
  Group,
  Separator,
  Title,
  Description,
  Header,
  Footer,
} from "./index.parts";

export const Item = {
  Root,
  Media,
  Content,
  Actions,
  Group,
  Separator,
  Title,
  Description,
  Header,
  Footer,
};
