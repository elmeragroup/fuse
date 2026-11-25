---
"@elmeragroup/fuse": patch
---

Open the Tooltip of an item active through `defaultActiveX`, `defaultActiveKey` or `defaultActiveName` inside a scroll panel less than half the plot's height. Before, the popup never opened there, however the panel was scrolled. The plot's room is now the overlap of the viewport and the padding box of each ancestor that clips its overflow. Fuse caps the room's width and height at the plot's, and the popup opens once the plot shows at least half of each. The check runs again after a scroll or a resize. It takes a scaled panel at its painted size, follows the plot into a web component's open shadow root, and ignores a wrapper that a `position: fixed` or `position: absolute` plot escapes.
