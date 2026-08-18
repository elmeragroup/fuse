# PhoneNumberField

## 1 Header

- **Canonical name:** `PhoneNumberField`
- **Export path:** `@elmeragroup/ui/phone-number-field` — exports `PhoneNumberField` + `PhoneNumberFieldProps` only. `Flag` and `usePhoneNumberFieldState` stay **unexported** (internal).
- **Tier:** labeled composite over base-ui Field + Combobox + InputGroup, phone logic from `@elmeragroup/lib` (libphonenumber-js).
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/phone-number-field/` (`index.ts`, `phone-number-field.tsx`, `flag.tsx`, `hooks/use-phone-number-field-state.ts`)

## 2 Anatomy

```
Field.Root                                (textFieldVariants slot `base` — borrowed public recipe)
├─ label row (div, `labelContainer`) > Field.Label (`label`)   — when `label`
├─ container (div, `container`)
│  ├─ InputGroup (ref: popover anchor; carries aria-invalid)
│  │  ├─ Combobox.Root (items=countries, value=selectedCountry)
│  │  │  ├─ InputGroup.Addon (inline-start)
│  │  │  │  └─ Combobox.Trigger role="button"      — Flag + dial code (tabular-nums)
│  │  │  └─ Combobox.Portal > Combobox.Positioner (anchor=InputGroup, bottom-start, offset 6)
│  │  │     └─ Combobox.Popup (bg-popover, w-(--anchor-width) max-w-72)
│  │  │        ├─ InputGroup > Addon(Icon.MagnifyingGlass) + Combobox.Input (search)
│  │  │        ├─ Combobox.Empty (noCountriesFoundText)
│  │  │        └─ Combobox.List > Combobox.Item per country
│  │  │           ├─ Combobox.ItemIndicator > Icon.Check
│  │  │           └─ Flag + dial code + localized country name (truncated)
│  │  ├─ InputGroup.Input (visible number input, name=`${name}-display-value`)
│  │  └─ endContent                                 — when `endContent`
│  └─ Field.Description (`description`)             — when `description`
├─ Field.Error                                      — when errorMessage truthy
└─ <input type="hidden" name={name} value={outputValue} />   — the real form value
```

Internal parts: `Flag` (unicode-emoji flag on supporting OSes, flagcdn.com `<picture>` fallback, country-code text as last resort; fixed 20px slot so both paths share width) and `usePhoneNumberFieldState` (digits state, country detection, formatting, validation).

## 3 Props

`PhoneNumberFieldProps = UsePhoneNumberFieldStateOptions & { …field props } & Pick<ComponentProps<"input">, "id" | "autoFocus" | "onBlur" | "inputMode" | "enterKeyHint" | "autoComplete" | "aria-label" | "aria-labelledby" | "aria-describedby">`.

State options (from `UsePhoneNumberFieldStateOptions` — all public via the component):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | `""` | Controlled outer value; URI-decoded on sync (may arrive from URL params) |
| `onChange` | `(value: string) => void` | — | Receives the **formatted output value** (per `outputFormat`), not raw digits |
| `defaultCountryCode` | `CountryCode` | `DEFAULT_COUNTRY_CODE` (lib) | |
| `metadata` | `MetadataJson` | `libphonenumber-js/metadata.min.json` | Custom/trimmed metadata injection |
| `autoDetectCountry` | `boolean` | `true` | Detect country from `+`/`00` prefix while typing/pasting |
| `international` | `boolean` | `false` | Store/display full number with prefix vs. national digits |
| `preserveOnCountryChange` | `boolean` | `false` | Keep digits when switching country (default clears and emits `""`) |
| `outputFormat` | `PhoneNumberFormat` | `"e164"` | Format of `onChange`/hidden-input value |
| `formatOnType` | `boolean` | `false` | As-you-type display formatting |
| `isRequired` | `boolean` | `false` | Feeds validation; sets `aria-required` on the visible input |
| `onCountryChange` | `(country: PhoneNumberCountry) => void` | — | |
| `locale` | `string` | ui-context → `document.documentElement.lang` → `"en"` | Country display names (`Intl.DisplayNames`) and Combobox locale |

Field props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` / `description` | `string` | — | |
| `errorMessage` | `ReactNode` | — | `Field.Error`, truthy-gated |
| `placeholder` | `string` | — | Visible input |
| `endContent` | `ReactNode` | — | Trailing content inside the InputGroup |
| `isInvalid` | `boolean` | `false` | → `Field.Root invalid`; InputGroup gets `aria-invalid \|\| undefined` |
| `isDisabled` | `boolean` | `false` | → Field + Combobox.Root disabled |
| `isReadOnly` | `boolean` | `false` | → Combobox.Root + visible input readOnly |
| `isRequired` | `boolean` | — | (shared with state options above) |
| `name` | `string` | — | Hidden input gets `name`; visible input gets `${name}-display-value` (default `"phone-number-display-value"`) |
| `className` | `string` | — | Root |
| `selectCountryLabel` | `string` | `"Select country"` | Injected i18n (see §8) |
| `searchCountriesLabel` | `string` | `"Search countries"` | |
| `noCountriesFoundText` | `string` | `"No countries found."` | |
| `id`, `autoFocus`, `onBlur`, `inputMode` (`"tel"` default), `enterKeyHint`, `autoComplete`, `aria-label`, `aria-labelledby`, `aria-describedby` | native input | — | `autoComplete` also forwarded to Combobox.Root; aria/id keys forwarded via conditional-spread guard (§8) |

