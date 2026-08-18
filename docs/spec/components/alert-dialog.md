# AlertDialog

## 1 Header

- **Canonical name**: `AlertDialog` (namespace compound, three parts)
- **Export path**: `@elmeragroup/ui` (`import { AlertDialog } from "@elmeragroup/ui"`)
- **Tier**: prop-driven composite over Dialog (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/alert-dialog.tsx`

## 2 Anatomy

**Internal-wins ruling**: this is **not** shadcn's compound AlertDialog and **not** base-ui's AlertDialog primitive. It reuses `@base-ui/react/dialog`'s `Root`/`Trigger`/`Close` and our own `Dialog.Content`/`Header`/`Footer`/`Title`, passing `role="alertdialog"` through to the Popup. The confirm surface is **prop-driven** — title, body, and both buttons come from props on `AlertDialog.Content`, not from composed parts.

| Part | Base | Notes |
| --- | --- | --- |
| `AlertDialog.Root` | `DialogPrimitive.Root` | state owner; ref stamps `data-slot="alert-dialog"` |
| `AlertDialog.Trigger` | `DialogPrimitive.Trigger` | opens the dialog |
| `AlertDialog.Content` | `Dialog.Content role="alertdialog" showCloseButton={false}` | prop-driven confirm surface: Header (Title + icon), Description body, Footer (cancel + action buttons) |

```tsx
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
  <AlertDialog.Content
    title="Delete order?"
    actionLabel="Delete"
    cancelLabel="Keep it"
    onAction={handleDelete}
    isPerformingAction={isDeleting}>
    This permanently removes the order.
  </AlertDialog.Content>
</AlertDialog.Root>
```

## 3 Props

**AlertDialog.Root / AlertDialog.Trigger** — their `DialogPrimitive.Root` / `DialogPrimitive.Trigger` props verbatim.

**AlertDialog.Content** — `ComponentProps<Dialog.Content>` (so the 13-value `size` axis, `className`, `container`, and Popup props all pass through; `showCloseButton` is forced `false` and not overridable) plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | — (required) | rendered in `Dialog.Title` (`text-balance`) |
| `icon` | `ReactNode` | variant fallback (§4) | rendered right of the title in the Header |
| `variant` | `"destructive" \| "neutral"` | `"destructive"` | drives action-button variant and fallback icon |
| `children` | `ReactNode` | — (required) | body copy, rendered in a real `Dialog.Description` part (§8) |
| `actionLabel` | `string` | — (required) | primary button label |
| `cancelLabel` | `string` | `"Cancel"` | secondary button label |
| `onAction` | `() => void` | — | primary button click |
| `onCancel` | `() => void` | — | cancel button click (button always closes via `Dialog.Close`) |
| `isPerformingAction` | `boolean` | `false` | primary button `isPending` (spinner, per Button spec) |
| `isActionDisabled` | `boolean` | `false` | primary button `disabled` |
| `isAutomaticallyCloseOnActionEnabled` | `boolean` | `false` | opt-in: wraps the action button in `Dialog.Close` so clicking it also closes; default leaves closing to the caller (async flows close after success) |
| `container` | `HTMLElement \| RefObject<HTMLElement>` | active `ThemeScope` element | inherited from `Dialog.Content` (§8) |

Composite-tier prop naming per conventions (`is*` booleans, callback props).

## 4 Variants

No `tv` recipe of its own — sizing comes from `Dialog.Content`'s private `dialogContentVariants` (`size` default `"md"`).

`variant` axis (prop-switch, not tv):

- `"destructive"` (default): action button `Button variant="destructive"` (consumer-compat alias → `error` tokens per conventions); fallback icon `WarningOctagon` (`size-5 shrink-0 text-error`).
- `"neutral"`: action button `Button variant="default"`; fallback icon `Info` (`size-5 shrink-0`).

Action button: `size="sm"`, `autoFocus`, `isPending={isPerformingAction}`, `disabled={isActionDisabled}`. Cancel button: `Dialog.Close` rendered as `Button size="sm" variant="ghost"`, `onClick={onCancel}`.

Animation strategy: inherited from Dialog (keyframe `animate-in`/`animate-out`, `duration-100`).

## 5 Consumed tokens

- Everything `Dialog.Content` consumes (`popover`, `popover-foreground`, `foreground/10` ring, literal `bg-black/10` scrim).
- `error` — destructive fallback icon color (ref: `text-destructive`, §8).
- `muted-foreground` — body copy (via `Dialog.Description`).
- Button tokens via the action/cancel/destructive Button variants.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `alert-dialog` (Root) · `alert-dialog-trigger`; the surface re-emits Dialog slots (`dialog-content`, `dialog-header`, `dialog-footer`, `dialog-title`, `dialog-description`).

**Test-automation hooks (kept, load-bearing)**: `data-dialog-action-type="primary"` on the action button, `data-dialog-action-type="secondary"` on the cancel button.

**Emitted (by base-ui)**: `data-open` / `data-closed` on Popup/Backdrop (styled by Dialog).

## 7 Accessibility

- `role="alertdialog"` on the Popup (passed through `Dialog.Content`); base-ui still wires `aria-modal`, `aria-labelledby` → Title, and — after the §8 bugfix — `aria-describedby` → the Description body.
- `autoFocus` on the action button: focus lands on the primary action on open (alertdialog convention — focus the least-destructive control is debated; ref chose the action button, kept).
- No corner close button (`showCloseButton` forced `false`) — an alert dialog must be answered, not dismissed in passing; Escape still closes (base-ui default) unless the consumer sets `dismissible={false}` on Root.
- Cancel always closes (wrapped in `Dialog.Close`); the action button closes only with `isAutomaticallyCloseOnActionEnabled`.
- `isPerformingAction` surfaces Button's pending semantics (spinner + disabled interaction) so double-submit is prevented.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `AlertDialog`→`AlertDialog.Root`, `AlertDialogTrigger`→`AlertDialog.Trigger`, `AlertDialogContent`→`AlertDialog.Content`.
2. **Stays prop-driven (internal-wins ruling)**: the ref's prop-driven API is kept over shadcn's compound AlertDialog. Documented explicitly: it reuses `Dialog.Root` machinery + `role="alertdialog"`, **not** base-ui's AlertDialog component.
3. **BUGFIX (ruled)**: the body becomes a real `Dialog.Description` part so `aria-describedby` is wired. The ref renders the body as a raw `<div className="text-sm text-pretty text-muted-foreground">` — visually identical to `DialogDescription` but with **no** describedby association; screen readers never announce the consequence text. Same classes, correct primitive.
4. **Overlay `container` prop (mandated)**: inherited from `Dialog.Content` and forwarded to the internal Portal; the ref's `DialogContent` hardcodes its Portal with nothing forwarded (see dialog spec §8; portal-inside-ThemeScope guidance applies).
5. **Icons → Phosphor**: `Icon.OctagonX` → `WarningOctagon` (Phosphor has no X-in-octagon glyph; `WarningOctagon` is the closest equivalent — verified against `@phosphor-icons` naming), `Icon.Info` → `Info`. Imported from `@elmeragroup/ui/icons`, regular weight.
6. **`destructive` → `error` token rename** on the fallback icon (`text-destructive` → `text-error`); the Button `variant="destructive"` alias resolves to error tokens per the Button spec.

Kept faithfully: `showCloseButton` forced `false` (deliberate, not the unification gap); `autoFocus` on the action button; `isAutomaticallyCloseOnActionEnabled` opt-in close-on-action; `data-dialog-action-type` primary/secondary hooks; `variant` default `"destructive"`; `cancelLabel` fallback `"Cancel"`; `size-5 shrink-0` fallback-icon sizing; Header override `flex-row items-start justify-between gap-4` (icon right of title).

## 9 Test requirements

Role/label-based queries throughout:

- Role: `getByRole("alertdialog", { name: title })` appears on open; no `role="dialog"` match.
- describedby: the `alertdialog` element's `aria-describedby` resolves to the body copy (regression guard for the §8 bugfix).
- Focus: on open, focus is on the action button (`getByRole("button", { name: actionLabel })` has focus); focus is trapped; Escape closes and restores trigger focus.
- Actions: clicking action fires `onAction` and does **not** close by default; with `isAutomaticallyCloseOnActionEnabled` it closes; clicking cancel fires `onCancel` and always closes.
- States: `isPerformingAction` shows Button pending state; `isActionDisabled` disables the action button; cancel stays enabled.
- No corner close button rendered (`queryByRole("button", { name: "Close" })` is null).
- Hooks: action/cancel buttons carry `data-dialog-action-type` `"primary"`/`"secondary"`.
- Variant: `"destructive"` renders destructive action button + `WarningOctagon` fallback; `"neutral"` renders default button + `Info`; a custom `icon` replaces the fallback.

## 10 Demo requirements

Plain runnable `.tsx` demos: `alert-dialog-destructive.tsx` (default variant, async `onAction` closing manually), `alert-dialog-neutral.tsx` (`variant="neutral"`, `isAutomaticallyCloseOnActionEnabled`), `alert-dialog-pending.tsx` (`isPerformingAction`/`isActionDisabled` toggles), `alert-dialog-custom-icon.tsx` (custom `icon` + `cancelLabel`).
