---
"@elmeragroup/fuse": patch
---

The standalone `styles.css` no longer uses native CSS nesting, so translucent colours now work in
Chrome 111 and Safari 16.4, the oldest versions Fuse supports. Before, these browsers dropped every nested
`@supports (color: color-mix(...))` block, and each `bg-*/<alpha>` utility painted its opaque
fallback colour instead of the translucent one. The sheet now goes through the same Lightning CSS
pass that a Tailwind production build runs, at the same browser targets. That pass also adds a few
`-webkit-` prefixes and rewrites some values in shorter equivalent forms. Apps that build Fuse
through Tailwind are unaffected.
