# GridList

## 1 Header

- **Canonical name**: `GridList` / `GridListItem` (flat pair, kept as the ref exports them — no namespace for the interim)
- **Export path**: `@elmeragroup/ui/react-aria/grid-list` — exports `GridList`, `GridListItem`. `react-aria/` prefix is the quarantine marker for the remaining RAC dependency.
- **RSC**: client
- **Tier**: **react-aria interim**. One of the two facet-filter remnants (with SearchField) — the Autocomplete/filter toolbars still run on RAC; migration is deferred until the listbox/filter rewrite (per the react-aria cluster README).
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/grid-list.tsx` (+ `styles/checkbox.ts`, `styles/utils.ts` `focusRing`, `react-aria/utils.ts` `composeTailwindRenderProps`)

## 2 Anatomy

```
AriaGridList data-slot="grid-list"          (role="grid"; empty-state centering via data-empty)
└─ AriaGridListItem data-slot="grid-list-item"  (role="row" > gridcell; itemStyles = tv extend focusRing)
   ├─ internal RAC Button slot="drag"        — Phosphor `DotsSixVertical`, locale `gridList.drag` name; only when allowsDragging
   ├─ Checkbox slot="selection"              — only when selectionMode !== "none" && selectionBehavior === "toggle"
   │  └─ box div + Check / Minus             (named icon imports; module-private RAC Checkbox styled by checkboxVariants)
   └─ children (render props composed)
```

The internal `Checkbox` exists solely because RAC GridList requires RAC's `<Checkbox slot="selection">`; it is not exported.

## 3 Props

| Part         | Prop                                                                                         | Type                               | Default    | Notes                                                |
| ------------ | -------------------------------------------------------------------------------------------- | ---------------------------------- | ---------- | ---------------------------------------------------- |
| GridList     | `items` / `children`                                                                         | RAC collection API                 | —          | static or dynamic collection                         |
| GridList     | `selectionMode`                                                                              | `"none" \| "single" \| "multiple"` | `"none"`   |                                                      |
| GridList     | `selectionBehavior`                                                                          | `"toggle" \| "replace"`            | `"toggle"` | toggle shows the selection checkbox                  |
| GridList     | `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange`                                 | RAC                                | —          |                                                      |
| GridList     | `disabledKeys`, `disallowEmptySelection`, `onAction`, `renderEmptyState`, `dragAndDropHooks` | RAC                                | —          | pass-through                                         |
| GridListItem | `id`, `textValue`, `isDisabled`, `onAction`, `href`                                          | RAC                                | —          | `textValue` auto-derived when `children` is a string |

Both parts accept `className` (string or render-prop function, composed via `composeTailwindRenderProps` / tv).

## 4 Variants

- `itemStyles` — module-private tv, composes `focusRing({ target: "state", isFocusVisible })`; boolean axes `isSelected` (false: `hover:bg-muted`; true: `z-20 border bg-muted hover:bg-muted/80`) and `isDisabled` (`z-10 text-muted-foreground`)
- Internal Checkbox uses `checkboxVariants` (shared slot recipe, private) with axes `isSelected`, `isDisabled`, `isInvalid`, `isFocusVisible`

## 5 Consumed tokens

`bg-muted` (hover/selected rows), `text-muted-foreground` (disabled rows), `ring` + `background` (shared `focusRing`), `border` default token; checkbox slot: `bg-primary`/`border-primary` (selected), `bg-background`, `border` (`--border`), `text-primary-foreground` (icon), `border-error` (invalid, renamed §8). Forced-colors system colors (`GrayText`, `Highlight`, `Mark`) kept.

## 6 Data attributes

- Emitted: `data-slot="grid-list"`, `data-slot="grid-list-item"`; RAC emits `data-empty` (list), `data-hovered`, `data-selected`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-pressed`, `data-dragging` (items/checkbox)
- Consumed: the list's `empty:flex empty:items-center …` classes target RAC `data-empty` (ref spelled via the `tailwindcss-react-aria-components` plugin; rewritten as explicit `data-[empty]:` variants, §8)

