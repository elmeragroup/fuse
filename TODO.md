# Open work

## Design and accessibility review

- Review GE dark semantics, Telinet's live collection, shared support roles,
  chart ordering and syntax colors using the [token provenance](packages/fuse/src/theme/tokens/PROVENANCE.md).
- Check dark states, fixed-color artwork and chart distinction in product screens.
- When design supplies ring colors or an audit escalates contrast, replace the
  shared violet where needed. Retain the [accepted contrast exceptions](<apps/docs/src/app/(docs)/accessibility/page.tsx>)
  until reviewed replacements exist, including internal and Telinet light muted copy.
- Ask design for an external secondary hover tone. Every external palette sets `secondary`
  equal to `foreground`, so `--secondary-hover` equals `--secondary` and the hover is invisible.
- Ask design whether external themes keep the reference's 4px corner on the `Checkbox`,
  the phone country trigger and the standalone `Calendar` (`styles/corner-radius.ts`), or
  round them from the brand radius. Internal themes round them with `--radius`.
- Confirm the shared overlay-close dictionary and the docs' client-demo rule and
  three non-public import exceptions with the owner; these remain implemented defaults.

## Consumer and release verification

- Add first-paint fixtures for the written Next Pages, TanStack Start and React Router recipes.
- Finish release activation, packed Next/Vite fixtures and authentication work in
  [the release runbook](scripts/RELEASE.md).
- After upstream tooling uses stable Effect 4 and the release-age guard admits it,
  upgrade and remove prerelease exclusions unless another exception is justified.
- Retire repo-policy workarounds when upstream lint can require disable reasons
  and configure the focus-ring owner path.

## Figma token sync

- Run the first sync against a real Enterprise file and confirm that empty picker scopes,
  cross-collection aliases, the mode change order and the read-back check behave as the
  in-memory fake assumes.
- Add a CI job running `figma:check` once a service account owns a personal access token.
- Density control metrics live only in CSS, so the sync cannot send them to Figma yet.
- Revisit Figma extended collections for brand theming if the two-collection mode
  pairing proves awkward for designers.

## Product-triggered work

- When Base UI offers suitable date primitives, migrate the interim React Aria tier.
  Removing its public subpaths is a major release; other interim atoms can move earlier.
- When a product commits to charts, ship the deferred chart entry and decide its optional peer.
- When a product needs density preferences, define persistence and pre-paint stamping in the host.
- Add brands and locales on product demand; reconsider locale subsetting near ten locales.
- When behavioral tests miss a visual regression or manual theme review stops scaling,
  add visual regression coverage over demos to the publish gate.
- When measured icon weight becomes a problem, reconsider Phosphor core code generation.
- Revisit a source registry or separate playground when consumer demand or docs limitations justify it.
- The docs DTCG export still emits light modes only; the Figma sync in `packages/fuse-figma`
  writes both schemes. Retire the export once designers work from the synced variables.

OrderModule application migrations remain outside this repository's work.
