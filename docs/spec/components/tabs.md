# Tabs

## 1 Header

- **Canonical name**: `Tabs` — namespace compound: `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`
- **Export path**: `@elmeragroup/ui/tabs` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: base-ui composite (tabbed panel switcher)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/tabs.tsx`

## 2 Anatomy

| Part           | base-ui primitive                      | data-slot      |
| -------------- | -------------------------------------- | -------------- |
| `Tabs.Root`    | `Tabs.Root` from `@base-ui/react/tabs` | `tabs`         |
| `Tabs.List`    | `Tabs.List`                            | `tabs-list`    |
| `Tabs.Trigger` | `Tabs.Tab`                             | `tabs-trigger` |
| `Tabs.Content` | `Tabs.Panel`                           | `tabs-content` |

Root establishes the `group/tabs` Tailwind group scope; List establishes `group/tabs-list`. Triggers style themselves off both scopes (orientation from `group/tabs`, list variant from `group/tabs-list`) — this two-group coupling is kept as-is (§8).

```tsx
<Tabs.Root defaultValue="account">
  <Tabs.List>
    <Tabs.Trigger value="account">Account</Tabs.Trigger>
    <Tabs.Trigger value="password">Password</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="account">…</Tabs.Content>
  <Tabs.Content value="password">…</Tabs.Content>
</Tabs.Root>
```

## 3 Props

### Tabs.Root

`ComponentProps<typeof TabsPrimitive.Root>` — pass-through includes `value`, `defaultValue`, `onValueChange`, `orientation`, `render`.

| Prop          | Type                         | Default        | Notes                                                                                                   |
| ------------- | ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | destructured locally so `data-orientation` renders pre-hydration (SSR); also forwarded to the primitive |
| `className`   | `string`                     | —              | merged via `cn` onto `group/tabs flex gap-2 data-horizontal:flex-col`                                   |

### Tabs.List

`ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>` — pass-through includes `loop`, `render`.

| Prop        | Type                  | Default     | Notes                                                |
| ----------- | --------------------- | ----------- | ---------------------------------------------------- |
| `variant`   | `"default" \| "line"` | `"default"` | emitted as `data-variant`; fed to `tabsListVariants` |
| `className` | `string`              | —           | merged via `cn`                                      |

### Tabs.Trigger

`ComponentProps<typeof TabsPrimitive.Tab>` — pass-through includes `value` (required to pair with a panel), `disabled`, `render`. `className` merged via `cn`.

### Tabs.Content

`ComponentProps<typeof TabsPrimitive.Panel>` — pass-through includes `value`, `keepMounted`, `render`. `className` merged onto `flex-1 text-sm` plus `focusRing({ target: "self" })`; base-ui gives the open panel `tabIndex={0}`.

## 4 Variants

**Recipe: `tabsListVariants` — PUBLIC** (the ref exports it; kept exported for the borrow pattern).

- Base: `group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-(--control-h-md) group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none`

**Density mapping.** Horizontal Tabs.List is a single-height field box pinning the `md` rung (`group-data-horizontal/tabs:h-(--control-h-md)`). Vertical lists stay `h-fit` (content-sized, not a control box). `p-[3px]` is optical track padding, not `--control-px-*`. Triggers fill that height (`h-[calc(100%-1px)]`) and read the `md` rung for inline padding, icon-edge padding, gap, and the control-type pair; `py-*` is not set. No `size` axis and no `dense:` / `comfortable:` variants. _(Amended 2026-09-02: trigger padding/type tokenized; `p-[3px]` remains the documented list exemption.)_

- Axis `variant`: `default` → `bg-muted` (filled pill list); `line` → `gap-1 bg-transparent` (underline style). Default: `default`.

Trigger styling is plain classes (no recipe): active tab gets `data-active:bg-background data-active:text-foreground` plus `shadow-sm` under `variant="default"`; under `variant="line"` the background/shadow are suppressed and an `after:` pseudo-element underline (`after:bg-foreground`, `h-0.5` below in horizontal, `w-0.5` at right edge in vertical) fades in via `data-active:after:opacity-100`.

## 5 Consumed tokens

`muted`, `muted-foreground`, `foreground` (incl. `text-foreground/60` resting trigger), `background` (active trigger fill), `ring` through the shared self-focus recipe on both triggers and the open panel. `rounded-lg`/`rounded-md` derive from `--radius`.

## 6 Data attributes

**Emitted** — Root: `data-slot="tabs"`, `data-orientation` (component-set pre-hydration; base-ui also emits `data-horizontal`/`data-vertical`). List: `data-slot="tabs-list"`, `data-variant`. Trigger: `data-slot="tabs-trigger"`; base-ui emits `data-active`, `data-disabled`, `data-highlighted`. Content: `data-slot="tabs-content"`; base-ui emits `data-active`, `data-hidden`.

**Consumed** — List reads Root's orientation via `group-data-horizontal/tabs:` / `group-data-vertical/tabs:`; Trigger reads both `group-data-*/tabs:` (orientation) and `group-data-[variant=…]/tabs-list:` (list variant), plus its own `data-active` and `has-data-[icon=inline-start/end]` padding hooks.

## 7 Accessibility

- base-ui wires `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`, `aria-controls`/`aria-labelledby` pairing automatically.
- Keyboard: one tab stop on the list; Arrow keys move and activate tabs (←/→ horizontal, ↑/↓ vertical per `orientation`); Home/End jump to first/last.
- Disabled triggers: `disabled:`/`aria-disabled:` both render `pointer-events-none opacity-50`. Base-ui deliberately keeps disabled tabs in the roving-focus sequence but does not activate them.
- Triggers and panels both compose `focusRing({ target: "self" })`. This is required for panels: the open base-ui panel has `tabIndex={0}` and is a keyboard tab stop.

## 8 Divergence from reference

1. **Rename: flat → namespace** — ref exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`; ours are `Tabs.Root/.List/.Trigger/.Content` per compound-component convention.
2. **All `dark:` classes dropped** (`no-tailwind-dark-variant`; dark axis lives in tokens). The trigger is heavy on these — removed verbatim: `dark:text-muted-foreground`, `dark:hover:text-foreground`, `dark:group-data-[variant=line]/tabs-list:data-active:border-transparent`, `dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent`, `dark:data-active:border-input`, `dark:data-active:bg-input/30`, `dark:data-active:text-foreground`. No `dark:` classes elsewhere in the file.
3. **KEPT: two-group coupling** — the `group/tabs` (orientation) + `group/tabs-list` (variant) scopes and the trigger's cross-scope selectors are retained unchanged; it is the mechanism that lets one trigger class string serve both list variants and both orientations.
4. **KEPT: redundant pre-hydration `data-orientation`** — Root sets `data-orientation={orientation}` explicitly even though base-ui emits it, so SSR markup carries orientation before hydration and the `data-horizontal:flex-col` layout class applies on first paint. Documented as deliberate, not dead code.
5. **KEPT: `tabsListVariants` stays public** — exported from the package as in the ref.
6. **Panel focus fixed:** the ref's unconditional `outline-none` on `Tabs.Content` is removed and the shared self-focus recipe is composed. The pinned base-ui primitive sets the open panel to `tabIndex={0}`, so suppressing its outline without replacement violated the cluster focus contract.
7. **Density retokenization:** horizontal list `h-9` pins `--control-h-md`. Vertical `h-fit` is unchanged.

