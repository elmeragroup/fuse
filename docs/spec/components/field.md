# Field

## 1 Header

- **Canonical name**: `Field` (namespace compound)
- **Export path**: `@elmeragroup/ui/field` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — base-ui Field validity/context wiring
- **Tier**: base-ui structural primitive (unlabeled building block; labeled composites such as `TextField`/`TextareaField` build on it)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/field.tsx`

## 2 Anatomy

Twelve parts. Base UI owns id/aria wiring; validation visibility stays external (see §7).

| Part                | Base                                             | Notes                                                     |
| ------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `Field.Root`        | `@base-ui/react/field` `Field.Root`              | orientation layout owner                                  |
| `Field.Label`       | base-ui `Field.Label`                            | auto-associated label                                     |
| `Field.Description` | base-ui `Field.Description`                      | auto `aria-describedby`                                   |
| `Field.Error`       | base-ui `Field.Error`                            | renders `null` without children; `match` + `role="alert"` |
| `Field.Control`     | base-ui `Field.Control`                          | wires any control via `render`                            |
| `Field.Item`        | base-ui `Field.Item`                             | per-item scope inside grouped fields                      |
| `Field.Content`     | `div`                                            | flex column for label+description beside a control        |
| `Field.Group`       | `div`                                            | vertical stack of fields; `@container/field-group`        |
| `Field.Set`         | `@base-ui/react/fieldset` `Fieldset.Root`        | fieldset semantics                                        |
| `Field.Legend`      | base-ui `Fieldset.Legend`                        | `variant` prop styles as legend or label                  |
| `Field.Separator`   | `div` wrapping the canonical base-ui `Separator` | optional inline content                                   |
| `Field.Title`       | `div`                                            | label-look heading without label semantics                |

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Input type="email" />
  <Field.Description>Work address preferred.</Field.Description>
  <Field.Error>{errorMessage}</Field.Error>
</Field.Root>
```

## 3 Props

All parts accept `className` (merged via `cn`) and the underlying element/primitive props. Primitive-tier naming applies (`disabled`, `invalid`, `name` — never `isDisabled` at this tier).

**Field.Root** — `ComponentProps<FieldPrimitive.Root>` plus:

| Prop                                                              | Type                                         | Default          | Notes                                            |
| ----------------------------------------------------------------- | -------------------------------------------- | ---------------- | ------------------------------------------------ |
| `orientation`                                                     | `"vertical" \| "horizontal" \| "responsive"` | `"vertical"`     | tv axis; also emitted as `data-orientation`      |
| `disabled`                                                        | `boolean`                                    | —                | base-ui; cascades `data-disabled` to parts       |
| `invalid`                                                         | `boolean`                                    | —                | base-ui; forces invalid state                    |
| `name` / `validate` / `validationMode` / `validationDebounceTime` | base-ui                                      | base-ui defaults | pass-through; external validators own visibility |

**Field.Legend** — `ComponentProps<Fieldset.Legend>` plus:

| Prop      | Type                  | Default    | Notes                                       |
| --------- | --------------------- | ---------- | ------------------------------------------- |
| `variant` | `"legend" \| "label"` | `"legend"` | emitted as `data-variant`; drives text size |

**Field.Separator** — `ComponentProps<"div">` plus optional `children?: ReactNode` rendered as inline content over the rule (`data-content` reflects presence).

**Field.Error** — `ComponentProps<FieldPrimitive.Error>`; returns `null` when `children` is falsy. Always sets base-ui `match` and `role="alert"`.

**Field.Label / Field.Description / Field.Control / Field.Item** — pass-through of the respective base-ui primitive props. **Field.Content / Field.Group / Field.Title** — plain `ComponentProps<"div">`.

Polymorphism via base-ui `useRender` (`render` prop); never `as`.

## 4 Variants

- Recipe `fieldVariants` (tv), **module-private** — no borrow pattern exists; consumers style via `className`.
- Single axis `orientation`: `vertical` (default, column, children full-width except `.sr-only`), `horizontal` (row, centered; top-aligns when a `[data-slot=field-content]` child exists; checkbox/radio nudged `mt-px`), `responsive` (vertical, switching to horizontal at `@md/field-group` container width).
- `Field.Legend`'s `variant` is styled via `data-[variant=…]` selectors, not a tv recipe.

