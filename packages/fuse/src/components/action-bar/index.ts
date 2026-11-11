/**
 * Server-visible namespace for `ActionBar`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  ActionBarRoot,
  ActionBarCount,
  ActionBarClear,
  ActionBarButton,
  ActionBarButtonLabel,
  ActionBarSeparator,
} from "./action-bar";

export const ActionBar = {
  Root: ActionBarRoot,
  Count: ActionBarCount,
  Clear: ActionBarClear,
  Button: ActionBarButton,
  ButtonLabel: ActionBarButtonLabel,
  Separator: ActionBarSeparator,
};