Internal hook return (not public API, informs behavior): `displayValue`, `rawValue`, `outputValue`, `handleInputChange` (runs `cleanPhoneInput` + detection), `handleCountrySelect`, `handlePaste` (preventDefault + reroute through input pipeline), `setCountry`, `country`, `selectedCountry`, `callingCode`, `validation`, `nationalNumber`, `countries`, `getCountryName` (with `Intl.DisplayNames` fallback to `en-US`, then to the raw code).

## 4 Variants

No own recipe. **Borrows the public `textFieldVariants`** slots `base`, `labelContainer`, `label`, `container`, `description` (no axes passed — plain defaults). Trigger/popup/item styling is inline; no size axis.

## 5 Consumed tokens

`card` (InputGroup surface per conventions), `input`/`ring`/`error` (InputGroup border/focus/invalid states), `popover` + `popover-foreground` (country popup), `accent` + `accent-foreground` (highlighted item), `muted` (trigger hover/pressed), `muted-foreground` (description, search icon, empty text), `foreground` (addon text; popup `ring-foreground/10`). Radii: popup `rounded-md`, trigger `rounded`, item `rounded-sm`.

## 6 Data attributes

- **Emitted:** `data-slot="field|field-label|field-description|field-error"` plus InputGroup's slots; `data-overlay-container="combobox"` on the Positioner (theme-scope portalling hook).
- **Consumed (base-ui Combobox):** `data-pressed` (trigger active fill), `data-open`/`data-closed` + `data-[side=…]` (popup animation), `data-highlighted`/`data-disabled` (items), `data-empty` (empty state). Popup animation classes use bare `data-open:`/`data-closed:` variants — the conventions' `data-open:` ancestor-match trap applies; keep them scoped to the popup element.

## 7 Accessibility

- Country trigger: `role="button"` with `aria-label={selectCountryLabel}` and `aria-labelledby={undefined}` (see §8). Enter/Space/click opens the popup; popup search input receives focus; ArrowUp/ArrowDown move highlight; Enter selects; Escape closes. Selecting a country returns focus to the number input via `requestAnimationFrame`.
- Search input: `aria-label={searchCountriesLabel}`, `aria-autocomplete="none"`, `aria-haspopup="false"`, `autoComplete="one-time-code"` (§8).
- Number input: labeled by `Field.Label` via base-ui wiring, or by the forwarded `aria-label`/`aria-labelledby`; `aria-required` uses `isRequired ? true : undefined`; `inputMode="tel"` by default.
- `Field.Error` has `role="alert"`; InputGroup carries `aria-invalid || undefined`.
- Flag emoji spans have `role="img"` + `aria-label="{CC} flag"`; CDN images have equivalent `alt`.

