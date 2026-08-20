# Elmera UI

Whitelabel React components for Elmera Group's energy brands and corporate Elmera. One public package, 20 theme permutations (variant × brand × segment), ESM-only.

Density is a document-level control-metric axis, independent of theme. Variant supplies only the deployment default (`internal → dense`, `external → comfortable`). Brand is host-owned: spread `themeAttributes(theme)` on `<html>`, then stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))`.

## Develop

Node `>=24.13 <25`, pnpm 11.

```sh
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm test:browser
```

Docs: `pnpm --filter docs dev` → http://localhost:3000.
