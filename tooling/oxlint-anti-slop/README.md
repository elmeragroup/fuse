# @elmeragroup/oxlint-plugin-anti-slop

Vendored copy of [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) `src/`.

- Upstream commit: `446268e5d15baa968eaec669ff65358d36ae6259`
- Do not install `oxlint-plugin-anti-slop` from npm (third-party name-squat).
- Refresh is a manual diff against that repo; there are no upstream releases.

## Tests

Run the 12 vendored RuleTester modules with Node 24's test runner:

```sh
pnpm --filter @elmeragroup/oxlint-plugin-anti-slop test
```

The package `test` script is `node --experimental-strip-types --test rules/*.test.ts`. The root Turbo `test`/CI graph discovers it through that script.
