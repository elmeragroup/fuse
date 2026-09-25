/**
 * Server-visible namespace for `Popover`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Trigger, Content, Header, Title, Description } from "./index.parts";

export const Popover = {
  Root,
  Trigger,
  Content,
  Header,
  Title,
  Description,
};

export type { PopoverContentProps } from "./popover";
