# ToggleGroup

## 1 Header

- **Canonical name**: `ToggleGroup` — namespace compound: `ToggleGroup.Root`, `ToggleGroup.Item`
- **Export path**: `@elmeragroup/ui/toggle-group` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: base-ui composite control (a set of toggles with single or multiple selection)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/toggle-group.tsx`

## 2 Anatomy

| Part | base-ui primitive | data-slot |
| --- | --- | --- |
| `ToggleGroup.Root` | `ToggleGroup` from `@base-ui/react/toggle-group` | `toggle-group` |
| `ToggleGroup.Item` | `Toggle` from `@base-ui/react/toggle` (group-aware when inside the group) | `toggle-group-item` |

Root provides a React context (`variant`, `size`, `spacing`, `orientation`) that items consume; items borrow the public `toggleVariants` recipe from `toggle.tsx` (the sanctioned borrow pattern) and layer group-specific overrides on top.

```tsx
<ToggleGroup.Root value={align} onValueChange={setAlign} toggleMultiple={false}>
  <ToggleGroup.Item value="left" aria-label="Align left"><TextAlignLeft aria-hidden /></ToggleGroup.Item>
  <ToggleGroup.Item value="center" aria-label="Align center"><TextAlignCenter aria-hidden /></ToggleGroup.Item>
  <ToggleGroup.Item value="right" aria-label="Align right"><TextAlignRight aria-hidden /></ToggleGroup.Item>
</ToggleGroup.Root>
```

## 3 Props

### ToggleGroup.Root

`ComponentProps<typeof ToggleGroupPrimitive> & VariantProps<typeof toggleVariants> & { spacing?: number; orientation?: "horizontal" | "vertical" }` — primitive pass-through includes `value`, `defaultValue`, `onValueChange`, `toggleMultiple`, `disabled`, `loop`, `render`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"default" \| "outline"` | — (items default) | fed to context + `data-variant` |
| `size` | `"xs" \| "sm" \| "default" \| "lg"` | — (items default) | fed to context + `data-size` |
| `spacing` | `number` | `2` | Tailwind spacing units between items; `0` = segmented-control mode (see §4) |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | layout + rounding direction; emitted as `data-orientation` |
| `className` | `string` | — | merged via `cn` |

### ToggleGroup.Item

`ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>` — pass-through includes `value` (required for group selection), `disabled`, `render`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` / `size` | as above | `"default"` / `"default"` | resolved as `itemProp ?? contextValue` (§8 bugfix — the ref resolves `context ?? itemProp`) |
| `className` | `string` | — | merged after group overrides + `toggleVariants` |

Resolution rule (ruled, §8): **`itemProp ?? contextValue`** — an explicit item-level `variant`/`size` wins over the group's; the group value applies when the item doesn't specify one.

## 4 Variants

No recipe of its own — `ToggleGroup.Item` **borrows the public `toggleVariants`** (`variant`, `size` axes; see toggle spec §4). Group-level styling is plain classes plus two mechanisms:

- **Spacing CSS-var mechanism**: Root sets `style={{ "--gap": spacing }}` and `data-spacing={spacing}`; the gap class is `gap-[--spacing(var(--gap))]` (Tailwind v4 `--spacing()` function scales the raw number by the spacing scale). Items read `data-spacing` via the `group/toggle-group` scope.
- **`spacing={0}` segmented-control mode**: items collapse into one control — `rounded-none` with first/last caps restored directionally (`first:rounded-l-md`/`last:rounded-r-md` horizontal, `first:rounded-t-md`/`last:rounded-b-md` vertical), border-collapse for `outline` (`border-l-0` on all but first horizontally; `border-t-0` vertically), per-item `shadow-none` with a single `shadow-xs` moved to the Root (`data-[spacing=0]:data-[variant=outline]:shadow-xs`), press scale disabled (`active:scale-100`), tightened `px-2` + icon-padding hooks re-declared. `focus:z-10 focus-visible:z-10` keep the focus ring above collapsed neighbors.
- **Orientation**: Root is `flex flex-row items-center`; base-ui emits `data-orientation`, and `data-vertical:flex-col data-vertical:items-stretch` flips the axis. Item rounding keys off `group-data-horizontal`/`group-data-vertical`.

## 5 Consumed tokens

- Via borrowed `toggleVariants`: `muted`, `foreground`, `input`, `ring`, `error` (see toggle spec §5).
- No group-only tokens; the Root's `rounded-md` derives from `--radius`.

## 6 Data attributes

**Emitted** — Root: `data-slot="toggle-group"`, `data-variant`, `data-size`, `data-spacing`, `data-orientation` (also set by base-ui). Item: `data-slot="toggle-group-item"`, `data-variant`, `data-size` (resolved values), `data-spacing` (mirrored from context); base-ui emits `data-pressed` on selected items.

**Consumed**: items key off the Root's group scope — `group-data-[spacing=0]/toggle-group:*`, `group-data-horizontal/toggle-group:*`, `group-data-vertical/toggle-group:*`; pressed styling comes from `toggleVariants`' `data-pressed:`/`aria-pressed:` selectors.

## 7 Accessibility

- base-ui renders `role="group"`; items are toggle buttons with `aria-pressed`.
- Selection: `toggleMultiple={false}` (default) = zero-or-one pressed; `toggleMultiple` = independent multi-press. `onValueChange` always receives an array of pressed values.
- Keyboard: one tab stop; Arrow keys move focus between items (axis follows `orientation`, wraps with `loop`); Space/Enter toggle the focused item.
- Icon-only items need `aria-label`. Focus ring stays visible in segmented mode via `focus-visible:z-10`.

## 8 Divergence from reference

1. **Rename: flat → namespace** — ref exports `ToggleGroup` + `ToggleGroupItem`; ours are `ToggleGroup.Root` + `ToggleGroup.Item` per compound-component convention.
2. **BUGFIX (ruled): item-level `variant`/`size` become effective** — the ref resolves `context.variant ?? variant` (context wins). Combined with a createContext default of non-undefined values (`size: "default"`, `variant: "default"`), item props are inert whenever the Root sets the axis, and *always* inert outside a Root (the default context supplies a value); they only take effect inside a Root that leaves the axis unset (provider value `undefined`). Ours resolves **`itemProp ?? contextValue`** everywhere (item prop wins, group is the fallback), with an all-`undefined` context default so standalone items fall through to `toggleVariants` defaults.
3. **BUGFIX (ruled): dead Radix selector removed** — the ref item carries `data-[state=on]:bg-muted`, a Radix-era leftover; base-ui emits `data-pressed`, never `data-state="on"`, so the selector can never match. Removed (pressed styling already comes from `toggleVariants`).
4. `dark:`/`destructive` cleanups arrive via the borrowed `toggleVariants` (see toggle spec §8); no group-local token divergences.

## 9 Test requirements

- **Single selection** (`toggleMultiple={false}`): clicking an item presses it and unpresses the sibling; `onValueChange` receives `[value]`; clicking the pressed item empties the selection.
- **Multiple selection** (`toggleMultiple`): items toggle independently; `onValueChange` accumulates values.
- Role queries: `getByRole("group")`; items via `getByRole("button", { pressed })`.
- Keyboard: Arrow navigation between items (horizontal ←/→, vertical ↑/↓ with `orientation="vertical"`), Space/Enter toggles, single tab stop.
- Prop resolution: Root `size="sm"` + unset item → item renders sm; Root `size="sm"` + item `size="lg"` → item renders lg (the §8.2 bugfix, asserted via `data-size`).
- `spacing={0}` emits `data-spacing="0"` and `--gap: 0`; first/last items get directional cap-rounding classes.

## 10 Demo requirements

Plain runnable `.tsx` demos: `toggle-group-single.tsx` (text alignment, single select), `toggle-group-multiple.tsx` (bold/italic/underline), `toggle-group-outline-segmented.tsx` (`variant="outline" spacing={0}` segmented control), `toggle-group-vertical.tsx` (`orientation="vertical"`), `toggle-group-sizes.tsx` (group-level size with one item override).
