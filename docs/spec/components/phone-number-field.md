# PhoneNumberField

## 1 Header

- **Canonical name:** `PhoneNumberField`
- **Export path:** `@elmeragroup/ui/phone-number-field` (also re-exported from `@elmeragroup/ui`) — exports `PhoneNumberField` and `PhoneNumberFieldProps` only. `Flag` and `usePhoneNumberFieldState` stay package-private.
- **RSC:** client — owns input/country state, effects, callbacks, focus restoration, and `Intl.DisplayNames`
- **Tier:** labeled composite over base-ui Field + InputGroup. The country popup is the library `Combobox`'s `Content`/`List`/`Item`/`Empty`; `Combobox.Root`, the flag trigger, and the popup's search input stay direct `@base-ui/react` primitives (§8.15, 2026-09-03). Phone logic is vendored package-private code over `libphonenumber-js`, with no `@elmeragroup/lib` dependency
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
│  │  │  └─ Combobox.Content (library part: portal + positioner + popup; anchor=InputGroup)
│  │  │     ├─ InputGroup > Addon(MagnifyingGlass) + raw Combobox.Input (named icon import; search)
│  │  │     ├─ Combobox.Empty (noCountriesFoundText)
│  │  │     └─ Combobox.List > Combobox.Item per country (library parts)
│  │  │        └─ Flag + dial code + localized country name (truncated) + the part's own indicator
│  │  ├─ InputGroup.Input (visible number input, name=`${name}-display-value`)
│  │  └─ endContent                                 — when `endContent`
│  └─ Field.Description (`description`)             — when `description`
├─ Field.Error                                      — when errorMessage truthy
└─ <input type="hidden" name={name} value={outputValue} />   — the real form value
```

Internal parts: `Flag` renders the packaged `@elmeragroup/ui/flags` SVG URL as a decorative lazy `<img>` in a fixed 20×15 px slot; `usePhoneNumberFieldState` owns digits, country detection, formatting, and validation. There is no OS detection, emoji branch, network fallback, or public flag variant.

## 3 Props

`PhoneNumberFieldProps` is one declared object type: the state options below (every member of `UsePhoneNumberFieldStateOptions` except its internal, required `locale`, which the component reads from `useElmeraGroupUi()`), plus the field props, plus the nine native input keys re-declared as `ComponentProps<"input">[K]`.

State options (mirrored from `UsePhoneNumberFieldStateOptions` — all public via the component):

| Prop                      | Type                                               | Default                               | Notes                                                                                                          |
| ------------------------- | -------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `value`                   | `string`                                           | `""`                                  | Controlled outer value; URI-decoded on sync (may arrive from URL params)                                       |
| `onChange`                | `(value: string) => void`                          | —                                     | Receives the **formatted output value** (per `outputFormat`), not raw digits                                   |
| `defaultCountryCode`      | `Extract<CountryCode, FlagAssetCode>`              | `"NO"`                                | `FlagAssetCode` comes from `@elmeragroup/ui/flags`; untyped unresolved values follow the fallback below        |
| `metadata`                | `MetadataJson`                                     | `libphonenumber-js/metadata.min.json` | Custom/trimmed metadata injection; country rows are intersected with `flagAssets`                              |
| `autoDetectCountry`       | `boolean`                                          | `true`                                | Detect country from `+`/`00` prefix while typing/pasting                                                       |
| `international`           | `boolean`                                          | `false`                               | Store/display full number with prefix vs. national digits                                                      |
| `preserveOnCountryChange` | `boolean`                                          | `false`                               | Keep digits when switching country (default clears and emits `""`)                                             |
| `outputFormat`            | `"e164" \| "international" \| "national" \| "raw"` | `"e164"`                              | Format of `onChange`/hidden-input value; type is declared privately and reflected into `PhoneNumberFieldProps` |
| `formatOnType`            | `boolean`                                          | `false`                               | As-you-type display formatting                                                                                 |
| `onCountryChange`         | `(country: PhoneNumberCountry) => void`            | —                                     |                                                                                                                |

Field props:

| Prop                                                                                                                                            | Type                                            | Default              | Notes                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `label` / `description`                                                                                                                         | `string`                                        | —                    |                                                                                                               |
| `errorMessage`                                                                                                                                  | `ReactNode`                                     | —                    | `Field.Error`, truthy-gated                                                                                   |
| `placeholder`                                                                                                                                   | `string`                                        | —                    | Visible input                                                                                                 |
| `endContent`                                                                                                                                    | `ReactNode`                                     | —                    | Trailing content inside the InputGroup                                                                        |
| `isInvalid`                                                                                                                                     | `boolean`                                       | `false`              | → `Field.Root invalid`; InputGroup gets `aria-invalid \|\| undefined`                                         |
| `isDisabled`                                                                                                                                    | `boolean`                                       | `false`              | → Field + Combobox.Root disabled                                                                              |
| `isReadOnly`                                                                                                                                    | `boolean`                                       | `false`              | → Combobox.Root + visible input readOnly                                                                      |
| `isRequired`                                                                                                                                    | `boolean`                                       | —                    | sets `aria-required` on the visible input; a component-level prop, not a state option                         |
| `name`                                                                                                                                          | `string`                                        | —                    | Hidden input gets `name`; visible input gets `${name}-display-value` (default `"phone-number-display-value"`) |
| `className`                                                                                                                                     | `string`                                        | —                    | Root                                                                                                          |
| `selectCountryLabel`                                                                                                                            | `string`                                        | locale dictionary    | Explicit override for the built-in `selectCountry` key                                                        |
| `searchCountriesLabel`                                                                                                                          | `string`                                        | locale dictionary    | Explicit override for `searchCountries`                                                                       |
| `noCountriesFoundText`                                                                                                                          | `string`                                        | locale dictionary    | Explicit override for `noCountries`                                                                           |
| `container`                                                                                                                                     | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` | forwarded to the country Combobox content                                                                     |
| `id`, `autoFocus`, `onBlur`, `inputMode` (`"tel"` default), `enterKeyHint`, `autoComplete`, `aria-label`, `aria-labelledby`, `aria-describedby` | native input                                    | —                    | `autoComplete` also forwarded to Combobox.Root; aria/id keys forwarded via conditional-spread guard (§8)      |

