# Toast

## 1 Header

- **Canonical name**: `Toast` (namespace compound + imperative manager)
- **Export path**: `@elmeragroup/ui` (`import { Toast } from "@elmeragroup/ui"`)
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: **directed pivot** — the ref implementation (`.ref/OrderModuleInternalWeb/packages/ui/src/toaster.tsx`, sonner) is abolished by owner ruling; the library adopts `@base-ui/react/toast` primitives instead. Styling/composition precedent: `.ref/kumo/packages/kumo/src/components/toast/toast.tsx`.

## 2 Anatomy

| Part | Base | Notes |
| --- | --- | --- |
| `Toast.Provider` | `ToastPrimitive.Provider` | state owner; wraps the app (or a subtree); accepts `toastManager`, `limit`, `timeout` |
| `Toast.Viewport` | `ToastPrimitive.Portal > ToastPrimitive.Viewport` | fixed bottom-right landmark region; owns the `container` prop (§3); renders the toast list itself — consumers place `<Toast.Viewport />` once and never map toasts by hand |
| `Toast.Root` | `ToastPrimitive.Root` | per-toast surface; status chrome from the toast's `type`; swipe/stacking transforms |
| `Toast.Content` | `ToastPrimitive.Content` | stacking-aware content wrapper (`data-behind`/`data-expanded` opacity) |
| `Toast.Title` | `ToastPrimitive.Title` | bold first line |
| `Toast.Description` | `ToastPrimitive.Description` | muted body text |
| `Toast.Action` | `ToastPrimitive.Action` | action button, rendered from the toast's `actionProps` via our `Button` (`render`) |
| `Toast.Close` | `ToastPrimitive.Close` | ghost icon button, Phosphor `X`, top-right |

Base-ui's `Toast.Positioner`/`Toast.Arrow` (anchored toasts) are **not wrapped** in v1 — stacked toasts only. The imperative surface is re-exported faithfully:

- `Toast.useToastManager()` — hook, inside a `Toast.Provider`; returns `{ toasts, add, update, close, promise }`.
- `Toast.createToastManager()` — module-scope manager for code outside the React tree (timers, query-cache listeners); same `add`/`update`/`close`/`promise` methods, **no** reactive `toasts` array; passed to `<Toast.Provider toastManager={…}>`.

```tsx
<Toast.Provider>
  <App />
  <Toast.Viewport />
</Toast.Provider>;

// anywhere below the provider:
const toastManager = Toast.useToastManager();
toastManager.add({ type: "success", title: "Saved", description: "Changes stored." });
```

## 3 Props

**Toast.Provider** — `ComponentProps<ToastPrimitive.Provider>` verbatim (`toastManager`, `limit`, `timeout`, `children`). Primitive-tier naming per conventions.

**Toast.Viewport** — `ComponentProps<ToastPrimitive.Viewport>` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `container` | `HTMLElement \| ref` | active `ThemeScope` element | forwarded to `ToastPrimitive.Portal` (overlay convention, §8) |

**Manager `add`/`update` options** — base-ui's `ToastManagerAddOptions` verbatim (`id`, `title`, `description`, `type`, `timeout`, `priority: "low" | "high"`, `actionProps`, `data`, `onClose`, `onRemove`). Our wrapper narrows `type` to the styled statuses: `"error" | "info" | "success" | "warning" | "loading"` (unset → neutral). `add` returns a `toastId`; re-adding an existing `id` updates in place (base-ui upsert, `updateKey` increments). `close(toastId?)` closes one or — with no id — all toasts.

**Manager `promise`** — `promise(p, { loading, success, error })`; each state is either a description shorthand string/function or a full method-options object (title, description, actionProps, …). Base-ui sets `type` to `loading`/`success`/`error` per state, which drives our status chrome and the `SpinnerGap` loading icon automatically.

**Toast.Root / Content / Title / Description / Action / Close** — their base-ui part's props verbatim; all take `className` (merged via `cn`). These parts are exported for custom renderers but the built-in `Toast.Viewport` list covers the standard cases.

## 4 Variants

`toastVariants` — `tv` recipe, **module-private** (no borrow pattern):

| Axis | Values | Default | Notes |
| --- | --- | --- | --- |
| `status` | `neutral` \| `error` \| `info` \| `success` \| `warning` \| `loading` | `neutral` | derived from the toast's `type`, not a consumer prop; emitted as `data-status` |

