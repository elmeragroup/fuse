# Test audit workflow

An audit sweeps existing tests for the [junk patterns](SKILL.md#junk-patterns)
and the test-only seams they keep alive, then lands one coherent batch per
owner boundary. [SKILL.md](SKILL.md) owns the value bar and its terms. This
file adds the order of work.

## 1. Discovery

Discovery is read-only. For a broad scope, give each [lane](SKILL.md#terms)
its own read-only agent when subagents are available, plus one cross-cutting
sweep for a single junk pattern. Draw the lanes from these test trees:

- `packages/fuse`: its `src/` suites, root `src/*.test.ts` package gates, type
  tests, and `test/` support and packed-consumer checks;
- `packages/color` and `packages/fuse-figma`;
- `apps/docs/test` and `apps/static-theme/test`;
- the repo-policy suite in `test/`.

Prefer a few candidates you can prove to a long speculative inventory.

Done when every lane has returned its candidates, each with its location and
the junk pattern it matches.

## 2. Candidate evidence

Before judging a candidate, read the complete test and its production owner:
the entry point, callers, callees, sibling implementations, overlapping tests,
the Vitest project that runs it, and the history that added it (`git log -S`,
the PR). When the test claims behavior a dependency provides (Base UI, React
Aria, Tailwind, React Flight), read that dependency's source or types in
`node_modules`.

Record every field below. A candidate with a missing field stays.

- exact test name and location;
- the failure it can actually detect;
- non-test callers of the covered production code or test-only seam;
- the keeper that remains and the mutation that turned it red, or why no
  contract exists;
- relevant history and the reason the test or seam exists;
- production or test-support deletions it unlocks;
- risk and the focused validation command.

To prove a keeper, make one deliberate mutation of the production owner and
confirm the keeper goes red. Then restore the source byte for byte.

Share the evidence with the user before editing, unless their request already
covers the edits.

## 3. Edit

Pick one coherent owner-boundary batch. Delete test-only seams and dead
production paths outright, with no aliases left behind. Move retained
regressions to their keepers. Consolidate repeated package or dependency
assertions into one generic contract.

Prefer net-negative production lines. A replacement test that restates the
same implementation fails the gate, and an uncertain candidate stays as it is.

When a seam is a public export, removing it changes the package API and needs
a changeset. Read [scripts/RELEASE.md](../../../scripts/RELEASE.md) first.

## 4. Validation

1. While editing, run the focused commands the Tests section of `AGENTS.md`
   names.
2. For a removed source grep or manifest assertion, run the lint rule, script
   or turbo task that owns the real contract, such as `package:check`,
   `size-limit`, `test:packed-consumer`, `test:repo-policy` or `docs#generate`.
3. Rebuild `apps/docs` and `apps/static-theme` before running their tests
   through Vitest directly. Both read the last build: the docs global setup
   runs `next start`, and the static-theme tests read and serve its `dist/`.
4. Before review, run the gates the Tests section of `AGENTS.md` names.
5. Read `git diff --numstat` and count production and tooling lines separately
   from test and test-support lines.

## 5. Landing

Commit, push, or open a PR only when the user authorizes it. A PR that
changes only tests and test support carries the `no-changeset` label. Handle a
baseline failure as [CAMPAIGN.md §7](CAMPAIGN.md#7-product-defects) says. Land
one batch at a time. After it merges, refresh from `main` and rerun discovery
for the next batch.

## 6. Handoff

Report:

- the junk patterns removed and why they arose;
- production owner simplifications and the test-only seams deleted;
- retained false positives and the contract each still guards;
- the focused and full proof actually run, including each mutation;
- production and tooling lines versus test and test-support lines;
- PR and merge state;
- named follow-ups.
