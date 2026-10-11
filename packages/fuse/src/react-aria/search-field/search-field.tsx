"use client";

import type { ReactElement, ReactNode, RefAttributes } from "react";

import { SearchField as AriaSearchField } from "react-aria-components";
import type { SearchFieldProps as AriaSearchFieldProps, ValidationResult } from "react-aria-components";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { X } from "../../icons/generated/x";
import { searchFieldVariants } from "../../styles/search-field";
import { Button } from "../internal/button";
import { composeTailwindRenderProps } from "../internal/compose-tailwind-render-props";
import { Description, FieldError, FieldGroup, Input, Label } from "../internal/field";
import { FormErrors, useClearFormErrors } from "../internal/form-errors";
import { searchFieldStrings } from "./intl";

/**
 * Labeled search field composite over RAC `SearchField`.
 * Client — the interim react-aria cluster owns value, clear and submit.
 *
 * `ref` is taken off the RAC root and forwarded to the inner `<input>`.
 * RAC still wires `type="search"` / `role="searchbox"`
 * through the slotted Input.
 */
export type SearchFieldProps = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the field is invalid. Accepts a
   * node or a validation render function. Without it or `isInvalid`, the field shows a `Form` error under
   * its `name`, which clears when the value changes.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /** Placeholder forwarded to the inner `Input`. */
  placeholder?: string;
  /**
   * Accessible name for the clear button. Defaults to the `searchField.clear`
   * row of the locale dictionary; an explicit string wins.
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
  onChange,
  ref,
  ...props
}: SearchFieldProps & RefAttributes<HTMLInputElement>): ReactElement {
  const strings = useLocalizedStrings(searchFieldStrings);
  const { base, button, buttonIcon, group, icon, input } = searchFieldVariants();
  const names = [props.name] as const;
  const clearingOnChange = useClearFormErrors(names, onChange);

  return (
    <FormErrors names={names}>
      <AriaSearchField
        {...props}
        onChange={clearingOnChange}
        className={composeTailwindRenderProps(className, base())}>
        {label ? <Label>{label}</Label> : null}
        <FieldGroup isReadOnly={props.isReadOnly} className={group()}>
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
        <FieldError>{errorMessage}</FieldError>
        {description ? <Description slot="description">{description}</Description> : null}
      </AriaSearchField>
    </FormErrors>
  );
}

SearchField.displayName = "SearchField";