Internal hook return (`UsePhoneNumberFieldStateReturn`, not public API, informs behavior): exactly eight members — `displayValue`, `outputValue`, `handleInputChange` (runs the private clean + detection pipeline), `selectCountry`, `handlePaste` (preventDefault + reroute through that same pipeline), `selectedCountry`, `countries`, `getCountryName`. _(Amended 2026-09-03 — §8.14: the earlier list named seven members the hook never returned: `rawValue`, `handleCountrySelect`, `setCountry`, `country`, `callingCode`, `validation`, `nationalNumber`.)_ Locale comes only from `useElmeraGroupUi().locale`; `Intl.DisplayNames` falls back to `en-US`, then the raw code.

`getCountries(metadata)` uses `libphonenumber-js/core` + `metadata.min.json`, constructs `{ code, dialCode }`, and preserves the reference's product exclusion set exactly: `AF`, `BY`, `MM`, `BI`, `CF`, `CD`, `GN`, `GW`, `HT`, `IQ`, `IR`, `LB`, `LY`, `ML`, `MD`, `NI`, `NE`, `KP`, `RU`, `SO`, `SD`, `SS`, `SY`, `TN`, `UA`, `VE`, `YE`, `ZW`. This is a copied product rule, not a claim that the list represents current law; changes require a product/compliance decision and a changeset.

