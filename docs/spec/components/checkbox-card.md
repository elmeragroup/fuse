# CheckboxCard

## 1 Header

- **Canonical name**: `CheckboxCard` (single component)
- **Export path**: `@elmeragroup/ui/checkbox-card` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: labeled composite — an opinionated selectable card over the base-ui Checkbox primitive with a circle/check-circle crossfade indicator. Distinct from `CheckboxItem` (the `SelectionItem.Shell` row): CheckboxCard is a marketing/product-card surface with tags, large title, and right-content slot.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/checkbox-card.tsx` (crossfade classes from `.ref/OrderModuleInternalWeb/packages/ui/src/styles/utils.ts`)

## 2 Anatomy

Single component, fixed internal structure:

| Layer          | Base                                      | Notes                                                                                                        |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| root           | base-ui `Field.Item`                      | **requires a `Field.Root` ancestor** (and a `CheckboxGroup` primitive ancestor for `value` to mean anything) |
| card           | `Card` + `CardContent`                    | surface + `variant`/`isDisabled` recipe classes                                                              |
| label          | base-ui `Field.Label`                     | wraps control + text column; whole text area clickable                                                       |
| control        | base-ui `Checkbox.Root` (custom `render`) | 24px `Circle`→`CheckCircle` icon crossfade                                                                   |
| text column    | `div`s                                    | tags (`Badge` per tag) → title → description → `children`                                                    |
| `rightContent` | `ReactNode`                               | rendered **outside** the label — clicks there don't toggle                                                   |

```tsx
<Field.Root name="addons">
  <CheckboxGroupPrimitive value={value} onValueChange={setValue}>
    <CheckboxCard value="insurance" title="Insurance" description="Covers everything." tags={["Popular"]} />
  </CheckboxGroupPrimitive>
