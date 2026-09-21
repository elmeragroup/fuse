# 0009 — Docs client boundaries: demo directives, the non-public carve-out, and one code renderer

Date: 2026-09-02. Status: **proposed — pending owner confirmation**. Decisions 1 and 2 are the recommended defaults, implemented and dated so the owner confirms or overturns written text; decision 3 needed no ruling and is accepted.

## Context

[docs-site](../spec/docs-site.md) §6 requires every demo file to begin with `"use client"`, and the generator fails generation when one does not. The rule was enforced but never written down, so a reader could not tell whether it was a deliberate contract or an artefact. Three demos additionally import specifiers a consumer could not reach through `@elmeragroup/fuse/*`, and `apps/docs/package.json` carries two dependencies for those three files alone.

Separately, highlighted code on the site had three renderings (the API panel's signature, the demo frame's source region, MDX fences) while a `DocsCodeBlock` component already existed, and the per-component markdown endpoint printed RSC as a per-prop column where the HTML page prints it once per part ([performance](../spec/performance.md) §3 makes RSC a per-part fact).

## Decision

1. **Every demo is a client module** (pending owner confirmation). The directive is authored in the demo file; the generator and `docs-inspection` validate it and never insert it. A namespace compound (`Dialog.Root`, `ScrollArea.Bar`) is a plain object exported from a client module, so a server component sees only an opaque client reference and member access resolves to `undefined` at prerender. A consumer's page writes the same directive for the same reason, which keeps the displayed source byte-identical to the file that rendered the stage (§6's one-file rule). Docs chrome modules that dot into a compound, such as `theme-matrix.tsx`, carry the directive for the same reason, with a comment naming it; they own a client boundary, not state. _Alternative not taken:_ a generator that adds the directive only when a demo imports client-only symbols — rejected because it would graft a line into the shown source and break the byte-identity.

2. **A closed three-demo carve-out for non-public specifiers** (pending owner confirmation). `calendar-rtl.tsx` (RAC `I18nProvider`, an RTL locale), `date-field-date-input.tsx` (raw RAC `DateField`/`Label` around the exported `DateInput`), and `scroll-area-composed.tsx` (`@base-ui/react/scroll-area` primitives with two `ScrollArea.Bar`s) each render a scenario the reviewed demo coverage requires and the public API cannot express. The list is closed and locked by `apps/docs/test/demo-imports.test.ts`; a new entry amends §6 first. `@internationalized/date` is _not_ a carve-out — it is the value type the date cluster's public API takes, so a consumer imports it too. _Alternative not taken:_ rewriting the three demos, which would drop those scenarios or fake them through the public API.

3. **One code renderer, highlighting on the server** (accepted; no owner ruling needed). `DocsCodeBlock` takes raw `source` and owns highlighting for all three call sites. Because the API accordion is the docs' one client component, the server renders each row's signature block through `DocsCodeBlock` and hands the finished element down as a prop (`ApiPropView.signature`), so `sugar-high` never enters the client graph and no signature is highlighted at hydration — the split `api-row.ts` documents. The markdown endpoint prints RSC once per part on the part heading and drops the per-prop column, matching the HTML page.

## Consequences

- Decisions 1 and 2 are the spec's recommended defaults, recorded so the owner confirms or overturns text rather than reconstructing the argument. Overturning 1 means a conditional generator plus a story for the shown source; overturning 2 means rewriting three demos and dropping two `apps/docs` dependencies.
- The carve-out list has one owner: the §6 bullet and the test that reads it. Adding a demo with a non-public specifier fails that test until the bullet is amended.
- Highlighting stays a prerender cost. A future client-side need for highlighting would have to re-import the highlighter deliberately and re-measure, not acquire it by accident through a shared component.
