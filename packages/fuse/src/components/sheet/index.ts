/**
 * Server-visible namespace for `Sheet`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Trigger,
  Close,
  Portal,
  Overlay,
  Content,
  Header,
  Body,
  Footer,
  Title,
  Description,
} from "./index.parts";

export const Sheet = {
  Root,
  Trigger,
  Close,
  Portal,
  Overlay,
  Content,
  Header,
  Body,
  Footer,
  Title,
  Description,
};

export type { SheetContentProps, SheetRootProps } from "./sheet";