## 7 Accessibility

- RAC GridList semantics: `role="grid"` with rows/gridcells; selection checkbox is announced per row; `textValue` feeds typeahead
- Keyboard: Arrow Up/Down move row focus; Space toggles selection (Enter fires `onAction` when set); Ctrl/Cmd+A selects all in multiple mode; Escape clears selection (unless `disallowEmptySelection`); typeahead by `textValue`
- Drag button (`slot="drag"`) is the package-private RAC Button (ghost `icon-sm`, shared focus ring) with Phosphor `DotsSixVertical` and the localized `gridList.drag` accessible name; it receives keyboard drag semantics from RAC when `dragAndDropHooks` is supplied. _(Amended 2026-09-02.)_

## 8 Divergence from reference

1. **Export path**: bare export → `@elmeragroup/ui/react-aria/grid-list` (interim quarantine prefix).
2. **Icons**: the ref imports `Check` / `Minus` **directly from `lucide-react`** — swapped to curated Phosphor `Check` / `Minus` from `@elmeragroup/ui/icons`, regular weight. The drag handle uses Phosphor `DotsSixVertical` (added to the curated roster 2026-09-02) instead of the ref's `≡` text glyph, on the package-private RAC Button so the shared focus ring applies.
3. **Raw colors converted** (all inside the shared `checkboxVariants` this module consumes): `text-gray-400` / `text-gray-300` (disabled icon/label) → `text-muted-foreground`; `--color-gray-200` (disabled box) → `var(--border)`; `gray.500` pressed border → `border` token; `theme(colors.primary/success/destructive.DEFAULT)` arbitrary values → plain token utilities. `grid-list.tsx` itself has no raw colors.
4. **destructive → error**: checkbox invalid state `colors.destructive.DEFAULT` → `error` token. No `dark:`/`inverted:` variants present in this module.
5. `empty:` plugin variants rewritten as explicit `data-[empty]:` (drops `tailwindcss-react-aria-components`).
6. Family-wide: **list-box is RETIRED** — the dead internal copy is deleted; the external partner-list consumer migrates to `Item.Group`/`Item`; `DropdownListBox*` is absorbed by base-ui Select/Combobox. GridList records this here because it shares the facet-filter rewrite destiny: when the listbox/filter rewrite lands, this module goes with it.

7. **Dead `variant: "success"` axis removed from `checkboxVariants`** (2026-09-03, ticket 44): the axis and its two `isSelected` compounds came across from the ref, but this module's only `<Checkbox slot="selection" />` never passes a variant, so no rendered checkbox ever reached the arm. The axis, the compounds and the private wrapper's `variant?: "success"` prop are gone; the emitted classes for every selected/disabled/invalid/focus combination are unchanged.

## 9 Test requirements

- `getByRole("grid")` / `getAllByRole("row")` render from both static and `items` collections
- `selectionMode="multiple"` + toggle: row checkboxes appear (`getAllByRole("checkbox")`), Space toggles, `onSelectionChange` receives keys; Ctrl/Cmd+A selects all
- Arrow-key navigation moves focus between rows; typeahead focuses matching `textValue`
- `disabledKeys` rows expose `aria-disabled` and refuse selection; `renderEmptyState` content centers when the collection is empty
- Drag handle: with `dragAndDropHooks`, `getByRole("button", { name })` finds the handle in every locale; the shared focus-ring helper passes on keyboard focus and is absent on mouse focus
- Dual-density: the drag handle follows the signed `sm` rung at both stamps, while row padding — not a control-box rung per §4 — is identical across them; the shared focus-ring helper runs at both stamps. _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

- `grid-list-selection.tsx` — multiple selection with checkboxes and a disabled row
- `grid-list-empty.tsx` — `renderEmptyState` with the centered empty styling
