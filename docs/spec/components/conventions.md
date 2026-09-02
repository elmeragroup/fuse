# Component spec conventions

Shared conventions every component spec references instead of repeating. Sources: Component API spec template (wayfinder ticket 011), Theme provider API (wayfinder ticket 006), Icon system (wayfinder ticket 009), Canonical token contract (wayfinder ticket 001), Spec: text inputs & fields (wayfinder ticket 019) (family-wide prop-style rulings).

## Spec template

Every component spec has exactly ten sections: **1 Header** (canonical name, canonical subpath, RSC status, tier, source-of-truth file) · **2 Anatomy** (compound parts → base-ui primitives) · **3 Props** (table per part) · **4 Variants** (tv axes/values/defaults, recipe name + publicity) · **5 Consumed tokens** · **6 Data attributes** (emitted and consumed) · **7 Accessibility** (keyboard, aria, focus) · **8 Divergence from reference** · **9 Test requirements** · **10 Demo requirements**.

`Source of truth` in a header means **pinned lift source**, not decision authority: provision the commit listed in the root spec README, copy the named file(s), then apply this chapter, the owning architecture/theme/accessibility chapters, and the component's §8. When those disagree with lifted code, the normative spec wins. Never fill a missing reference with guessed code or artwork.

## API conventions

- **Compound components use namespace style**: `Field.Root`, `Field.Label`, `InputGroup.Addon` — matching base-ui 1:1. Flat ref exports (`FieldLabel`) are renamed in the spec; each rename is a Divergence entry.
- **Polymorphism: base-ui `useRender`** (`render` prop + `mergeProps`). Never an `as` prop.
- **Overlay components take `container?: HTMLElement | RefObject<HTMLElement>`** and default to the nearest `ThemeScope` under the lifecycle rules in [theming](../theming.md) §7.4.
- **Docs chrome is not library Sidebar.** Overlay `container` / `ThemeScope` rules apply to library overlays (dialog, popover, sheet, …). The docs site's SideNav and QuickNav are **docs-local** compositions over `ScrollArea` ([docs-site](../docs-site.md) §2); they must not be implemented as, or blocked on, `@elmeragroup/ui/sidebar`.
- **Prop style is two-level**: primitives keep base-ui naming (`disabled`, `invalid`, `readOnly`, `min`, `max`, event handlers); labeled composites keep the refs' proven face — `isDisabled`/`isInvalid`/`isReadOnly`/`isRequired`/`isPending`/`isSuccess` booleans, `onChange(value)` (value, not event), `minValue`/`maxValue`/`formatOptions`, `errorMessage: ReactNode` (unified — never `string`).
- **Variant engine is `tv`** (tailwind-variants); typed via `VariantProps`. Recipes are exported only where a borrow pattern exists (e.g. `buttonVariants`, `buttonGroupVariants`, `textFieldVariants`), and a public recipe is exported from its component's own entry. There is no public styles barrel. Micro-recipes and helper hooks stay module-private unless a component spec explicitly names a public hook.
- `aria-*` booleans use the `x || undefined` idiom (never `"false"`); conditional-spread objects guard against base-ui `mergeProps` clobbering auto-wired aria with `undefined`.

## Styling conventions

