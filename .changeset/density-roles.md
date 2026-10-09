---
"@elmeragroup/fuse": minor
---

Every part now has a density role, and density changes every part that has one. A part is a
`data-slot` the library writes. Its role names the metrics it reads:

- `control`: an interactive single-line box.
- `row`: one line of a collection.
- `surface`: a shell that pads content, or a stack that spaces groups.
- `label`: the words that describe a control.
- `layout`: sized by its children.
- `fixed`: the same at both densities.

`PART_DENSITY` declares every part's role, and the workspace theme catalog carries it. The docs
check every rendered part against its role at both densities. The tokens handbook page lists the
metrics and the parts for each role.

New metrics, in px dense/comfortable:

- Row metrics: `--row-h` 32/36, `--row-h-header` 40/44, `--row-px` 8/12, `--row-py` 6/8. A row
  keeps its text size and grows in height and padding only.
- Surface gaps: `--surface-gap-sm` 8/12, `--surface-gap-md` 12/16, `--surface-gap-lg` 16/24,
  `--surface-gap-xl` 24/32.
- Label metrics: `--label-text` 14/16 and `--label-leading` 20/24. They replace the unreleased
  `--control-text-row` and `--control-leading-row`.
- The Figma sync exports them as `Fuse density` variables, and the theme catalog gives every
  density metric the role that reads it.

What now follows density:

- **Rows.**
  - Menu, Select, Combobox, NavigationMenu content and default Sidebar rows read the row metrics.
  - `Table` and `DataTable` heads and cells, `VerticalTable` keys and values, `GridList` rows,
    `DescriptionList` terms and details, `Sidebar.Input` and `Combobox.Empty` follow too.
  - In a Frame, a table's first and last cells keep their 2px extra edge inset over `--row-px`.
- **Item.**
  - `default` pads every side with `--surface-pad-md` and gaps its parts by `--surface-gap-md`.
  - `sm`, and so every `Alert`, keeps that inline edge and pads its block with `--row-px`.
  - `xs` is a list row on the row metrics.
  - `sm` and `xs` gap their parts by `--surface-gap-sm`.
  - A compact `Item.Group` pads default Items with `--surface-pad-md` and `sm` Items with
    `--row-px`.
- **Field text.**
  - `Field.Label`, `Field.Title`, `Field.Description`, `Field.Error`, a `variant="label"`
    `Field.Legend`, and the React Aria fields' label, description and error read the label
    metrics.
  - A `variant="legend"` `Field.Legend` stays 16/24px.
  - `SelectionItem.Title` and `SelectionItem.Description` read them too. They now write their own
    `selection-item-title` and `selection-item-description` slots in place of `item-title` and
    `item-description`.
- **Group gaps.**
  - `Field.Root` uses `--surface-gap-md`. `Field.Set` and `Field.Group` use `--surface-gap-xl`,
    with `md` or `lg` around nested groups.
  - Checkbox, Radio and selection-item option groups stack by `--surface-gap-sm` and line up by
    `--surface-gap-lg`.
  - `Item.Group` uses `--surface-gap-lg`, or `--surface-gap-sm` for `sm` and `xs` rows.
  - FieldFrame's 4px between a label and its control stays fixed part spacing.
- **Sheet.**
  - The header, body and footer pad with `--surface-pad-lg` and stack by `--surface-gap-lg`.
  - Body blocks are spaced by `--surface-gap-xl`.
- **Accordion.** An open panel sits `--surface-gap-lg` below its trigger. The gap moved from the
  trigger's bottom padding into the panel, so it opens and closes with the panel.
- **Siblings of density-following parts.**
  - The `Pagination` ellipsis is the md control square.
  - `InputGroup.Button` reads the xs rung, or the sm square for `icon-sm`; the `Combobox` caret
    follows.
  - `InputGroup.Addon` pads with the md control icon inset or the md inset, and its text and
    `InputGroup.Text` take the md control type.
  - The `Combobox` chips box takes the md control type, gap and `--row-py`.
  - `Tooltip` pads with `--surface-pad-md` and `--row-py`.
  - The React Aria picker dialog stacks its content by `--surface-gap-lg`.
- **Sidebar.**
  - `Sidebar.Header`, `Sidebar.Footer` and `Sidebar.Group` pad with `--row-px`; the collapsed
    icon rail keeps 8px.
  - `Sidebar.GroupAction`, and `Sidebar.MenuAction` on a default row, are the xs control square,
    centred on their row.
  - `Sidebar.MenuBadge` stays centred on the default row.

Other changes:

- `Button` writes its `size` as `data-size`.
- `Card`'s root, header, content and footer write their `direction` as `data-direction`, and so do
  `CheckboxGroup`, `RadioGroup` and the selection-item list, from their `orientation`.
- TextField, NumberField and PhoneNumberField roots write `data-spacing="part"`, and the other
  labeled composites `data-spacing="group"`: the first stack their label 4px above the control at
  either density.
- `Sidebar.MenuButton` reserves the menu action's square plus 8px at its end, so a truncated
  label stops before the action at either density.
- `Item.Group`'s `sm` and `xs` row gaps now match only its Item rows, not a Button of that size
  inside one.
- When comfortable, an internal theme's InputGroup addon buttons and the PhoneNumberField country
  trigger round at 0, their concentric corner.
- A Menu, Select, Combobox or NavigationMenu row that wraps is 4px taller when comfortable.

Dense moves:

- Tables:
  - A one-line body row is 32px (was 30px).
  - A head inside a Frame is 40px (was 36px).
  - A row with an `icon-sm` button, such as DataTable's row actions, is 44px (was 48px).
  - A framed body row is 32px including its rule (was 33px).
- A one-line `GridList` row is 32px (was 28px).
- `Combobox.Empty` pads 6px on the block axis (was 8px) and 8px inline (was 0).
- `DescriptionList` terms and details pad 6px on the block axis (was 8px).
- A one-line `VerticalTable` row is 33px (was 37px).
- Item:
  - A default `Item` pads 12px on the block axis (was 14px) and gaps by 12px (was 14px).
  - An `sm` Item pads 8px on the block axis (was 10px) and gaps by 8px (was 10px), so a one-line
    `Alert` is 38px (was 42px).
  - An `xs` Item pads 8px inline (was 10px) and 6px on the block axis (was 8px); a one-line `xs`
    Item is 32px (was 36px).
- A standalone `Field.Description` has a 20px line height (was 21px).
- `Field.Group` gaps by 24px (was 28px), and a group of `sm` Items by 8px (was 10px).
- `Sidebar.GroupAction` sits 2px higher. `Sidebar.MenuAction` sits 2px higher on every row size.
