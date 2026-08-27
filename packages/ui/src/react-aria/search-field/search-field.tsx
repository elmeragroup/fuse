"use client";

import type { ReactElement, ReactNode, RefAttributes } from "react";

import { SearchField as AriaSearchField } from "react-aria-components";
import type { SearchFieldProps as AriaSearchFieldProps, ValidationResult } from "react-aria-components";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { X } from "../../icons/generated/x";
import { searchFieldVariants } from "../../styles/search-field";
import { Button } from "../internal/button";
import { Description, FieldError, FieldGroup, Input, Label } from "../internal/field";
import { composeTailwindRenderProps } from "../internal/utils";
import { searchFieldStrings } from "./intl";

/**
 * Labeled search field composite over RAC `SearchField` (search-field.md §2/§3).
 * Client — the interim react-aria cluster owns value, clear and submit.
 *
 * `ref` is taken off the RAC root and forwarded to the inner `<input>`
 * (search-field.md §3). RAC still wires `type="search"` / `role="searchbox"`
 * through the slotted Input.
 */
export type SearchFieldProps = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the field is invalid. Accepts a
   * node or a validation render function.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /** Placeholder forwarded to the inner `Input`. */
  placeholder?: string;
  /**
   * Accessible name for the clear button. Defaults to the `searchField.clear`
   * row of the locale dictionary (accessibility.md §4.1); an explicit string wins.
   */
  clearLabel?: string;
} & AriaSearchFieldProps;

export function SearchField({
  label,
  description,
  errorMessage,
  placeholder,
  clearLabel,
  className,
  ref,
  ...props
}: SearchFieldProps & RefAttributes<HTMLInputElement>): ReactElement {
  const strings = useLocalizedStrings(searchFieldStrings);
  const { base, button, buttonIcon, icon, input } = searchFieldVariants();

  return (
    <AriaSearchField {...props} className={composeTailwindRenderProps(className, base())}>
      {label ? <Label>{label}</Label> : null}
      <FieldGroup>
        <MagnifyingGlass aria-hidden className={icon()} />
        <Input className={input()} placeholder={placeholder} ref={ref} />
        <Button
          variant="ghost"
          size="icon"
          className={button()}
          aria-label={clearLabel ?? strings.format("clear")}>
          <X aria-hidden className={buttonIcon()} />
        </Button>
      </FieldGroup>
      {description ? <Description slot="description">{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaSearchField>
  );
}

SearchField.displayName = "SearchField";
