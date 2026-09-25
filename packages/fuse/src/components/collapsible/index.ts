/**
 * Server-visible namespace for `Collapsible`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from "./collapsible";

export const Collapsible = {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
};
