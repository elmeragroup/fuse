---
"@elmeragroup/fuse": patch
---

`ThemeProvider` no longer client-renders Suspense boundaries below it that are still streaming.
Its context value used to change once the color scheme connected after mount. React then
client-rendered any boundary that had not hydrated yet, and a boundary whose content was still
streaming showed that content twice until the streaming runtime dropped the server's copy. The
provider's value now stays the same, and `useColorScheme` subscribes on its own. A
`useColorScheme` consumer that hydrates after the provider connected first renders the server's
value, then updates.
