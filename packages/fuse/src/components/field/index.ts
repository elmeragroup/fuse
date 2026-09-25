/**
 * Server-visible namespace for `Field`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  FieldRoot,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldControl,
  FieldItem,
  FieldContent,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldSeparator,
  FieldTitle,
} from "./field";

export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Description: FieldDescription,
  Error: FieldError,
  Control: FieldControl,
  Item: FieldItem,
  Content: FieldContent,
  Group: FieldGroup,
  Set: FieldSet,
  Legend: FieldLegend,
  Separator: FieldSeparator,
  Title: FieldTitle,
};
