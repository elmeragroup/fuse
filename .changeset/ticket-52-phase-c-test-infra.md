---
"@elmeragroup/ui": patch
---

Consolidate Phase C test infrastructure. One locator walker covers every component and react-aria browser suite; data-slot and document-root queries still need a §9 cite. Source-spelling greps that ADR 0008 retired are gone, replaced by oxlint one-owner rules for `dirname(fileURLToPath(import.meta.url))` and for local copies of the shared browser-harness helpers (`roleNamed`, `headingNamed`, `cssVarColor`, `textNamed`, `textboxNamed`, `stampDensity`, `px`). `withExtractedTarball` throws so its `finally` can remove the temp directory. `Sidebar.MenuButton` no longer mounts its tooltip Content while the sidebar is expanded or on mobile; before, a zero-delay `Tooltip.Provider` could show the label with the sidebar open. Class assertions dropped in Phase C sit on the unit recipes again.
