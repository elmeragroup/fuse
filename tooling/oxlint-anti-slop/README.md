# @elmeragroup/oxlint-plugin-anti-slop

Vendored copy of [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) `src/`.

- Upstream commit: `446268e5d15baa968eaec669ff65358d36ae6259`
- Do not install `oxlint-plugin-anti-slop` from npm (third-party name-squat).
- Refresh is a manual diff against that repo; there are no upstream releases.

## Local divergence

`rules/no-slop-comments.ts` and `rules/no-narration-comments.ts` are local rules, not
part of upstream — keep them, their `index.ts` registrations, and
`shared/slop-comments.ts` when refreshing the vendored files. Design rationale: the pre-v1 wayfinder research note 028 (removed at v1; see git history).

`no-slop-comments` takes one option, `ticketPattern` (regex source, default
`[A-Z][A-Z0-9]*-\d+`), for the bare ticket ids that count as a tracker reference.
The root `.oxlintrc.json` sets it to `ELM-\d+`.

## Tests

Run the RuleTester modules (12 vendored + 2 local) with Node 24's test runner:

```sh
pnpm --filter @elmeragroup/oxlint-plugin-anti-slop test
```

The package `test` script is `node --experimental-strip-types --test rules/*.test.ts`. The root Turbo `test`/CI graph discovers it through that script.
