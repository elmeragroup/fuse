"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it.
// Root, Trigger, and the popup's search Input are the raw
// primitives; the popup surface itself is the library Combobox.
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useFormContext } from "@base-ui/react/internals/form-context";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";
import { flushSync } from "react-dom";

import type { FlagAssetCode } from "../../flags";
import { useFormReset } from "../../hooks/use-form-reset";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { selfFocusRingClass } from "../../styles/utils";
import { ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList } from "../combobox/combobox";
import { FieldFrame, fieldFrameRootClass } from "../field/field-frame";
import {
  InputGroupAddon,
  InputGroupInput,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { countryNameResolver, sortByCountryName } from "./country-names";
import { Flag } from "./flag";
import { usePhoneNumberFieldState } from "./hooks/use-phone-number-field-state";
import { phoneNumberFieldStrings } from "./intl";
import type { PhoneNumberCountry } from "./phone-engine";
import { CountryPickerScope, SubmittedValueControl } from "./phone-field-context";

export type PhoneNumberFieldProps = {
  /** Authoritative controlled value; URI-decoded when received. Omit for uncontrolled editing. */
  value?: string;
  /**
   * Initial number of an uncontrolled field, read on mount as `value` is. A native form reset
   * restores it, read again under the current props, and calls `onCountryChange` when that
   * changes the country; `""` restores an empty number in `defaultCountryCode`. Without a
   * `defaultValue`, a reset clears the digits and keeps the country. A later change leaves the
   * shown number alone and becomes the next reset's target. Ignored while `value` is set, even
   * to `""`.
   */
  defaultValue?: string;
  /**
   * Proposes a formatted output value. Controlled fields display it after parent acceptance.
   * Also called once as hydration commits, with a number typed or autofilled before the client
   * scripts attached; a controlled parent accepts or rejects it like any other proposal.
   */
  onChange?: (value: string) => void;
  /**
   * Initial country. Must be a libphonenumber country with a packaged flag asset. A code the
   * picker does not offer (outside `countries`, excluded, or untyped) falls back to `NO` when
   * offered, else the first offered country in catalog order.
   * @default "NO"
   */
  defaultCountryCode?: Extract<CountryCode, FlagAssetCode>;
  /**
   * Custom/trimmed metadata. Replacement reconciles the picker while preserving existing
   * international identity. To limit the picker, pass `countries` instead: trimmed metadata can
   * no longer parse the numbers it leaves out.
   */
  metadata?: MetadataJson;
  /**
   * The countries the picker offers, as ISO codes. The metadata still parses every number:
   * detection only selects a listed country, so a number from another one stays in
   * international form beside the selected country, as with trimmed metadata. With one
   * country the field shows its flag and dial code as plain context instead of a picker.
   * Codes outside the catalog, without a packaged flag or in the product exclusions are
   * ignored, and a list that leaves no country throws. A change that drops the selected
   * country keeps the shown number's international identity, except a controlled `raw` value,
   * which names no country and reads again in the one that remains. The rows sort by name
   * whatever the list's order.
   * @default every country in the catalog
   */
  countries?: readonly Extract<CountryCode, FlagAssetCode>[];
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
   * As-you-type display formatting. A national entry keeps the trunk prefix it was typed with,
   * so a Swedish "0701234567" shows "070-123 45 67", and one typed without it stays ungrouped.
   * A number detected from a `+` or `00` prefix shows in the national format.
   * @default false
   */
  formatOnType?: boolean;
  /** Called when the selected picker country changes. */
  onCountryChange?: (country: { code: Extract<CountryCode, FlagAssetCode>; dialCode: string }) => void;
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows a `Form` error under `name`, or the visible input's own constraint message.
   */
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
   * The field takes the muted read-only fill.
   * @default false
   */
  isReadOnly?: boolean;
  /** Forwards `required` to the visible input, so native constraint validation blocks an empty submit. */
  isRequired?: boolean;
  /**
   * Hidden input gets `name`; the visible input gets `${name}-display-value`.
   * Unset, neither input submits. Inside a `Form`, the field shows `errors[name]`, clears it
   * when the number it submits changes, and gives `onFormSubmit` that number under `name`, in
   * `outputFormat`.
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
  /**
   * Marks the number input required for assistive technology only, forwarded when defined.
   * It doesn't validate: an empty field still submits. Use `isRequired` for the native
   * constraint, and this for a rule a schema can relax.
   */
  "aria-required"?: ComponentProps<"input">["aria-required"];
};

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
  "aria-required": ariaRequired,
  ...stateOptions
}: PhoneNumberFieldProps): ReactElement {
  const numberInputRef = useRef<HTMLInputElement>(null);
  // Anchor the country popover to the whole field box (InputGroup), not the flag
  // trigger, so its left edge lines up with the field rather than inset to the flag.
  const inputGroupRef = useRef<HTMLDivElement>(null);
  // Combobox.Root stringifies the selected item on mount; names are only needed
  // once the popup is open (list rows + filter).
  const countryPickerOpenRef = useRef(false);
  // The locale whose name order the picker rows follow, taken as the picker opens; null until
  // the first open. A locale change shows in the order at the next open, so it cannot move
  // the highlight of an open picker onto another country.
  const [rowOrderLocale, setRowOrderLocale] = useState<string | null>(null);
  const strings = useLocalizedStrings(phoneNumberFieldStrings);
  const resolvedSelectCountryLabel = selectCountryLabel ?? strings.format("selectCountry");
  const resolvedSearchCountriesLabel = searchCountriesLabel ?? strings.format("searchCountries");
  const resolvedNoCountriesFoundText = noCountriesFoundText ?? strings.format("noCountries");
  const { locale } = useLocale();

  const phone = usePhoneNumberFieldState({
    ...stateOptions,
    inputRef: numberInputRef,
  });
  useFormReset(numberInputRef, phone.onReset);
  const getCountryName = useMemo(() => countryNameResolver(locale), [locale]);

  // A Form reads the submitted number at submit time, after the commit that last changed it.
  const submittedValueRef = useRef(phone.outputValue);
  useLayoutEffect(() => {
    submittedValueRef.current = phone.outputValue;
  });
  const getSubmittedValue = useCallback(() => submittedValueRef.current, []);
  // A Form error under `name` clears when the number the field submits changes: an edit, a
  // country that changes it, or a reset. Searching the picker changes nothing it submits.
  // A layout effect, so it runs before the Form's own: errors the parent passes in the same
  // commit as a new value, such as a server's verdict on it, stay.
  const { clearErrors } = useFormContext();
  const clearedValueRef = useRef(phone.outputValue);
  useLayoutEffect(() => {
    if (clearedValueRef.current === phone.outputValue) return;
    clearedValueRef.current = phone.outputValue;
    if (name) clearErrors(name);
  }, [phone.outputValue, name, clearErrors]);

  // Metadata order resolves no name, so it holds until the first open. The hook keeps that
  // order for its own lookups; only the rows the picker shows are sorted.
  const pickerCountries = useMemo(
    () => (rowOrderLocale === null ? phone.countries : sortByCountryName(phone.countries, rowOrderLocale)),
    [rowOrderLocale, phone.countries]
  );

  // Input drops the undefined keys, so they cannot erase its Field id, label or description.
  const ariaProps = {
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    "aria-required": ariaRequired,
  };

  // Every native edit path honors both flags together.
  const isEditable = !isDisabled && !isReadOnly;

  // A number typed (or autofilled) before hydration survives hydration in the DOM, but the
  // hook starts from its own initial value, and the first re-render, which Base UI's Field
  // registration triggers in this same commit, would write that value over it. Read it once,
  // before then, and propose it as an edit: a controlled parent can accept it like any other.
  // On a client mount, or a hydration without an early edit, the two values are equal.
  const hydrationCheckedRef = useRef(false);
  useLayoutEffect(() => {
    if (hydrationCheckedRef.current) return;
    hydrationCheckedRef.current = true;
    const input = numberInputRef.current;
    if (input && isEditable && input.value !== phone.displayValue) {
      phone.edit({
        value: input.value,
        selectionStart: null,
        selectionEnd: null,
        selectionDirection: null,
        inputType: null,
      });
    }
  });

  // The flag and dial code: the picker trigger's face, or the plain context of one country.
  const countryFace = (
    <div className="flex items-center gap-1">
      <Flag country={phone.country.code} />
      {/* The input's font size, touch floor included, so both runs of digits have one size.
          Leading is `normal` because a text input centres its text on the font's normal
          metrics whatever its line-height; the dial code centres the same way. */}
      <span className={cn(controlMd.entryType(), "font-medium min-w-6 leading-[normal] tabular-nums")}>
        {phone.country.dialCode}
      </span>
    </div>
  );

  return (
    <>
      <FieldFrame
        className={cn(fieldFrameRootClass, className)}
        name={name}
        invalid={isInvalid}
        disabled={isDisabled}
        label={label}
        description={description}
        errorMessage={errorMessage}>
        <InputGroupRoot ref={inputGroupRef} aria-invalid={isInvalid || undefined}>
          {phone.countries.length === 1 ? (
            <InputGroupAddon className="text-foreground" align="inline-start">
              {/* One country leaves nothing to pick, so its flag and dial code are context: no
                  trigger, popup or tab stop, and a click focuses the number input, as on any
                  addon. The name tells assistive technology which country the code belongs to. */}
              {/* The addon keeps its block padding and inline inset for a non-button child, so
                  only a trailing gap here puts the flag where the trigger's sits. The server's
                  Intl data can name a country differently from the browser's (Hong Kong), so the
                  name may keep the server's text through hydration. */}
              <div className="flex shrink-0 items-center pr-1">
                <span className="sr-only" suppressHydrationWarning>
                  {getCountryName(phone.country.code)}
                </span>
                {countryFace}
              </div>
            </InputGroupAddon>
          ) : (
            <CountryPickerScope>
              <ComboboxPrimitive.Root
                items={pickerCountries}
                value={phone.country}
                onValueChange={(next) => {
                  if (!isEditable) return;
                  phone.selectCountry(next?.code);
                  requestAnimationFrame(() => numberInputRef.current?.focus());
                }}
                itemToStringLabel={(country) =>
                  countryPickerOpenRef.current ? getCountryName(country.code) : country.code
                }
                itemToStringValue={(country) => country.code}
                isItemEqualToValue={(left, right) => left.code === right.code}
                onOpenChange={(open) => {
                  // Only latch open. Base UI still filters with itemToStringLabel through
                  // the exit transition; flipping this back to false here would switch
                  // labels from names to ISO codes and flash the empty state.
                  if (open) {
                    // Base UI calls this before it commits `open`, and finds the selected row's
                    // index only while the popup is closed. The sorted rows commit first, in their
                    // own render, so the popup opens highlighting the selected country rather than
                    // whichever took its old index. On the first open the labels switch to names
                    // only after that render: switching them in it too loses the highlight.
                    if (rowOrderLocale !== locale) {
                      flushSync(() => setRowOrderLocale(locale));
                    }
                    countryPickerOpenRef.current = true;
                  }
                }}
                disabled={isDisabled}
                readOnly={isReadOnly}
                autoComplete={autoComplete}
                // Detach the country Combobox from the host form so base-ui's own hidden
                // country input never reaches FormData beside `${name}` and
                // `${name}-display-value`. The id names no rendered form on purpose
                form="fuse-phone-country-unbound"
                locale={locale}>
                <InputGroupAddon className="text-foreground" align="inline-start">
                  {/* role="button" overrides Base UI's default role="combobox" so the trigger keeps the
                        getByRole("button", {name}) contract the browser tests freeze. The picker's own labelable
                        scope already keeps the field's label off it; the empty aria-labelledby is a safeguard
                        that keeps aria-label the name.
                        Don't "simplify" either without updating the browser tests.
                        The min height is 1.5rem, floored at the fixed 24px target for a host root below 16px.
                        The trigger renders a <button>, so the inline addon drops its block padding and the
                        trigger fits the field's fixed md box at both densities. */}
                  <ComboboxPrimitive.Trigger
                    role="button"
                    aria-label={resolvedSelectCountryLabel}
                    aria-labelledby=""
                    className={cn(
                      selfFocusRingClass,
                      // No UA button border or fill in a preflight-free host.
                      "flex min-h-[max(1.5rem,24px)] shrink-0 items-center rounded-inner border-0 bg-transparent px-1 transition-[color,background-color,scale] duration-150",
                      isEditable
                        ? "cursor-pointer hover:bg-muted active:scale-[0.97] data-pressed:bg-muted"
                        : "cursor-default"
                    )}>
                    {countryFace}
                  </ComboboxPrimitive.Trigger>
                </InputGroupAddon>
                <ComboboxContent
                  anchor={inputGroupRef}
                  container={container}
                  aria-label={resolvedSelectCountryLabel}>
                  <InputGroupRoot>
                    <InputGroupAddon align="inline-start">
                      <MagnifyingGlass className="size-4 text-muted-foreground" />
                    </InputGroupAddon>
                    {/* A plain input: as a Field control it would register its id with the
                        picker's labelable scope, which the trigger takes its id from. */}
                    <ComboboxPrimitive.Input
                      render={<InputGroupPlainInput />}
                      aria-label={resolvedSearchCountriesLabel}
                      // The picker's own labelable scope keeps the field's label off this input;
                      // the empty list is a safeguard that keeps dictionary `searchCountries`
                      // the name.
                      aria-labelledby=""
                      autoComplete="one-time-code"
                      // An empty name keeps the search box out of autofill heuristics and
                      // out of any FormData: a nameless control is never submitted
                      name=""
                      aria-autocomplete="none"
                      aria-haspopup="false"
                    />
                  </InputGroupRoot>
                  <ComboboxEmpty>{resolvedNoCountriesFoundText}</ComboboxEmpty>
                  <ComboboxList>
                    {(country: PhoneNumberCountry) => (
                      <ComboboxItem key={country.code} value={country}>
                        <Flag country={country.code} />
                        <span className="text-sm leading-tight tabular-nums">{country.dialCode}</span>
                        <span className="text-sm leading-tight max-w-32 truncate text-ellipsis">
                          {getCountryName(country.code)}
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxPrimitive.Root>
            </CountryPickerScope>
          )}
          <SubmittedValueControl getSubmittedValue={getSubmittedValue}>
            <InputGroupInput
              ref={numberInputRef}
              readOnly={isReadOnly}
              name={name ? `${name}-display-value` : undefined}
              value={phone.displayValue}
              onChange={(event) => {
                if (!isEditable) return;
                const { value, selectionStart, selectionEnd, selectionDirection } = event.currentTarget;
                const { nativeEvent } = event;
                phone.edit({
                  value,
                  selectionStart,
                  selectionEnd,
                  selectionDirection,
                  inputType: nativeEvent instanceof InputEvent ? nativeEvent.inputType : null,
                });
              }}
              onPaste={(event) => {
                if (!isEditable) return;
                event.preventDefault();
                phone.paste(event.clipboardData.getData("text"));
              }}
              onBlur={onBlur}
              placeholder={placeholder}
              autoFocus={autoFocus}
              inputMode={inputMode}
              enterKeyHint={enterKeyHint}
              autoComplete={autoComplete}
              required={isRequired}
              className="shrink tabular-nums"
              {...ariaProps}
            />
          </SubmittedValueControl>
          {endContent}
        </InputGroupRoot>
      </FieldFrame>
      <input type="hidden" name={name} value={phone.outputValue} disabled={isDisabled} />
    </>
  );
}

PhoneNumberField.displayName = "PhoneNumberField";
