# Accordion

## 1 Header

- **Canonical name**: `Accordion` (namespace compound)
- **Export path**: `@elmeragroup/ui/accordion` (`import { Accordion, accordionVariants } from "@elmeragroup/ui/accordion"`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (NEW component — user-ruled reimplementation of the external radix accordion on the base-ui primitive)
- **Source of truth (API shape)**: `.ref/OrderModuleWeb/packages/ui/src/accordion.tsx` (radix-based; the API being reimplemented)
- **Source of truth (primitive)**: `.ref/base-ui/packages/react/src/accordion/` (`Root`/`Item`/`Header`/`Trigger`/`Panel`)

## 2 Anatomy

| Part                | Base                         | Notes                                                                                                        |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Accordion.Root`    | `AccordionPrimitive.Root`    | `div`; owns value state; applies `base` slot; provides the variant context                                   |
| `Accordion.Item`    | `AccordionPrimitive.Item`    | `div`; one expandable section; applies `item` slot                                                           |
| `Accordion.Header`  | `AccordionPrimitive.Header`  | native `h3`; applies `header` slot                                                                           |
| `Accordion.Trigger` | `AccordionPrimitive.Trigger` | native `button` inside Header; applies `trigger` slot, renders the caret icon after `children`               |
| `Accordion.Content` | `AccordionPrimitive.Panel`   | `div role="region"`; applies `content` slot; wraps `children` in an inner `div` with the `contentInner` slot |

```tsx
<Accordion.Root variant="card" defaultValue={["shipping"]}>
  <Accordion.Item value="shipping">
    <Accordion.Header>
      <Accordion.Trigger>Shipping</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content>Delivered within 3–5 business days.</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
```

`Accordion.Header` is a distinct exported part (base-ui shape). The radix ref folded Header into `AccordionTrigger` (Header wrapping a react-aria `Heading level={3}` wrapping the Trigger); here Header renders base-ui's native `h3` and composition is explicit (§8). Heading level is adjustable via `render` (e.g. `render={<h2 />}`).

## 3 Props

All parts take `className` (merged into their slot via the recipe's `className` argument) and forward the rest of their base-ui part's props, including `render` per conventions.

**Accordion.Root** — `ComponentProps<AccordionPrimitive.Root> & VariantProps<typeof accordionVariants>`:

| Prop                       | Type                                     | Default     | Notes                                                                                                                                                                         |
| -------------------------- | ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                    | `Value[]`                                | —           | controlled open item(s); always an array, even in single mode                                                                                                                 |
| `defaultValue`             | `Value[]`                                | —           | uncontrolled initial open item(s)                                                                                                                                             |
| `onValueChange`            | `(value: Value[], eventDetails) => void` | —           | base-ui signature; second arg is `AccordionRoot.ChangeEventDetails`                                                                                                           |
| `multiple`                 | `boolean`                                | `false`     | replaces radix `type="single" \| "multiple"` (§8)                                                                                                                             |
| `disabled`                 | `boolean`                                | `false`     | disables every item                                                                                                                                                           |
| `hiddenUntilFound`         | `boolean`                                | `false`     | panels use `hidden="until-found"`; find-in-page can expand them; overrides `keepMounted`                                                                                      |
| `keepMounted`              | `boolean`                                | `false`     | keep closed panels in the DOM                                                                                                                                                 |
| `variant`                  | `"default" \| "card" \| "infodropdown"`  | `"default"` | §4; provided to parts via context                                                                                                                                             |
| `radius`                   | `"none" \| "lg" \| "xl"`                 | `"none"`    | §4; provided to parts via context                                                                                                                                             |
| `orientation`, `loopFocus` | —                                        | —           | accepted (base-ui passthrough) but **deprecated upstream** — they no longer affect keyboard focus after the APG roving-focus removal; not part of our documented API (§7, §8) |

**Accordion.Item** — `ComponentProps<AccordionPrimitive.Item>` verbatim: `value` (identity for Root's `value` arrays; auto-generated when omitted), `disabled`, `onOpenChange(open, eventDetails)`.

**Accordion.Header** — `ComponentProps<AccordionPrimitive.Header>` verbatim (renders `h3`).

**Accordion.Trigger** — `ComponentProps<AccordionPrimitive.Trigger>` verbatim: `disabled`, `nativeButton` (default `true`), `render`. Renders `children` then the caret icon; the icon is not replaceable via props (matches the ref).

**Accordion.Content** — `ComponentProps<AccordionPrimitive.Panel>` verbatim, including per-panel `hiddenUntilFound` / `keepMounted` overrides (base-ui allows both root-level and panel-level). `className` lands on the inner `contentInner` div, matching the ref's merge point (§8 note 9).

## 4 Variants

Recipe: `accordionVariants` — **public export** (the ref exports it; kept). `tv` slots: `base`, `item`, `header`, `trigger`, `icon`, `content`, `contentInner`.

| Axis      | Values         | Default | Effect                                                                                                                                               |
| --------- | -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant` | `default`      | ✓       | `item`: `bg-muted rounded-sm`; `trigger`: `transition-[padding-bottom]`                                                                              |
|           | `card`         |         | `base`: `space-y-3`; `item`: `bg-card text-foreground rounded-lg border`; `content`: `bg-card text-foreground rounded-lg`; `icon`: `text-foreground` |
|           | `infodropdown` |         | `base`: `border-border border-b`; `trigger`: `relative justify-start data-[panel-open]:pb-0`; `icon`: `absolute right-0`; `content`: `pl-7`          |
| `radius`  | `none`         | ✓       | no-op                                                                                                                                                |
|           | `lg`           |         | `item`: `overflow-hidden rounded-lg`                                                                                                                 |
|           | `xl`           |         | `item`: `overflow-hidden rounded-xl`                                                                                                                 |

Base slot classes (variant-independent):

- `item`: `p-4`
- `header`: `flex`
- `trigger`: `flex flex-1 cursor-pointer items-center justify-between gap-2 font-medium hover:underline data-[panel-open]:pb-4` plus shared `focusRing({ target: "self" })` (open-state selectors moved from radix `data-[state=open]` to base-ui attributes, §6/§8)
- `icon`: `text-foreground size-4 shrink-0 transition-transform duration-200`, plus `rotate-180` when open (keyed off the trigger's `data-panel-open` via a group selector, §6)
- `content`: `h-0 overflow-hidden transition-[height] duration-200 ease-in-out data-[open]:h-(--accordion-panel-height)` — base-ui height-var transition replacing the radix keyframes; reduced-motion is the central stylesheet block, not a per-component override (§8)
- `contentInner`: `pt-1.5`

**Context-passed variants pattern (kept — extraction verdict: cleanest styling mechanism)**: `Accordion.Root` resolves nothing for its children; it publishes `{ variant, radius }` on an internal `AccordionContext` (memoized), and each part calls `useAccordion()` and runs `accordionVariants(variants)` for its own slot. Parts throw outside a Root. The context and hook stay module-private; only the recipe is public.

## 5 Consumed tokens

Material tokens re-expressed as contract tokens (§8 mapping):

- `muted` — default-variant item surface (subtle grouped background role).
- `card` + `foreground` — card-variant item/content surface and text (raised white surface role; never literal `bg-white`).
- `border` — card-variant item border and infodropdown separator (`border-b`).
- `foreground` — caret icon (all variants; card restates it).
- `ring` + `background` — Trigger's shared focus recipe.
- Radii: `rounded-sm` / `rounded-lg` / `rounded-xl` — `--radius`-derived scale steps, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `accordion` · `accordion-item` · `accordion-header` · `accordion-trigger` · `accordion-content` (added; the radix ref has none, §8).

**Emitted (by base-ui, styled by us)**: `data-open`/`data-disabled`/`data-index` on Item, Header and Panel; `data-panel-open`/`data-disabled` on Trigger (the trigger does **not** get `data-open`); `data-starting-style`/`data-ending-style` on Panel; `data-orientation`/`data-disabled` on Root. Panel exposes `--accordion-panel-height`/`--accordion-panel-width` CSS vars.

**Consumed selectors**: trigger `data-[panel-open]:pb-4` (and infodropdown `data-[panel-open]:pb-0`); icon rotation via the trigger group (`group/accordion-trigger` on the trigger, `group-data-[panel-open]/accordion-trigger:rotate-180` on the icon); content `data-[open]:h-(--accordion-panel-height)`. All arbitrary state selectors are self-scoped; the named group selector is the explicit ancestor-state channel per conventions.

## 7 Accessibility

- Base-ui wires the disclosure pattern: Trigger is a native `button` with `aria-expanded` and `aria-controls`; Panel is `role="region"` with `aria-labelledby` pointing at the trigger; Header is a real `h3` heading (adjustable via `render`).
- Keyboard: Enter/Space on a focused trigger toggles its panel. Focus moves between triggers with **Tab/Shift+Tab only** — base-ui removed roving focus per the APG guidance update, so Arrow/Home/End trigger navigation does not exist and `orientation`/`loopFocus` are deprecated no-ops (§8 note 8).
- Single mode (`multiple={false}`, default) is always collapsible: the open item's trigger closes it; `aria-disabled` is never forced onto the open trigger (radix needed `collapsible` for this, §8).
- `hiddenUntilFound` keeps closed panel content findable by the browser's find-in-page; a match fires `beforematch` and base-ui opens the item.
- Icon is decorative (`aria-hidden`); per conventions, boolean aria uses `x || undefined`.

## 8 Divergence from reference

1. **Reimplementation on base-ui**: the ref wraps `@radix-ui/react-accordion`; this component wraps `@base-ui/react/accordion`. base-ui `Panel` is exported as `Accordion.Content` (matches collapsible's Panel→Content rename); all other part names align 1:1.
2. **Renames (flat → namespace)**: `Accordion`→`Accordion.Root`, `AccordionItem`→`Accordion.Item`, `AccordionTrigger`→`Accordion.Trigger` (+ new `Accordion.Header`), `AccordionContent`→`Accordion.Content`.
3. **`type` → `multiple`**: radix `type="single" | "multiple"` becomes base-ui's `multiple?: boolean` (default `false`). Radix's `collapsible` prop is **dropped**: base-ui single mode is always collapsible, so there is no non-collapsible configuration; migrating code deletes both props or replaces `type="multiple"` with `multiple`.
4. **Value shape**: `value`/`defaultValue`/`onValueChange` kept (base-ui-native), but the value is always an array — radix single mode used a bare string. `onValueChange` gains a second `eventDetails` argument.
5. **Header**: the ref's `AccordionTrigger` internally rendered radix `Header asChild` around a react-aria `Heading level={3}`. Base-ui's `Accordion.Header` renders a native `h3` itself, so the react-aria `Heading` is dropped and Header becomes an explicit exported part the consumer composes.
6. **Icon**: `MaterialIcon.ExpandMore` → Phosphor `CaretDown` (regular weight, from `@elmeragroup/ui/icons`), rotated `180deg` when open. Rotation selector moves from radix `[&[data-state=open]>svg]:rotate-180` to a group selector on base-ui's trigger attribute — note base-ui triggers emit `data-panel-open`, not `data-open`.
7. **Open-state selectors**: every radix `data-[state=open]` / `data-[state=closed]` becomes the base-ui attribute for that element (`data-open` on Item/Header/Panel, `data-panel-open` on Trigger), scoped per conventions.
8. **Animation**: radix `animate-accordion-up/down` keyframes (which depend on `--radix-accordion-content-height` and a Tailwind keyframe registration) are replaced by a plain height transition against base-ui's `--accordion-panel-height` var: `h-0 overflow-hidden transition-[height] … data-[open]:h-(--accordion-panel-height)`. Reduced-motion is the central stylesheet block (accessibility.md §7), not a per-component `motion-reduce:*` override. Default-variant trigger padding uses `transition-[padding-bottom]`, not `transition-all`. _(Amended 2026-09-02.)_
9. **Content `className` merge point kept**: like the ref, consumer `className` on Content merges into the inner `contentInner` div (padding layer), not the animating outer panel — the outer height transition must not be perturbable.
10. **Token mapping (Material → contract)**: `bg-secondary-container` → `bg-muted` (subtle grouped-surface role; not `secondary-soft`, which is reserved for status/emphasis tinting); `text-on-surface` → `text-foreground`; `bg-on-primary` → `bg-card`; `text-on-primary-container` → `text-foreground`; `border-on-primary-container/25` → `border-border`.
11. **Deprecated primitive props not adopted**: base-ui's `orientation` and `loopFocus` are deprecated upstream (APG removed roving focus) and no longer affect keyboard behavior; they pass through but are documented as unsupported and excluded from tests/demos.
12. **`data-slot` attributes added** on every part (the radix ref emits none), consistent with the internal-ref convention.
13. **`accordionVariants` stays public** — the ref exports it and the borrow pattern exists; kept per conventions.
14. **New capability surfaced**: root-level `hiddenUntilFound`/`keepMounted` and per-item `disabled`/`onOpenChange` come free from base-ui; the radix ref had no equivalents.
15. **Focus unified:** Trigger composes the canonical self-focus adapter rather than inheriting the ref/browser outline.
16. **Disclosure retired**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/disclosure.tsx` (`Disclosure`/`DisclosureGroup`/`DisclosureHeader`/`DisclosurePanel`, a RAC-shaped API over these same base-ui primitives) is **not carried forward**. Migration mapping:
    - `DisclosureGroup` + `Disclosure` → `Accordion.Root` + `Accordion.Item`: `defaultExpandedKeys` → `defaultValue`, `allowsMultipleExpanded` → `multiple`, `Disclosure id` → `Item value`, `DisclosureHeader` → `Header`+`Trigger`, `DisclosurePanel` → `Content` (`shouldUnmountOnCollapse` → `!keepMounted`; note the inverted default — Disclosure kept panels mounted by default, Accordion unmounts by default).
    - Ungrouped `Disclosure` → `Collapsible` (see collapsible.md): `defaultExpanded` → `defaultOpen`, `isExpanded` → `open`, `onExpandedChange` → `onOpenChange`, `shouldUnmountOnCollapse` → `!keepMounted`.
    - This retirement removes the last react-aria dependency (`react-aria/heading`) outside the date/calendar cluster.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Structure: each item exposes `getByRole("heading", { level: 3 })` containing a `getByRole("button")` trigger with `aria-expanded` and `aria-controls` pointing at a `getByRole("region")` panel labelled by the trigger.
- Toggle: click and Enter/Space on the trigger open and close the panel; `aria-expanded` and the region's visibility track.
- Single vs multiple: default mode — opening item B closes item A, and clicking the open item's trigger closes it (always-collapsible); `multiple` — both stay open independently.
- Focus: Tab moves trigger → trigger → (open) panel content; Arrow keys do **not** move focus between triggers (deprecation guard — asserts we don't accidentally reintroduce roving focus expectations).
- Controlled: `value` + `onValueChange` round-trips; callback receives the full array value; single-mode array has length ≤ 1.
- Disabled: `disabled` on Root disables every trigger; per-item `disabled` disables only that item (`data-disabled` present, click is a no-op).
- `hiddenUntilFound`: closed panel content stays in the DOM with `hidden="until-found"`; dispatching `beforematch` opens the item. `keepMounted`: closed panel stays in the DOM (hidden); default unmounts.
- Variants: `variant`/`radius` from Root reach Item/Trigger/Content via context — unit recipe test asserts the class tokens; browser asserts computed fill, radius, and item spacing. Parts throw when rendered outside `Accordion.Root`. _(Amended 2026-09-04 — spec 07 / [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain runnable `.tsx` demos: `accordion-basic.tsx` (default variant, single mode, three items), `accordion-multiple.tsx` (`multiple` with `defaultValue` opening two items), `accordion-variants.tsx` (`default` / `card` / `infodropdown` side by side, `radius` axis on card), `accordion-controlled.tsx` (`value` + `onValueChange` with external open-all/close-all buttons), `accordion-hidden-until-found.tsx` (`hiddenUntilFound` with searchable closed content).
