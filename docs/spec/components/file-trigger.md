# FileTrigger

## 1 Header

- **Canonical name**: `FileTrigger` (single component)
- **Export path**: `@elmeragroup/ui/react-aria/file-trigger` — exports `FileTrigger` + `FileTriggerProps`. `react-aria/` prefix marks the quarantined RAC dependency.
- **Tier**: **react-aria interim** — foundational-layer atom (cluster README group 4).
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/file-trigger.tsx` (composes the tier-internal RAC `button.tsx`, which borrows the base-ui `buttonVariants` recipe)

## 2 Anatomy

```
FileTriggerPrimitive (RAC; renders a hidden <input type="file">, ref target)
└─ Button (RAC button styled by base-ui buttonVariants; size default "sm")
   ├─ leading icon — when withIcon (default):
   │    Icon.Camera     when defaultCamera set
   │    Icon.Folder     when acceptDirectory
   │    Icon.Paperclip  otherwise
   └─ children (label content)
```

## 3 Props

`FileTriggerProps = { withIcon?, isDisabled?, ref?, className? } & FileTriggerPrimitiveProps & VariantProps<typeof buttonVariants>`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `acceptedFileTypes` | `string[]` | — | MIME types / extensions → input `accept` |
| `allowsMultiple` | `boolean` | — | → input `multiple` |
| `acceptDirectory` | `boolean` | — | directory picker (`webkitdirectory`); selects the Folder icon |
| `defaultCamera` | `"user" \| "environment"` | — | mobile capture hint; selects the Camera icon |
| `onSelect` | `(files: FileList \| null) => void` | — | fires after the native picker closes |
| `withIcon` | `boolean` | `true` | leading icon on/off; adds `gap-x-2` when on |
| `isDisabled` | `boolean` | — | applied to the visible Button |
| `size` / `variant` | `buttonVariants` axes | `size="sm"` | `variant` routed to the Button (ref bug fixed, §8) |
| `className` | `string` | — | merged onto the Button |
| `ref` | `RefObject<HTMLInputElement>` | — | the hidden file input |
| `children` | `ReactNode` | — | button label |

## 4 Variants

None of its own — borrows the public `buttonVariants` recipe (`variant`, `size`) for the visible button; `withIcon` only toggles a gap class.

## 5 Consumed tokens

All via `buttonVariants` (button surface/foreground/focus tokens); this module adds no colors itself.

## 6 Data attributes

`data-slot="button"` on the visible button (from the tier-internal Button); RAC emits `data-pressed`/`data-hovered`/`data-focus-visible`/`data-disabled` on it. The file input itself is visually hidden by RAC. None consumed.

## 7 Accessibility

- The visible control is a real button; the `<input type="file">` is hidden and activated programmatically by RAC — Space/Enter open the native picker
- Icons are decorative and must be `aria-hidden` (ref omits this — added, §8); `children` provides the accessible name
- `isDisabled` disables the button (and picker activation)

## 8 Divergence from reference

1. **Export path**: bare export → `@elmeragroup/ui/react-aria/file-trigger` (interim quarantine prefix).
2. **Icons**: `Icon.Camera` / `Icon.Folder` / `Icon.Paperclip` → Phosphor `Camera` / `Folder` / `Paperclip` (verified — all three exist under those exact names in Phosphor), curated via `@elmeragroup/ui/icons`, regular weight, `aria-hidden` added.
3. **Ref bugs fixed**: (a) `variant` is typed via `VariantProps<typeof buttonVariants>` but the ref never passes it to `Button` — it leaks into the `...props` spread onto `FileTriggerPrimitive`; we route it to the Button. (b) `isDisabled` likewise leaks onto `FileTriggerPrimitive` (not a RAC FileTrigger prop) while also being read for the Button; we pass it to the Button only.
4. No raw colors, no `destructive` classes, no `dark:`/`inverted:` variants present — nothing to convert.
5. Dies with the tier: the base-ui replacement is a plain hidden-input + Button composition.

## 9 Test requirements

- `getByRole("button", { name })` renders; a hidden `<input type="file">` exists and receives `accept` from `acceptedFileTypes`, `multiple` from `allowsMultiple`
- Clicking/keyboard-activating the button clicks the hidden input (spy on input `click`); `onSelect` fires with a `FileList` when files are set on the input and `change` dispatched
- Icon selection: `defaultCamera` → Camera, `acceptDirectory` → Folder, default → Paperclip; `withIcon={false}` renders no icon
- `isDisabled` disables the button; `variant`/`size` classes land on the button (regression for §8.3)

## 10 Demo requirements

- `file-trigger-basic.tsx` — attach-file button (`acceptedFileTypes`, `allowsMultiple`) listing selected file names
- `file-trigger-modes.tsx` — camera and directory modes showing the icon switch
