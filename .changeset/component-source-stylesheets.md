---
"@elmeragroup/fuse": minor
---

The package ships one Tailwind source stylesheet per entry at `@elmeragroup/fuse/source/<entry>.css` (`source/button.css`, `source/react-aria/calendar.css`, …). Each declares `@source` for exactly the published files that entry's classes live in, shared style owners included, so an app that adopts one component at a time imports those files instead of scanning the whole package root. The files are generated from each entry's import graph at build time and checked against the packed package, so a refactor that moves a class between files moves the `@source` line with it. The package-root `@source` stays the documented default.
