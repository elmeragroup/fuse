---
"@elmeragroup/ui": patch
---

Refresh runtime dependencies to the latest admitted versions. React and
React DOM are 19.3.0. Base UI is 1.8.0, React Aria is 3.52.1, and React
Aria Components is 1.21.1; their exact published pins move with the
catalog. `@internationalized/date` is 3.12.4, `libphonenumber-js` is
1.13.12, and `sugar-high` is 2.4.0 (published range `^2.4.0`).

`Code` and the docs renderer highlight through sugar-high's granular `core`
and `lang/javascript` entries instead of the root barrel, so the `code`
entry measures 12855 gzip bytes — under the 17634-byte ceiling it had
before the upgrade — instead of paying for every language preset.

sugar-high v2 changes token classification for at least one pattern: in
`const html = "<div>" + a + "</div>";`, `a` renders as
`sh__token--property` where v1 emitted `sh__token--identifier`, so
highlighted markup and its colors can differ from v1.
