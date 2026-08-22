# Input

## 1 Header

- **Canonical name**: `Input` (single component, no compound parts)
- **Export path**: `@elmeragroup/ui/input` (`import { Input } from "@elmeragroup/ui/input"`)
- **Tier**: base-ui control primitive (unlabeled; labeled usage goes through `TextField`, grouped usage through `InputGroup.Input`)
- **RSC**: client (base-ui `Input` participates in Field context wiring)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/input.tsx`

## 2 Anatomy

Single element wrapping `@base-ui/react/input` `Input`, which renders a native `<input>` and participates in base-ui `Field` wiring (labels, descriptions, validity) automatically when rendered inside `Field.Root`.

```tsx
<Input type="email" placeholder="name@example.com" />
```

Inside a field:

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Input type="email" />
</Field.Root>
```

## 3 Props

`ComponentProps<"input">` — full native surface, primitive-tier naming (`disabled`, `readOnly`, `required`, `min`, `max`, event handlers; never `isDisabled` here).

| Prop        | Type                      | Default              | Notes                                                                                           |
| ----------- | ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `type`      | `string`                  | — (browser `"text"`) | destructured and forwarded explicitly in the ref; file-input styling included (`file:` classes) |
| `className` | `string`                  | —                    | merged via `cn` after base classes                                                              |
| …rest       | `ComponentProps<"input">` | —                    | spread onto the base-ui primitive                                                               |

No `value`-massaging, no controlled/uncontrolled opinion — native semantics. Polymorphism is not applicable (always an `<input>`).

## 4 Variants

None public. Shared chrome lives in the package-private `fieldBox` `tv` recipe (`styles/field-box.ts`) — card fill, input border, md height/padding/type, placeholder, disabled fill/opacity, invalid border + ring, self focus ring, one transition list. Nothing exported. (The exported borrow recipe for the text-input _look_ is `textFieldVariants` at the labeled-composite tier, not here.)

No `size` axis. The field box pins the `md` rung per [conventions](conventions.md) ruling 2 inside `fieldBox`. Input adds only host deltas: `min-w-0`, `file:` chrome, `disabled:pointer-events-none`. Do not also set `py-*` once height is pinned. Radius via the `rounded-md` scale derived from `--radius`; never hardcoded.

**Density mapping.** Single-height field box → `md` rung. Dense computed metrics match the ref's `h-9 px-2.5` box; comfortable is the signed `ui.css` column. No `dense:` / `comfortable:` variants.

## 5 Consumed tokens

- `card` — resting background (`bg-card`; see §8).
- `input` — border color (`border-input`); disabled fill (`disabled:bg-input/50`).
- `ring` — shared `focusRing({ target: "self" })`; exact classes live only in styles/utils.
- `error` — invalid border + ring (`aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20`).
- `muted-foreground` — placeholder.
- `foreground` — file-selector button text.

## 6 Data attributes

**Emitted**: `data-slot="input"`.

**Consumed**: `aria-invalid` (styling hook, set by base-ui Field or by the consumer); native `disabled`/`focus-visible` states. When wrapped by `InputGroup.Input` the slot is overridden to `input-group-control` (see input-group spec).

## 7 Accessibility

- Native `<input>` semantics; no aria is hand-written here.
- Rendered inside `Field.Root`, base-ui auto-wires id/label/description/error association and sets `aria-invalid` — the invalid styles above key off that.
- Disabled styling includes `disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50`; the control remains excluded from tab order natively.
- Focus is `focus-visible`-scoped: keyboard focus shows the ring, pointer focus does not.

## 8 Divergence from reference

1. **`bg-white` → `bg-card`** — input-like surfaces use the `card` token (white in all 20 themes today, dark-ready); literal `bg-white` violates `no-primitive-colors`.
2. **`inverted:` variant classes DROPPED** (`inverted:bg-input/30 inverted:disabled:bg-input/80`) — the ref's custom `.inverted` Tailwind variant/mechanism does not exist in the new theme system; inverted surfaces are a theme-scope concern.
3. **`dark:` variant classes dropped** (`dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`) — dark axis lives in tokens behind `[data-theme="dark"]`, per `no-tailwind-dark-variant`.
4. **`destructive` → `error`** token rename on the invalid border/ring classes.
5. **Focus ring unified** — the ref's local border/three-pixel ring becomes shared `focusRing({ target: "self" })`; the focus-tinted border is dropped.
6. **Density retokenization:** the fixed `h-9 … px-2.5 py-1 text-base md:text-sm` box pins the `md` rung (`--control-h-md`, `--control-px-md`, control-type pair) without gaining a `size` axis. `py-1` is dropped once height is pinned.

No API divergence — prop surface is identical to the ref.

## 9 Test requirements

- Renders a `getByRole("textbox")`; `type` forwards (e.g. `spinbutton` for `type="number"`).
- Inside `Field.Root` + `Field.Label`: accessible name resolves (`getByRole("textbox", { name: … })`).
- `disabled` removes it from the tab order (Tab lands on the next focusable).
- `aria-invalid` reaches the DOM when Field is invalid.
- Keyboard: type into the field and assert `onChange` fires with the native event; Tab focuses, typing edits (per §7 focus-visible behavior, assert ring class only via state, not snapshot).
- Uncontrolled and controlled value both work (native semantics untouched).
- Dual-density: at document `dense` and `comfortable`, computed height, inline padding, font-size, and line-height match the signed `md` rung; nested `data-density` and `ThemeScope` variant changes do not rescope metrics. Shared focus-ring helper: ring on `:focus-visible`, absent on mouse focus, both stamps.

## 10 Demo requirements

Plain runnable `.tsx` demos: `input-basic.tsx` (placeholder + typing), `input-types.tsx` (text/email/number/password/file), `input-states.tsx` (disabled, readOnly, invalid via Field), `input-in-field.tsx` (full Field.Root + Label + Description + Error composition).
