# Reference sources

`.ref/` is intentionally gitignored because it contains large upstream checkouts and two access-controlled company repositories. It is not a runtime/build dependency of the published package, but the pinned checkout is required before copying new implementation code or assets from a reference. A clean-clone implementer creates the exact directory names below, clones the listed remote, checks out the detached commit, and verifies `git -C .ref/<name> rev-parse HEAD` equals the table. If access to a required company repository is missing, report the blocker and preserve the existing implementation or artwork.

| Directory                     | Clone remote                                                       | Required commit                            |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `.ref/base-ui`                | `https://github.com/mui/base-ui.git`                               | `582d51a8383b2b86b9bf466ba2ff7708807c1639` |
| `.ref/coss`                   | `https://github.com/cosscom/coss.git`                              | `e43fa4a8da4c490ebf3e1e1707b2a9af6fa2a217` |
| `.ref/flag-icons`             | `https://github.com/yammadev/flag-icons.git`                       | `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e` |
| `.ref/kumo`                   | `https://github.com/cloudflare/kumo.git`                           | `bba0f5eb1249e9936f83e04319e6db0458e98717` |
| `.ref/OrderModuleInternalWeb` | `git@ssh.dev.azure.com:v3/fjordkraft/ITUTV/OrderModuleInternalWeb` | `83a2097485367ace2dc66d46b62b3878a044c73a` |
| `.ref/OrderModuleWeb`         | `git@ssh.dev.azure.com:v3/fjordkraft/ITUTV/OrderModuleWeb`         | `ac5727784ff37cfc761b234517fe0270df663e02` |
| `.ref/react-spectrum`         | `https://github.com/adobe/react-spectrum.git`                      | `de6bc849cc36ed441123cbefb8b2e542b03020f4` |
| `.ref/shadcn-ui`              | `https://github.com/shadcn-ui/ui.git`                              | `d4fc45b1fbabfccb7a6a4333d8004cf19481caa9` |

References supply code and source artwork. Adapt copied code to Fuse's current public API, semantic tokens, accessibility, localization and client boundaries. Preserve independent regression expectations. Lifted files retain applicable license/copyright notices, and no `.ref/` path may appear in package source, generated declarations, or the packed artifact.

## Regenerating flags

`generate-flags` refuses to copy assets unless `.ref/flag-icons` is a Git checkout at the commit in the table above, with no staged, unstaged, or untracked changes under `svg/` or to `LICENSE`. The generator never fetches, checks out, or otherwise modifies that checkout. To recover, inspect with `git -C .ref/flag-icons status --porcelain` and `git -C .ref/flag-icons diff`, then restore with `git -C .ref/flag-icons checkout --detach <commit from the table>` and, after human review of `git -C .ref/flag-icons restore .` or `git -C .ref/flag-icons clean -n`, rerun generation.

## Copying styles and assets

Translate legacy Material roles into Fuse's semantic roles with the mapping in
[token provenance](src/theme/tokens/PROVENANCE.md#external-mappings-and-unresolved-choices).
Choose new roles by usage. Only the `destructive` pair remains a compatibility
alias to `error`.

Prefer the internal snapshot when both company references contain a logo. Telinet
comes from OrderModuleWeb. Steddi intentionally uses the same glyph for full and
mark variants. Preserve fixed artwork colors; translate token classes on Signing.
The icon and illustration modules retain their exact source-path comments.

Before adding new artwork, record its source and permission for public distribution.
Package code is MIT. Retain source notices when copying code or artwork; the
package license does not relicense third-party assets. The five Twemoji-derived
emoji graphics remain CC BY 4.0 under [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
and [their license](licenses/twemoji-CC-BY-4.0.txt). Flags retain their MIT license
and generated provenance under `src/flags`. Fonts are app-supplied; this package
never includes font binaries. Brand marks and illustrations remain bundled local
assets, and country flags resolve from the installed package rather than a CDN.