</Field.Root>
```

## 3 Props

`Omit<ComponentProps<CheckboxPrimitive.Root>, "render" | "disabled" | "title" | "className">` + `VariantProps<typeof checkboxCardStyles>` plus:

| Prop           | Type                     | Default      | Notes                                                                                                                           |
| -------------- | ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | `ReactNode`              | — (required) | native string `title` attr is Omit-ted so ReactNode isn't narrowed (ref comment)                                                |
| `description`  | `string`                 | — (required) | `text-sm text-pretty` line under the title                                                                                      |
| `tags`         | `string[]`               | —            | rendered as `Badge` per tag above the title; row omitted when empty/absent                                                      |
| `rightContent` | `ReactNode`              | —            | trailing slot outside the label                                                                                                 |
| `variant`      | `"default" \| "muted"`   | `"default"`  | card surface: `bg-card` / `bg-muted`                                                                                            |
| `isDisabled`   | `boolean`                | —            | recipe `opacity-75` on the card + `disabled` on the checkbox primitive (primitive `disabled` is Omit-ted from the pass-through) |
| `value`        | `string`                 | —            | checkbox group membership value                                                                                                 |
| `children`     | `ReactNode`              | —            | extra content below the description, inside the label                                                                           |
| `...other`     | checkbox primitive props | —            | spread onto `Checkbox.Root` **after** the internal `render` prop — see §8.4                                                     |

The public `CheckboxCard` surface has no `className` prop; styling axes are `variant`/`isDisabled` only (see §8.7).

## 4 Variants

- Recipe `checkboxCardStyles` (tv), **module-private** — never exported; no borrow pattern.
- Axes: `variant` (`default` → `bg-card`, `muted` → `bg-muted`; default `default`) and boolean `isDisabled` (`true` → `opacity-75`). Empty `base`.
- Indicator crossfade uses the shared `iconCrossfadeTransition` / `iconCrossfadeShown` / `iconCrossfadeHidden` class constants from `styles/utils` (kept as full class strings — the ref notes group-data arbitrary values don't emit reliably).

## 5 Consumed tokens

- `card` / `muted` — card surface per `variant`.
- `foreground` — unchecked circle icon, title, description, control text.
- `success` — checked `CheckCircle` icon color.
- `ring` — the control composes shared `focusRing({ target: "self" })`; brand-colored focus is not allowed.
- `background` — ring offset.
- Badge tokens come from the canonical `Badge` component.

## 6 Data attributes

**Emitted**: none of its own — the ref sets no `data-slot` on any layer (divergence candidate consciously not taken; kept faithful). Base-ui emits state attrs on the checkbox root (`data-checked`/`data-unchecked`, `data-disabled`) and Field.Item/Label wiring attrs.

**Consumed**: none via CSS selectors — checked visuals are driven by the `render` callback's `state.checked` boolean (JS-side crossfade class swap), not `data-checked:` variants.

## 7 Accessibility

- Base-ui `Field.Label` associates the label block with the checkbox: clicking title/description/tags/children toggles; `rightContent` sits outside the label and does not toggle.
- `role="checkbox"` with Space toggle from the base-ui primitive; the control uses the shared focus ring.
- **Field.Root-ancestor requirement (KEPT)**: `Field.Item`/`Field.Label` throw outside a base-ui `Field.Root`; CheckboxCard does not create one. Consumers must wrap in `Field.Root` (typically via `CheckboxGroup` or a form field). Documented, not fixed.
- Disabled state: `has-disabled:cursor-not-allowed` on the label, `opacity-75` card; the checkbox primitive is disabled so it is skipped in tab order.
- The icon indicator is decorative (`state.checked` swap); checked state is conveyed by `aria-checked`, not color alone plus the shape change (circle → check-circle) satisfies non-color signaling.

## 8 Divergence from reference

1. **Parity ruling recorded**: internal `CheckboxCard` is a **strict superset of the external ref's `CheckboxCardHorizontal`** — full parity, no migration action required.
2. **Icons → Phosphor**: the reference circle/check-circle namespace icons become named `Circle` / `CheckCircle` imports from `@elmeragroup/ui/icons`. **`fill` weight is permitted for the checked `CheckCircle`** (selected/active state exception per the icon conventions); the unchecked `Circle` stays regular.
3. **`checkboxCardStyles` stays module-private** — no export, consumers get `variant`/`isDisabled` only.
4. **Spread-after-render constraint KEPT and documented**: `{...other}` is spread onto `Checkbox.Root` _after_ the internal `render` prop, so a consumer-supplied `render` would override the icon indicator — which is why `render` is Omit-ted from the prop type. Net effect: **consumers cannot override the icon rendering**; the crossfade indicator is fixed. Any future custom-indicator need routes through `SelectionItem.Shell`'s `control` escape hatch instead.
5. **No renames** — `CheckboxCard` was already a single flat export; it stays a single component (no namespace).
6. **No `dark:`/`destructive` classes existed in this file** — nothing to strip; `bg-card` already canonical.
7. **Inherited reference `className` omitted (BUGFIX)**: the pinned reference type is `Omit<ComponentProps<CheckboxPrimitive.Root>, "render" | "disabled" | "title">`, so Base UI's stateful `className` (`BaseUIComponentProps`) is inherited. Because `{...other}` is spread after the internal `className`/`render`, a consumer `className` would replace required focus/layout classes. Intentionally omitted from the public surface so the only styling axes are `variant`/`isDisabled` and those classes are not replaced for typed consumers.

## 9 Test requirements

Role/label-based queries only.

- Renders `role="checkbox"` with accessible name derived from the label content (title text).
- Click on title/description toggles; click on `rightContent` (render a button there) does **not** toggle — card click-vs-slot isolation.
- Space toggles when focused; `isDisabled` removes it from tab order and blocks toggling.
- Controlled via ancestor checkbox-group primitive: `value` membership drives `aria-checked`.
- `tags` render as badges (query by text); no tag row when `tags` is empty.
- `variant="muted"` and `isDisabled` reflect in computed surface styles (browser test; no class-name assertions).
- Throws/errors without a `Field.Root` ancestor — pinned as a documented requirement (test renders inside `Field.Root` for all other cases).
- Checked state swaps the visible indicator icon (assert via `aria-checked` plus hidden/shown icon opacity in browser test).

## 10 Demo requirements

Plain runnable `.tsx` demos: `checkbox-card-basic.tsx` (title + description inside `Field.Root` + checkbox group), `checkbox-card-tags.tsx` (tags + `children` extra content), `checkbox-card-right-content.tsx` (`rightContent` with an interactive element demonstrating non-toggling slot), `checkbox-card-variants.tsx` (`default` vs `muted`, plus `isDisabled`), `checkbox-card-group.tsx` (multi-card group with controlled `string[]` value).
