# SearchField

## 1 Header

- **Canonical name**: `SearchField` (single labeled composite; no namespace)
- **Export path**: `@elmeragroup/ui/react-aria/search-field` — exports `SearchField` + `SearchFieldProps`. The `react-aria/` prefix is the quarantine marker: this module still imports `react-aria-components` and the path self-documents that.
- **RSC**: client
- **Tier**: **react-aria interim**. One of the two facet-filter remnants (with GridList) — the Autocomplete/filter toolbars still run on RAC; migration is deferred until the listbox/filter rewrite (per the react-aria cluster README). Until then this is a faithful port, not a redesign.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/search-field.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/styles/search-field.ts` (composes internal RAC `field.tsx` parts and the RAC `button.tsx`)

## 2 Anatomy

```
AriaSearchField (root, searchFieldVariants slot `base`)
├─ Label                                  — when `label` (RAC Label, fieldVariants `label`)
├─ FieldGroup (RAC Group, fieldVariants `fieldGroup`)
│  ├─ MagnifyingGlass aria-hidden         (named icon import; slot `icon`)
│  ├─ Input type="search" (ref target)    (slot `input`; native cancel button hidden via CSS)
│  └─ Button variant="ghost" size="icon"  (slot `button`; RAC-wired clear button)
│     └─ X aria-hidden                    (named icon import; slot `buttonIcon`)
├─ Description slot="description"         — when `description`
└─ FieldError                             — rendered always; shows only when invalid
```

All inner parts come from the tier-internal RAC field module (`Label`, `Input`, `FieldGroup`, `Description`, `FieldError`) and the RAC `Button`. None of these internals are public.

## 3 Props

`SearchFieldProps = { label?, description?, errorMessage?, placeholder? } & AriaSearchFieldProps`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | renders RAC `Label`, auto-associated |
| `description` | `string` | — | renders `Description slot="description"` |
| `errorMessage` | `ReactNode \| ((v: ValidationResult) => ReactNode)` | — | unified composite face; forwarded as FieldError children |
| `clearLabel` | `string` | locale dictionary | accessible name for the clear button |
| `placeholder` | `string` | — | forwarded to the inner `Input` |
| `value` / `defaultValue` / `onChange` | RAC | — | `onChange(value: string)` |
| `onSubmit` / `onClear` | RAC | — | Enter submits, clear button / Escape clears |
| `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` | `boolean` | — | ref-style booleans (labeled composite, per conventions) |
| `name`, `validate`, `autoFocus`, aria-* | RAC | — | pass-through |

`ref` forwards to the inner `<input>`.

## 4 Variants

`searchFieldVariants` — slot recipe (`base`, `icon`, `input`, `button`, `buttonIcon`), **no variant axes**, module-private (no borrow pattern). Inner parts consume `fieldVariants` (private) and `buttonVariants` (`variant="ghost"`, `size="icon"`).

## 5 Consumed tokens

- Via field slots: `border-input`, `bg-card`, `text-foreground`, `text-muted-foreground` (description), shared state-driven `focusRing`, `border-error` / `text-error` (invalid)
- Own slots: `text-foreground` (icons); disabled icon uses `text-muted-foreground` (converted, §8)
- Ghost-button tokens via `buttonVariants`

## 6 Data attributes

- Emitted by RAC on the root: `data-empty`, `data-disabled`, `data-invalid`, `data-readonly`; on Group/Input: `data-focused`, `data-focus-visible`, `data-hovered`, `data-disabled`, `data-invalid`
- Consumed: clear button hides via root `data-empty` (`group-data-[empty]:invisible` — the ref spelled this `group-empty:` through the `tailwindcss-react-aria-components` plugin; we write the explicit data-attribute variant and drop the plugin), disabled icon color via `group-aria-disabled:`

## 7 Accessibility

- RAC SearchField wiring: label ↔ input association, description/error via `aria-describedby`, `role="searchbox"` semantics from `<input type="search">`
- Keyboard: **Escape** clears the field; **Enter** fires `onSubmit`; clear button is a real button (Space/Enter) and is invisible (not just hidden) while empty
- Both icons are `aria-hidden`; the clear button is named by localized `clearLabel`.

## 8 Divergence from reference

1. **Export path**: bare `@elmeragroup/ui/search-field` → `@elmeragroup/ui/react-aria/search-field` (interim-tier quarantine prefix).
2. **Icons**: the reference search/close namespace icons become named Phosphor `MagnifyingGlass` / `X` imports from `@elmeragroup/ui/icons`, regular weight.
3. **Raw colors converted**: `group-aria-disabled:text-gray-200` on the leading icon → `group-aria-disabled:text-muted-foreground` (only non-token color in this module; `forced-colors:` system colors kept).
4. **destructive → error**: inherited via field slots — `border-destructive`/`text-destructive` (invalid border, error text) become `border-error`/`text-error`. No `dark:`/`inverted:` variants present.
5. `group-empty:` plugin variant rewritten as explicit `group-data-[empty]:` (drops the `tailwindcss-react-aria-components` dependency).
6. Ref's clear button has no accessible name — localized `clearLabel` is added.
7. `errorMessage` is widened to the library-wide `ReactNode | render function` composite face.
8. Family-wide: the RAC `field` bare export is **dropped** from public (field → base-ui field); the RAC field parts here are tier-internal only. (`popover` and `item` bare exports likewise dropped — popover had zero consumers, item → base-ui item.)
9. Shared RAC `fieldGroupVariants` changes its resting field-box surface from `bg-background` to `bg-card` per [conventions](conventions.md); SearchField inherits that alignment.

## 9 Test requirements

- `getByRole("searchbox", { name: label })` renders; description and error text are in `aria-describedby`
- Typing updates value; **Escape** clears and fires `onClear`; **Enter** fires `onSubmit` with current value
- Clear button (`getByRole("button", { name: /clear/i })`) clears the field and is invisible when empty (root `data-empty`)
- `isDisabled` / `isInvalid` reflect on the root data attributes; `errorMessage` renders only when invalid
- Clear label renders in all four locales; explicit `clearLabel` wins.

## 10 Demo requirements

- `search-field-basic.tsx` — label + placeholder + onSubmit
- `search-field-validation.tsx` — `isRequired` + `errorMessage` function form, description text
