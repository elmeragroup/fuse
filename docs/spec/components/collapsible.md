# Collapsible

## 1 Header

- **Canonical name**: `Collapsible` (namespace compound)
- **Export path**: `@elmeragroup/ui/collapsible` (also re-exported from `@elmeragroup/ui`)
- **Tier**: unstyled base-ui primitive passthrough
- **RSC**: client
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/collapsible.tsx`

## 2 Anatomy

| Part | Base | Notes |
| --- | --- | --- |
| `Collapsible.Root` | `CollapsiblePrimitive.Root` | `div`; owns open state |
| `Collapsible.Trigger` | `CollapsiblePrimitive.Trigger` | native `button`; toggles the panel |
| `Collapsible.Content` | `CollapsiblePrimitive.Panel` | `div`; the expandable region (base-ui `Panel` renamed, §8) |

```tsx
<Collapsible.Root defaultOpen>
  <Collapsible.Trigger>Show details</Collapsible.Trigger>
  <Collapsible.Content>…</Collapsible.Content>
</Collapsible.Root>
```

## 3 Props

Pure passthrough — every part forwards `ComponentProps` of its base-ui part verbatim, including `className` and `render` per conventions. The wrappers add only `data-slot` (§6).

**Collapsible.Root**:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` | — | controlled open state |
| `defaultOpen` | `boolean` | `false` | uncontrolled initial state |
| `onOpenChange` | `(open: boolean, eventDetails) => void` | — | base-ui signature; second arg is `CollapsibleRoot.ChangeEventDetails` |
| `disabled` | `boolean` | `false` | ignores user interaction |

**Collapsible.Trigger** — `disabled`, `nativeButton` (default `true`), `render`.

**Collapsible.Content**:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `hiddenUntilFound` | `boolean` | `false` | `hidden="until-found"`; find-in-page can expand the panel; overrides `keepMounted` |
| `keepMounted` | `boolean` | `false` | keep the element in the DOM while closed |

## 4 Variants

None — **deliberately visually unstyled** (kept from the ref) except the mandatory shared `focusRing({ target: "self" })` on Trigger. No `tv` recipe, no `variant`/`radius` axes, and no layout/surface classes. Consumers style via `className`/`render`; animation hooks are base-ui's data attributes and `--collapsible-panel-height`/`--collapsible-panel-width` CSS vars on the panel (e.g. `h-0 overflow-hidden transition-[height] data-[open]:h-(--collapsible-panel-height)`). Styled disclosure UIs belong to `Accordion` (accordion.md).

## 5 Consumed tokens

`ring` + `background` only, through Trigger's mandatory focus recipe; no surface/layout token consumption.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `collapsible` · `collapsible-trigger` · `collapsible-content`.

**Emitted (by base-ui, available to consumers)**: `data-open`/`data-closed` + `data-starting-style`/`data-ending-style` on Root and Panel; `data-panel-open` on Trigger (the trigger does **not** get `data-open`). Panel exposes `--collapsible-panel-height`/`--collapsible-panel-width`.

**Consumed selectors**: Trigger's shared self-focus selector only. Consumer `data-open:` classes follow conventions' self-scoped custom-variant contract and belong on the state-emitting element.

## 7 Accessibility

- Base-ui wires the disclosure pattern: Trigger is a native `button` with `aria-expanded` and `aria-controls` referencing the panel.
- Keyboard: Enter/Space on the trigger toggles; Tab order is trigger → (open) panel content. No other keyboard behavior — a lone disclosure has no composite navigation.
- `hiddenUntilFound` keeps closed content findable by the browser's find-in-page; a `beforematch` hit opens the panel.
- `disabled` on Root or Trigger removes interactivity (`data-disabled` present).

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Collapsible`→`Collapsible.Root`, `CollapsibleTrigger`→`Collapsible.Trigger`, `CollapsibleContent`→`Collapsible.Content`.
2. **base-ui `Panel` → our `Content`**: the ref already exposes the Panel primitive as `CollapsibleContent`; the rename is kept and mirrored by Accordion's `Panel`→`Content` (accordion.md §8).
3. **Visually unstyled passthrough kept deliberately**: the ref adds no layout/surface classes, recipes, or icons — only `data-slot` attributes over the raw primitive. The one addition is the library-wide focus recipe on Trigger. This is the intended tier: Collapsible is the styling-free single-disclosure primitive; the styled sibling is Accordion.
4. **Absorbs retired ungrouped `Disclosure`**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/disclosure.tsx` is retired (accordion.md §8). Ungrouped `Disclosure`/`DisclosureHeader`/`DisclosurePanel` usage migrates here: `defaultExpanded` → `defaultOpen`, `isExpanded` → `open`, `onExpandedChange` → `onOpenChange`, `shouldUnmountOnCollapse` → `!keepMounted` (inverted default: Disclosure kept panels mounted, Collapsible unmounts by default), `DisclosureHeader` → consumer heading + `Collapsible.Trigger`, `DisclosurePanel` → `Collapsible.Content`. Grouped usage migrates to Accordion.
5. **Focus unified:** the otherwise-unstyled Trigger composes the canonical self-focus adapter; there is no v1 focus exception for unheadless primitives.

## 9 Test requirements

Role/label-based queries throughout:

- Toggle: click and Enter/Space on `getByRole("button")` toggle the panel; `aria-expanded` and `aria-controls` are wired; panel content appears/disappears.
- Controlled: `open` + `onOpenChange` round-trips on trigger activation; `defaultOpen` renders open initially.
- Disabled: `disabled` trigger does not toggle; `data-disabled` present.
- `keepMounted`: closed panel stays in the DOM (hidden); default unmounts it.
- `hiddenUntilFound`: closed content stays in the DOM with `hidden="until-found"`; dispatching `beforematch` on the panel opens it and fires `onOpenChange(true)`.
- `render`: Trigger composes onto a custom button via `render` and keeps aria wiring.

## 10 Demo requirements

Plain runnable `.tsx` demos: `collapsible-basic.tsx` (uncontrolled with `defaultOpen`, consumer-styled trigger + height-transition panel using `--collapsible-panel-height`), `collapsible-controlled.tsx` (external `open` state with a separate toggle button), `collapsible-hidden-until-found.tsx` (`hiddenUntilFound` with searchable closed content).
