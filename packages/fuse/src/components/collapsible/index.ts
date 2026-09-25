/**
 * Server-visible namespace for `Collapsible`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Trigger, Content } from "./index.parts";

export const Collapsible = {
  Root,
  Trigger,
  Content,
};
