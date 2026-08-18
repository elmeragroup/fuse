# PopoverInfoButton

## 1 Header

- **Canonical name**: `PopoverInfoButton` (single component; convenience composite, no namespace)
- **Export path**: `@elmeragroup/ui` (`import { PopoverInfoButton } from "@elmeragroup/ui"`)
- **Tier**: convenience composite over `Popover` + base-ui `Button` (client component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/popover-info-button.tsx`

## 2 Anatomy

| Part | Renders | Notes |
| --- | --- | --- |
| `PopoverInfoButton` | `Popover.Root > Popover.Trigger render={<Button/>} > <Info/>` + `Popover.Content` | trigger is a ghost icon button with a Phosphor `Info` glyph; `children` become the popover content |

```tsx
<Field.Label>
  {t("gridRent")}
  <PopoverInfoButton label={t("moreInformation")}>{t("gridRentExplainer")}</PopoverInfoButton>
</Field.Label>
```

Trigger uses the **render slot-merging pattern** (kept): `Popover.Trigger render={<Button …/>}` — base-ui merges trigger behavior/aria onto the Button element; no nested buttons. Content renders `side="right" sideOffset={8} showArrow`.

## 3 Props

`Omit<ComponentProps<typeof Button>, "children"> & VariantProps<typeof popoverInfoButtonStyles> & { … }` — Button props (`variant`, `size`, `disabled`, …) flow to the trigger button:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | required | popover content |
| `label` | `string` | `"More information"` | trigger `aria-label` — i18n-injectable (§8.2) |
| `size` | Button size | `"icon-sm"` | trigger button size |
| `variant` | Button variant | `"ghost"` | trigger button variant |
| `contentSize` | see §4 | `"default"` | max-width of the popover content |
| `container` | `HTMLElement` | active `ThemeScope` | overlay portal target, forwarded to `Popover.Content` per overlay conventions |

## 4 Variants

Recipe: `popoverInfoButtonStyles` — **module-private** slot recipe (`tv` slots `icon: "size-4"`, `content: "w-auto p-4 text-sm"`). Single axis:

- `contentSize`: `sm | default | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl | 7xl` → `max-w-sm` … `max-w-7xl` on the content slot (`default → max-w-md`). Default: `default`.

Trigger looks come from Button's public axis (defaults `ghost` / `icon-sm`).

## 5 Consumed tokens

None directly — the recipe is sizing-only. Colors/radii arrive via Button (`ghost` variant) and `Popover.Content` (popover surface tokens: `popover`/`popover-foreground`, `border`, shadow).

## 6 Data attributes

**Emitted**: none of its own; the trigger carries Button's + base-ui trigger state (`data-popup-open` etc. per the Popover spec), the content carries Popover.Content's.

**Consumed**: none.

## 7 Accessibility

- Trigger is `getByRole("button", { name: label })` — icon-only, named by `aria-label` (default `"More information"`, overridable for i18n).
- Popover open/close, focus, `Escape`, and outside-press dismissal are entirely base-ui Popover semantics (see popover spec §7); `aria-expanded`/`aria-haspopup` wiring is automatic via the render-merged trigger.
- The `Info` glyph is decorative (`aria-hidden`).

## 8 Divergence from reference

1. **DE-RAC (ruled)**: ref imports `Button` from `./button` (the react-aria button); ours composes base-ui `Button`. The `render` slot-merging pattern on `Popover.Trigger` is kept unchanged — only the button implementation swaps. No react-aria API surface remains.
2. **`aria-label` becomes the `label` prop (ruled divergence)**: ref hardcodes `aria-label="More information"` — baked English, and a consumer-passed `aria-label` in `{...other}` spreads *after* it (silently winning, undocumented). Ours makes it an explicit `label` prop defaulting to `"More information"`, i18n-injectable per the no-baked-English convention.
3. **Icon → Phosphor**: `Icon.Info` (lucide) → `Info` from `@elmeragroup/ui/icons`, regular weight.
4. **`container` prop added** per overlay conventions (ref exposes no portal control).
5. Kept verbatim: `ghost`/`icon-sm` defaults, `side="right" sideOffset={8} showArrow`, the `contentSize` axis and its `w-auto p-4 text-sm` content base, recipe privacy.

## 9 Test requirements

- `getByRole("button", { name: "More information" })` by default; `label` prop renames it.
- Click/Enter opens: `children` visible in the popover (`getByRole("dialog")` or popup role per Popover spec), `aria-expanded` toggles on the trigger; `Escape` closes and returns focus to the trigger.
- Exactly one button in the DOM (render slot-merge guard — no nested trigger/button).
- `contentSize` maps to the expected `max-w-*` class on the content; Button props (`variant`, `disabled`) reach the trigger.

## 10 Demo requirements

`popover-info-button-basic.tsx` (label-adjacent info button with short explainer), `popover-info-button-sizes.tsx` (`contentSize` sm/default/2xl side by side), `popover-info-button-i18n.tsx` (translated `label` + rich content).
