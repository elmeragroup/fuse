---
"@elmeragroup/fuse": patch
---

Every JSDoc block in the package now reads in one style, so the API reference, the markdown
endpoint and editor hovers describe each prop the same way. Boolean props open with "Whether",
callbacks with "Called when", and props types with "Props for". Defaults the code declares are no
longer repeated in prose, and the docs use US spelling. The public types and runtime behavior are
unchanged.
