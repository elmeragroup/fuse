/**
 * Server-visible namespace for `Accordion`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Item, Header, Trigger, Content } from "./index.parts";

export const Accordion = {
  Root,
  Item,
  Header,
  Trigger,
  Content,
};
