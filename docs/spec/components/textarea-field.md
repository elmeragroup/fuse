# TextareaField

## 1 Header

- **Canonical name**: `TextareaField` (single labeled composite; renamed from the ref's `TextArea` — mirrors `input` → `TextField`)
- **Export path**: `@elmeragroup/ui/textarea-field` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: labeled composite (composite prop face: `is*` booleans, `onChange(value)`, `errorMessage: ReactNode`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/text-area.tsx`

## 2 Anatomy

A pre-wired Field composition around the `Textarea` primitive. Internal structure (not user-composable):

```tsx
<Field.Root invalid={isInvalid} disabled={isDisabled}>
  {/* label row: label left, character counter right (only when label or maxLength present) */}
  <div>
    <Field.Label>{label}</Field.Label>
    <span>{currentLength}/{maxLength}</span>
  </div>
  <Field.Control render={<Textarea … />} />
  <Field.Description>{description}</Field.Description>
  <Field.Error>{errorMessage}</Field.Error>
</Field.Root>
```

Label row renders when `label` is set or `maxLength` is set, including `maxLength={0}`; Description/Error render only when provided (Field.Error additionally self-suppresses on empty children).

## 3 Props

`Omit<ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange" | "disabled" | "required" | "className">` re-typed plus the composite face — `disabled` and `required` are omitted because `isDisabled`/`isRequired` own them (they also drive `Field.Root`), and `className` because the composite's own `className` targets the inner `Textarea`: _(Amended 2026-09-03 — the omit list shipped wider than §3 recorded.)_

| Prop           | Type                       | Default | Notes                                                                   |
| -------------- | -------------------------- | ------- | ----------------------------------------------------------------------- |
| `label`        | `string`                   | —       | rendered in `Field.Label`; omit for externally-labeled usage            |
| `description`  | `string`                   | —       | `Field.Description`, auto `aria-describedby`                            |
| `errorMessage` | `ReactNode`                | —       | `Field.Error` content; widened from ref's `string` (§8)                 |
| `value`        | `string`                   | —       | controlled value                                                        |
| `defaultValue` | `string`                   | —       | uncontrolled initial value (restored, §8)                               |
| `onChange`     | `(value: string) => void`  | —       | value, not event — composite convention                                 |
| `maxLength`    | `number`                   | —       | forwarded natively **and** drives the `current/max` counter; `0` is set |
| `isRequired`   | `boolean`                  | —       | forwarded as native `required`                                          |
| `isInvalid`    | `boolean`                  | —       | sets `Field.Root` `invalid`; base-ui emits `aria-invalid`               |
| `isDisabled`   | `boolean`                  | —       | added (§8); sets `Field.Root` `disabled`, cascading to the control      |
| `className`    | `string`                   | —       | merged onto the inner `Textarea`                                        |
| …rest          | remaining `Textarea` props | —       | spread onto the inner `Textarea`                                        |

Controlled/uncontrolled: supplying `value` makes it controlled; `defaultValue` (or neither) is uncontrolled. The character counter reflects the current value in both modes (uncontrolled mode tracks length internally from the change event). After an uncanceled native form reset (button or programmatic), the counter reads the restored DOM value. Canceled resets preserve the current count. Controlled values remain parent-owned, and resets never call `onChange`. The form listener and pending reset work are invalidated on unmount.

## 4 Variants

None of its own — no tv recipe at this component. The `textArea` slot on `textFieldVariants` is dead and removed (text-field.md §4/§8.3) and is not consumed or restored here. `min-h-16` is pinned by the `Textarea` primitive (textarea.md §4). Shared `textFieldVariants` layout slots (`labelContainer`, …) may be reused when they match the lift; they are not a recipe of this component.

## 5 Consumed tokens

Directly: `muted-foreground` (character counter text). Everything else via composed parts: `Textarea` (`card`, `input`, `ring`, `error`, `muted-foreground`) and `Field` (`error`, `muted-foreground`).

## 6 Data attributes

**Emitted** (via composition): `data-slot="field"` / `field-label` / `field-control` (merged onto the textarea alongside `data-slot="textarea"` semantics — base-ui `Field.Control` with `render` merges props onto the `Textarea`) / `field-description` / `field-error`; base-ui state attrs `data-invalid`, `data-disabled`, `data-touched`, `data-dirty`, `data-filled` on Root/parts.

**Consumed**: none beyond what `Field`/`Textarea` consume.

## 7 Accessibility

- `Field.Control render={<Textarea/>}` gives the plain `<textarea>` full base-ui wiring: label association, `aria-describedby` for description, `aria-invalid` + error association. This component exists precisely so labeled textarea usage never hand-rolls that wiring (see the textarea spec's aria note).
- `errorMessage` renders through `Field.Error` (`role="alert"`, `match`) — announced on appearance; external validators own visibility and pass the single translated message.
- Counter is visual-only supplementary info; `maxLength` remains natively enforced so the count never exceeds the limit.
- `isRequired` renders native `required` (exposed to AT); `isDisabled` disables via Field cascade, removing the control from tab order.
- Keyboard: standard textarea editing; Enter inserts newline.

## 8 Divergence from reference

1. **Renamed `TextArea` → `TextareaField`** (file `text-area.tsx` → `textarea-field`) — mirrors the `input` → `TextField` naming: primitive is `Textarea`, labeled composite is `TextareaField`. Type `TextAreaProps` → `TextareaFieldProps`.
2. **`isDisabled` added** — the ref lacks any disabled face at this tier (only reachable via raw spread); composite convention requires the `is*` boolean, wired to `Field.Root` `disabled`.
3. **`defaultValue` restored** — the ref `Omit`s it and forces `value={value ?? ""}`, making the control always-controlled (typing without `onChange` is swallowed). Uncontrolled usage is supported again; controlled behavior unchanged.
4. **`errorMessage` widened `string` → `ReactNode`** — unified composite convention (never `string`).
5. **Internal `bg-white` override → `bg-card`** — the ref re-tinted the transparent Textarea with `cn("bg-white", className)`; with Textarea now `bg-card` by default this override collapses, and any residual tint uses the token.
6. Compound internals referenced in namespace style (`Field.Root` etc.) per the field spec's renames — no additional public renames here.
7. **Label row, description and error move to the shared frame (2026-09-03, field.md §8.9):** the §2 composition is rendered by the package-private `FieldFrame`; the character counter is passed to it as the label row's status face, which is what forces the row to exist when `maxLength` is set without a `label` (including `maxLength={0}`). `Field.Control render={<Textarea/>}` stays here — the frame owns the label row, not the control. Emitted markup and class sets are unchanged.

## 9 Test requirements

- Accessible name: `getByRole("textbox", { name: label })` resolves.
- Description linked via `aria-describedby`; `errorMessage` (as ReactNode) appears with `role="alert"` and is associated; absent when not provided.
- Controlled: typing calls `onChange` with the string value (not the event); value prop drives display.
- Uncontrolled: with `defaultValue` (and with neither prop) typing updates the displayed value without `onChange`.
- Counter: renders `0/120` initially, updates as the user types (keyboard), caps at `maxLength` (native truncation).
- `isInvalid` → `aria-invalid` on the textbox; `isDisabled` → disabled control, skipped by Tab; `isRequired` → `required`.
- Label row absent when neither `label` nor `maxLength` is given. `maxLength={0}` is set: the row and `0/0` counter render, and native `maxLength` is 0.

## 10 Demo requirements

Plain runnable `.tsx` demos: `textarea-field-basic.tsx` (label + description), `textarea-field-counter.tsx` (maxLength counter, controlled), `textarea-field-uncontrolled.tsx` (defaultValue), `textarea-field-error.tsx` (isInvalid + ReactNode errorMessage from an external validator), `textarea-field-disabled.tsx` (isDisabled + isRequired states).
