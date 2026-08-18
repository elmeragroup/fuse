# ButtonGroup

## 1. Header

- **Canonical name:** `ButtonGroup` — namespace compound: `ButtonGroup.Root`, `ButtonGroup.Separator`, `ButtonGroup.Text`.
- **Export path:** `@elmeragroup/ui/base-ui/button-group`. The `buttonGroupVariants` recipe stays **public** (ref already exports it) from the same module.
- **Tier:** styled composite over plain DOM + the canonical Separator.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/button-group.tsx` (separator import corrected to `base-ui/separator.tsx`, see §8).

## 2. Anatomy

| Part | Renders | Purpose |
| --- | --- | --- |
| `ButtonGroup.Root` | `div role="group"` | Layout container; collapses inner radii/borders of `data-slot` children into one visual control. |
| `ButtonGroup.Separator` | canonical `Separator` (`@base-ui/react/separator`) | Hairline divider between segments (split-buttons). |
| `ButtonGroup.Text` | `useRender` div (default) | Static label/affix segment styled to sit flush with buttons. **Convention exemplar:** already built on base-ui `useRender` + `mergeProps` in the ref — the pattern every polymorphic part follows. |

Children opt into the group's corner/border collapsing by emitting `data-slot` (Button, Select trigger, Separator, Text all do).

## 3. Props

**`ButtonGroup.Root`** — `ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Recipe axis **and** emitted as `data-orientation`. Defaulted (divergence, §8) so the attribute is always present. |
| `className` | `string` | — | Merged via `cn`. |
| …rest | div props | — | `role="group"` is fixed. |

**`ButtonGroup.Separator`** — `ComponentProps<typeof Separator>`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Note the flipped default: a horizontal group needs a vertical hairline. |
| `className` | `string` | — | Merged over the group-separator overrides. |
| …rest | Separator props | — | Forwarded to the canonical base-ui Separator. |

**`ButtonGroup.Text`** — `useRender.ComponentProps<"div">`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `render` | `RenderProp` | `<div />` | base-ui polymorphism (e.g. render as `<label>`). |
| `className` | `string` | — | Merged via `cn` inside `mergeProps`. |
| …rest | div props | — | Passed through `mergeProps`. |

## 4. Variants

Recipe: `buttonGroupVariants` (`tv`) — **public**. Default: `orientation: "horizontal"`.

**Base:** `group/button-group flex w-fit items-stretch`; focused child lifts above siblings (`*:focus-visible:relative *:focus-visible:z-10`); nested button-groups get `gap-2` (`has-[>[data-slot=button-group]]:gap-2`); native-select escape hatch re-rounds a trailing select trigger when an `aria-hidden` `<select>` is last (`has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md`); unsized select triggers become `w-fit`; direct `input` children get `flex-1`.

| `orientation` | Classes (summary) |
| --- | --- |
| `horizontal` | `*:data-slot:rounded-r-none`; last `data-slot` child restores `rounded-r-md!`; every `data-slot` following another gets `rounded-l-none border-l-0` |
| `vertical` | `flex-col`; same scheme on the block axis: `rounded-b-none` / last child `rounded-b-md!` / followers `rounded-t-none border-t-0` |

`ButtonGroup.Text` styling (module-private micro-recipe, plain `cn`): `flex items-center gap-2 rounded-md border bg-muted px-2.5 text-sm font-medium shadow-xs`; svg children non-interactive, default `size-4`.

`ButtonGroup.Separator` overrides on the canonical Separator: `relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto`.

## 5. Consumed tokens

