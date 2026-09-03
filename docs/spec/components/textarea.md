# Textarea

## 1 Header

- **Canonical name**: `Textarea` (single component, no compound parts)
- **Export path**: `@elmeragroup/ui/textarea` (also re-exported from `@elmeragroup/ui`)
- **RSC**: server — plain native element; Field wiring belongs to `TextareaField`
- **Tier**: control primitive (unlabeled; **labeled usage goes through `TextareaField`**, grouped usage through `InputGroup.Textarea`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/textarea.tsx`

## 2 Anatomy

A single plain native `<textarea>` — deliberately **not** a base-ui primitive and **not** a `Field.Control` (base-ui's Input primitive is input-only). Auto-grows via `field-sizing-content`.

```tsx
<Textarea placeholder="Tell us more…" />
```

To get Field aria wiring, wrap it in `Field.Control` via `render` (this is exactly what `TextareaField` does internally):

```tsx
<Field.Root>
  <Field.Label>Notes</Field.Label>
  <Field.Control render={<Textarea />} />
</Field.Root>
```

## 3 Props

`ComponentProps<"textarea">` — full native surface, primitive-tier naming (`disabled`, `readOnly`, `required`, `rows`, `maxLength`, event handlers).

| Prop        | Type                         | Default | Notes                              |
| ----------- | ---------------------------- | ------- | ---------------------------------- |
| `className` | `string`                     | —       | merged via `cn` after base classes |
| …rest       | `ComponentProps<"textarea">` | —       | spread onto the element            |

No controlled/uncontrolled opinion — native semantics. Polymorphism not applicable.

## 4 Variants

None public. Shared chrome comes from the package-private `fieldBox` recipe (same surface as Input). Textarea adds only `flex field-sizing-content` on top of `fieldBox({ box: "content" })`; the `content` rung is what replaces the `control` rung's pinned `h-(--control-h-md)` with `min-h-16 py-2`. No `h-auto` is emitted — `field-box.test.ts` asserts its absence. Nothing exported. _(Amended 2026-09-03 — §8.5: the height release moved into the shared recipe's `box` axis; the text still described a local `h-auto`.)_

No `size` axis. Inline padding and control type pin the `md` rung per [conventions](conventions.md) ruling 2, 2026-08-21, via `fieldBox`.

**Density mapping / `min-h` ruling.** Textarea is content-sized (`field-sizing-content`) with a `min-h-16` floor. That floor is **not** a control-box height and does **not** retarget with density — it stays 4rem at both stamps so a multi-line field cannot collapse to a single Button row. Inline padding reads `--control-px-md`; type reads the control-type pair. `py-2` is block padding for a multi-line field (not a pinned single-height box) and stays. No `dense:` / `comfortable:` variants.

## 5 Consumed tokens

- `card` — resting background (`bg-card`; see §8).
- `input` — border (`border-input`); disabled fill (`disabled:bg-input/50`).
- `ring` — shared `focusRing({ target: "self" })`; no local focus classes.
- `error` — invalid border + ring (`aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20`).
- `muted-foreground` — placeholder.

## 6 Data attributes

**Emitted**: `data-slot="textarea"`.

**Consumed**: `aria-invalid` (styling hook — supplied by base-ui Field when wrapped in `Field.Control`, or set directly by the consumer); native `disabled`/`focus-visible` states. When wrapped by `InputGroup.Textarea` the slot is overridden to `input-group-control` (see input-group spec).

## 7 Accessibility

- Native `<textarea>` semantics (`role="textbox"` with `aria-multiline`); no aria is hand-written here.
- **Aria-wiring note**: because this is a plain element rather than a base-ui Field control, label/description/error association is NOT automatic from merely sitting inside `Field.Root` — it must be wrapped in `Field.Control render={<Textarea/>}` (or given explicit `id`/`aria-describedby`). `TextareaField` packages this correctly; prefer it for any labeled usage.
- Disabled styling: `disabled:cursor-not-allowed disabled:opacity-50` (note: no `pointer-events-none` here, unlike Input — faithful to ref).
- Focus is `focus-visible`-scoped; keyboard focus shows the ring.
- Enter inserts a newline (never submits); no keyboard behavior is added by the component.

## 8 Divergence from reference

1. **`bg-transparent` → `bg-card`** — aligned with Input for parity; input-like surfaces use the `card` token. The ref relied on downstream overrides (`TextArea` re-applied `bg-white`, `InputGroupTextarea` re-applied `bg-transparent`); the new default makes the standalone control correct out of the box, and `InputGroup.Textarea` still overrides to transparent.
2. **`dark:` variant classes dropped** (`dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`) — dark axis lives in tokens.
3. **`destructive` → `error`** token rename on the invalid border/ring classes.
4. **Density retokenization:** `px-2.5` and `text-base md:text-sm` become `--control-px-md` and the control-type pair. `min-h-16` is an explicit content-floor exemption.
5. **The height release lives in `fieldBox`, not here** (2026-09-03): the control's pinned `h-(--control-h-md)` is swapped for `min-h-16 py-2` by the shared recipe's `box: "content"` rung, so Textarea adds only `flex field-sizing-content` and emits no `h-auto` (`field-box.test.ts` asserts its absence). §4 described a local `h-auto` override that no longer exists.

Kept as-is (not divergences): plain `<textarea>` rather than a base-ui control; `field-sizing-content` auto-grow; no exported recipe.

## 9 Test requirements

- Renders `getByRole("textbox")`; typing multi-line content works (keyboard: type, press Enter, type — value contains the newline).
- Wrapped in `Field.Control` inside `Field.Root` + `Field.Label`: accessible name resolves via role/name query; `aria-describedby` links Description.
- Bare inside `Field.Root` (without `Field.Control`): document current behavior — no automatic name; test asserts the `TextareaField` path instead for labeled cases.
- `disabled` excludes it from tab order; `aria-invalid` styling attribute reaches the DOM.
- `maxLength` enforced natively (typing past the limit truncates).
- Dual-density: at document `dense` and `comfortable`, inline padding and control type match the signed `md` rung; `min-h-16` is identical across stamps; nested `data-density` does not rescope. Shared focus-ring helper at both stamps.

## 10 Demo requirements

Plain runnable `.tsx` demos: `textarea-basic.tsx` (placeholder + auto-grow while typing), `textarea-states.tsx` (disabled, readOnly, invalid), `textarea-in-field.tsx` (Field.Control wrapping with label/description/error — the manual composition `TextareaField` automates).
