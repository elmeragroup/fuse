# Field

## 1 Header

- **Canonical name**: `Field` (namespace compound)
- **Export path**: `@elmeragroup/ui/field` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — base-ui Field validity/context wiring
- **Tier**: base-ui structural primitive (unlabeled building block; labeled composites such as `TextField`/`TextareaField` build on it)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/field.tsx`

## 2 Anatomy

Twelve parts. Base UI owns id/aria wiring; validation visibility stays external (see §7).

| Part | Base | Notes |
| --- | --- | --- |
| `Field.Root` | `@base-ui/react/field` `Field.Root` | orientation layout owner |
| `Field.Label` | base-ui `Field.Label` | auto-associated label |
| `Field.Description` | base-ui `Field.Description` | auto `aria-describedby` |
| `Field.Error` | base-ui `Field.Error` | renders `null` without children; `match` + `role="alert"` |
| `Field.Control` | base-ui `Field.Control` | wires any control via `render` |
| `Field.Item` | base-ui `Field.Item` | per-item scope inside grouped fields |
| `Field.Content` | `div` | flex column for label+description beside a control |
| `Field.Group` | `div` | vertical stack of fields; `@container/field-group` |
| `Field.Set` | `@base-ui/react/fieldset` `Fieldset.Root` | fieldset semantics |
| `Field.Legend` | base-ui `Fieldset.Legend` | `variant` prop styles as legend or label |
| `Field.Separator` | `div` wrapping the canonical base-ui `Separator` | optional inline content |
| `Field.Title` | `div` | label-look heading without label semantics |

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Field.Control render={<Input type="email" />} />
  <Field.Description>Work address preferred.</Field.Description>
  <Field.Error>{errorMessage}</Field.Error>
</Field.Root>
```

## 3 Props

All parts accept `className` (merged via `cn`) and the underlying element/primitive props. Primitive-tier naming applies (`disabled`, `invalid`, `name` — never `isDisabled` at this tier).

**Field.Root** — `ComponentProps<FieldPrimitive.Root>` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal" \| "responsive"` | `"vertical"` | tv axis; also emitted as `data-orientation` |
| `disabled` | `boolean` | — | base-ui; cascades `data-disabled` to parts |
| `invalid` | `boolean` | — | base-ui; forces invalid state |
| `name` / `validate` / `validationMode` / `validationDebounceTime` | base-ui | base-ui defaults | pass-through; external validators own visibility |

**Field.Legend** — `ComponentProps<Fieldset.Legend>` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
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

- `error` — invalid text on `Field.Root` (`data-[invalid=true]:text-error`) and `Field.Error` text.
- `muted-foreground` — `Field.Description` text, `Field.Separator` inline content.
- `primary` — `Field.Label` checked-card border (`has-data-checked:border-primary/30`); link hover in descriptions.
- `background` — `Field.Separator` content chip backdrop.
- Border color of the embedded rule comes from the canonical `Separator` component (its own `border` token).

## 6 Data attributes

**Emitted**: `data-slot` per part — `field`, `field-label` (on **both** `Field.Label` and `Field.Title` — deliberate, see §8), `field-description`, `field-error`, `field-control`, `field-item`, `field-content`, `field-group`, `field-set`, `field-legend`, `field-separator`, `field-separator-content`; `data-orientation` on Root; `data-variant` on Legend; `data-content` (boolean) on Separator.

**Consumed**: base-ui state attrs `data-disabled`/`data-invalid` (label opacity via `group-data-[disabled=true]/field`, root text color via `data-[invalid=true]`); child `data-slot` values `checkbox-group`, `radio-group` (Set/Group gap tightening), `field-content` (horizontal alignment), `field` (card-style labels: nested Field inside Label gets border, radius, padding), `field-label` (horizontal flex-auto); `data-variant=legend` adjacency (`[[data-variant=legend]+&]:-mt-1.5` on Description); `group-data-[variant=outline]/field-group` on Separator (consumed from a variant-carrying group wrapper).

## 7 Accessibility

- Base UI wires `htmlFor`/`id`, `aria-describedby` (Description), and `aria-invalid`/error association (Error) automatically; the library never hand-writes these ids.
- `Field.Error` renders with `role="alert"` and `match` so the single, externally-translated message announces on appearance. External validators own visibility — the component renders exactly what it is given.
- `Field.Set`/`Field.Legend` provide native fieldset/legend group semantics for radio/checkbox clusters.
- `Field.Title` intentionally carries **no** label semantics (plain `div`) — use it for label-styled headings where a `<label>` would be incorrect (e.g. labelling a group, not a control).
- No keyboard behavior of its own; focus behavior belongs to the wrapped control.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Field`→`Field.Root`, `FieldLabel`→`Field.Label`, `FieldDescription`→`Field.Description`, `FieldError`→`Field.Error`, `FieldGroup`→`Field.Group`, `FieldContent`→`Field.Content`, `FieldItem`→`Field.Item`, `FieldLegend`→`Field.Legend`, `FieldSet`→`Field.Set`, `FieldSeparator`→`Field.Separator`, `FieldTitle`→`Field.Title`, `FieldControl`→`Field.Control`.
2. **`Field.Item` gains `cn` class merge** — the ref passes `className` raw (`className={className}`), silently dropping base styles ordering guarantees every other part has; inconsistency fixed.
3. **`destructive` → `error`** token rename throughout (root invalid text, error text) per the canonical token contract.
4. **`dark:` variant dropped** (`dark:has-data-checked:border-primary/20` on Label) — dark axis lives in tokens behind `[data-theme="dark"]`.
5. **`FieldTitle` `data-slot="field-label"` duplication KEPT deliberately** — the orientation recipe and disabled-opacity selectors target `[data-slot=field-label]`; Title must participate in the same layout/disabled contract as Label while remaining a non-label element. Renaming its slot would fork every sibling selector.
6. **Separator import unified** to the canonical base-ui `Separator` component (single source; the ref already imported `./separator` — the spec pins this against drift).

## 9 Test requirements

- Label association: render Root+Label+Control(Input); query the input by accessible name (`getByRole("textbox", { name: … })`).
- Description wiring: input's `aria-describedby` resolves to the Description text (role/label queries only, no test-ids).
- Error: absent from DOM when `children` is falsy; with children, present with `role="alert"` and associated to the control.
- `disabled` on Root cascades: control disabled, label rendered with `data-disabled` state.
- `invalid` on Root: control gets `aria-invalid`; root emits `data-invalid`.
- `orientation` prop reflected as `data-orientation` for all three values.
- Legend `variant` reflected as `data-variant`.
- Separator: `data-content="true"` with children, `"false"` without.
- Keyboard: Tab reaches the control; clicking the Label focuses the control (native label activation).

## 10 Demo requirements

Plain runnable `.tsx` demos, one per scenario: `field-basic.tsx` (label + input + description), `field-error.tsx` (external validation message toggling), `field-orientations.tsx` (all three orientations inside `Field.Group`), `field-set.tsx` (Set + Legend + checkbox group with Field.Item), `field-choice-card.tsx` (Field nested in Label — card-style selectable field with Title/Content), `field-separator.tsx` (grouped fields with labeled separator).
