"use client";

import { useRef } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it.
// Root, Trigger, and the popup's search Input are the raw
// primitives; the popup surface itself is the library Combobox.
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import type { FlagAssetCode } from "../../flags";
import { useFormReset } from "../../hooks/use-form-reset";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { useElmeraGroupUi } from "../../theme/elmera-group-ui";
import { Combobox } from "../combobox/combobox";
import { FieldFrame, fieldFrameRootClass } from "../field/field-frame";
import { InputGroup } from "../input-group/input-group";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { Flag } from "./flag";
import { usePhoneNumberFieldState } from "./hooks/use-phone-number-field-state";
import { phoneNumberFieldStrings } from "./intl";
import type { PhoneNumberCountry } from "./phone-engine";

export type PhoneNumberFieldProps = {
  /** Authoritative controlled value; URI-decoded when received. Omit for uncontrolled editing. */
  value?: string;
  /** Proposes a formatted output value. Controlled fields display it after parent acceptance. */
  onChange?: (value: string) => void;
  /**
   * Initial country. Must be a libphonenumber country with a packaged flag asset.
   * Untyped unresolved values fall back to `NO`, then the first picker country.
   * @default "NO"
   */
  defaultCountryCode?: Extract<CountryCode, FlagAssetCode>;
  /** Custom/trimmed metadata. Replacement reconciles the picker while preserving existing international identity. */
  metadata?: MetadataJson;
  /**
   * Detect country from a `+`/`00` prefix while typing or pasting.
   * @default true
   */
  autoDetectCountry?: boolean;
  /**
   * Preserve entered digits and international prefixes in the display. Accepted national drafts stay national.
   * @default false
   */
  international?: boolean;
  /**
   * Keep digits when switching country. Default clears and emits `""`.
   * @default false
   */
  preserveOnCountryChange?: boolean;
  /**
   * Format of `onChange` and the hidden submit input.
   * @default "e164"
   */
  outputFormat?: "e164" | "international" | "national" | "raw";
  /**
   * As-you-type display formatting.
   * @default false
   */
  formatOnType?: boolean;
  /** Called when the selected picker country changes. */
  onCountryChange?: (country: { code: Extract<CountryCode, FlagAssetCode>; dialCode: string }) => void;
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
  errorMessage?: ReactNode;
  /** Placeholder for the visible number input. */
  placeholder?: string;
  /** Trailing content inside the InputGroup. */
  endContent?: ReactNode;
  /**
   * Forwards `invalid` to `Field.Root`. InputGroup gets `aria-invalid || undefined`.
   * @default false
   */
  isInvalid?: boolean;
  /**
   * Disables editing and both visible and hidden form inputs.
   * @default false
   */
  isDisabled?: boolean;
  /**
   * Blocks edits, including paste and country changes, while preserving focus and form submission.
   * @default false
   */
  isReadOnly?: boolean;
  /** Sets `aria-required` on the visible input. */
  isRequired?: boolean;
  /**
   * Hidden input gets `name`; the visible input gets `${name}-display-value`
   * (default `"phone-number-display-value"`).
   */
  name?: string;
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Explicit override for the built-in `selectCountry` dictionary key. */
  selectCountryLabel?: string;
  /** Explicit override for the built-in `searchCountries` dictionary key. */
  searchCountriesLabel?: string;
  /** Explicit override for the built-in `noCountries` dictionary key. */
  noCountriesFoundText?: string;
  /**
   * Portal target for the country picker. Defaults to the nearest enclosing
   * `ThemeScope` element.
   */
  container?: OverlayContainerProps["container"];
  /** Native `id` forwarded to the visible input when defined. */
  id?: ComponentProps<"input">["id"];
  /** Native `autoFocus` forwarded to the visible input. */
  autoFocus?: ComponentProps<"input">["autoFocus"];
  /** Native `onBlur` forwarded to the visible input. */
  onBlur?: ComponentProps<"input">["onBlur"];
  /**
   * Native `inputMode` forwarded to the visible input.
   * @default "tel"
   */
  inputMode?: ComponentProps<"input">["inputMode"];
  /** Native `enterKeyHint` forwarded to the visible input. */
  enterKeyHint?: ComponentProps<"input">["enterKeyHint"];
  /** Native `autoComplete`, also forwarded to Combobox.Root. */
  autoComplete?: ComponentProps<"input">["autoComplete"];
  /** Accessible name forwarded to the visible input when defined. */
  "aria-label"?: ComponentProps<"input">["aria-label"];
  /** Accessible name reference forwarded to the visible input when defined. */
  "aria-labelledby"?: ComponentProps<"input">["aria-labelledby"];
  /** Description reference forwarded to the visible input when defined. */
  "aria-describedby"?: ComponentProps<"input">["aria-describedby"];
};

