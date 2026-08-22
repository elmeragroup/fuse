# TimelineList

## 1 Header

- **Canonical name**: `TimelineList` namespace: `TimelineList.Root`, `TimelineList.Item`, `TimelineList.Title`, `TimelineList.Time`, `TimelineList.Description`
- **Export path**: `@elmeragroup/ui/timeline-list` (also re-exported from `@elmeragroup/ui`)
- **RSC**: server — owns no state, effects, event handlers, or browser APIs; `Title` may render the client `Heading` child without making the list module client
- **Tier**: presentational semantic-list composite
- **Source of truth**: `.ref/OrderModuleWeb/packages/ui/src/timeline-list.tsx` and `.ref/OrderModuleInternalWeb/packages/ui/src/timeline-list.tsx`

## 2 Anatomy

```text
TimelineList.Root                    <ol>
└─ TimelineList.Item                 <li>
   ├─ decorative dot                <span aria-hidden>
   ├─ TimelineList.Title             Heading level={3}
   ├─ TimelineList.Time              <time dateTime={ISO}>
   └─ TimelineList.Description       <div>
```

The connecting line is `Item::before` on every non-last item. Root supplies list semantics and resets list spacing; consumers may interleave no non-Item children because `:last-child` controls the line.

## 3 Props

| Part          | Props                                                                           | Notes                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`        | `ComponentPropsWithoutRef<"ol">`                                                | forwards `ref` to `HTMLOListElement`                                                                                                                                                                                               |
| `Item`        | `ComponentPropsWithoutRef<"li">`                                                | forwards `ref` to `HTMLLIElement`                                                                                                                                                                                                  |
| `Title`       | `Omit<ComponentPropsWithoutRef<typeof Heading>, "noMargin">`                    | defaults `level={3}` and forces `noMargin`; explicit props may override `level`, but cannot unset `noMargin`                                                                                                                       |
| `Time`        | `Omit<ComponentPropsWithoutRef<"time">, "dateTime"> & { date: string \| Date }` | normalizes a valid value with `new Date(date).toISOString()`; every invalid value throws `RangeError("TimelineList.Time received an invalid date")`; the generated `dateTime` is component-owned and applied after remaining props |
| `Description` | `ComponentPropsWithoutRef<"div">`                                               | forwards `ref`                                                                                                                                                                                                                     |

All parts accept `className`; library classes merge first and consumer classes last through the package-private `cn` helper.

## 4 Variants

`timelineListVariants` is a module-private slotted `tv` recipe with `root`, `item`, `dot`, `title`, `time`, and `description` slots. It has no axes or public export. Base geometry follows the references: item `relative mb-10 ml-6 pl-6`; dot `absolute left-0 top-2 size-[8.75px] rounded-full`; connector `left-[4px] top-8 h-full w-px` on non-last items. The final item removes bottom margin. Root uses `m-0 list-none p-0`.

## 5 Consumed tokens

- `foreground`: dot and time text
- `border`: connector line (replaces the reference's raw `zinc-600`)

Title and Description inherit their normal typography/color. No primitive palette class is allowed.

## 6 Data attributes

Each part emits its slot marker: `data-slot="timeline-list"`, `timeline-list-item`, `timeline-list-title`, `timeline-list-time`, and `timeline-list-description`. The decorative dot has `data-slot="timeline-list-dot"`. No state data attributes are consumed.

## 7 Accessibility

- Root/Item use native ordered-list semantics; no redundant roles.
- The dot and connector are decorative (`aria-hidden="true"` and CSS pseudo-element respectively).
- `Time` always emits a machine-readable ISO `dateTime`; visible children remain consumer-owned localized copy.
- Heading level defaults to 3 but consumers must choose a level consistent with their page hierarchy.
- There is no keyboard behavior because the component adds no interaction.

## 8 Divergence from reference

1. Flat `ListItemWithTimeline*` exports become the `TimelineList` namespace; no aliases ship.
2. Adds semantic `Root` (`<ol>`) so a complete accessible list is available from the public API.
3. `timelineVariants` becomes module-private `timelineListVariants`; there is no proven recipe-borrowing use.
4. Connector `bg-zinc-600` becomes `bg-border`; dot `bg-on-surface` becomes `bg-foreground` under the canonical token grammar.
5. Fixes the erroneous `ListItemWithTimeline.displayName = "Card"` by using namespace display names.
6. `date` accepts `Date` as well as string and has an explicit, environment-independent invalid-date `RangeError` contract.
7. React 19 refs are ordinary props; no new `forwardRef` wrapper.

## 9 Test requirements

- Renders one `list` containing the expected number of `listitem`s and heading/text content.
- Dot is hidden from the accessibility tree; connector exists only on non-last items by recipe assertion.
- `Time` normalizes a `Date` and an offset-bearing string to ISO; invalid input always throws the documented `RangeError`; untyped `dateTime` cannot override the generated ISO value.
- Consumer `className` and native attributes/ref reach each part.
- Public API exports only the namespace and part prop types from `/timeline-list`; the old flat names and recipe do not resolve.
- Server-boundary test imports and renders the entry without a `"use client"` directive.

## 10 Demo requirements

- `timeline-list-basic.tsx`: three dated events with titles and descriptions.
- `timeline-list-rich.tsx`: events with links/actions supplied by the consumer inside Description, demonstrating that TimelineList itself owns no interactivity.
