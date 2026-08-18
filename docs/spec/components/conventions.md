# Component spec conventions

Shared conventions every component spec references instead of repeating. Sources: [Component API spec template](../../../wayfinder/tickets/011-component-api-spec-template.md), [Theme provider API](../../../wayfinder/tickets/006-theme-provider-api.md), [Icon system](../../../wayfinder/tickets/009-icon-system.md), [Canonical token contract](../../../wayfinder/tickets/001-canonical-token-contract.md), [Spec: text inputs & fields](../../../wayfinder/tickets/019-spec-forms-text.md) (family-wide prop-style rulings).

## Spec template

Every component spec has exactly ten sections: **1 Header** (canonical name, export path, tier, source-of-truth file) · **2 Anatomy** (compound parts → base-ui primitives) · **3 Props** (table per part) · **4 Variants** (tv axes/values/defaults, recipe name + publicity) · **5 Consumed tokens** · **6 Data attributes** (emitted and consumed) · **7 Accessibility** (keyboard, aria, focus) · **8 Divergence from reference** · **9 Test requirements** · **10 Demo requirements**.

## API conventions

- **Compound components use namespace style**: `Field.Root`, `Field.Label`, `InputGroup.Addon` — matching base-ui 1:1. Flat ref exports (`FieldLabel`) are renamed in the spec; each rename is a Divergence entry.
- **Polymorphism: base-ui `useRender`** (`render` prop + `mergeProps`). Never an `as` prop.
- **Overlay components take a `container` prop** and must be portalled inside the active `ThemeScope`.
- **Prop style is two-level**: primitives keep base-ui naming (`disabled`, `invalid`, `readOnly`, `min`, `max`, event handlers); labeled composites keep the refs' proven face — `isDisabled`/`isInvalid`/`isReadOnly`/`isRequired`/`isPending`/`isSuccess` booleans, `onChange(value)` (value, not event), `minValue`/`maxValue`/`formatOptions`, `errorMessage: ReactNode` (unified — never `string`).
- **Variant engine is `tv`** (tailwind-variants); typed via `VariantProps`. Recipes are exported only where a borrow pattern exists (e.g. `buttonVariants`, `buttonGroupVariants`, `textFieldVariants`); micro-recipes stay module-private.
- `aria-*` booleans use the `x || undefined` idiom (never `"false"`); conditional-spread objects guard against base-ui `mergeProps` clobbering auto-wired aria with `undefined`.

## Styling conventions

- **Tokens only** — the `no-primitive-colors` lint rule forbids raw palette classes in library source. Canonical status names are `error/info/success/warning` (+`-soft`); `destructive` classes are consumer-compat aliases and never appear in library source.
- **Input-like surfaces use `bg-card`** (white in all 16 themes today, dark-ready) — never literal `bg-white`.
- **No `dark:` variants** (`no-tailwind-dark-variant` rule) — the dark axis lives in tokens behind `[data-theme="dark"]`.
- **`data-open:` trap**: bare `data-open:` Tailwind variants match any ancestor's attribute; always scope (`data-[open]` on the element via explicit selector) as documented in the internal ref.
- Class merging goes through `cn` from `@elmeragroup/lib`; recipe composition through `tv`. `focusRing` and `disabledHatch` shared recipes come from `styles/utils`.
- Radii derive from `--radius`/`--radius-button` and the locked arithmetic; components never hardcode radius values (the ref's `min(var(--radius-md), 8px)` clamps are kept and documented per component).

## Icons

Phosphor only, imported from `@elmeragroup/ui/icons` (curated per-icon re-exports). Components render **regular** weight; `fill` is reserved for selected/active states. Canonical swaps from the refs: `Loader2 → SpinnerGap` (spin animation), `Check → Check`, `ChevronUp/ChevronDown → CaretUp/CaretDown`, `ChevronsUpDown → CaretUpDown`, `Search → MagnifyingGlass`, `X → X`.

## Tests & demos

- Tests co-located: `*.test.ts` (unit project) / `*.browser.test.tsx` (browser project). **All queries role/label-based**; keyboard-interaction tests cover each spec's §7 behaviors. Written fresh — never ported.
- Demos are plain runnable `.tsx` files (one per spec §10 scenario), consumed by docs extraction and future VR targets.
