"use client";

import { useRef } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it
// (phone-number-field.md §8).
import { Combobox } from "@base-ui/react";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import type { FlagAssetCode } from "../../flags";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Check } from "../../icons/generated/check";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useElmeraGroupUi } from "../../theme/elmera-group-ui";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { Field } from "../field/field";
import { InputGroup } from "../input-group/input-group";
import { overlayLayer } from "../overlay/overlay-classes";
import { textFieldVariants } from "../text-field/text-field-variants";
import { Flag } from "./flag";
import { usePhoneNumberFieldState } from "./hooks/use-phone-number-field-state";
import { phoneNumberFieldStrings } from "./intl";
import type { PhoneNumberCountry } from "./phone-engine";

const triggerFocusRing = focusRing({ target: "self" }).root();

export type PhoneNumberFieldProps = {
  /** Controlled outer value; URI-decoded on sync (may arrive from URL params). */
  value?: string;
  /** Receives the formatted output value (per `outputFormat`), not raw digits. */
  onChange?: (value: string) => void;
  /**
   * Initial country. Must be a libphonenumber country with a packaged flag asset.
   * Untyped unresolved values fall back to `NO`, then the first picker country.
   * @default "NO"
   */
  defaultCountryCode?: Extract<CountryCode, FlagAssetCode>;
  /** Custom/trimmed libphonenumber metadata. Country rows are intersected with `flagAssets`. */
  metadata?: MetadataJson;
  /**
   * Detect country from a `+`/`00` prefix while typing or pasting.
   * @default true
   */
  autoDetectCountry?: boolean;
  /**
   * Store and display the full number with prefix instead of national digits.
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
   * Forwards `disabled` to Field and the country Combobox.
   * @default false
   */
  isDisabled?: boolean;
  /**
   * Forwards `readOnly` to the country Combobox and the visible input.
   * @default false
   */
  isReadOnly?: boolean;
  /** Feeds validation and sets `aria-required` on the visible input. */
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
  container?: HTMLElement | RefObject<HTMLElement | null>;
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

/**
 * Labeled phone composite over Field + InputGroup plus direct `@base-ui/react`
 * Combobox primitives (phone-number-field.md §2/§7). Client — it owns input and
 * country state, effects, callbacks, focus restoration, and `Intl.DisplayNames`.
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
  const strings = useLocalizedStrings(phoneNumberFieldStrings);
  const resolvedSelectCountryLabel = selectCountryLabel ?? strings.format("selectCountry");
  const resolvedSearchCountriesLabel = searchCountriesLabel ?? strings.format("searchCountries");
  const resolvedNoCountriesFoundText = noCountriesFoundText ?? strings.format("noCountries");
  const { locale } = useElmeraGroupUi();
  const resolvedContainer = useThemeScopeContainer(container);

  const {
    base,
    labelContainer,
    label: labelStyles,
    container: containerStyles,
    description: descriptionStyles,
  } = textFieldVariants();

  const phone = usePhoneNumberFieldState({
    ...stateOptions,
    isRequired,
    locale,
  });

  // Base UI Input is a Field.Control; a present-but-undefined ARIA key clobbers the
  // auto-wired label/description via mergeProps (no undefined-guard). Forward only defined keys.
  const ariaProps: Record<string, string> = {};
  if (id !== undefined) {
    ariaProps.id = id;
  }
  if (ariaLabel !== undefined) {
    ariaProps["aria-label"] = ariaLabel;
  }
  if (ariaLabelledby !== undefined) {
    ariaProps["aria-labelledby"] = ariaLabelledby;
  }
  if (ariaDescribedby !== undefined) {
    ariaProps["aria-describedby"] = ariaDescribedby;
  }

  return (
    <Field.Root invalid={isInvalid} disabled={isDisabled} className={cn(base(), className)}>
      {label ? (
        <div className={labelContainer()}>
          <Field.Label className={labelStyles()}>{label}</Field.Label>
        </div>
      ) : null}
      <div className={containerStyles()}>
        <InputGroup.Root ref={inputGroupRef} aria-invalid={isInvalid || undefined}>
          <Combobox.Root
            items={phone.countries}
            value={phone.selectedCountry}
            onValueChange={(next) => {
              phone.handleCountrySelect(next?.code);
              requestAnimationFrame(() => numberInputRef.current?.focus());
            }}
            itemToStringLabel={(country) => phone.getCountryName(country.code)}
            itemToStringValue={(country) => country.code}
            isItemEqualToValue={(left, right) => left.code === right.code}
            disabled={isDisabled}
            readOnly={isReadOnly}
            autoComplete={autoComplete}
            // Detach the country Combobox from the host form so its selected
            // country code cannot collide with `${name}-display-value`.
            form="elmera-ui-phone-country-unbound"
            locale={locale}>
            <InputGroup.Addon className="text-foreground" align="inline-start">
              {/* role="button" overrides Base UI's default role="combobox" so the trigger keeps the
                  getByRole("button", {name}) contract the browser tests freeze; aria-labelledby is
                  cleared so the surrounding Field's label doesn't bleed onto it and aria-label wins.
                  Don't "simplify" either without updating the browser tests. */}
              <Combobox.Trigger
                role="button"
                aria-label={resolvedSelectCountryLabel}
                aria-labelledby={undefined}
                className={cn(
                  triggerFocusRing,
                  "rounded flex min-h-5.5 shrink-0 items-center px-1 transition-[color,background-color,scale] duration-150",
                  isDisabled || isReadOnly
                    ? "cursor-default"
                    : "cursor-pointer hover:bg-muted active:scale-[0.97] data-pressed:bg-muted"
                )}>
                <div className="flex items-center gap-1">
                  <Flag country={phone.selectedCountry.code} />
                  <span className="text-xs font-medium min-w-6 tabular-nums">
                    {phone.selectedCountry.dialCode}
                  </span>
                </div>
              </Combobox.Trigger>
            </InputGroup.Addon>
            {resolvedContainer === null ? null : (
              <Combobox.Portal container={resolvedContainer}>
                <Combobox.Positioner
                  anchor={inputGroupRef}
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className={cn("isolate", overlayLayer)}>
                  <Combobox.Popup
                    aria-label={resolvedSelectCountryLabel}
                    className="shadow-md w-(--anchor-width) max-w-72 origin-(--transform-origin) rounded-md bg-popover p-2 text-popover-foreground ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
                    <InputGroup.Root className="mb-2">
                      <InputGroup.Addon align="inline-start">
                        <MagnifyingGlass className="size-4 text-muted-foreground" />
                      </InputGroup.Addon>
                      <Combobox.Input
                        render={
                          <InputGroup.Input
                            aria-label={resolvedSearchCountriesLabel}
                            autoComplete="one-time-code"
                            name=""
                          />
                        }
                        aria-label={resolvedSearchCountriesLabel}
                        aria-autocomplete="none"
                        autoComplete="one-time-code"
                        aria-haspopup="false"
                      />
                    </InputGroup.Root>
                    <Combobox.Empty className="text-sm w-full justify-center px-2 text-center text-muted-foreground data-empty:flex">
                      {resolvedNoCountriesFoundText}
                    </Combobox.Empty>
                    <Combobox.List className="no-scrollbar max-h-[min(300px,calc(var(--available-height)-2.75rem))] scroll-py-1 overflow-y-auto overscroll-contain p-1">
                      {(country: PhoneNumberCountry) => (
                        <Combobox.Item
                          key={country.code}
                          value={country}
                          className="text-sm relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0">
                          <Combobox.ItemIndicator
                            render={
                              <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
                            }>
                            <Check className="pointer-events-none size-4" />
                          </Combobox.ItemIndicator>
                          <div className="flex items-center gap-2">
                            <Flag country={country.code} />
                            <span className="text-sm leading-tight tabular-nums">{country.dialCode}</span>
                            <span className="text-sm leading-tight max-w-32 truncate text-ellipsis">
                              {phone.getCountryName(country.code)}
                            </span>
                          </div>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            )}
          </Combobox.Root>
          <InputGroup.Input
            ref={numberInputRef}
            readOnly={isReadOnly}
            name={name ? `${name}-display-value` : "phone-number-display-value"}
            value={phone.displayValue}
            onChange={(event) => phone.handleInputChange(event.currentTarget.value)}
            onPaste={phone.handlePaste}
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
        {description ? (
          <Field.Description className={cn(descriptionStyles(), "text-pretty")}>
            {description}
          </Field.Description>
        ) : null}
      </div>
      <Field.Error>{errorMessage}</Field.Error>
      <input type="hidden" name={name} value={phone.outputValue} />
    </Field.Root>
  );
}

PhoneNumberField.displayName = "PhoneNumberField";
