/**
 * Server-visible namespace for `ButtonGroup`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ButtonGroupRoot, ButtonGroupSeparator, ButtonGroupText } from "./button-group";

export const ButtonGroup = {
  Root: ButtonGroupRoot,
  Separator: ButtonGroupSeparator,
  Text: ButtonGroupText,
};

export type { ButtonGroupRootProps, ButtonGroupSeparatorProps, ButtonGroupTextProps } from "./button-group";
