"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it.
// Root, Trigger, and the popup's search Input are the raw
// primitives; the popup surface itself is the library Combobox.
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useFormContext } from "@base-ui/react/internals/form-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";
import { flushSync } from "react-dom";

import type { FlagAssetCode } from "../../flags";
import { useEarlyInputValue } from "../../hooks/use-early-input-value";
import { useFormReset } from "../../hooks/use-form-reset";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { fieldReads } from "../../styles/field-size";
import { selfFocusRingClass } from "../../styles/utils";
import { ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList } from "../combobox/combobox";
import { FieldFrame } from "../field/field-frame";
import {
  InputGroupAddon,
  InputGroupInput,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
import type { InputGroupRootProps } from "../input-group/input-group";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { countryNameResolver, sortByCountryName } from "./country-names";
import { Flag } from "./flag";
import { usePhoneNumberFieldState } from "./hooks/use-phone-number-field-state";
import { phoneNumberFieldStrings } from "./intl";
import type { PhoneNumberCountry } from "./phone-engine";
import { CountryPickerScope, SubmittedValueControl } from "./phone-field-context";

/** The props of {@link PhoneNumberField}. */
export type PhoneNumberFieldProps = {
  /**
   * The number, for a controlled field. The field decodes it as a URI component when it arrives.
   * Leave it out for an uncontrolled field.
   */
  value?: string;
  /**
   * The starting number of an uncontrolled field, read on mount as `value` is. A native form reset
   * restores it, reads it again under the current props, and calls `onCountryChange` when that
   * changes the country. `""` restores an empty number in `defaultCountryCode`. Without a
   * `defaultValue`, a reset clears the digits and keeps the country. A later change leaves the
   * shown number alone and becomes the next reset's target. The field ignores it while `value` is
   * set, even to `""`.
   */
  defaultValue?: string;
  /**
   * Proposes a number in `outputFormat`. A controlled field shows it once the parent accepts it.
   * The field calls it only when the proposal differs from the number the parent holds: `value`,
   * compared exactly, or the output an uncontrolled field already shows. So deleting a separator,
   * which keeps the number, calls nothing, while a parent that stores another form of the number,
   * such as national digits, hears every proposal. It is also called once as hydration commits,
   * with a number typed or autofilled before the client scripts ran, under the same rule. A
   * controlled parent accepts or rejects it like any other proposal.
   */
  onChange?: (value: string) => void;
  /**
   * The starting country. It must be a libphonenumber country with a packaged flag. A code the
   * picker does not offer, because it is outside `countries`, excluded or untyped, falls back to
   * `NO` when the picker offers it, else to the first offered country in catalog order. The field
   * ignores it while `countryCode` is set.
   */
  defaultCountryCode?: Extract<CountryCode, FlagAssetCode>;
  /**
   * The country, for a controlled country. Pass it with `onCountryChange`, in place of
   * `defaultCountryCode`. Leave it out for an uncontrolled country.
   *
   * The field shows the country a controlled `value` names with its own `+` or `00` prefix while
   * `autoDetectCountry` is on, else the country of a proposal the parent holds, else
   * `countryCode`. It reads a value without a prefix, or an uncontrolled `defaultValue`, in
   * `countryCode`.
   *
   * A new `countryCode`, or a `countries` or `metadata` change that resolves it to another country,
   * acts like a pick. It clears the digits unless `preserveOnCountryChange` keeps them, and
   * proposes the result through `onChange`. A change that leaves the country in place keeps the
   * number.
   *
   * A pick, or a country detected while typing or pasting, is a proposal. The field shows it once
   * the parent sets `countryCode` to it, and a parent that keeps its code returns the field to it.
   * An uncontrolled number reports a pick's number only once the field shows it, so a rejected pick
   * reports nothing. Each proposal reaches `onChange` once, whatever order the parent answers in.
   *
   * A proposal the parent has not answered yet keeps waiting through a render with the same props,
   * and through a change to `defaultValue`, `defaultCountryCode` or `preserveOnCountryChange`
   * alone. It also waits through a change to `outputFormat`, `international`, `formatOnType`,
   * `autoDetectCountry`, `metadata` or `countries` that keeps `value` and `countryCode`, while
   * `countries` still offers the proposal's country. An answer to one half of it keeps it waiting
   * for the other, in either order: `countryCode` set to its country, or a `value` that is its
   * number in a countryless form of the parent's own, such as national digits. A code that only
   * falls back to the proposal's country is no answer. A proposal answered in full ends, as does
   * one whose number the parent holds while the value names another country. Any other change
   * drops it.
   *
   * A code the picker does not offer resolves as `defaultCountryCode` does. Removing `countryCode`
   * keeps the country and number the field shows.
   */
  countryCode?: Extract<CountryCode, FlagAssetCode>;
  /**
   * Your own or trimmed libphonenumber metadata. A new metadata object updates the picker and keeps
   * the international identity of the number shown. A shallow copy, such as `{ ...metadata }`
   * written in a render, is the same metadata and replaces nothing. To limit the picker, pass
   * `countries` instead, since trimmed metadata can no longer parse the numbers it leaves out. It
   * does not make the bundle smaller, since the field imports its full default metadata either way.
   */
  metadata?: MetadataJson;
  /**
   * The countries the picker offers, as ISO codes. Every country by default. The metadata still
   * parses every number. Detection only selects a listed country, so a number from another one
   * stays in international form beside the selected country, as with trimmed metadata. With one
   * country, the field shows its flag and dial code as plain text instead of a picker. The field
   * ignores codes outside the catalog, without a packaged flag or in the product exclusions, and
   * a list that leaves no country throws. A change that drops the selected country keeps the shown
   * number's international identity, except a controlled `raw` value, which names no country and
   * is read again in the country that remains. The rows sort by name whatever the list's order.
   */
  countries?: readonly Extract<CountryCode, FlagAssetCode>[];
  /**
   * Picks the country from a `+` or `00` prefix as the user types or pastes. Pass `false` to keep
   * the selected country.
   */
  autoDetectCountry?: boolean;
  /**
   * Keeps the typed digits and international prefixes in the display. An accepted national draft
   * stays national.
   */
  international?: boolean;
  /**
   * Keeps the digits when the country changes. Otherwise a country change clears them, and calls
   * `onChange` with `""` unless the parent already holds `""`.
   */
  preserveOnCountryChange?: boolean;
  /** The format `onChange` reports and the hidden input submits. */
  outputFormat?: "e164" | "international" | "national" | "raw";
  /**
   * Formats the display as the user types. A national entry keeps the trunk prefix it was typed
   * with, so a Swedish "0701234567" shows "070-123 45 67", and one typed without it stays
   * ungrouped. A number detected from a `+` or `00` prefix shows in the national format.
   */
  formatOnType?: boolean;
  /**
   * Called when the selected country changes. With `countryCode` set, it is called instead once as
   * each disagreement starts, with the country of a proposal waiting for the parent, else the one
   * shown, when it differs from `countryCode`. It never hears the code the parent just set. A
   * proposal that moves the country calls it before `onChange`, so a parent that takes both at
   * once reads the number in the new country.
   */
  onCountryChange?: (country: { code: Extract<CountryCode, FlagAssetCode>; dialCode: string }) => void;
  /** The visible label, rendered as `Field.Label`. Without it, name the field with `aria-label`. */
  label?: string;
  /** Supporting text, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` while it is truthy. Pass `isInvalid` with it, so
   * the field is marked invalid too. Without it, the field shows a `Form` error under `name`, or
   * the number input's constraint message.
   */
  errorMessage?: ReactNode;
  /** The number input's placeholder text. */
  placeholder?: string;
  /** Content at the end of the field box, such as a button that acts on the number. */
  endContent?: ReactNode;
  /** Marks the field invalid, with the invalid look on the field box. */
  isInvalid?: boolean;
  /** Disables editing, the country picker, and both the visible and the hidden input. */
  isDisabled?: boolean;
  /**
   * Blocks edits, paste and country changes. The field stays focusable and still submits, with
   * the muted read-only fill.
   */
  isReadOnly?: boolean;
  /** Makes the number input required, so the browser's constraint check blocks an empty submit. */
  isRequired?: boolean;
  /**
   * The name the number submits under, from a hidden input. The visible input takes
   * `${name}-display-value`. Without it, neither input submits. Inside a `Form`, the field shows
   * the form's error under this name, removes it when the submitted number changes, and gives
   * `onFormSubmit` the number under this name, in `outputFormat`.
   */
  name?: string;
  /**
   * The control size of the field box around the country picker and the number, also written as
   * `data-size`. `default` is the md control size, and `sm` the sm one. The search box in the
   * country popup keeps the default size.
   */
  size?: InputGroupRootProps["size"];
  /** Extra classes for the field's root. */
  className?: string;
  /**
   * Replaces the `selectCountry` text of the locale dictionary: the country popup's name and the
   * country button's description. The button's name is its visible dial code and the selected
   * country, such as "+47 Norway".
   */
  selectCountryLabel?: string;
  /** Replaces the `searchCountries` text of the locale dictionary, the country search box's name. */
  searchCountriesLabel?: string;
  /** Replaces the `noCountries` text of the locale dictionary, shown when no country matches. */
  noCountriesFoundText?: string;
  /** Where the country popup renders. It defaults to the nearest `ThemeScope` element. */
  container?: OverlayContainerProps["container"];
  /** The number input's `id`. */
  id?: ComponentProps<"input">["id"];
  /** Focuses the number input when the field mounts. */
  autoFocus?: ComponentProps<"input">["autoFocus"];
  /** Called when the number input loses focus. */
  onBlur?: ComponentProps<"input">["onBlur"];
  /** The number input's `inputMode`, which picks the on-screen keyboard. */
  inputMode?: ComponentProps<"input">["inputMode"];
  /** The number input's `enterKeyHint`. */
  enterKeyHint?: ComponentProps<"input">["enterKeyHint"];
  /** The number input's `autoComplete`, also passed to the country picker. */
  autoComplete?: ComponentProps<"input">["autoComplete"];
  /** The number input's name when there is no `label`. It names the field box too. */
  "aria-label"?: ComponentProps<"input">["aria-label"];
  /** The ids of the elements that name the number input, in place of `label`. */
  "aria-labelledby"?: ComponentProps<"input">["aria-labelledby"];
  /** The ids of the elements that describe the number input. */
  "aria-describedby"?: ComponentProps<"input">["aria-describedby"];
  /**
   * Marks the number input required for screen readers only. It does not validate, so an empty
   * field still submits. Use `isRequired` for the browser's constraint check, and this for a rule
   * a schema can relax.
   */
  "aria-required"?: ComponentProps<"input">["aria-required"];
};

/** Props of the country picker's trigger. */
type CountryTriggerProps = {
  /** The trigger's name: its visible dial code, then the selected country. */
  label: string;
  /** The select-country action, which describes the trigger. */
  description: string;
  isEditable: boolean;
  /** The flag and dial code the trigger shows. */
  children: ReactNode;
};

/** The country picker's trigger, inside `ComboboxPrimitive.Root`, with its name and description. */
function CountryTrigger({ label, description, isEditable, children }: CountryTriggerProps): ReactElement {
  const nameId = useId();
  const descriptionId = useId();
  return (
    <>
      {/* role="button" overrides Base UI's default role="combobox" so the trigger keeps the
          getByRole("button", {name}) contract the browser tests freeze. The picker's own
          labelable scope already keeps the field's label off it; the explicit aria-labelledby
          also wins over any label Base UI would wire, so the name stays the text below. Don't
          "simplify" either without updating the browser tests. The min height is 1.5rem,
          floored at the fixed 24px target for a host root below 16px. The trigger renders a
          <button>, so the inline addon drops its block padding and the trigger fits the field
          box at both sizes and densities. */}
      {/* The name starts with the visible dial code, so a voice-control user can say the "+47"
          they see (WCAG 2.5.3), and goes on to name the country, which the code alone does not
          tell a screen reader. The description is the select-country action. The server's Intl
          data can name a country differently from the browser's (Hong Kong), so the name may
          keep the server's text through hydration. */}
      <span id={nameId} className="sr-only" suppressHydrationWarning>
        {label}
      </span>
      <span id={descriptionId} className="sr-only">
        {description}
      </span>
      <ComboboxPrimitive.Trigger
        data-slot="phone-number-field-country-trigger"
        role="button"
        aria-labelledby={nameId}
        aria-describedby={descriptionId}
        // Base UI marks a read-only combobox trigger aria-readonly, which the button
        // role does not support; the read-only state shows as the inert cursor and the
        // read-only number input.
        aria-readonly={undefined}
        className={cn(
          selfFocusRingClass,
          // No UA button border or fill in a preflight-free host.
          "flex min-h-[max(1.5rem,24px)] shrink-0 items-center rounded-inner border-0 bg-transparent px-1 transition-[color,background-color,scale] duration-150",
          isEditable
            ? // oxlint-disable-next-line fuse/state-face -- the country trigger takes these faces only while the field is editable
              "cursor-pointer hover:bg-muted active:scale-[0.97] data-pressed:bg-muted"
            : "cursor-default"
        )}>
        {children}
      </ComboboxPrimitive.Trigger>
    </>
  );
}

/**
 * The field box, an InputGroup named as the field. Its two tab stops, the country picker and the
 * number, together make one value, and the group's name is what puts the picker's "Select
 * country" in its field's context, as when a form has a mobile and a work number (WAI-ARIA APG:
 * a group of related controls is named). It takes the name the number input takes: the
 * consumer's `aria-labelledby`, else the Field label's id, with `aria-label` for a field with
 * neither. It renders inside `Field.Root` to read the label's id, and above the picker's own
 * labelable scope.
 */
function PhoneFieldGroup({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: InputGroupRootProps): ReactElement {
  const { labelId } = useLabelableContext();
  return (
    <InputGroupRoot
      {...definedProps({ "aria-labelledby": ariaLabelledby ?? labelId, "aria-label": ariaLabel })}
      {...props}
    />
  );
}

function countryCodeOf(country: PhoneNumberCountry): string {
  return country.code;
}

function isSameCountry(left: PhoneNumberCountry, right: PhoneNumberCountry): boolean {
  return left.code === right.code;
}

/**
 * A labeled phone number field with a country picker, over Field and InputGroup. The country
 * popup is the library's `Combobox.Content`, `List`, `Item` and `Empty`. Its Root, the flag
 * trigger and the popup's search input stay raw Base UI primitives. It is a client component,
 * because it holds the number and country state, the effects and callbacks, focus restoration
 * and `Intl.DisplayNames`.
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
  size = "default",
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
  defaultCountryCode = "NO",
  autoDetectCountry = true,
  international = false,
  preserveOnCountryChange = false,
  outputFormat = "e164",
  formatOnType = false,
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
    defaultCountryCode,
    autoDetectCountry,
    international,
    preserveOnCountryChange,
    outputFormat,
    formatOnType,
    inputRef: numberInputRef,
  });
  useFormReset(numberInputRef, phone.onReset);
  const getCountryName = useMemo(() => countryNameResolver(locale), [locale]);
  // Stable between keystrokes: a new identity makes Base UI re-filter and re-scan every row,
  // though the picker is closed. Names are only needed once the popup is open (rows and filter).
  const countryToStringLabel = useCallback(
    (country: PhoneNumberCountry) =>
      countryPickerOpenRef.current ? getCountryName(country.code) : country.code,
    [getCountryName]
  );

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

  // A number typed (or autofilled) before hydration is proposed as an edit.
  useEarlyInputValue(
    numberInputRef,
    phone.displayValue,
    isEditable
      ? (value) => {
          phone.edit({
            value,
            selectionStart: null,
            selectionEnd: null,
            selectionDirection: null,
            inputType: null,
          });
        }
      : null
  );

  // The flag and dial code: the picker trigger's face, or the plain context of one country.
  const countryFace = (
    <div className="flex items-center gap-1">
      <Flag country={phone.country.code} />
      {/* The input's font size, touch floor included, so both runs of digits have one size.
          Leading is `normal` because a text input centres its text on the font's normal
          metrics whatever its line-height; the dial code centres the same way. */}
      <span className={cn(fieldReads.entryType(), "font-medium min-w-6 leading-[normal] tabular-nums")}>
        {phone.country.dialCode}
      </span>
    </div>
  );

  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}>
      <PhoneFieldGroup
        ref={inputGroupRef}
        size={size}
        aria-invalid={isInvalid || undefined}
        {...definedProps({ "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby })}>
        {phone.countries.length === 1 ? (
          <InputGroupAddon className="text-foreground" align="inline-start">
            {/* One country leaves nothing to pick, so its flag and dial code are context: no
                trigger, popup or tab stop, and a click focuses the number input, as on any
                addon. The name after the code tells assistive technology which country the
                code belongs to, read as "+47 Norway", the order the trigger's name takes. */}
            {/* The addon keeps its block padding and inline inset for a non-button child, so
                only a trailing gap here puts the flag where the trigger's sits. The server's
                Intl data can name a country differently from the browser's (Hong Kong), so the
                name may keep the server's text through hydration. */}
            <div className="flex shrink-0 items-center pr-1">
              {countryFace}
              <span className="sr-only" suppressHydrationWarning>
                {getCountryName(phone.country.code)}
              </span>
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
              itemToStringLabel={countryToStringLabel}
              itemToStringValue={countryCodeOf}
              isItemEqualToValue={isSameCountry}
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
                <CountryTrigger
                  label={strings.format("selectedCountry", {
                    country: getCountryName(phone.country.code),
                    dialCode: phone.country.dialCode,
                  })}
                  description={resolvedSelectCountryLabel}
                  isEditable={isEditable}>
                  {countryFace}
                </CountryTrigger>
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
      </PhoneFieldGroup>
      {/* The submit control, in `outputFormat`, lives inside the frame, so the field is one root
      element as TextField is, and a consumer's `last:`, `space-y-*` or `divide-y` container
      treats both the same. A hidden input renders no box, so it adds no gap before the error,
      and Field ignores it: only `Field.Control` registers as the field's control. */}
      <input type="hidden" name={name} value={phone.outputValue} disabled={isDisabled} />
    </FieldFrame>
  );
}

PhoneNumberField.displayName = "PhoneNumberField";