`muted` (Text background), `border` (Text border, and via the Separator's base `bg-border`), `input` (Separator override tint inside groups), `ring` indirectly via child focus styles. Radii: `rounded-md` edges from `--radius`; the group deliberately re-rounds only outer corners — child radius clamps (`min(var(--radius-md), 8px/10px)` on small Buttons) are overridden by the child's own `in-data-[slot=button-group]:rounded-md`, keeping the group's silhouette uniform. No raw palette classes; no `dark:` variants.

## 6. Data attributes

**Emitted:** Root — `data-slot="button-group"`, `data-orientation="horizontal" | "vertical"` (always present, §8); Separator — `data-slot="button-group-separator"` plus the canonical Separator's `data-slot="separator"` semantics and base-ui's `data-orientation`; Text — `data-slot="button-group-text"` via `useRender` `state`.
**Consumed:** child `[data-slot]` is the **layout contract** — the horizontal/vertical variants select `[data-slot]` children for radius/border collapsing, and Button reacts from its side via `in-data-[slot=button-group]:rounded-md`. Any child that should join the group's silhouette must emit `data-slot` (this is why InputGroup.Text gains `data-slot` in its own spec). Also consumed: `[data-slot=select-trigger]`, `select[aria-hidden=true]`, and the Separator's `data-horizontal`/`data-vertical`.

## 7. Accessibility

- Root renders `role="group"`; consumers supply `aria-label`/`aria-labelledby` when the grouping needs a name.
- **Roving focus is NOT provided** — each button is a separate tab stop; Tab/Shift+Tab move between them. Arrow-key roving belongs to toolbar/toggle-group components, not this layout container.
- Separator is a base-ui Separator (`role="separator"` semantics with correct `aria-orientation`); purely visual here.
- Focused children are lifted (`z-10`) so focus rings are never clipped by adjacent segments.
- `ButtonGroup.Text` is static content; use `render={<label htmlFor=… />}` when it labels an adjacent input.

## 8. Divergence from reference

1. **Namespace renames (LOCKED):** `ButtonGroup` → `ButtonGroup.Root`, `ButtonGroupSeparator` → `ButtonGroup.Separator`, `ButtonGroupText` → `ButtonGroup.Text`. No flat exports.
2. **`orientation` defaults to `"horizontal"` (fix):** the ref leaves the prop `undefined` and passes it straight to `data-orientation`, so the attribute was omitted in the default case while the recipe still styled horizontally. The spec defaults the prop, so `data-orientation` is **always emitted** and CSS/tests can rely on it.
3. **Separator import unified (fix):** the ref imports `../separator` — the root `separator.tsx`, which emits **no `data-slot`** and sizes via an orientation ternary instead of `data-horizontal`/`data-vertical` classes. The spec uses the canonical `base-ui/separator.tsx` (emits `data-slot="separator"`, styles via data-orientation variants). This matters because `[data-slot]` is the group's layout contract (§6): a slotless separator is invisible to the radius/border-collapsing selectors and to the Button's `in-data-[slot=button-group]` hook chain. Same contract reasoning gives `InputGroup.Text` a `data-slot` in its own spec.
4. **Kept:** public `buttonGroupVariants`; `ButtonGroup.Text` on `useRender` (highlighted as the convention exemplar); flipped `orientation="vertical"` default on Separator.

## 9. Test requirements

Role-based queries only (`getByRole("group")`, `getByRole("button", { name })`, `getByRole("separator")`).

- Root renders `role="group"` with `data-slot="button-group"` and `data-orientation="horizontal"` by default; `orientation="vertical"` flips both attribute and `flex-col` layout.
- **No roving focus:** Tab moves focus button → button; ArrowRight/ArrowLeft do **not** move focus (assert explicitly — this is contract, not omission).
- Enter/Space activate the focused child button inside the group (grouping does not swallow keyboard activation).
- Separator: present with correct `aria-orientation`; emits `data-slot="button-group-separator"`.
- Text: default renders a `div` with `data-slot="button-group-text"`; `render={<label />}` swaps the tag and merges className (useRender exemplar test).
- Child `data-slot` children get collapsed inner corners; the last child keeps its trailing rounded edge.

## 10. Demo requirements

Plain runnable `.tsx` demos, one per scenario:

- `button-group-basic.tsx` — horizontal group of attached Buttons (variant matrix inside a group).
- `button-group-vertical.tsx` — `orientation="vertical"` stack.
- `button-group-split-button.tsx` — primary action + `ButtonGroup.Separator` + `CaretDown` (Phosphor) menu trigger; shows `aria-expanded` pinned styling on the open trigger.
- `button-group-text.tsx` — `ButtonGroup.Text` affix (plain and `render`-as-`label`), incl. an icon child.
- `button-group-nested.tsx` — nested groups demonstrating the `gap-2` spacing rule.
