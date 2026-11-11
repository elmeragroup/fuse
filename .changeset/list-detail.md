---
"@elmeragroup/fuse": minor
---

Add `ListDetail` (`@elmeragroup/fuse/list-detail`), a list beside the detail of its open item.
From the root's `split` width, a container query, the detail is a complementary pane beside the
list; below it, the detail opens in a Sheet over the list. `ListDetail.Title` names the pane and
the dialog alike, and `ListDetail.Close` renders only in the Sheet. The server renders the pane,
which its CSS hides in a root too narrow for it, and the client follows the same container
query. A change of layout, from the root's width, the root font size or `split`, keeps the
detail and focus where the user was.
