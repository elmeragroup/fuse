/**
 * Server-visible namespace for `ButtonGroup`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Separator, Text } from "./index.parts";

export const ButtonGroup = {
  Root,
  Separator,
  Text,
};

export type { ButtonGroupRootProps, ButtonGroupSeparatorProps, ButtonGroupTextProps } from "./button-group";
