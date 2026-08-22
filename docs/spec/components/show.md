# Show

## 1 Header

- **Canonical name**: `Show` (single component; control-flow helper, no namespace)
- **Export path**: `@elmeragroup/ui/show` (also re-exported from `@elmeragroup/ui`)
- **RSC**: server
- **Tier**: render helper — no DOM of its own, no state, server-component safe
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/show.tsx`

## 2 Anatomy

No parts, no wrapper element: returns `<>{children}</>` when `when` is true, `null` otherwise.

```tsx
<Show when={items.length > 0}>
  <ResultList items={items} />
</Show>
```

## 3 Props

| Prop       | Type        | Default  | Notes                                                                                           |
| ---------- | ----------- | -------- | ----------------------------------------------------------------------------------------------- |
| `when`     | `boolean`   | required | render condition (strict boolean — callers coerce, e.g. `items.length > 0`, not `items.length`) |
| `children` | `ReactNode` | —        | rendered inside a fragment when `when` is true                                                  |

**Eager evaluation (documented)**: `children` is an ordinary prop — the JSX (and any expressions inside it) is **evaluated by the parent before** `Show` decides anything; only _rendering_ is skipped. Guarding expressions that throw when the condition is false (`data!.name`) is not safe here — use an inline ternary or optional chaining. A Solid-style render-prop overload (`children: () => ReactNode`) was considered and **NOT added** — kept minimal (§8).

## 4 Variants

None.

## 5 Consumed tokens

None — renders no element.

## 6 Data attributes

None emitted or consumed.

## 7 Accessibility

Transparent: contributes nothing to the accessibility tree; semantics are entirely the children's. Note that mounting children via `Show` triggers the same live-region behavior as conditional JSX (relevant when wrapping `role="alert"` content).

## 8 Divergence from reference

1. Verbatim port — one-line helper kept exactly (`when ? <>{children}</> : null`).
2. **NOT added (ruled)**: lazy `children` render-prop alternative and a Solid-style `fallback` prop — kept minimal; eager evaluation is documented in §3 instead.

## 9 Test requirements

- `when={true}` renders children; `when={false}` renders nothing (container empty).
- Renders no wrapper element of its own (children are direct siblings in the DOM).
- Type test: `when` accepts only `boolean` (no truthy coercion at the type level).

## 10 Demo requirements

`show-basic.tsx` (toggle-driven conditional block, contrasted with an inline ternary and a comment noting the eager-evaluation caveat).
