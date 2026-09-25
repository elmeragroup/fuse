/**
 * Server-visible namespace for `Dialog`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
} from "./index.parts";

export const Dialog = {
  Root,
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
};

export type { DialogContentProps, DialogFooterProps, DialogTitleProps } from "./dialog";
