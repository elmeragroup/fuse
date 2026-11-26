---
"@elmeragroup/fuse": patch
---

Pressed, checked, active, current, armed and selected parts now show their state in forced-colors
mode, such as Windows contrast themes. Before, forced colors replaced the colors that show the
state, so these parts looked like their resting siblings:

- a pressed `Toggle` and `ToggleGroup.Item`, in the default and the outline variant, lost their
  pressed fill and text color;
- the active `Tabs.Trigger` in a default `Tabs.List` lost its card fill, shadow and text color;
- the checked `RadioIconButton` lost its fill and its primary border color;
- the active `Sidebar.MenuButton` lost its fill and text color and kept only its weight, and the
  active `Sidebar.MenuSubButton` lost its fill and text color;
- the active `NavigationMenu.Link` lost its text color and kept only its weight;
- the checked `DatePicker.PresetItem`, and the pressed date preset of a
  `DataTableFilter.DateEditor` that shows its presets beside a custom editor, lost their accent
  fill and text color;
- the current page's `Pagination.Link` draws a border where the other links draw none, but forced
  colors draw every link's border in the link color, so it looked like the others;
- an armed `destructive` or `success` `ConfirmButton` lost its error or success fill and text
  color.

They now fill with the `Highlight` system color and take `HighlightText` for their text and icons.
The highlight recolors the borders a part already draws, its own in `Highlight` and those inside
it in `HighlightText`, and adds none. A Kbd, Badge or Avatar inside one drops its own background,
so its text stays readable. The active tab of a `line` list keeps its underline and gains no fill.

Under keyboard focus they keep the fill and draw a 2px `HighlightText` outline inside it, 2px in
from the edge. A `DatePicker.PresetItem` draws it while its radio has focus. An outline outside
the part would be clipped by a scrolling container and would not show beside a pressed segment.
A control focused inside one of these parts draws a `HighlightText` outline around itself. A
`Sidebar.MenuAction` and a `Sidebar.MenuBadge` beside an active row draw their icon, text and
count in `HighlightText` on the row's fill, a child that sets its own text color included, and
the action draws its focus outline in `HighlightText`. A filled child, such as a secondary
`Badge`, drops its background and draws its border in `HighlightText`, as inside a highlighted
part. A mark drawn only by its `mark-fill-*` background, such as an unread dot, fills with
`HighlightText`. A disabled active `Sidebar.MenuButton`
draws a 2px `Highlight` frame on its edge in place of the fill, dimmed with the row, and the
action and badge beside it keep the forced colors of any other row.

A selected `Table.Row` lost its muted fill, in a plain table and inside a `Frame`. It now draws a
2px `Highlight` frame on its edge, over its cells, and leaves the cells as they are, so a Meter's
bar, a sticky cell's background and text selected inside the row keep their forced colors. A
sticky cell with its own `z-index` covers the frame where it overlaps it. A row under keyboard
focus, selected or not, draws a 2px `CanvasText` outline 4px in from its edge, inside the frame,
where the table's scrolling container does not clip it.

In forced colors a `Table.Header` made sticky with no `z-index` of its own stays above the frame
and outline of a row that scrolls under it.

The step dots of `Tour.Progress` no longer disappear in forced-colors mode: the other steps' dots
draw in the text color and the current one in `Highlight`.
