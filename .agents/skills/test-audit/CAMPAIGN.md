# Test-pruning campaign

A campaign prunes one subsystem's whole test suite in one PR. A subsystem is a
component family with its docs demos (`components/sidebar`), the `react-aria/`
quarantine, the `theme/` runtime, or a workspace such as `packages/fuse-figma`.
[SKILL.md](SKILL.md) owns the value bar and its terms. [AUDIT.md](AUDIT.md)
owns candidate evidence (§2), validation (§4) and handoff (§6) for every lane.
The steps below replace AUDIT.md's discovery (§1), edit (§3) and
one-batch-at-a-time landing (§5), so the whole subsystem lands in one PR. Each
step ends on its completion criterion, and the next step starts only once it
holds.

## 1. Baseline

Record the subsystem's test and test-support line counts and every in-scope
test file's pass/fail state at a pinned `main` SHA. Keep baseline failures in
their own list for [step 7](#7-product-defects).

Done when every in-scope test file has a recorded baseline result.

## 2. Lanes and inventory

Split the suite into [lanes](SKILL.md#terms). For `theme/`, the lanes could be
composition, CSS emission, the color-scheme runtime and script, density,
contrast, and the provider. Include
the subsystem's cases in shared suites (`source-contracts.test.ts`, the docs
demo browser tests, the packed-consumer checks) and its support files in
`packages/fuse/test/`. A shared suite's cases go to the lane of the owner they
test.

Done when every test file and shared-suite case the subsystem owns belongs to
exactly one lane.

## 3. Read-only ledger per lane

Give each lane to its own read-only agent when subagents are available. The
agent reads every assigned test in full, including `it.each` tables. It also
reads the production owners with their entry points, callers, history and
Vitest project. Each test declaration goes into a written **ledger** with one
mark. An `it.each` is one declaration unless its rows need different marks;
then mark each row.

- `R`: retain, naming the contract and the bug it catches. A retained test
  that only moves to a better-named file stays `R` with the move noted.
- `F`: retain the contract but repair the assertion, such as a vacuous
  negative that passes when only one of several items is missing.
- `C`: consolidate, naming the keeper that absorbs the assertion first, such
  as a sibling table case, a stronger boundary suite, or the shared owner in
  another package.
- `D`: delete, naming the proof that remains, or why no contract exists.

Judge a test by its assertions, not its name.

Done when every declaration in the lane has a mark and an evidence line.

## 4. Layer plan per lane

The ledger is input to the plan, not the edit list. A second read-only pass
starts from the ledger and looks for the redundant **layer**: a whole suite
that replays contracts a stronger suite already proves. Fuse's layers run from
node unit tests through Chromium browser tests and docs demo tests to the
packed-consumer checks, with public type tests beside them. Name the keeper
for each contract at the layer the Tests section of `AGENTS.md` assigns it,
and prefer the real dependency over a mock of it. Correct any ledger errors
this pass finds.

Done when each lane plan names its retired files, its keeper per contract, the
assertions to carry into keepers, and the test-only seams it unlocks.

## 5. Cutover

Edit lane by lane. Route every change to shared support in
`packages/fuse/test/` through one owner, one change at a time. With each lane,
remove the test-only seams it unlocks. A moved suite keeps the filename suffix
that routes it to its project in the owning `vitest.config.ts`. Update the
reviewed inventories that list moved or deleted suites. Record the durable
test-ownership rules this campaign's mistakes taught in the Tests section of
`AGENTS.md`, and unresolved gaps in `TODO.md`.

Done when every lane plan is applied and each lane's keepers pass.

## 6. Preservation review

Before claiming completion, have independent reviewers compare deleted
coverage against the keepers, one reviewer per lane or group of neighboring
lanes. They look for contracts that lost their only proof. They also look for
new assertions that cannot go red, such as a rejection row the production code
never reaches.

Prove each restored contract's keeper with the mutation
[AUDIT.md §2](AUDIT.md#2-candidate-evidence) describes.

Done when every reported gap is restored or rejected with source evidence, and
every restored contract has a caught mutation.

## 7. Product defects

A baseline failure that survives into a keeper is a bug report. Fix it at its
owner as a separate commit with its own changeset, and prove it through the
real user flow. A **control** run reverts the fix and shows the old behavior.
Record product discrepancies that no in-scope test exposes in `TODO.md` as
follow-ups, and leave them out of the campaign.

Done when each repaired defect has a failing control and a passing candidate
on the same harness.

## 8. Reconcile and hand off

A campaign outlives many `main` commits. Rebase onto current `main` before
handoff. When `main` modified a file the campaign deleted, keep the deletion,
port the new contract into its keeper, and confirm every regression `main`
added still has a home. Rerun the subsystem's suites on the final head.

Hand off with the [AUDIT.md](AUDIT.md#6-handoff) report, plus:

- baseline and final test and test-support line counts, with production
  counted separately;
- lanes, retired layers, and keepers;
- preservation gaps found and their mutations;
- product defects with control and candidate proof.