Flag availability is a separate filter, not an addition to that product list. The pinned flag set has no `AC`, `BQ`, `EH`, or `TA` asset, so candidate countries must also satisfy `code in flagAssets`; at the baseline dependency version those are the exact four rows removed for asset availability. `Extract<CountryCode, FlagAssetCode>` is the only code type accepted by the private `Flag` and selected-country state; the intersection also rejects source-only SVG codes that libphonenumber does not recognize. Auto-detection changes country only when the result resolves through the manifest. An unresolved untyped `defaultCountryCode` falls back to `NO` when `NO` exists in the supplied metadata, otherwise the first resolved picker country; if filtering leaves no country, the hook throws a descriptive configuration error before render. The complete gate and refresh rule are in [architecture](../architecture.md) §6a.

## 4 Variants

No own recipe. **Borrows the public `textFieldVariants`** slots `base`, `labelContainer`, `label`, `container`, `description` (no axes passed — plain defaults). Trigger/popup/item styling is inline; no size axis.

## 5 Consumed tokens

`card` (InputGroup surface per conventions), `input`/`ring`/`error` (InputGroup border/focus/invalid states; since §8.15 also the popup search box's `border-input/30` + `bg-input/30` fill, painted by `Combobox.Content`), `popover` + `popover-foreground` (country popup), `accent` + `accent-foreground` (highlighted item), `muted` (trigger hover/pressed), `muted-foreground` (description, search icon, empty text), `foreground` (addon text; popup `ring-foreground/10`). Radii: popup `rounded-md`, trigger `rounded`, item `rounded-sm`.

## 6 Data attributes

- **Emitted:** `data-slot="field|field-label|field-description|field-error"` plus InputGroup's slots; from the composed library parts (§8.15) `data-slot="combobox-content|combobox-list|combobox-item|combobox-empty"` and `data-chips="true"` on the popup (the flag that tells `Combobox.Content` it is anchored to an external element). Portal placement is resolved through the explicit `container` prop/nearest `ThemeScope`, not an overlay data attribute.
- **Consumed (base-ui Combobox):** `data-pressed` (trigger active fill), `data-open`/`data-closed` + `data-[side=…]` (popup animation), `data-highlighted`/`data-disabled` (items), `data-empty` (empty state). Popup animation classes use conventions' self-scoped `data-open:`/`data-closed:` custom variants on the popup element.

## 7 Accessibility

- Country trigger: `role="button"` with `aria-label={selectCountryLabel}` and `aria-labelledby={undefined}` (see §8). Enter/Space/click opens the popup; popup search input receives focus; ArrowUp/ArrowDown move highlight; Enter selects; Escape closes. Selecting a country returns focus to the number input via `requestAnimationFrame`.
- Search input: `aria-label={searchCountriesLabel}`, `aria-autocomplete="none"`, `aria-haspopup="false"`, `autoComplete="one-time-code"` (§8).
- Number input: labeled by `Field.Label` via base-ui wiring, or by the forwarded `aria-label`/`aria-labelledby`; `aria-required` uses `isRequired ? true : undefined`; `inputMode="tel"` by default.
- `Field.Error` has `role="alert"`; InputGroup carries `aria-invalid || undefined`.
- Flag images are decorative (`alt=""`, `aria-hidden="true"`): the adjacent localized country name and dial code carry the information, so announcing “flag” would be redundant.

## 8 Divergence from reference / load-bearing hacks (all preserved)

1. **Root Combobox import:** `import { Combobox } from "@base-ui/react"` — the `@base-ui/react/combobox` subpath type-checks but crashes at runtime with a null React context. Keep the root import until upstream fixes it.
2. **Two-input pattern:** the visible input is named `${name}-display-value` and holds the formatted display string; a `<input type="hidden" name={name}>` holds `outputValue` (e.g. E.164) — the value forms actually submit. Do not merge them.
3. **`role="button"` trigger override:** overrides base-ui's default `role="combobox"` on the trigger so `getByRole("button", { name: selectCountryLabel })` stays the frozen test contract; `aria-labelledby` is explicitly cleared so the Field label doesn't bleed onto the trigger and `aria-label` wins.
4. **ariaProps conditional-spread guard:** base-ui `mergeProps` has no undefined-guard, so a present-but-undefined `id`/`aria-*` key clobbers the Field-auto-wired label/description. Only defined keys are spread onto the visible input.
5. **Popup anchored to the InputGroup** (`anchor={inputGroupRef}`), not the flag trigger, so the popup's left edge aligns with the field box; `w-(--anchor-width)` sizes it to the field.
6. **rAF focus after country select:** `requestAnimationFrame(() => numberInputRef.current?.focus())` — focusing synchronously loses to Combobox's own post-select focus management.
7. **Localized defaults (ADR 0006):** labels read the co-located dictionary using the required provider locale; optional props override them. Exact defaults are in [accessibility](../accessibility.md) §4.
8. **`autoComplete="one-time-code"` on the search input** suppresses browser/password-manager autofill popups over the country list.
9. **Icon swaps:** lucide `CheckIcon` becomes the named Phosphor `Check` import (item indicator); the reference search icon becomes named Phosphor `MagnifyingGlass`.
10. **Flags replaced (user ruling):** the private `"emoji" | "cdn" | "auto"` branch, `flagcdn.com`, image-error country-code fallback, Unicode conversion helper, and OS/user-agent support table are all deleted. The private Flag has no variant, accepts only `Extract<CountryCode, FlagAssetCode>`, and always renders the locally packaged SVG URL, giving macOS and Windows identical output. The four unresolved libphonenumber codes and their state guards are specified in §3/[architecture](../architecture.md) §6a; no wrong-country image is substituted.
11. **Token renames:** `destructive` → `error` in InputGroup invalid styles; the fixed flag artwork is exempt from theme tokens.
12. **Locale is provider-only:** the component-level `locale` option and `document.documentElement.lang` fallback are deleted. `useElmeraGroupUi().locale` is required, and the same locale drives `Intl.DisplayNames` and built-in strings.
13. **Private phone engine:** `cleanPhoneInput`, parse/detect/format helpers, constants, country creation, validation types, and `usePhoneNumberFieldState` are copied into package-private modules from the pinned reference. None is re-exported and no `@elmeragroup/lib` type leaks into declarations.
14. **`PhoneNumberFieldProps` is declared, not derived** (2026-09-03): the type is one object literal — it mirrors `UsePhoneNumberFieldStateOptions` minus the internal `locale` (which comes from `useElmeraGroupUi()`), adds the field props, and re-declares the nine native input keys as `ComponentProps<"input">[K]`; it is not an intersection with the hook options plus a `Pick`. The hook's return is the eight members of `UsePhoneNumberFieldStateReturn`. §3 documented a derived type and a fourteen-member return, seven of whose names the hook never had; the text is corrected to the shipped types, which stay as they are.

15. **Country popup composed from the library Combobox** (2026-09-03): `Combobox.Content/List/Item/Empty` replace the hand-built `Portal`/`Positioner`/`Popup`/`List`/`Item`/`ItemIndicator`/`Empty` this chapter used to specify, so the picker inherits the family's popup chrome and its fixes instead of a copy that had already drifted from it. `Combobox.Root`, the flag `Trigger`, and the popup's search `Input` stay raw `@base-ui/react` primitives: the library `Trigger` appends a caret the flag trigger must not have and would lose the `role="button"` contract of §8.3, and the library `Input` builds its own InputGroup with no leading-icon slot. The deliberate output changes, in full: the popup loses `p-2` and gains the shared surface's `max-h-(--available-height)` + `overflow-hidden` (it previously grew to the full list height, with only the inner list scrolling); the search InputGroup drops its local `mb-2` for the shared `m-1 mb-0` compact chrome; the list takes the shared `max-h` clamp and `data-empty:p-0`; the empty row takes the shared `hidden` + `group-data-empty/combobox-content:flex` and `py-2` in place of `data-empty:flex` and `px-2`; and options gain `[&_svg:not([class*='size-'])]:size-4` and `data-highlighted:**:text-accent-foreground`, the two rules the copied item class had already missed. The `max-w-72` cap is dropped: `Combobox.Content` pins an anchored popup's minimum width to `--anchor-width`, which a smaller `max-width` cannot undo, so the popup is the width of the field — which is what §8.5 already intends. Every other emitted class set is byte-identical: root, InputGroup, trigger, positioner, search input, search addon and icon, item indicator, and the number input.
16. **One parse per keystroke** (2026-09-03): the hook has a single `applyState(next, { emitChange })` where `commit` and `syncValue` duplicated the same country-notify / set-state / emit sequence; it carries `ProcessedPhoneInput` rather than restating that shape; the display/output pair comes from one memoized closure shared by the emit path and the render, invalidated by rebuilding the closure whenever a formatting option changes; and the sync effect returns early when the incoming `value` is the string the hook last emitted and neither `international` nor `metadata` has changed. Together these take a controlled keystroke from three `AsYouType` parses to one, pinned by a test. `Intl.DisplayNames.of` is resolved once per (locale, picker set) into a map instead of once per row per render. The hook's shape is unchanged: the same eight members of §3, the same options. Inside `phone-engine`, only symbols another module imports are exported, and `processInputWithDetection`, `resolvePhoneFieldValues`, and the private `getDisplayValue` take one options object rather than five or six positional arguments of which two were adjacent booleans.
17. **The unbound `form` and the empty search `name`** (2026-09-03), previously shipped undocumented: `Combobox.Root` carries `form="elmera-ui-phone-country-unbound"`, an id that deliberately names no rendered form, so base-ui's own hidden country-code input is associated with nothing and cannot reach the host form's `FormData` beside `name` and `${name}-display-value` — the pair of §8.2 is the whole submitted surface. The popup's search input carries `name=""`: a control with no name is never submitted, and the empty name also keeps it out of browser autofill heuristics, which `autoComplete="one-time-code"` (§8.8) covers only for password managers. Both are load-bearing; neither may be tidied away unless the two-input contract of §8.2 changes first.

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
- Parse budget: a controlled probe over `usePhoneNumberFieldState` alone counts `AsYouType` parses and asserts exactly one per keystroke while the emitted value echoes back (§8.16). The hook needs a renderer that runs effects, which the node `unit` project has no dependency for, so this one hook test runs in the `browser` project and renders no library component.
- The picker's exclusion list, flag gap, and empty-picker error are the test tree's own literals (`test/phone-picker-contract.ts`), not imports of the engine's constants: reading the implementation's own `Set` back made both assertions tautologies (ADR 0008).
- Locale matrix: `selectCountry`, `searchCountries`, and `noCountries` render in all four supported locales; each override prop wins.
- Flag contract: NO/SE/FI rows render the manifest's packaged SVG URLs with empty alt text plus the exact lazy-image attributes from [architecture](../architecture.md) §6a; the code has no platform branch. Picker tests assert that `AC`/`BQ`/`EH`/`TA` are absent, every rendered row resolves through `flagAssets`, and auto-detection never selects an unresolved code. Type tests reject those four values as `defaultCountryCode`; an untyped unresolved default exercises the documented fallback. Source/package scans reject `flagcdn.com`, browser-detection identifiers, Unicode regional-indicator helpers, and substitute-country mappings.

## 10 Demo requirements

Plain `.tsx` demos: `phone-number-field-basic` (label, default country), `phone-number-field-international` (international + formatOnType), `phone-number-field-detect` (paste `+`-prefixed numbers), `phone-number-field-form` (hidden-input submission with FormData readout), `phone-number-field-i18n` (provider locale switch + explicit copy override), `phone-number-field-states` (invalid + error, disabled, read-only, endContent).
