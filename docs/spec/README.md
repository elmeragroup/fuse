# Maintained library contracts

These documents describe obligations that future changes to `@elmeragroup/fuse` must preserve. They are current maintenance references, not the completed v1 implementation plan. Read the chapter relevant to your change; routine component work starts with [component authoring](../component-authoring.md).

## Where to look

| Change                                                         | Read                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Component API, styling, tests, or demos                        | [Component authoring](../component-authoring.md), then the component's JSDoc, authored page, and tests |
| Package exports, dependencies, or CSS distribution             | [Architecture](architecture.md)                                                                        |
| Token semantics, density, provider behavior, or overlay scopes | [Theming](theming.md)                                                                                  |
| Setting up a consuming app                                     | [Theme integration](../theming-integration.md)                                                         |
| Keyboard, labels, localization, contrast, or motion            | [Accessibility](accessibility.md)                                                                      |
| Bundle limits, server/client boundaries, or runtime work       | [Performance](performance.md)                                                                          |
| Icons, logos, illustrations, or flags                          | [Icons](icons.md)                                                                                      |
| Builds, lint, test runners, or CI                              | [Tooling](tooling.md)                                                                                  |
| Docs site, generated API reference, or demo pipeline           | [Docs site](docs-site.md)                                                                              |
| Versioning or first-publish setup                              | [Release runbook](release.md)                                                                          |
| Unfinished product work                                        | [Roadmap](roadmap.md)                                                                                  |
| Copying reference code or artwork                              | [Reference sources](../reference-sources.md)                                                           |

[CONTEXT.md](../../CONTEXT.md) defines domain terms. [ADRs](../adr/) record reasons and rejected alternatives.

## Ownership

- These chapters own cross-component behavior and compatibility policies. ADRs explain why.
- Code and configuration own token values, dependency versions, entry inventories, and budget measurements. Link to the owning module or generate a reference instead of copying its data into Markdown.
- Public JSDoc, authored component pages, and type and browser tests own component details. Keep them in step with behavior changes.
- Tests protect behavior, public types, packed output, and independent compatibility expectations. Avoid requiring particular documentation wording, section titles, or historical citation IDs. Performance's RSC table remains an independent reviewed expectation, not generated from the implementation it checks.

When a change affects a contract, update its owning chapter in the same change and record a new architectural trade-off in an ADR. Completed execution steps belong in git history. Pending release prerequisites and deferred work stay visible until resolved.

Migration of the existing OrderModule apps remains outside this library effort.
