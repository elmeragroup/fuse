# Focusable

## 1 Header

- **Canonical name**: `Focusable` (+ `useFocusable` hook)
- **Export path**: `@elmeragroup/ui/react-aria/focusable` — re-exports `Focusable` (from `react-aria-components`), `useFocusable` and type `FocusableOptions` (from `react-aria`). `react-aria/` prefix marks the quarantined RAC dependency.
- **RSC**: client
- **Tier**: **react-aria interim** — foundational-layer atom (cluster README group 4). Notably the tier's **only consumer of `react-aria` proper** (the hooks package) in addition to `react-aria-components`; both dependencies retire together.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/focusable.tsx` (a 4-line re-export module — no styling, no wrapper logic)

## 2 Anatomy

No DOM of its own:

- `Focusable` (RAC) clones focus/hover behavior onto its single child element, making a non-interactive element focusable and hoverable — the canonical use is wrapping a tooltip/overlay trigger that isn't natively focusable (e.g. a disabled button or an icon span).
- `useFocusable(options, ref)` returns `{ focusableProps }` to spread onto a custom element.

## 3 Props

| Export         | Prop                                             | Type                                                                                                 | Notes                           |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------- |
| `Focusable`    | `children`                                       | single focusable-able React element                                                                  | receives merged props via clone |
| `Focusable`    | `isDisabled`, `autoFocus`, `excludeFromTabOrder` | `boolean`                                                                                            | RAC pass-through                |
| `useFocusable` | `options`                                        | `FocusableOptions` (`isDisabled`, `autoFocus`, `excludeFromTabOrder`, keyboard/focus event handlers) | re-exported type                |
| `useFocusable` | `ref`                                            | `RefObject<Element>`                                                                                 | target element                  |

Everything is a verbatim re-export; this spec adds no props.

## 4 Variants

None — no styling in this module.

## 5 Consumed tokens

None.

## 6 Data attributes

None emitted by this module (RAC may set `data-focused`/`data-focus-visible` on components that consume the context; not part of this surface).

## 7 Accessibility

- Ensures the wrapped element participates in the tab order (`tabIndex=0` when needed) and emits proper focus events for aria hooks (tooltips, overlays)
- `excludeFromTabOrder` keeps programmatic focusability while removing tab-stop
- The consumer remains responsible for the wrapped element's role, name, and visible focus treatment — `Focusable` adds behavior but renders no library-owned element to style. In library compositions its child must be a library interactive primitive that already composes `focusRing`; custom consumer elements must provide an equivalent visible focus indicator.

## 8 Divergence from reference

1. **Export path**: bare export → `@elmeragroup/ui/react-aria/focusable` (interim quarantine prefix).
2. Verbatim re-export otherwise — no icons, no colors, no classes to convert.
3. Dies with the tier: base-ui overlay triggers accept arbitrary render targets, removing the need for a focus-cloning wrapper. Consumers should treat this export as migration debt.

## 9 Test requirements

- Wrapping a plain `<span>` in `Focusable` makes it tabbable (`tab()` lands on it) and focus events fire
- `excludeFromTabOrder` removes the tab stop but `element.focus()` still works
- `useFocusable` returns `focusableProps` whose spread reproduces the same behavior on a custom element (browser test, role/label queries on the wrapped content)

## 10 Demo requirements

- `focusable-tooltip-trigger.tsx` — non-focusable element (disabled button wrapper) made focusable so a tooltip can open on keyboard focus
