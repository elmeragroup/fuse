/**
 * Server-visible namespace for `ScrollArea`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ScrollAreaRoot, ScrollAreaBar } from "./scroll-area";

export const ScrollArea = {
  Root: ScrollAreaRoot,
  Bar: ScrollAreaBar,
};
