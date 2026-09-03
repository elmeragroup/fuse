# ConfirmButton

## 1 Header

- **Canonical name**: `ConfirmButton` (single component; behavioral wrapper, no namespace)
- **Export path**: `@elmeragroup/ui/confirm-button` (also re-exported from `@elmeragroup/ui`)
- **Tier**: behavioral composite over base-ui `Button` (client component — owns armed state)
- **RSC**: client
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/confirm-button.tsx`

## 2 Anatomy

| Part            | Renders                                              | Notes                                             |
| --------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `ConfirmButton` | base-ui `Button` + conditional `sr-only` live region | single element; two-press arm/confirm interaction |

```tsx
<ConfirmButton variant="destructive" onConfirm={deleteRow} armedChildren={t("confirmDelete")}>
  {t("delete")}
</ConfirmButton>
```

## 3 Props

`ConfirmButtonProps = Omit<ButtonProps, "onClick" | "children"> & { … }` — all Button props (`variant`, `size`, `disabled`, `isPending`, …) pass through except `onClick`, which the component owns:

| Prop             | Type         | Default  | Notes                                                         |
| ---------------- | ------------ | -------- | ------------------------------------------------------------- |
| `onConfirm`      | `() => void` | required | fired on the **second** press only                            |
| `children`       | `ReactNode`  | —        | resting label                                                 |
| `armedChildren`  | `ReactNode`  | —        | label swapped in while armed; resting label kept when omitted |
| `armedAriaLabel` | `string`     | —        | explicit armed announcement/label override                    |
| `disabled`       | `boolean`    | —        | disables the button; **also disarms** (§8.1)                  |

**Behavior (fully specced):**

- **Two-press flow**: first press arms (`data-armed="true"`, armed styles, label swap, announcement); second press disarms and calls `onConfirm` once.
- **Escape disarms**: `Escape` while armed calls `preventDefault()` and resets to resting (no `onConfirm`). Consumer `onKeyDown` still runs after.
- **Blur disarms**: any blur while armed resets to resting. Consumer `onBlur` still runs after.
- **Announcement**: while armed (and an announcement string resolves), a `<span className="sr-only" aria-live="polite">` renders inside the button with the announcement text.
- **`armedAriaLabel` resolution chain**: announcement = `armedAriaLabel` ?? (`armedChildren` if it is a `string`) ?? the consumer's `aria-label`. While armed, the button's `aria-label` becomes the announcement; at rest it is the consumer's `aria-label`.
- Visible children = `armedChildren` when armed and provided, else `children`.

## 4 Variants

Recipe: `confirmButtonVariants` — **module-private**. Mirrors the Button `variant` axis with **deliberately empty keys** (`default`, `outline`, `secondary`, `ghost`, `link` map to `""`) — they exist purely so `VariantProps` type-aligns 1:1 with Button's axis; only two add armed styling:

| `variant`     | armed classes                                                            |
| ------------- | ------------------------------------------------------------------------ |
| `destructive` | `data-[armed=true]:bg-error data-[armed=true]:text-error-foreground`     |
| `success`     | `data-[armed=true]:bg-success data-[armed=true]:text-success-foreground` |

The underlying `variant` also passes to `Button` unchanged, so resting looks are Button's. No `defaultVariants` (undefined variant adds nothing).

## 5 Consumed tokens

`error`/`error-foreground`, `success`/`success-foreground` (armed solid fills — deliberately stronger than Button's tinted resting destructive/success looks: arming escalates). Everything else via Button's recipe.

## 6 Data attributes

**Emitted**: `data-armed="true"` while armed, absent at rest (the `x || undefined` idiom — never `"false"`); plus Button's own attributes.

**Consumed**: its own `data-[armed=true]:` variants (self-scoped — element-level selector, no group leakage).

## 7 Accessibility

- Standard `getByRole("button")`; disabled/pending semantics inherited from Button.
- Arming is announced twice over: the `aria-live="polite"` sr-only span (in-place announcement) and the swapped `aria-label` (state readable on re-query). Both use the §3 resolution chain; supply a **string** `armedChildren` or `armedAriaLabel` so non-visual users hear the escalation.
- `Escape` is a documented disarm affordance; blur-to-disarm guarantees a keyboard user tabbing away never leaves a stale armed trap.
- `onConfirm` fires only from an explicit second activation (click/Enter/Space via Button) — never from timers.

## 8 Divergence from reference

1. **FIX (ruled): armed state resets when `disabled` flips true.** Ref derives `isArmed = isArmedRaw && !disabled` but never clears `isArmedRaw`, so a button armed → disabled → re-enabled snaps back to armed with no user action. Ours resets the raw state on the `disabled` transition (effect/derived reset) — re-enabling always yields a resting button.
2. **Token renames (LOCKED)**: armed styles `destructive*`/`success*` classes → canonical `error*`/`success*` tokens (variant **values** unchanged).
3. **`confirmButtonVariants` stays private** (ref also keeps it private); the empty variant keys are kept and documented as type-alignment with Button's axis (§4).
4. Otherwise verbatim: two-press flow, escape/blur disarm, announcement chain, `data-armed` idiom, base-ui Button host (ref already composes on `base-ui/button`).
5. **The §8.1 reset is derive-with-reset, not an effect** (2026-09-03, ticket 44): the armed flag is cleared during the render that first sees a new `disabled` value (compared against a `wasDisabled` state cell), rather than in a `useEffect` that commits a second render after paint. `isArmed = isArmedRaw && !disabled` still guards the intermediate render, so the observable behaviour — including the §9 disabled-reset regression — is unchanged.

## 9 Test requirements

- **Two-press flow**: first click does not call `onConfirm`, sets `data-armed="true"` and swaps to `armedChildren`; second click calls `onConfirm` exactly once and resets (attribute absent, resting label).
- **Escape disarm**: arm, press `Escape` → disarmed, `onConfirm` not called; consumer `onKeyDown` still invoked.
- **Blur disarm**: arm, tab away → disarmed on refocus inspection.
- **Announcement**: while armed, the sr-only `aria-live="polite"` span contains the resolved announcement; resolution chain covered (`armedAriaLabel` wins > string `armedChildren` > resting `aria-label`); button's accessible name swaps while armed and restores at rest.
- **Disabled reset (regression for §8.1)**: arm, set `disabled`, re-enable → button is disarmed; next click arms (does not confirm).
- Keyboard activation (Enter/Space) drives the same flow as click.

## 10 Demo requirements

`confirm-button-destructive.tsx` (delete flow with `armedChildren` escalation), `confirm-button-success.tsx` (approve flow), `confirm-button-icon.tsx` (icon-size button relying on `armedAriaLabel` for the announcement).