## 5 Consumed tokens

- `error` — invalid text on `Field.Root` (`data-invalid:text-error`) and `Field.Error` text.
- `muted-foreground` — `Field.Description` text, `Field.Separator` inline content.
- `primary` — `Field.Label` checked-card border (`has-data-checked:border-primary/30`); link hover in descriptions.
- `background` — `Field.Separator` content chip backdrop.
- Border color of the embedded rule comes from the canonical `Separator` component (its own `border` token).

## 6 Data attributes

**Emitted**: `data-slot` per part — `field`, `field-label` (`Field.Label`), `field-title` (`Field.Title`), `field-description`, `field-error`, `field-control`, `field-item`, `field-content`, `field-group`, `field-set`, `field-legend`, `field-separator`, `field-separator-content`; `data-field-heading` on Label and Title (layout hook, not a slot); `data-orientation` on Root; `data-variant` on Legend; `data-content` (boolean) on Separator.

**Consumed**: base-ui state attrs `data-disabled`/`data-invalid` (label/title opacity via `group-data-disabled/field` on the heading hook, root text color via `data-invalid`). These use presence variants, not `data-[…=true]`, because FieldRoot stamps `data-disabled=""` / `data-invalid=""` for boolean true. Child `data-slot` values `checkbox-group`, `radio-group` (Set gap tightening via `has-[>[data-slot=…]]:gap-3`; Group via `*:data-[slot=checkbox-group]:gap-3` / `*:data-[slot=radio-group]:gap-3` — Group itself stamps `field-group`, so a self `data-[slot=checkbox-group]` selector never matches), `field-content` (horizontal alignment), `field` (card-style labels: nested Field inside Label gets border, radius, padding); `data-field-heading` (horizontal flex-auto — later composites target this hook, never the label slot, when they mean heading-shaped parts); `data-variant=legend` adjacency (`[[data-variant=legend]+&]:-mt-1.5` on Description); `group-data-[variant=outline]/field-group` on Separator (consumed from a variant-carrying group wrapper). _(Amended 2026-09-02 — Group checkbox/radio gap is child-targeting.)_

## 7 Accessibility

