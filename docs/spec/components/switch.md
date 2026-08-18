# Switch

## 1 Header

- **Canonical name**: `Switch` (single component, no compound parts exposed)
- **Export path**: `@elmeragroup/ui` (`import { Switch } from "@elmeragroup/ui"`)
- **Tier**: base-ui control primitive (unlabeled; labeled usage composes with `Field.Root` + `Field.Label`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/switch.tsx`

## 2 Anatomy

One exported component wrapping two base-ui parts internally:

| Internal part | base-ui primitive | data-slot |
| --- | --- | --- |
| root (`<button role="switch">`) | `Switch.Root` from `@base-ui/react/switch` | `switch` |
| thumb (`<span>`) | `Switch.Thumb` | `switch-thumb` |

The thumb is not consumer-composable — the ref renders it internally with fixed classes and no props; we keep that. The root carries `group/switch` so thumb classes can key off root state (`group-data-[size=…]/switch:…`).

```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

```tsx
<Field.Root>
  <Field.Label>Notifications</Field.Label>
  <Switch />
</Field.Root>
```

## 3 Props

`ComponentProps<typeof SwitchPrimitive.Root> & { size?: "sm" | "default" }` — full primitive pass-through, primitive-tier naming (`checked`, `defaultChecked`, `onCheckedChange`, `disabled`, `required`, `readOnly`, `name`, `value`, `inputRef`, `nativeButton`, `render` for polymorphism).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `"sm" \| "default"` | `"default"` | our only added prop; emitted as `data-size` |
| `className` | `string` | — | merged via `cn` after base classes |
| …rest | `SwitchPrimitive.Root` props | — | spread onto the primitive; base-ui renders a hidden `<input>` for form participation |

No `onChange(value)` face here — this is the primitive tier; labeled composites that wrap it may add one later.

## 4 Variants

No tv recipe — the ref styles with a plain class string plus `data-size` selectors; kept module-private (there is no borrow pattern for switch). Size axis is expressed via `data-[size=…]` selectors rather than tv:

| size | root | thumb | checked translate |
| --- | --- | --- | --- |
| `default` | `h-[18.4px] w-[32px]` | `size-4` (16px) | `translate-x-[calc(100%-2px)]` |
| `sm` | `h-[14px] w-[24px]` | `size-3` (12px) | `translate-x-[calc(100%-2px)]` |

**Kept-but-flagged**: the magic root dimensions (`18.4px`/`32px`, `14px`/`24px`) are ref-verbatim optical values, not scale-derived — kept for pixel fidelity, flagged for a future metric pass. Likewise the per-size checked/unchecked thumb translate classes are duplicated verbatim per size even though both resolve to the identical `calc(100%-2px)` / `translate-x-0` — kept as-is (collapsing them changes selector specificity ordering), flagged as a candidate cleanup.

Other fixed styling: `rounded-full border border-transparent shadow-xs transition-colors`; an invisible `after:` pseudo-element extends the hit area by 12px on every side (`after:-inset-x-3 after:-inset-y-3`).

## 5 Consumed tokens

- `primary` — checked track fill (`data-checked:bg-primary`).
- `input` — unchecked track fill (`data-unchecked:bg-input`).
- `background` — thumb fill (`bg-background`).
- `ring` — focus border + ring (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`).
- `error` — invalid border + ring (`aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20`).

## 6 Data attributes

**Emitted**: `data-slot="switch"`, `data-size` (root); `data-slot="switch-thumb"` (thumb). base-ui emits `data-checked` / `data-unchecked` / `data-disabled` on both parts.

**Consumed**: `data-checked`/`data-unchecked` (track fill, thumb translate), `data-disabled` (`cursor-not-allowed opacity-50`), `aria-invalid` (error ring, auto-wired by base-ui Field), `data-size` via the `group/switch` scope for thumb metrics. The root is also a `peer` for consumer-side sibling styling.

## 7 Accessibility

- base-ui renders `role="switch"` with `aria-checked`; a hidden native input carries `name`/`value` for forms.
- Keyboard: Space and Enter toggle; Tab moves focus in/out — all base-ui behavior, nothing hand-written.
- Focus is `focus-visible`-scoped (ring on keyboard focus only).
- Inside `Field.Root`, label association and `aria-invalid` are auto-wired; the invalid styles key off that.
- The `after:` inset pseudo-element guarantees a comfortable pointer target (~44px effective on `default`) without visual size change.

## 8 Divergence from reference

1. **`dark:` variant classes dropped** (`dark:aria-invalid:border-destructive/50`, `dark:aria-invalid:ring-destructive/40`, `dark:data-unchecked:bg-input/80` on root; `dark:data-checked:bg-primary-foreground`, `dark:data-unchecked:bg-foreground` on thumb) — dark axis lives in tokens behind `[data-theme="dark"]`, per `no-tailwind-dark-variant`.
2. **`destructive` → `error`** token rename on the `aria-invalid:` border/ring classes.
3. **Kept-but-flagged: magic dimensions** — `18.4px`/`32px` (default) and `14px`/`24px` (sm) root sizes are not derived from any scale; retained verbatim for fidelity, flagged for a future metrics pass (see §4).
4. **Kept-but-flagged: duplicated per-size thumb translate** — `group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]` and the `sm` twin are byte-identical logic duplicated per size (same for the `translate-x-0` unchecked pair); retained verbatim, flagged.

No API divergence — prop surface (`size` included) is identical to the ref.

## 9 Test requirements

- `getByRole("switch")` renders; `aria-checked` reflects state.
- Click toggles and fires `onCheckedChange` with the new checked value.
- Keyboard: focus via Tab, toggle via Space and via Enter; `disabled` removes it from the tab order and blocks toggling.
- Controlled (`checked` + `onCheckedChange`) and uncontrolled (`defaultChecked`) both work.
- Inside `Field.Root` + `Field.Label`: accessible name resolves via `getByRole("switch", { name: … })`.
- `data-size` emits `"sm"`/`"default"`; invalid Field state sets `aria-invalid` on the root.
- Form participation: `name`/`value` submit through the hidden input.

## 10 Demo requirements

Plain runnable `.tsx` demos: `switch-basic.tsx` (uncontrolled toggle), `switch-sizes.tsx` (`sm` vs `default`), `switch-states.tsx` (disabled checked/unchecked, invalid via Field), `switch-in-field.tsx` (Field.Root + Label composition, controlled), `switch-form.tsx` (name/value in a native form submit).