- **Tokens only** — the `no-primitive-colors` lint rule forbids raw palette classes in library source. Canonical status names are `error/info/success/warning` (+`-soft`); `destructive` classes are consumer-compat aliases and never appear in library source.
- **Input-like surfaces use `bg-card`** (white in all 20 themes today, dark-ready) — never literal `bg-white`.
- **No `dark:` variants** (`no-tailwind-dark-variant` rule) — the dark axis lives in tokens behind `[data-theme="dark"]`.
- **State-variant scope**: the raw CSS entry defines the internal reference's base-ui variants exactly. For example, `data-open:` expands to `&:where([data-state="open"]), &:where([data-open]:not([data-open="false"]))` and is therefore **self-scoped**, not an ancestor selector; `data-closed:` follows the same pattern. Put these classes on the element that emits the state. Ancestor state is always explicit through a named `group-*`, `peer-*`, or `in-data-*` variant—never inferred from bare `data-open:`. The copied set and snapshot cover exactly nine variants: `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal`, and `data-vertical`.
- Class merging goes through the package-private `cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }` helper; the package has no dependency on `@elmeragroup/lib`. Recipe composition goes through `tv`.
- `focusRing` is one package-private slotted `tv` recipe in `styles/utils`, with `root` and `control` slots and exactly three targets. `self` puts `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` on `root`. `within` requires the owned focus receiver to emit `data-focus-ring-control`; its `root` classes use `has-[[data-focus-ring-control]:focus-visible]:` prefixes for the same five declarations, while `control` supplies `focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0` to prevent a double ring. `state` always puts `outline-none` on `root` and, when RAC's explicit `isFocusVisible` boolean is true, adds `ring-2 ring-ring ring-offset-2 ring-offset-background`; `control` is empty. A group marks only its owned input/segment receiver, never addon buttons, so nested controls retain their own rings. All these literal focus classes live in this recipe and nowhere else.
- `disabledHatch` is the package-private exact class constant `bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgb(0_0_0/0.02)_8px,rgb(0_0_0/0.02)_16px)]`. The shared icon-state constants are likewise exact: `iconCrossfadeTransition = "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"`, `iconCrossfadeShown = "blur-0 scale-100 opacity-100"`, and `iconCrossfadeHidden = "scale-[0.25] opacity-0 blur-[4px]"`.
- Every focusable component composes `focusRing`; invalid-state rings and static one-pixel popup hairlines are separate styling concerns and do not count as focus-ring definitions.
- Radii derive from `--radius`/`--radius-button` and the locked arithmetic; components never hardcode radius values (the ref's `min(var(--radius-md), 8px)` clamps are kept and documented per component).

## Density metrics

A `size` axis that encodes a **control box** shares four rungs — `xs`, `sm`, `md`, `lg` — and a default control-type pair (`--control-text` / `--control-leading`). Density-owned metrics are control height, control inline padding, icon-edge inline padding, and control gap on every rung, plus font-size and line-height on `md` and `lg` only.

| Rung | Box metrics   | Type                              |
| ---- | ------------- | --------------------------------- |
| `xs` | density-owned | size-owned (`text-xs`)            |
| `sm` | density-owned | size-owned (`text-sm`)            |
| `md` | density-owned | density-owned (control-type pair) |
| `lg` | density-owned | density-owned (control-type pair) |

`xs` and `sm` type must not read the control-type pair. Default size **must pin height**; it is never content-sized. Once height is pinned, do not also set `py-*` on that rung — vertical padding is leftover space in the box.

**Field-box pinning (ruling 2, 2026-08-21).** Input-class surfaces that ship a single fixed height and **no `size` axis** (Input, Textarea inline padding, NumberField, Tabs list, RAC `fieldGroupVariants`) pin the `md` rung: `h-(--control-h-md)`, `--control-px-md`, and the control-type pair where type is density-owned. They do not grow a `size` axis to express density. Comfortable Input therefore matches comfortable Button `default`.

This rule applies to a `size` axis that encodes those control-box metrics (for example Button or Toggle) **and** to those single-height field boxes. Type-scale axes (`Text`, `Heading`), overlay-width axes (`Dialog`, `Sheet`), and decorative sizes are not density rungs. Do not mass-map existing specs; new size-axis control work must map onto these rungs.

**Comfortable source (ruling 1, 2026-08-21).** Dense metrics come from the internal-ref lift (`:root` defaults). Comfortable is the signed `--control-*` column in `ui.css` — never derived from the external ref. External deployments render comfortable via `defaultDensityForVariant` only.

These `--control-*` names are **library-owned implementation variables**, not a public token tier ([theming](../theming.md) §2.7, ADR [0001](../../adr/0001-canonical-token-contract.md) amendment 2026-08-20). They are not role tokens, not brand override keys, and not a consumer customization interface.

Recipes **do not** hardcode those metrics (including `md`/`lg` font-size and line-height) inside a `size` axis, a `data-[size=…]` class string, or a field-box recipe without a size axis. They read the `--control-*` implementation variables declared on `:root` in `ui.css`. The `elmera/no-hardcoded-density-metrics` rule warns when those families are hardcoded; it does not flag the legal numeric spacing below. Do not introduce `dense:` / `comfortable:` custom variants for them; density retargets the variables on `:root[data-density="comfortable"]`, and local exceptions stay on `size`. Do not silently add another unmapped literal ladder.

**Numeric spacing remains legal** for unrelated geometry: borders, translations, hit-area expansion, layout spacing, and explicitly documented optical values outside the density ladder. Radius stays brand-owned. Icon glyph size, shadows, transitions, and table-cell block padding are outside this remit.

Signed ladder values live in `ui.css` ([theming](../theming.md) §2.7). [Button](button.md) records the first size→rung map.

## Icons

Phosphor only, imported by named export from `@elmeragroup/ui/icons` (curated server-safe adapters). Components render **regular** weight; `fill` is reserved for selected/active states. Canonical swaps from the refs: `Loader2 → SpinnerGap` (spin animation), `Check → Check`, `ChevronUp/ChevronDown → CaretUp/CaretDown`, `ChevronsUpDown → CaretUpDown`, `Search → MagnifyingGlass`, `X → X`.

## Tests & demos

- Tests co-located: `*.test.ts` (unit project) / `*.browser.test.tsx` (browser project). **All queries role/label-based**; keyboard-interaction tests cover each spec's §7 behaviors. Written fresh — never ported. Unit tests assert recipe class output and pure functions; they do not read component source to pin spelling. Remaining source-level invariants live in `packages/ui/src/source-contracts.test.ts`. _(Amended 2026-09-02.)_
- Dual-density browser tests follow Button: stamp `data-density` on `document.documentElement` (`dense` and `comfortable`), assert computed metrics against the signed `--control-*` ladder, and prove nested `data-density` / `ThemeScope` variant changes do not rescope. Ticket 79, 2026-08-22: `pnpm gen component` stubs this dual-density browser-test pattern alongside the docs page. Focus rings use the shared helper in `packages/ui/test/assert-focus-ring.ts` (ring on `:focus-visible`, absent on mouse focus, both density stamps).
- Demos are plain runnable `.tsx` files (one per spec §10 scenario) living in the **docs app** next to the component's page (`apps/docs/src/app/(docs)/components/<slug>/demos/`, [docs-site](../docs-site.md) §6). The page imports them as ordinary modules; the build reads the same file as displayed source; future VR targets glob them there. They import via public specifiers (`@elmeragroup/ui/...`) only. _(Amended 2026-08-24 — ruling 74b, 2026-08-24: demos live in the docs app, never as published package code.)_
