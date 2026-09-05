# Avatar

## 1 Header

- **Canonical name**: `Avatar` (namespace: `Avatar.Root`, `Avatar.Image`, `Avatar.Fallback`)
- **Export path**: `@elmeragroup/ui/avatar` (`import { Avatar } from "@elmeragroup/ui/avatar"`)
- **RSC**: client — base-ui Avatar owns image loading state
- **Tier**: base-ui passthrough (`@base-ui/react/avatar`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/avatar.tsx`

## 2 Anatomy

Thin styled wrappers over the base-ui Avatar parts — pure passthrough, no added state.

```tsx
<Avatar.Root>
  <Avatar.Image src={user.imageUrl} alt="" />
  <Avatar.Fallback>{initials}</Avatar.Fallback>
</Avatar.Root>
```

| Part | base-ui primitive | Notes |
| --- | --- | --- |
| `Avatar.Root` | `AvatarPrimitive.Root` | `size-8` circle, `overflow-hidden`, `select-none`; sizing overridden via `className` |
| `Avatar.Image` | `AvatarPrimitive.Image` | `size-full object-cover`; base-ui tracks load state |
| `Avatar.Fallback` | `AvatarPrimitive.Fallback` | centered flex fill; shown until/unless the image loads |

## 3 Props

All parts: `ComponentProps<typeof AvatarPrimitive.{Part}>` — full primitive passthrough (`render`, `className`, and for `Image`: `src`, `onLoadingStatusChange`; for `Fallback`: `delay`). No wrapper-added props beyond `className` merging via `cn`.

| Part | Notable passthrough | Notes |
| --- | --- | --- |
| `Avatar.Image` | `src`, `alt`, `onLoadingStatusChange` | base-ui swaps to fallback on error |
| `Avatar.Fallback` | `delay` | debounce fallback flash on fast loads |
| all | `render` | base-ui `useRender` polymorphism |

## 4 Variants

None — no tv recipe (styling is inline class strings). Size is a `className` concern (`size-8` default; consumers pass `size-10` etc.). If a size axis is ever needed it becomes a private micro-recipe, not public.

## 5 Consumed tokens

- `muted` — root fill (`bg-muted`).
- `muted-foreground` — fallback/initials text (`text-muted-foreground`).
- Shape is `rounded-full` (no radius-token arithmetic involved).

## 6 Data attributes

**Emitted**: base-ui emits its own state attributes on parts (loading status). The ref adds no `data-slot`; spec adds `data-slot="avatar" | "avatar-image" | "avatar-fallback"` per family convention (§8).

**Consumed**: none.

## 7 Accessibility

- Decorative by default: `Avatar.Image` should get `alt=""` when adjacent text names the user; a meaningful `alt` otherwise.
- `Avatar.Fallback` initials are plain text and read as-is — fine when adjacent to the full name; otherwise give the root an `aria-label`.
- Non-interactive; no keyboard or focus behavior.

## 8 Divergence from reference

1. **Namespace rename**: flat `AvatarRoot`/`AvatarImage`/`AvatarFallback` → `Avatar.Root`/`.Image`/`.Fallback`.
2. **Raw palette → tokens (ruled)**: the ref root uses `bg-gray-200 text-gray-700` — the only raw palette classes in the internal ref's base-ui set — replaced with `bg-muted text-muted-foreground` per `no-primitive-colors`.
3. **`data-slot` attributes added** (ref emits none on these parts).

Pure base-ui passthrough otherwise — no prop or behavior divergence.

## 9 Test requirements

- With a loading/failed image, `Avatar.Fallback` content is visible (`getByText(initials)`); once the image loads, the `img` role is present and fallback hidden (drive via `onLoadingStatusChange`/mocked image).
- `Avatar.Image` renders `getByRole("img")` with the given `alt`.
- Parts emit their `data-slot` values.
- Root classes contain `bg-muted` and never `bg-gray-*` (token regression guard).
- `className` on root overrides size (`size-10` beats default `size-8` via `cn`).

## 10 Demo requirements

Plain runnable `.tsx` demos: `avatar-basic.tsx` (image + initials fallback), `avatar-fallback.tsx` (broken src, `delay` on fallback), `avatar-sizes.tsx` (className-driven `size-6/8/10/12`), `avatar-group.tsx` (overlapping stack via consumer classes — no library API).