`neutral` and `loading` share the plain `popover` surface; the four statuses tint via their `-soft` families. Status icons (Phosphor, regular weight per conventions; `fill` not used — kumo's `weight="fill"` is not adopted):

| status | icon |
| --- | --- |
| `error` | `WarningOctagon` |
| `info` | `Info` |
| `success` | `CheckCircle` |
| `warning` | `Warning` |
| `loading` | `SpinnerGap` + `animate-spin` |

## 5 Consumed tokens

- `popover` / `popover-foreground` — neutral toast surface and text.
- `error-soft` / `error-soft-foreground`, `info-soft` / `info-soft-foreground`, `success-soft` / `success-soft-foreground`, `warning-soft` / `warning-soft-foreground` — status surfaces/text; solid `error`/`info`/`success`/`warning` for the status icon and title accent.
- `border` — hairline ring (`ring-1`); status toasts ring with their solid status token at low alpha.
- `muted-foreground` — description text, close button idle.
- Radii: root `rounded-lg` (`--radius`-derived; no hardcoded values); `shadow-lg` elevation.
- No raw palette values anywhere — the sonner `TOAST_STYLE.INVERTED` raw-oklch object has no successor (§8); inverted rendering comes from mounting the Viewport inside a dark `ThemeScope`.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `toast-viewport` · `toast-root` · `toast-content` · `toast-title` · `toast-description` · `toast-action` · `toast-close`; `data-status` on Root (§4).

**Emitted (by base-ui, styled by us)**: `data-expanded` (viewport hovered/focused), `data-behind` (content behind the frontmost toast), `data-limited` (over `limit`, kept mounted `inert`), `data-starting-style` / `data-ending-style`, `data-swipe-direction="up|down|left|right"`. CSS variables consumed for stacking/swipe (kumo's transform recipe adopted): `--toast-index`, `--toast-offset-y`, `--toast-height`, `--toast-frontmost-height`, `--toast-swipe-movement-x/y`.

**Consumed selectors**: collapsed stack clamps height to `var(--toast-frontmost-height, var(--toast-height))` with `data-[behind]:opacity-0`; `data-[expanded]` restores full height/offset; `data-[starting-style]:translate-y-[150%]` entrance; `data-[ending-style]` exit keyed per `data-[swipe-direction=…]`; `data-[limited]:opacity-0`. All scoped to the element (conventions' `data-open:` ancestor-match trap applies equally here).

**Consumer escape hatch**: `data-base-ui-swipe-ignore` on any element inside a toast opts it out of swipe-to-dismiss (interactive elements are excluded automatically).

## 7 Accessibility

- The viewport is a focusable landmark region; **F6** moves focus into it to navigate toasts with the keyboard (base-ui built-in hotkey). Tab cycles focusable elements inside toasts; Escape returns focus to the previously focused element.
- Live-region semantics per base-ui: `priority: "low"` (default) announces politely (`role="status"`-equivalent), `priority: "high"` announces assertively (`role="alert"`-equivalent). Only the `title`/`description` **option strings** are announced — extra JSX inside `Toast.Root` is not read unless the user navigates to the viewport.
- Timers pause while the viewport is hovered or holds focus (the same condition that sets `data-expanded`).
- Swipe-to-dismiss (pointer) is supplementary — every toast keeps a labeled `Toast.Close` button (`aria-label="Close"`), so dismissal never requires a gesture.
- The loading status is decorative (`SpinnerGap` is `aria-hidden`); state changes announce via the promise toast's updated description.

## 8 Divergence from reference

1. **sonner abolished (owner ruling, timed with ui-lib adoption)** — the reference `Toaster`/`toast` are not ported; the library is built on `@base-ui/react/toast`, following kumo's adoption precedent. **Known breaking change** for both consumers; migration map:

   | Old (sonner) | New |
   | --- | --- |
   | `toast("msg")`, `toast.success/error/info/warning(msg)` | `toastManager.add({ description, type })` via `Toast.useToastManager()` |
   | `toast(...)` from non-React code (module import) | module-scope `Toast.createToastManager()` passed to `Toast.Provider` |
   | `toast.promise(p, {...})` | `toastManager.promise(p, { loading, success, error })` |
   | `toast.dismiss(id?)` | `toastManager.close(id?)` |
   | `<Toaster />` (mounted once) | `<Toast.Provider>` wrapping the app + one `<Toast.Viewport />` |
   | `richColors` (ref default-on) | always on — status `-soft` token chrome, no toggle |
   | `closeButton` (ref default-on) | always rendered (`Toast.Close`) |
   | `toastOptions.classNames` / `toasterVariants` slots recipe | `className` per part; recipe is module-private |
   | `action`/`cancel` config | `actionProps` on `add`/`update`/`promise` states |
   | `icons` prop (`Icon.OctagonX/Info/CheckCircle/Loader/AlertTriangle`) | built-in Phosphor `WarningOctagon`/`Info`/`CheckCircle`/`Warning`/`SpinnerGap` (regular weight) |

2. **`TOAST_STYLE.INVERTED` dies** — the ref's raw-oklch `CSSProperties` object (hand-tuned dark surfaces via sonner's `--normal-bg`/`--success-bg`/… vars) violates the tokens-only rule and has no replacement object. Inverted toasts are achieved by portalling the Viewport into a `ThemeScope` with the dark/inverted theme (token inversion), which the `container` prop enables.
3. **Migration note (OrderModuleWeb + OrderModuleInternalWeb)**: remove the `sonner` dependency; replace the app-shell `<Toaster />` with `<Toast.Provider>` + `<Toast.Viewport />`; mechanical find-and-replace of `toast.*` call sites to a shared `createToastManager()` instance or the hook; any `TOAST_STYLE.INVERTED` usage moves to a ThemeScope wrapper.
4. **Vs kumo** (precedent, not verbatim): kumo's `Toasty` single-component API is split into `Provider` + `Viewport` per our namespace convention; kumo's `weight="fill"` icons become regular weight; kumo's `kumo-*` tokens map to our contract tokens; kumo's bump-on-duplicate `add` wrapper is **not** adopted (base-ui's native upsert-by-`id` + `updateKey` covers dedupe); kumo's `actions: ButtonProps[]` array narrows to base-ui's single `actionProps`.
5. **Anchored toasts (`Toast.Positioner`/`Toast.Arrow`) deferred** — base-ui supports them; out of scope until a consumer needs "copied"-style anchored feedback.

Kept faithfully from base-ui: the entire manager method surface (`add`/`update`/`close`/`promise` semantics, upsert by `id`, `updateKey`); F6 viewport hotkey; `data-base-ui-swipe-ignore`; stacking CSS-variable contract; `limit` + `data-limited` inert behavior.

## 9 Test requirements

Role/label-based queries throughout:

- `add({ priority: "high" })` renders content findable via `getByRole("alert")`; default priority via `getByRole("status")` (assert against base-ui's live-region output).
- Manager flows: `add` returns an id and the toast appears (`getByText` on title/description); `add` with an existing `id` updates in place (no duplicate node); `update` swaps the description; `close(id)` removes one, `close()` removes all.
- `promise`: loading description appears, then resolves to the success state (title/description swap, `data-status` flips `loading → success`); rejection flips to `error`.
- Action: `actionProps` renders a button (`getByRole("button", { name })`); clicking it fires the handler. `Toast.Close` (`getByRole("button", { name: "Close" })`) dismisses.
- F6 moves focus into the viewport region; Escape restores focus to the prior element.
- `data-status` reflects each `type`; neutral toast omits status chrome.
- `container`: viewport portal renders inside the provided element / active ThemeScope, not `document.body`.
- **Swipe-to-dismiss is not unit-testable** (pointer-gesture physics; jsdom and even browser-mode synthetic events don't reproduce base-ui's swipe tracking) — covered by the labeled Close button tests plus a future VR/interaction pass; assert only that `data-base-ui-swipe-ignore` passes through.

## 10 Demo requirements

Plain runnable `.tsx` demos: `toast-statuses.tsx` (buttons firing neutral + all four statuses, icons visible), `toast-action.tsx` (undo-style `actionProps` toast), `toast-promise.tsx` (`promise` walking loading → success and loading → error with `SpinnerGap`), `toast-stacking.tsx` (rapid-fire toasts showing collapse, hover-to-expand, `limit` overflow, close-all).