function definedProps<T extends object>(props: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const defined = Object.fromEntries(Object.entries(props).filter((entry) => entry[1] !== undefined));
  // SAFETY: Object.entries loses key/value correlation; the filter is the omission contract.
  return defined as { [K in keyof T]?: Exclude<T[K], undefined> };
}

/**
 * Labeled phone composite over Field + InputGroup. The country popup is the library
 * `Combobox.Content/List/Item/Empty`; Root, the flag Trigger, and the popup's search
 * Input stay raw `@base-ui/react` primitives.
 * Client — it owns input and country state, effects, callbacks, focus restoration, and
 * `Intl.DisplayNames`.
 */
export function PhoneNumberField({
  label,
  description,
  errorMessage,
  placeholder,
  endContent,
  isInvalid = false,
  isDisabled = false,
  isReadOnly = false,
  isRequired,
  name,
  className,
  selectCountryLabel,
  searchCountriesLabel,
  noCountriesFoundText,
  container,
  id,
  autoFocus,
  onBlur,
  inputMode = "tel",
  enterKeyHint,
  autoComplete,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  ...stateOptions
}: PhoneNumberFieldProps): ReactElement {
  const numberInputRef = useRef<HTMLInputElement>(null);
  // Anchor the country popover to the whole field box (InputGroup), not the flag
  // trigger, so its left edge lines up with the field rather than inset to the flag.
  const inputGroupRef = useRef<HTMLDivElement>(null);
  // Combobox.Root stringifies the selected item on mount; names are only needed
  // once the popup is open (list rows + filter).
  const countryPickerOpenRef = useRef(false);
  const strings = useLocalizedStrings(phoneNumberFieldStrings);
  const resolvedSelectCountryLabel = selectCountryLabel ?? strings.format("selectCountry");
  const resolvedSearchCountriesLabel = searchCountriesLabel ?? strings.format("searchCountries");
  const resolvedNoCountriesFoundText = noCountriesFoundText ?? strings.format("noCountries");
  const { locale } = useElmeraGroupUi();

  const phone = usePhoneNumberFieldState({
    ...stateOptions,
    locale,
  });
  useFormReset(numberInputRef, phone.resetUncontrolled);

  // Base UI Input is a Field.Control; a present-but-undefined ARIA key clobbers the
  // auto-wired label/description via mergeProps (no undefined-guard). Forward only defined keys.
  const ariaProps = definedProps({
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
  });

  // Every native edit path honors both flags together.
  const isEditable = !isDisabled && !isReadOnly;

  return (
    <>
      <FieldFrame
        className={cn(fieldFrameRootClass, className)}
        invalid={isInvalid}
        disabled={isDisabled}
        label={label}
        description={description}
        errorMessage={errorMessage}>
        <InputGroup.Root ref={inputGroupRef} aria-invalid={isInvalid || undefined}>
          <ComboboxPrimitive.Root
            items={phone.countries}
            value={phone.selectedCountry}
            onValueChange={(next) => {
              if (!isEditable) return;
              phone.selectCountry(next?.code);
              requestAnimationFrame(() => numberInputRef.current?.focus());
            }}
            itemToStringLabel={(country) =>
              countryPickerOpenRef.current ? phone.getCountryName(country.code) : country.code
            }
            itemToStringValue={(country) => country.code}
            isItemEqualToValue={(left, right) => left.code === right.code}
            onOpenChange={(open) => {
              // Only latch open. Base UI still filters with itemToStringLabel through
              // the exit transition; flipping this back to false here would switch
              // labels from names to ISO codes and flash the empty state.
              if (open) {
                countryPickerOpenRef.current = true;
              }
            }}
            disabled={isDisabled}
            readOnly={isReadOnly}
            autoComplete={autoComplete}
            // Detach the country Combobox from the host form so base-ui's own hidden
            // country input never reaches FormData beside `${name}` and
            // `${name}-display-value`. The id names no rendered form on purpose
            form="elmera-ui-phone-country-unbound"
            locale={locale}>
            <InputGroup.Addon className="text-foreground" align="inline-start">
              {/* role="button" overrides Base UI's default role="combobox" so the trigger keeps the
                  getByRole("button", {name}) contract the browser tests freeze; aria-labelledby is
                  cleared so the surrounding Field's label doesn't bleed onto it and aria-label wins.
                  Don't "simplify" either without updating the browser tests. */}
              <ComboboxPrimitive.Trigger
                role="button"
                aria-label={resolvedSelectCountryLabel}
                aria-labelledby={undefined}
                className={cn(
                  selfFocusRingClass,
                  "rounded flex min-h-5.5 shrink-0 items-center px-1 transition-[color,background-color,scale] duration-150",
                  isEditable
                    ? "cursor-pointer hover:bg-muted active:scale-[0.97] data-pressed:bg-muted"
                    : "cursor-default"
                )}>
                <div className="flex items-center gap-1">
                  <Flag country={phone.selectedCountry.code} />
                  <span className="text-xs font-medium min-w-6 tabular-nums">
                    {phone.selectedCountry.dialCode}
                  </span>
                </div>
              </ComboboxPrimitive.Trigger>
            </InputGroup.Addon>
            <Combobox.Content
              anchor={inputGroupRef}
              container={container}
              aria-label={resolvedSelectCountryLabel}>
              <InputGroup.Root>
                <InputGroup.Addon align="inline-start">
                  <MagnifyingGlass className="size-4 text-muted-foreground" />
                </InputGroup.Addon>
                <ComboboxPrimitive.Input
                  render={
                    <InputGroup.Input
                      aria-label={resolvedSearchCountriesLabel}
                      autoComplete="one-time-code"
                      // An empty name keeps the search box out of autofill heuristics and
                      // out of any FormData: a nameless control is never submitted
                      name=""
                    />
                  }
                  aria-label={resolvedSearchCountriesLabel}
                  aria-autocomplete="none"
                  autoComplete="one-time-code"
                  aria-haspopup="false"
                />
              </InputGroup.Root>
              <Combobox.Empty>{resolvedNoCountriesFoundText}</Combobox.Empty>
              <Combobox.List>
                {(country: PhoneNumberCountry) => (
                  <Combobox.Item key={country.code} value={country}>
                    <Flag country={country.code} />
                    <span className="text-sm leading-tight tabular-nums">{country.dialCode}</span>
                    <span className="text-sm leading-tight max-w-32 truncate text-ellipsis">
                      {phone.getCountryName(country.code)}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Content>
          </ComboboxPrimitive.Root>
          <InputGroup.Input
            ref={numberInputRef}
            readOnly={isReadOnly}
            name={name ? `${name}-display-value` : "phone-number-display-value"}
            value={phone.displayValue}
            onChange={(event) => {
              if (isEditable) phone.handleInputChange(event.currentTarget.value);
            }}
            onPaste={(event) => {
              if (isEditable) phone.handlePaste(event);
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            inputMode={inputMode}
            enterKeyHint={enterKeyHint}
            autoComplete={autoComplete}
            aria-required={isRequired ? true : undefined}
            className="shrink tabular-nums"
            {...ariaProps}
          />
          {endContent}
        </InputGroup.Root>
      </FieldFrame>
      <input type="hidden" name={name} value={phone.outputValue} disabled={isDisabled} />
    </>
  );
}

PhoneNumberField.displayName = "PhoneNumberField";
