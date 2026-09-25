/**
 * Server-visible namespace for `Field`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Label,
  Description,
  Error,
  Control,
  Item,
  Content,
  Group,
  Set,
  Legend,
  Separator,
  Title,
} from "./index.parts";

export const Field = {
  Root,
  Label,
  Description,
  Error,
  Control,
  Item,
  Content,
  Group,
  Set,
  Legend,
  Separator,
  Title,
};
