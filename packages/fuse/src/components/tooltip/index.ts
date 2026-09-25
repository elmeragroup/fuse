/**
 * Server-visible namespace for `Tooltip`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from "./tooltip";

export const Tooltip = {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
};
