# Sidebar

## 1 Header

- **Canonical name**: `Sidebar` (namespace compound) + `useSidebar` hook
- **Export path**: `@elmeragroup/ui/sidebar` (also re-exported from `@elmeragroup/ui`) — exports `Sidebar`, `useSidebar`, and the documented constants; `useIsMobile` is package-private
- **Tier**: composed application-shell component (context provider + 23 parts; largest component in the library)
- **RSC**: client (context provider, open/mobile state, cookie writes, window keydown listener, `matchMedia`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/sidebar.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/hooks/use-is-mobile.ts`

## 2 Anatomy

Not a base-ui primitive wrapper — a composed shell built from plain elements, our `Input`, our `Separator`, `Skeleton`, `Sheet` (mobile branch), and `Tooltip` (collapsed icon-mode labels). Five parts are **`useRender`-based** (polymorphic via `render` + `mergeProps`, per conventions): `GroupLabel`, `GroupAction`, `MenuButton`, `MenuAction`, `MenuSubButton` — these are the library's convention exemplars for `useRender` composition.

| Part                                | Base                                                                   | Notes                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar.Provider`                  | `SidebarContext.Provider > div`                                        | owns open state, cookie persistence, cmd/ctrl+B shortcut; wrapper div sets `--sidebar-width`/`--sidebar-width-icon` inline and `group/sidebar-wrapper`                                                                    |
| `Sidebar.Root`                      | `div` (desktop) / `Sheet` (mobile) / bare `div` (`collapsible="none"`) | three render branches, see §3; desktop branch = outer `group peer` div > `sidebar-gap` spacer + fixed `sidebar-container` > `sidebar-inner` (the `bg-sidebar` surface)                                                    |
| `Sidebar.Trigger`                   | `Button variant="ghost" size="icon-sm"` (§8.5)                         | toggles via context; Phosphor `SidebarSimple` icon + localized sr-only label                                                                                                                                              |
| `Sidebar.Rail`                      | `button`                                                               | invisible 4px grab strip on the sidebar edge; click toggles; `tabIndex={-1}` + `aria-hidden`, localized `title`; direction-aware resize cursors                                                                           |
| `Sidebar.Inset`                     | `main`                                                                 | the content area sibling; `peer-data-[variant=inset]:` margins/rounding/shadow react to Root's peer attrs                                                                                                                 |
| `Sidebar.Input`                     | library `Input`                                                        | `h-8 w-full bg-background shadow-none` on top of the field box (shared `focusRing`); typed as `ComponentProps<"input">` (string `className`) because base-ui's `className` can be a render-prop function `cn` can't merge |
| `Sidebar.Header` / `Sidebar.Footer` | `div`                                                                  | `flex flex-col gap-2 p-2`                                                                                                                                                                                                 |
| `Sidebar.Separator`                 | our `Separator`                                                        | `mx-2 w-auto bg-sidebar-border`; import pinned to the canonical base-ui separator; spread order matters (§8.8)                                                                                                            |
| `Sidebar.Content`                   | `div`                                                                  | the scroll region: `no-scrollbar min-h-0 flex-1 overflow-auto`, `overflow-hidden` in icon mode                                                                                                                            |
| `Sidebar.Group`                     | `div`                                                                  | `relative flex w-full min-w-0 flex-col p-2`                                                                                                                                                                               |
| `Sidebar.GroupLabel`                | `useRender` div                                                        | fades/collapses away in icon mode (`-mt-8 opacity-0`)                                                                                                                                                                     |
| `Sidebar.GroupAction`               | `useRender` button                                                     | absolute top-right of group; hidden in icon mode; `size-6` box (24 px floor) plus `after:-inset-2` at every breakpoint                                                                                                    |
| `Sidebar.GroupContent`              | `div`                                                                  | `w-full text-sm`                                                                                                                                                                                                          |
| `Sidebar.Menu`                      | `ul`                                                                   | `flex w-full min-w-0 flex-col gap-0`                                                                                                                                                                                      |
| `Sidebar.MenuItem`                  | `li`                                                                   | `group/menu-item relative`                                                                                                                                                                                                |
| `Sidebar.MenuButton`                | `useRender` button (+ Tooltip wrap)                                    | the workhorse; recipe §4; tooltip composition §3                                                                                                                                                                          |
| `Sidebar.MenuAction`                | `useRender` button                                                     | absolute right action; `showOnHover`; position tracks button size via `peer-data-[size=*]/menu-button`                                                                                                                    |
| `Sidebar.MenuBadge`                 | `div`                                                                  | `pointer-events-none` absolute right badge, tabular-nums; hidden in icon mode; same size-tracking peers                                                                                                                   |
| `Sidebar.MenuSkeleton`              | `div` + 2× `Skeleton`                                                  | loading row; optional icon; deterministic text width (§8.4)                                                                                                                                                               |
| `Sidebar.MenuSub`                   | `ul`                                                                   | indented, `border-l border-sidebar-border`; hidden in icon mode                                                                                                                                                           |
| `Sidebar.MenuSubItem`               | `li`                                                                   | `group/menu-sub-item relative`                                                                                                                                                                                            |
| `Sidebar.MenuSubButton`             | `useRender` **a**                                                      | default tag is `<a>` (nav links), not button                                                                                                                                                                              |
| `Sidebar.Icon`                      | `div`                                                                  | ref addition (no shadcn equivalent): centers a brand icon in the footer, full width in icon mode                                                                                                                          |

```tsx
<Sidebar.Provider defaultOpen={cookieOpen}>
  <Sidebar.Root collapsible="icon">
    <Sidebar.Header>…</Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Funnel</Sidebar.GroupLabel>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton isActive tooltip="Orders" render={<a href="/orders" />}>
              <Package />
              <span>Orders</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer>
      <Sidebar.Icon>…</Sidebar.Icon>
    </Sidebar.Footer>
    <Sidebar.Rail />
  </Sidebar.Root>
  <Sidebar.Inset>
    <Sidebar.Trigger />
    {children}
  </Sidebar.Inset>
</Sidebar.Provider>
```

### Constants (module-level, documented contract)

| Constant                    | Value              | Notes                                                                                                                                                                                                                                  |
| --------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIDEBAR_COOKIE_NAME`       | `"sidebar:state"`  | **HARD invariant** — funnel's `layout.tsx` server-reads `cookieStore.get("sidebar:state")` for SSR open-state. The shadcn template's `sidebar_state` would silently break it. Keep the colon name; exported/documented constant (§8.6) |
| `SIDEBAR_COOKIE_MAX_AGE`    | `60 * 60 * 24 * 7` | 7 days                                                                                                                                                                                                                                 |
| `SIDEBAR_WIDTH`             | `16rem`            | desktop, via `--sidebar-width` on the Provider wrapper                                                                                                                                                                                 |
| `SIDEBAR_WIDTH_MOBILE`      | `18rem`            | mobile Sheet override of `--sidebar-width`                                                                                                                                                                                             |
| `SIDEBAR_WIDTH_ICON`        | `3rem`             | icon-collapsed width, via `--sidebar-width-icon`                                                                                                                                                                                       |
| `SIDEBAR_KEYBOARD_SHORTCUT` | `"b"`              | with `metaKey                                                                                                                                                                                                                          |     | ctrlKey`(cmd/ctrl+B),`preventDefault`, window-level listener |

### `useSidebar()` context surface

Throws `"useSidebar must be used within a SidebarProvider."` outside the provider. Returns:

| Field                          | Type                                                      | Notes                                                         |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| `state`                        | `"expanded" \| "collapsed"`                               | derived from `open`                                           |
| `open`                         | `boolean`                                                 | desktop open state (controlled or internal)                   |
| `setOpen`                      | `(open: boolean \| ((open: boolean) => boolean)) => void` | writes the cookie on every call; type fixed vs ref (§8.3)     |
| `openMobile` / `setOpenMobile` | `boolean` / React state setter                            | mobile Sheet state; not cookie-persisted                      |
| `isMobile`                     | `boolean`                                                 | from `useIsMobile()`                                          |
| `toggleSidebar`                | `() => void`                                              | toggles `openMobile` on mobile, `setOpen(o => !o)` on desktop |

### Private `useIsMobile()`

Package-private implementation detail: `matchMedia("(max-width: 767px)")` against a 768px breakpoint; state starts `undefined` and is coerced with `Boolean(...)`, so SSR and first client render report `false`. It is imported only by Sidebar source and is absent from every public entry.

## 3 Props

All parts take `className` (merged via `cn`) and forward remaining props to their underlying element. `useRender` parts additionally take `render`.

**Sidebar.Provider** — `ComponentProps<"div">` plus:

| Prop           | Type                                                              | Default           | Notes                                                                                                  |
| -------------- | ----------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `defaultOpen`  | `boolean`                                                         | `true`            | uncontrolled initial state; SSR pattern: parse the `sidebar:state` cookie server-side and pass it here |
| `open`         | `boolean`                                                         | —                 | controlled                                                                                             |
| `onOpenChange` | `(open: boolean) => void`                                         | —                 | controlled setter; when provided, internal state is bypassed but the cookie is still written           |
| `labels`       | `Partial<{ toggle: string; title: string; description: string }>` | locale dictionary | copy overrides; stored in private context for Root, Trigger, and Rail                                  |

**Sidebar.Root** — `ComponentProps<"div">` plus:

| Prop          | Type                                 | Default       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `side`        | `"left" \| "right"`                  | `"left"`      | emits `data-side`; drives gap rotation, container left/right offsets, border side, rail cursors                                                                                                                                                                                                                                                                                                                                                                           |
| `variant`     | `"sidebar" \| "floating" \| "inset"` | `"sidebar"`   | `floating`: `p-2` + rounded/shadow/ring inner; `inset`: `p-2` + sibling `Sidebar.Inset` gets margins/rounding via peer selectors; `sidebar`: flush with `border-r`/`border-l`                                                                                                                                                                                                                                                                                             |
| `collapsible` | `"offcanvas" \| "icon" \| "none"`    | `"offcanvas"` | `offcanvas`: gap collapses to 0, container slides off-screen; `icon`: collapses to `--sidebar-width-icon` (+ padding/2px for floating/inset); `none`: static branch — but **still emits `group peer` + `data-state/variant/side`** (deliberate funnel deviation from the shadcn template: the wizard dialogs use `variant="inset" collapsible="none"` and rely on `Sidebar.Inset`'s `peer-data-[variant=inset]:` and the wrapper's `has-data-[variant=inset]:bg-sidebar`) |
| `dir`         | `string`                             | —             | forwarded to `SheetContent` in the mobile branch (RTL)                                                                                                                                                                                                                                                                                                                                                                                                                    |

Mobile branch (when `isMobile` and `collapsible !== "none"`): renders `Sheet` (`side`, `open={openMobile}`, `onOpenChange={setOpenMobile}`) > `SheetContent` with `data-mobile="true"`, `showCloseButton={false}`, `--sidebar-width: 18rem` inline, `w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground`, a locale-labeled sr-only SheetHeader, and children in a full-height column. Caller `className` is merged onto `SheetContent` (§8.2 bugfix); remaining `...props` spread onto the Sheet root. Desktop collapse state is irrelevant on mobile; `openMobile` is session-only.

SSR pattern (the funnel contract this component exists to serve):

```tsx
// app/layout.tsx (server)
const open = (await cookies()).get("sidebar:state")?.value !== "false";
<Sidebar.Provider defaultOpen={open}>…</Sidebar.Provider>;
```

**Sidebar.Trigger** — `ComponentProps<typeof Button>`; `onClick` runs before `toggleSidebar()`.
**Sidebar.Rail** — `ComponentProps<"button">`.
**Sidebar.Inset** — `ComponentProps<"main">`. **Sidebar.Input** — `ComponentProps<"input">`.
**Sidebar.Header / Footer / Content / Group / GroupContent / MenuBadge / Icon** — `ComponentProps<"div">`. **Sidebar.Separator** — `ComponentProps<typeof Separator>`.
**Sidebar.Menu / MenuSub** — `ComponentProps<"ul">`. **Sidebar.MenuItem / MenuSubItem** — `ComponentProps<"li">`.
**Sidebar.GroupLabel** — `useRender.ComponentProps<"div">`. **Sidebar.GroupAction** — `useRender.ComponentProps<"button">`.

**Sidebar.MenuButton** — `useRender.ComponentProps<"button"> & VariantProps<typeof sidebarMenuButtonVariants>` plus:

| Prop       | Type                                               | Default     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isActive` | `boolean`                                          | `false`     | emits `data-active` (via `useRender` state), styled `bg-sidebar-accent font-medium text-sidebar-accent-foreground`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `variant`  | `"default" \| "outline"`                           | `"default"` | §4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `size`     | `"default" \| "sm" \| "lg"`                        | `"default"` | §4; also emitted as `data-size` for MenuAction/MenuBadge positioning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tooltip`  | `string \| ComponentProps<typeof Tooltip.Content>` | —           | collapsed-mode label. **Nested render composition** (the exemplar): with `tooltip` set, the button's `render` becomes `<Tooltip.Trigger render={render} />` — the caller's render element is threaded _through_ the trigger, so one DOM node is simultaneously the menu button, the caller's anchor/link, and the tooltip trigger. The whole thing wraps in `<Tooltip>` with `<Tooltip.Content side="right" align="center" hidden={state !== "collapsed" \|\| isMobile} {...tooltip} />` — the tooltip exists always but is only _visible_ when collapsed on desktop. String tooltip shorthand becomes `{ children: tooltip }` |

**Sidebar.MenuAction** — `useRender.ComponentProps<"button">` plus:

| Prop          | Type      | Default | Notes                                                                                                 |
| ------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `showOnHover` | `boolean` | `false` | `md:opacity-0` until menu-item hover/focus-within or `aria-expanded` (open dropdown keeps it visible) |

**Sidebar.MenuSkeleton** — `ComponentProps<"div">` plus `showIcon?: boolean` (default `false`).

**Sidebar.MenuSubButton** — `useRender.ComponentProps<"a">` plus:

| Prop       | Type           | Default | Notes                                                                                                                           |
| ---------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `size`     | `"sm" \| "md"` | `"md"`  | emitted as `data-size`; `md` reads `--control-h-md` + the control-type pair; `sm` reads `--control-h-sm` + size-owned `text-sm` |
| `isActive` | `boolean`      | `false` | emits `data-active`; accent background + foreground                                                                             |

## 4 Variants

`sidebarMenuButtonVariants` — `tv` recipe, **module-private** (micro-recipe; no borrow pattern).

- **Base** (ref's template strings verbatim, `cva`→`tv`): `peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm` + sidebar-token hover/active/focus states, `disabled:`/`aria-disabled:` opacity-50 + pointer-events-none, `data-open:hover:` (open dropdown anchored on the button keeps hover styling), `data-active:` styling, `group-has-data-[sidebar=menu-action]/menu-item:pr-8` in the ref (§8.1 rewrites this selector to `data-slot`), icon-mode clamp `group-data-[collapsible=icon]:size-8! p-2!`, `[&_svg]:size-4`, `[&>span:last-child]:truncate`. Collapse motion is `transition-[color,background-color,box-shadow]` — not width/height/padding _(amended 2026-09-02)_.
- **Axis `variant`** (default `"default"`): `default` — accent hover; `outline` — `bg-background shadow-[0_0_0_1px_var(--sidebar-border)]`, hover swaps the ring to `var(--sidebar-accent)`.
- **Axis `size`** (default `"default"`): `default` `h-8 text-sm` · `sm` `h-7 text-xs` · `lg` `h-12 text-sm group-data-[collapsible=icon]:p-0!`.

`sidebarMenuSubButtonVariants` — `tv` recipe, **module-private**. Size axis reads the control ladder: `md` (default) `h-(--control-h-md)` + the control-type pair; `sm` `h-(--control-h-sm)` + size-owned `text-sm`. Dual-density tests assert these heights against the signed `--control-*` rungs. _(Added 2026-09-02.)_

**Density exemption — sidebar chrome.** The menu-button ladder (`h-8` / `h-7` / `h-12`) and `Sidebar.Input`'s `h-8` are shell-local layout metrics for a navigation rail, not the four-rung control box. They do not map onto `xs`/`sm`/`md`/`lg` and **must not** become a second `--control-*` ladder. Dual-density tests assert these heights stay identical across `dense` and `comfortable` stamps. Icon-mode `size-8!` is the same exemption. `MenuSubButton` is **not** in this exemption.

Root's three branches are conditional class composition, not `tv` axes.

### Desktop layout mechanics (kept verbatim)

The desktop branch is a two-element trick that must not be "simplified":

- **`sidebar-gap`** — an in-flow, `bg-transparent` spacer inside the normal document flow. It is what pushes `Sidebar.Inset` aside. Its width animates: `w-(--sidebar-width)` → `0` (`offcanvas` collapsed) or `--sidebar-width-icon` (`icon` collapsed; `calc(var(--sidebar-width-icon) + spacing(4))` for `floating`/`inset` to cover their `p-2`). `group-data-[side=right]:rotate-180` mirrors it for right-side sidebars.
- **`sidebar-container`** — the `fixed inset-y-0 z-10 h-svh` element that actually shows the sidebar. Gap and container animate **`width` only** (`duration-200 ease-linear`) — the reviewed layout-property exception in [performance](../performance.md) §6. Offcanvas-collapsed it parks at `calc(var(--sidebar-width) * -1)` off-screen (left/right offset is not transitioned). Icon-collapsed on `floating`/`inset` it gets `+ 2px` beyond the gap width (border/ring allowance). Caller `className` and remaining props land here. _(Amended 2026-09-02 — previously also transitioned `left`/`right`.)_
- **`sidebar-inner`** — the visible `bg-sidebar` column; `floating` adds `rounded-lg shadow-sm ring-1 ring-sidebar-border`.
- The outer Root div is `hidden md:block` — below `md` the desktop branch renders nothing (the mobile Sheet branch takes over via `useIsMobile`).

## 5 Consumed tokens

Constrained to the canonical contract's **eight sidebar tokens** (ticket 001): `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`, `--sidebar-brand`, `--sidebar-brand-foreground` — with the **new light values** (`--sidebar: oklch(0.9851 0 0)`; `--sidebar-border` / `--sidebar-accent`: `oklch(0.9219 0 0)`).

- `sidebar` / `sidebar-foreground` — surface (inner container, mobile Sheet, `none` branch, wrapper `has-data-[variant=inset]:bg-sidebar`) and text.
- `sidebar-accent` / `sidebar-accent-foreground` — hover/active/`isActive` states on MenuButton, MenuAction, GroupAction, MenuSubButton; sub-button icons.
- `sidebar-border` — sidebar edge borders, floating ring, Separator, MenuSub `border-l`, Rail hover line, outline-variant shadow ring.
- `ring` — all interactive parts compose the canonical shared `focusRing` recipe (`Sidebar.Input` via the library Input field box; other controls via `focusRing({ target: "self" })`). `--sidebar-ring` remains a compatibility alias in the token contract but Sidebar does not create a distinct focus style from it. _(Amended 2026-09-02.)_
- `sidebar-brand` / `sidebar-brand-foreground` — reserved for brand emphasis (e.g. `Sidebar.Icon` logo surface); not consumed by the recipe itself.
- Neutral tokens: `background` (Inset, Input, outline MenuButton), `accent`/`accent-foreground` + `ring` via Button ghost (Trigger, §8.5).
- Widths flow through the component-scoped vars `--sidebar-width` / `--sidebar-width-icon` — never hardcoded in parts.

Dead ref references to `--sidebar-background` / `--sidebar-primary` are removed — cut from the contract (§8.7).

## 6 Data attributes

**Emitted** — `data-slot` (canonical, §8.1): `sidebar-wrapper` (Provider) · `sidebar` (Root, all three branches) · `sidebar-gap` · `sidebar-container` · `sidebar-inner` · `sidebar-trigger` · `sidebar-rail` · `sidebar-inset` · `sidebar-input` · `sidebar-header` · `sidebar-footer` · `sidebar-separator` · `sidebar-content` · `sidebar-group` · `sidebar-group-label` · `sidebar-group-action` · `sidebar-group-content` · `sidebar-menu` · `sidebar-menu-item` · `sidebar-menu-button` · `sidebar-menu-action` · `sidebar-menu-badge` · `sidebar-menu-skeleton` (+ `sidebar-menu-skeleton-icon`/`-text` on the Skeletons) · `sidebar-menu-sub` · `sidebar-menu-sub-item` · `sidebar-menu-sub-button` · `sidebar-icon`.

State attributes: Root — `data-state="expanded|collapsed"`, `data-variant`, `data-side`, `data-collapsible` (set to the collapsible mode **only while collapsed**, else `""`; also on the `none` branch: `data-state/variant/side` but no `data-collapsible`); mobile SheetContent — `data-mobile="true"`; `sidebar-container` re-emits `data-side`; MenuButton — `data-size`, `data-active`; MenuSubButton — `data-size`, `data-active`.

**Consumed selectors**: the component is a peer/group machine — wrapper `group/sidebar-wrapper` + `has-data-[variant=inset]:`; Root `group peer` feeding `group-data-[collapsible=icon|offcanvas]:`, `group-data-[side=…]:`, `group-data-[variant=…]:` throughout, and `Sidebar.Inset`'s `peer-data-[variant=inset]:`/`peer-data-[state=collapsed]:`; `group/menu-item` + `peer/menu-button` feeding MenuAction/MenuBadge positioning (`peer-data-[size=…]/menu-button:top-*`), hover reveal, and `peer-data-active/menu-button:` text; Rail's `[[data-side=left][data-state=collapsed]_&]:cursor-e-resize` family. Bare `data-open:`/`data-active:` variants are the self-scoped custom variants from conventions; ancestor state remains explicit through named group/peer selectors.

## 7 Accessibility

- **Keyboard shortcut**: cmd/ctrl+B toggles the sidebar (window-level `keydown`, `preventDefault`), on desktop and mobile alike.
- **Trigger**: real `<button>` with the locale's `sidebar.toggle` string rendered sr-only.
- **Rail**: `tabIndex={-1}` and `aria-hidden` (deliberate — mouse affordance only; keyboard and AT users have Trigger and cmd+B), localized `title`. _(Amended 2026-09-02.)_
- **Collapsed icon mode**: `tooltip` on MenuButton restores the hidden label — Tooltip.Content `side="right"`, `hidden` unless `state === "collapsed" && !isMobile`. Base-ui Tooltip wires `aria-describedby`.
- **Mobile**: full Sheet dialog semantics (focus trap, Escape, `aria-modal`), labeled by sr-only content from `sidebar.title` + `sidebar.description`.
- **Menus are semantic lists** (`ul`/`li`); MenuSubButton defaults to `<a>` for navigation; use `render` to compose router links. Active state is `data-active` styling — pair with `aria-current="page"` at the call site.
- Disabled states honor both `disabled:` and `aria-disabled:` (for rendered anchors).
- `Sidebar.Content` is the single scroll region; MenuAction/GroupAction are a `size-6` (24×24 CSS px) box at every breakpoint, with `after:-inset-2` extra hit area (the `md:after:hidden` cutoff is dropped). _(Amended 2026-09-02.)_

## 8 Divergence from reference

1. **Legacy duplicate `data-sidebar` attributes DROPPED** (locked): the ref stamps both `data-slot="sidebar-…"` and `data-sidebar="…"` on nearly every part (shadcn heritage), including via the `useRender` `state` objects (`{ slot, sidebar, … }`). `data-slot` is canonical; the `sidebar` state key and all `data-sidebar` attributes are removed. Internal selectors that keyed on it (the ref's `group-has-data-[sidebar=menu-action]/menu-item:pr-8`) are rewritten against `data-slot`.
2. **Mobile-branch `className` bugfix** (locked): the ref destructures `className` off `Sidebar` and never applies it in the mobile branch — silently dropped. We merge caller `className` onto `SheetContent` after the built-in classes.
3. **`setOpen` type fixed** (locked): the ref's context type declares `setOpen: (open: boolean) => void` but the implementation (and `toggleSidebar` itself, which calls `setOpen(o => !o)`) accepts an updater. Typed honestly as `boolean | ((open: boolean) => boolean)`.
4. **`MenuSkeleton` width made deterministic** (locked): the ref computes `Math.floor(Math.random() * 40) + 50`% inside `useState` — random-per-mount and an SSR/client hydration mismatch by construction (documented ref behavior, faithful to shadcn). Replaced with a CSS-based deterministic width (e.g. `nth-child`-cycled `--skeleton-width` values in the 50–90% band) — no randomness in render, hydration-safe.
5. **Trigger uses `Button variant="ghost" size="icon-sm"`** (locked): the ref hand-inlines the ghost icon-sm classes on a raw `<button>` because funnel didn't import Button; we own Button, so the Trigger renders it (`hit-area-1` retained), same as the Dialog/Sheet close-button unification.
6. **Cookie name kept, as a documented constant** (locked): `SIDEBAR_COOKIE_NAME = "sidebar:state"` — HARD invariant (funnel SSR reads it; see §2). Not renamed to shadcn's `sidebar_state`, ever.
7. **Token set constrained to the contract's eight sidebar tokens** (locked) with the new light values (§5). Dead `--sidebar-background`/`--sidebar-primary` references removed (cut from the contract). The ref's dark-era comment about sidebar-orange legibility (guen) is obsolete — the sidebar is light now and the brand accent is legible.
8. **Separator import pinned** to the canonical base-ui separator. Spread-order note: `Sidebar.Separator` passes `data-slot="sidebar-separator"` into `Separator`, which stamps its own `data-slot="separator"` — the wrapper's attribute must be spread **after** the inner default so `sidebar-separator` wins in the DOM.
9. **Renames (flat → namespace)**, one entry each: `SidebarProvider`→`Sidebar.Provider`, `Sidebar`→`Sidebar.Root`, `SidebarTrigger`→`Sidebar.Trigger`, `SidebarRail`→`Sidebar.Rail`, `SidebarInset`→`Sidebar.Inset`, `SidebarInput`→`Sidebar.Input`, `SidebarHeader`→`Sidebar.Header`, `SidebarFooter`→`Sidebar.Footer`, `SidebarSeparator`→`Sidebar.Separator`, `SidebarContent`→`Sidebar.Content`, `SidebarGroup`→`Sidebar.Group`, `SidebarGroupLabel`→`Sidebar.GroupLabel`, `SidebarGroupAction`→`Sidebar.GroupAction`, `SidebarGroupContent`→`Sidebar.GroupContent`, `SidebarMenu`→`Sidebar.Menu`, `SidebarMenuItem`→`Sidebar.MenuItem`, `SidebarMenuButton`→`Sidebar.MenuButton`, `SidebarMenuAction`→`Sidebar.MenuAction`, `SidebarMenuBadge`→`Sidebar.MenuBadge`, `SidebarMenuSkeleton`→`Sidebar.MenuSkeleton`, `SidebarMenuSub`→`Sidebar.MenuSub`, `SidebarMenuSubItem`→`Sidebar.MenuSubItem`, `SidebarMenuSubButton`→`Sidebar.MenuSubButton`, `SidebarIcon`→`Sidebar.Icon`. `useSidebar` keeps its name.
10. **Icons → Phosphor**: lucide `PanelLeftIcon` → Phosphor **`SidebarSimple`** — the closest Phosphor glyph to PanelLeft (a plain frame with a left-panel divider; Phosphor's `Sidebar` adds content lines inside the panel), and its name doesn't collide with the `Sidebar` namespace export.
11. **Helper privacy and strings:** `useIsMobile` is no longer public. Toggle/mobile-sheet copy comes from provider-locale keys with a `labels` override object.
12. **Mobile detection behavior kept, helper private:** 768px breakpoint (`max-width: 767px` MQL), `undefined`-then-`Boolean` state so SSR/first paint is `false`; observable through `useSidebar().isMobile`, not a `useIsMobile` export.
13. **Focus rings unified:** ref `ring-sidebar-ring` literals are replaced by canonical `focusRing`; Sidebar has no focus-color exception.
14. **Density exemption:** menu-button `h-8`/`h-7`/`h-12` and `Sidebar.Input` `h-8` stay shell-local; they are not remapped onto `--control-*`.
15. **`Sidebar.Input` composes the library `Input`** (2026-09-02): the shared field-box `focusRing` ships with the control; `data-slot="sidebar-input"` is spread after the inner `input` slot so it wins; `h-8` still overrides the field-box height (the §8.14 exemption).
16. **Rail is `aria-hidden`** (2026-09-02): `tabIndex={-1}` stays; the accessible toggle is Trigger + cmd/ctrl+B only. Localized `title` remains as the pointer tooltip.
17. **GroupAction/MenuAction are `size-6` at every breakpoint** (2026-09-02): the 20 px `w-5` box and `md:after:hidden` cutoff are dropped so the rendered box meets accessibility §8's 24 px floor on desktop as well as touch; `after:-inset-2` is kept as extra hit area.
18. **MenuSubButton size axis reads the control ladder** (2026-09-02): `md` → `--control-h-md` + control-type pair; `sm` → `--control-h-sm` + size-owned `text-sm`. Not part of the §8.14 chrome exemption.
19. **Collapse motion is shell width plus non-layout properties** (2026-09-02): gap/container `transition-[width] duration-200 ease-linear`; MenuButton `transition-[color,background-color,box-shadow]`; GroupLabel `transition-opacity`; Rail left/right transition dropped. Offcanvas `left`/`right` offset and the GroupLabel `-mt-8` snap. The [performance](../performance.md) §6 exception is not extended.

Kept faithfully: all constants (§2) incl. cookie write on **every** `setOpen` (even controlled); the three-branch Root incl. the `collapsible="none"` branch **still emitting `group peer` + `data-state/variant/side`** (deliberate funnel deviation from shadcn — inset wizard dialogs depend on the peer/has selectors); the gap+fixed-container desktop layout with 200ms ease-linear **width** transitions; floating/inset icon-width arithmetic (`+ spacing(4)` gap, `+ 2px` container); mobile Sheet composition (`18rem`, no close button, `sr-only` header); the nested `TooltipTrigger render={render}` composition and `hidden` gating on MenuButton tooltips; `data-collapsible` only-when-collapsed; MenuAction/MenuBadge size-tracking peers; `SidebarInput`'s `ComponentProps<"input">` typing rationale; `Sidebar.Icon` (funnel addition); RTL `dir` forwarding and the Rail's ltr/rtl cursor logic.

## 9 Test requirements

Role/label-based queries throughout; keyboard tests cover §7.

- **Toggle paths**: cmd+B and ctrl+B toggle `data-state` on Root (and `preventDefault`); under an `en-US` provider, Trigger (`getByRole("button", { name: "Toggle sidebar" })`) toggles; Rail click toggles (queried by its localized `title`; assert `tabIndex={-1}` and `aria-hidden`). The Trigger is the only tab-stop named from `sidebar.toggle`.
- **Focus ring**: `Sidebar.Input` paints the shared ring on keyboard `:focus-visible` at both density stamps (Chromium matches `:focus-visible` on a clicked text field, so the mouse-absence arm is not asserted on the textbox — same as Input's own suite).
- **Target size**: GroupAction and MenuAction bounding boxes are ≥ 24×24 CSS px at a desktop viewport.
- **Motion**: gap and container `transition-property` is `width` with `duration-200`; under `prefers-reduced-motion: reduce` the central block strips `width`/`left`/`right` from `transition-property` (accessibility.md §7 — duration of remaining paint properties is not zeroed).
- Toggle/title/description copy renders in all four locales; `Provider labels` overrides win. Public export tests reject `useIsMobile`.
- **Cookie write**: toggling writes `document.cookie` → `sidebar:state=<bool>; path=/; max-age=604800` — the exact name asserted as a hard invariant; also written when controlled (`onOpenChange` fires _and_ cookie updates).
- **Controlled/uncontrolled**: `defaultOpen={false}` starts collapsed; controlled `open` wins over internal state; `setOpen` accepts both boolean and updater.
- **`useSidebar` outside provider throws** the documented message.
- Dual-density exemption: MenuButton `default`/`sm`/`lg` heights and Sidebar.Input `h-8` are identical at `dense` and `comfortable`. MenuSubButton `md`/`sm` heights match `--control-h-md` / `--control-h-sm` at both stamps.
- **Collapsed icon-mode tooltip**: with `tooltip="Orders"` — expanded: hover shows no tooltip (hidden); collapsed: hover/focus shows `getByRole("tooltip", { name: "Orders" })` positioned right; the button and tooltip trigger are the same element (nested render); string vs object `tooltip` forms.
- **Branches**: `collapsible="none"` renders no Sheet, but still carries `data-state/variant/side` and `peer` classes (regression guard for the wizard-dialog deviation); mobile viewport (mock `matchMedia` < 768px) renders a dialog (`getByRole("dialog", { name: "Sidebar" })`), `openMobile` drives it, caller `className` lands on the SheetContent (§8.2 regression).
- **MenuButton**: `isActive` → `data-active`; `size`/`variant` classes; `data-size` positions MenuAction/MenuBadge; `render` polymorphism (renders an `<a>`, props merged).
- **MenuAction `showOnHover`**: hidden at `md:` until hover/focus-within/`aria-expanded`.
- **MenuSkeleton**: deterministic width across renders (two mounts produce identical DOM — the §8.4 guarantee); `showIcon`.
- **MenuSubButton**: defaults to `<a>`; `size`/`isActive` attributes.
- **`data-slot` audit**: every part stamps its slot; **no `data-sidebar` attributes anywhere** (§8.1 regression); `Sidebar.Separator` wins the spread-order fight (`data-slot="sidebar-separator"` in DOM); `Sidebar.Input` wins over the inner `input` slot (`data-slot="sidebar-input"` in DOM).
- **Mobile behavior**: `useSidebar().isMobile` is false before/at 768px, true below; responds to MQL change events; initial render false.

## 10 Demo requirements

Plain runnable `.tsx` demos:

- `sidebar-app-frame.tsx` — full application frame: Provider (cookie-driven `defaultOpen`), Root with Header/Content (groups, labels, menus)/Footer (`Sidebar.Icon` brand mark)/Rail, Inset with a Trigger in a top bar; cmd+B callout.
- `sidebar-icon-collapse.tsx` — `collapsible="icon"` with `tooltip` on every MenuButton; demonstrates the collapsed tooltip reveal and GroupLabel fade.
- `sidebar-mobile-sheet.tsx` — narrow-viewport demo of the Sheet branch (18rem, no close button, Escape/scrim dismiss).
- `sidebar-inset-variant.tsx` — `variant="inset"` with the rounded/shadowed Inset, plus a `collapsible="none"` inset composition (the wizard-dialog pattern the none-branch peer attrs exist for).
- `sidebar-menu-rich.tsx` — menu with `MenuBadge` counts, `MenuAction showOnHover` (dropdown on the action), `isActive` states, `MenuSub`/`MenuSubItem`/`MenuSubButton` (both sizes), and a `MenuSkeleton` loading group.
