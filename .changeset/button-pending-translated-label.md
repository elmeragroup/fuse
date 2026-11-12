---
"@elmeragroup/fuse": patch
---

A `Button` no longer throws `NotFoundError` when it turns pending on a page that Chrome's built-in
translation has translated. The pending indicator now renders after the children and still shows
at the leading edge. Before, React inserted it before the label's text node, which translation had
already replaced, and the error unmounted the tree up to the nearest error boundary.