## 9 Test requirements

- Role queries only: `getByRole("tablist")`, `getByRole("tab", { selected })`, `getByRole("tabpanel")`.
- Clicking a tab activates it: `aria-selected="true"`, matching panel visible, previous panel hidden.
- **Arrow-key activation**: focus the tablist, ArrowRight moves to and activates the next tab (base-ui activate-on-focus), ArrowLeft back; Home/End reach first/last.
- **Orientation**: `orientation="vertical"` → `data-orientation="vertical"` on Root, ↑/↓ drive navigation instead of ←/→.
- Disabled trigger can receive roving keyboard focus but does not activate; click likewise cannot activate it.
- Tabbing from the active trigger reaches the open `tabpanel`; keyboard focus on that panel renders the shared focus ring.
- `variant="line"` list emits `data-variant="line"`; active trigger has no `bg-background` (asserted via class/data-attr, not screenshots).
- Dual-density: horizontal list height matches the signed `md` rung at `dense` and `comfortable`; vertical `h-fit` is content-sized at both stamps; nested `data-density` does not rescope.

## 10 Demo requirements

Plain runnable `.tsx` demos: `tabs-basic.tsx` (two-tab default variant), `tabs-line.tsx` (`variant="line"` underline style), `tabs-vertical.tsx` (`orientation="vertical"`), `tabs-with-icons.tsx` (icon + label triggers), `tabs-disabled.tsx` (one disabled trigger).