- Base UI wires `htmlFor`/`id`, `aria-describedby` (Description), and `aria-invalid`/error association (Error) automatically; the library never hand-writes these ids.
- `Field.Error` renders with `role="alert"` and `match` so the single, externally-translated message announces on appearance. External validators own visibility — the component renders exactly what it is given.
- `Field.Set`/`Field.Legend` provide native fieldset/legend group semantics for radio/checkbox clusters.
- **Card-style label (nested `Field.Root` inside `Field.Label`, §6):** the nested root shadows the outer one, so the control inside the card registers with it and base-ui points the outer label's `htmlFor` at the outer root's control instead. Pair them explicitly — `Field.Label htmlFor="x"` plus `id="x"` on the control — or use the `Field.Item` row scope (what `CheckboxCard` and `Radio` do). Nesting alone leaves the control unnamed, and the card CSS is keyed on exactly that nesting (`has-[>[data-slot=field]]:border`/`:rounded-md` plus `*:data-[slot=field]:p-3` on the label), so the styling contract invites the shape the accessibility contract punishes. `field-choice-card.tsx` (§10) is the paired form and the docs browser test asserts the name; a first-class card composite is the real fix and is not in this chapter yet. _(Amended 2026-09-03 — the wiring caveat was undocumented and the demo hit it.)_
- `Field.Title` intentionally carries **no** label semantics (plain `div`) — use it for label-styled headings where a `<label>` would be incorrect (e.g. labelling a group, not a control).
- No keyboard behavior of its own; focus behavior belongs to the wrapped control.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Field`→`Field.Root`, `FieldLabel`→`Field.Label`, `FieldDescription`→`Field.Description`, `FieldError`→`Field.Error`, `FieldGroup`→`Field.Group`, `FieldContent`→`Field.Content`, `FieldItem`→`Field.Item`, `FieldLegend`→`Field.Legend`, `FieldSet`→`Field.Set`, `FieldSeparator`→`Field.Separator`, `FieldTitle`→`Field.Title`, `FieldControl`→`Field.Control`.
2. **`Field.Item` passes `className` through** — same shape as `Field.Control`: stamp `data-slot`, spread props. No no-op `cn(className)` wrapper.
3. **`destructive` → `error`** token rename throughout (root invalid text, error text) per the canonical token contract.
4. **`dark:` variant dropped** (`dark:has-data-checked:border-primary/20` on Label) — dark axis lives in tokens behind `[data-theme="dark"]`.
5. **`Field.Title` slot is honest** — `data-slot="field-title"` (Label keeps `field-label`). Orientation and disabled-opacity target the shared `data-field-heading` hook both parts emit, so later composites (Select, CheckboxCard, horizontal fields) style heading-shaped parts via the hook, never the label slot. Deliberate divergence from shadcn, which duplicates `field-label` on Title.
6. **Separator import unified** to the canonical base-ui `Separator` component (single source; the ref already imported `./separator` — the spec pins this against drift).
7. **Boolean data-attrs match Base UI empty-string mapping** — `data-invalid:text-error` and `group-data-disabled/field:opacity-50` instead of the ref's `data-[invalid=true]` / `group-data-[disabled=true]/field`. FieldRoot's `fieldValidityMapping` stamps `data-invalid=""` / `data-disabled=""` for boolean true; the `=true` form never matches.
8. **§8.2 and §8.5 are reversals of the pre-spine text, recorded as decisions** — before the spine shipped, §8.2 read "`Field.Item` gains `cn` class merge" and §8.5 read "`FieldTitle` `data-slot="field-label"` duplication KEPT". The shipped code and the current §8.2/§8.5 wording reverse both: `Field.Item` spreads `className` raw (a `cn(className)` wrapper with no base classes is a no-op), and `Field.Title` emits its own `field-title` slot plus the shared `data-field-heading` hook that Select, CheckboxCard and horizontal fields already target. Reverting §8.5 would re-fork every heading selector in those composites; reverting §8.2 changes no rendered output. _(Ruled 2026-09-02, pending owner confirmation: the reversal stands and the current §8.2/§8.5 text is normative.)_

## 9 Test requirements

- Label association: render Root+Label+Control(Input); query the input by accessible name (`getByRole("textbox", { name: … })`).
- Description wiring: input's `aria-describedby` resolves to the Description text (role/label queries only, no test-ids).
- Error: absent from DOM when `children` is falsy; with children, present with `role="alert"` and associated to the control.
- `disabled` on Root cascades: control disabled, label rendered with `data-disabled` state; Label and Title computed opacity matches the `opacity-50` dim (`group-data-disabled/field`).
- `invalid` on Root: control gets `aria-invalid`; root emits `data-invalid`; Root computed color matches the `error` token (`data-invalid:text-error`).
- `orientation` prop reflected as `data-orientation` for all three values.
- Legend `variant` reflected as `data-variant`.
- Separator: `data-content="true"` with children, `"false"` without.
- Keyboard: Tab reaches the control; clicking the Label focuses the control (native label activation).
- Type tests (`*.test-d.tsx`, tooling §7.3): the namespace ships all twelve parts from `@elmeragroup/ui/field` and the root barrel; `Field.Root` takes the three-value `orientation` axis and no size axis; `Field.Legend` takes `legend | label`; parts take `useRender`'s `render` and never an `as` prop _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain runnable `.tsx` demos, one per scenario: `field-basic.tsx` (label + input + description), `field-error.tsx` (external validation message toggling), `field-orientations.tsx` (all three orientations inside `Field.Group`), `field-set.tsx` (Set + Legend + checkbox group with Field.Item), `field-choice-card.tsx` (Field nested in Label — card-style selectable field with Title/Content), `field-separator.tsx` (grouped fields with labeled separator).
