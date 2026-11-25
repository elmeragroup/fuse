---
"@elmeragroup/fuse": patch
---

`Carousel.Indicator` keeps its 24px target when the host's root font size is below 16px. At a
14px root it measured 21px. It still grows with a root above 16px.

`Sidebar.MenuAction` and `Sidebar.GroupAction` keep their 24px target at a 14px and a 12px root,
and under a Tailwind-source host whose `--spacing` is 2px, 2.5px or 3.5px, at both densities. The
`sm` and `lg` menu actions still grow with a root above 16px.

Each action's enlarged hit area now stays inside its own row: a menu action's covers its row's
height and the menu button's end padding, and a group action's covers its label's height. Before,
an action could cover the bottom of the action above it, a group action could cover the top of the
first menu row, and a press near a truncated label's end could open the action instead of the row.
An `sm` or `lg` row and the group label are never shorter than their action.

`Sidebar.MenuBadge` stays centered on its row on an `sm` row at a 12px root and under a
Tailwind-source host's `--spacing`.

In the collapsed icon rail, a group's hidden label no longer catches presses on the last row of
the group above it.
