/**
 * Server-visible namespace for `Select`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Trigger,
  Value,
  Content,
  Item,
  Group,
  Label,
  Separator,
  ScrollUpButton,
  ScrollDownButton,
} from "./index.parts";

export const Select = {
  Root,
  Trigger,
  Value,
  Content,
  Item,
  Group,
  Label,
  Separator,
  ScrollUpButton,
  ScrollDownButton,
};

export type { SelectContentProps, SelectTriggerProps } from "./select";
