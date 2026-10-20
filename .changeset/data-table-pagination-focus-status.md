---
"@elmeragroup/fuse": patch
---

`DataTable.Pagination` keeps focus on a page button that becomes unavailable: pressing Next or
Last through to the last page (or First or Previous back to the first) leaves the button focused
with `aria-disabled` instead of dropping focus to the page. The page status is now a polite
`role="status"` region, so each page change is announced.