## 8 Divergence from reference / load-bearing hacks (all preserved)

1. **Root Combobox import:** `import { Combobox } from "@base-ui/react"` — the `@base-ui/react/combobox` subpath type-checks but crashes at runtime with a null React context. Keep the root import until upstream fixes it.
2. **Two-input pattern:** the visible input is named `${name}-display-value` and holds the formatted display string; a `<input type="hidden" name={name}>` holds `outputValue` (e.g. E.164) — the value forms actually submit. Do not merge them.
3. **`role="button"` trigger override:** overrides base-ui's default `role="combobox"` on the trigger so `getByRole("button", { name: selectCountryLabel })` stays the frozen test contract; `aria-labelledby` is explicitly cleared so the Field label doesn't bleed onto the trigger and `aria-label` wins.
4. **ariaProps conditional-spread guard:** base-ui `mergeProps` has no undefined-guard, so a present-but-undefined `id`/`aria-*` key clobbers the Field-auto-wired label/description. Only defined keys are spread onto the visible input.
5. **Popup anchored to the InputGroup** (`anchor={inputGroupRef}`), not the flag trigger, so the popup's left edge aligns with the field box; `w-(--anchor-width)` sizes it to the field.
6. **rAF focus after country select:** `requestAnimationFrame(() => numberInputRef.current?.focus())` — focusing synchronously loses to Combobox's own post-select focus management.
7. **Injected i18n strings:** the package is app-agnostic (no i18n dependency); `selectCountryLabel`/`searchCountriesLabel`/`noCountriesFoundText` default to the English source strings and are overridden by consumers.
8. **`autoComplete="one-time-code"` on the search input** suppresses browser/password-manager autofill popups over the country list.
9. **Icon swaps:** lucide `CheckIcon` → Phosphor `Check` (item indicator); `Icon.Search` → Phosphor `MagnifyingGlass`.
10. **Flag `variant` type narrowed (divergence):** ref type is `"emoji" | "cdn" | "auto"` but the logic only distinguishes `"cdn"` (`variant !== "cdn"`), so `"emoji"` behaves identically to `"auto"` — the dead `"emoji"` value is removed; type becomes `"cdn" | "auto"`. `Flag` remains unexported either way.
11. **Token renames:** `destructive` → `error` in InputGroup invalid styles; Flag's `dark:outline-white/10` / `dark:text-gray-400` raw-palette fallbacks replaced with token-based equivalents per conventions.
12. Locale resolution consumes the ui-context (`useElmeraGroupUi().locale`) with documented fallbacks — kept; Flag's OS-based unicode-flag support check also reads `userAgent` from ui-context.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Country picker keyboard flow: focus trigger (`getByRole("button", { name: "Select country" })`), open with Enter, type in search (`getByRole(…, { name: "Search countries" })`) to filter, ArrowDown + Enter to select; assert dial code updates, popup closes, and focus lands on the number input.
- Hidden-input form value: wrap in a form, type a national number, submit; assert `FormData.get(name)` is the E.164 `outputValue` and `${name}-display-value` carries the display string.
- Auto-detection: typing/pasting `+46…` switches the country to SE and (national mode) strips the prefix from the display.
- `preserveOnCountryChange` false clears digits and emits `""` on country switch; true re-emits reformatted value.
- Paste path: paste event is intercepted and cleaned (formatting characters stripped).
- `isInvalid`/`errorMessage` alert; `isDisabled` disables trigger and input; `isReadOnly` keeps focus but blocks edits.
- i18n injection: overridden labels appear in the accessibility tree.
- Empty search shows `noCountriesFoundText`.

## 10 Demo requirements

Plain `.tsx` demos: `phone-number-field-basic` (label, default country), `phone-number-field-international` (international + formatOnType), `phone-number-field-detect` (paste `+`-prefixed numbers), `phone-number-field-form` (hidden-input submission with FormData readout), `phone-number-field-i18n` (injected Norwegian labels + locale country names), `phone-number-field-states` (invalid + error, disabled, read-only, endContent).
