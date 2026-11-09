---
"@elmeragroup/fuse": minor
---

Adds the opt-in `@elmeragroup/fuse/temporal-polyfill` subpath for the coming Temporal-based date
components. Import it bare, once in each runtime that renders, before any of them runs:

```ts
import "@elmeragroup/fuse/temporal-polyfill";
```

It installs `temporal-polyfill` 1.0.8, now a pinned dependency, on `globalThis` only where no
`Temporal` exists, and leaves an engine's own Temporal in place. Where it installs, it also replaces
`Intl.DateTimeFormat` with the polyfill's. The root `@elmeragroup/fuse` entry never imports it.
Fuse's Temporal code warns once in development in every engine when the subpath was not imported,
and throws a `TypeError` that names the subpath in an engine without Temporal.
