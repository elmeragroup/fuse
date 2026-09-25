/**
 * Server-visible namespace for `Tooltip`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Provider, Root, Trigger, Content } from "./index.parts";

export const Tooltip = {
  Provider,
  Root,
  Trigger,
  Content,
};

export type { TooltipContentProps, TooltipProviderProps, TooltipRootProps } from "./tooltip";
