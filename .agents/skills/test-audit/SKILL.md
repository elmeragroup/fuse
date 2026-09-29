---
name: test-audit
description: "Test value gate and audit. Use when writing or changing a test, reviewing tests in a diff, or auditing and pruning existing tests and the test-only seams they keep alive."
---

# Test audit

One value bar serves four branches:

- To write or change a test, pass the [authoring gate](#authoring-gate).
- To review tests in a diff, answer the authoring gate's questions for every
  added or changed test from the diff and its owner. Report each question the
  diff cannot answer and each matched junk pattern as a finding.
- To audit existing tests, read [AUDIT.md](AUDIT.md) before discovery.
- To prune one subsystem's whole test suite in one PR, read
  [AUDIT.md](AUDIT.md), then [CAMPAIGN.md](CAMPAIGN.md).

The Tests section of `AGENTS.md` owns the tautology and oracle rule, the choice
of Vitest project, and the commands. This skill decides whether a test earns
its place.

## Terms

- The **owner boundary** is the public entry point of the production module
  that owns a behavior: the part a consumer renders, the exported function or
  recipe, the script's CLI, or the generated artifact. A contract's one primary
  test there is its **keeper**.
- The **oracle** is the independently defined expectation a test reproduces.
  Cross-checks name it in a `// Unit under test: … Oracle: …` comment.
- A **change detector** goes red under a behavior-preserving refactor.
- A **test-only seam** is an export, parameter, flag, global, reset hook,
  wrapper, or code path whose only callers are tests.
- A test goes **red** when it fails for the reason it claims to guard.

## Authoring gate

Answer each question before adding the test, and include the answers in your
report of the change.

1. What observable behavior, invariant, or independent contract does it
   protect, and what is its oracle?
2. What credible regression turns it red?
3. Why does the keeper not already go red on that regression? A second layer
   earns a test only through a risk the keeper cannot reach, such as the packed
   tarball under a Next App Router consumer or a production-only branch. Extend
   a table-driven case or shared fixture before writing a near-duplicate, and
   consolidate the setup it would duplicate.
4. Does it need a test-only seam? Then move it to the owner boundary, where it
   needs none.

Then check the test against every [junk pattern](#junk-patterns). A match
fails the gate unless the [retention bar](#retention-bar) names the contract it
independently guards. Rewrite a failed test at the owner boundary.

A bug regression test goes red on the pre-fix code for the intended reason and
passes after the fix at the owner boundary. Until you have seen it go red, it
proves only its mock. One regression at the owner boundary covers the bug, and
the layers the bug crosses need no replay of it.

## Junk patterns

**Tautologies.** The expectation comes from the thing under test. Beyond the
cases the Tests section of `AGENTS.md` forbids, hunt for:

- a function compared with its own output from the same run;
- a literal the test defines and then asserts back;
- a mock that implements the asserted behavior, or one mock standing in for
  different APIs;
- a fixture that supplies the state, ordering, or callback the owner should
  produce.

**Change detectors.** The test pins the implementation's shape.

- source, import, or string greps that go red on an identifier-only refactor;
- a copied inventory, manifest, or export list that echoes the source without
  forcing a decision on each new item;
- class-name assertions on a rendered part whose contract is its computed
  style;
- catalog or dependency versions that `pnpm-workspace.yaml` or a
  `package.json` already pins.

**Duplicates.** The contract already has a proof.

- the same contract asserted at several layers, or twice in one layer;
- a private predicate or call-shape test the keeper already covers;
- a recipe's classes pinned again in each consumer instead of once in the
  recipe's own test, with consumers cross-checking the imported recipe;
- a local copy of a shared helper or contract from `packages/fuse/test/`. Lint
  catches local declarations of the named harness helpers in `packages/fuse`.
  Hold renamed copies, `apps/*` tests and the other shared contracts to the
  same rule.

**Seam keepers.** A test whose only purpose is keeping a test-only seam alive,
including dead production code whose only callers are tests.

**False signals.** The test passes without the behavior.

- assertion-free coverage probes;
- tombstones that assert deleted internal code stays deleted, where a live
  rule about what exists belongs;
- negative controls that pass for an unrelated reason, such as a rejection
  from a different guard or a branch the production path never reaches;
- `vi.stubEnv("NODE_ENV", …)` in a `packages/fuse` browser test. Vite inlines
  `NODE_ENV` there, so the production branch never runs;
- names or fixtures that promise more than the input exercises, such as a
  "closes on Escape" test that only asserts the popup opened.

## Retention bar

Keep a test that independently enforces a public behavior `AGENTS.md` names,
or the package manifests, size budgets, release workflow, or repo policy. Also
keep:

- a cross-check between two representations that names its oracle, as
  `AGENTS.md` allows (theme CSS against `composeTheme`, the popover clamp
  against `CONTAINER_PADDING`);
- a hand pin of a shared recipe or constant, once, in its owner's test;
- a reviewed inventory that forces a decision on each new item, such as a
  component's server or client status in `source-contracts.test.ts` or a page
  in `apps/docs/test/fixtures/`;
- a tracked file snapshot of a public artifact under `__snapshots__/`, or a
  drift gate that compares committed generated files with a fresh generation.
  Every change to either shows in the PR diff;
- a guard that keeps a retired public API from returning;
- call ordering when order is observable behavior;
- a regression with a credible failure mode;
- source inspection, in the central suite or beside its owner, when it is the
  cheapest independent guard. It goes red on a contract change (a directive,
  an import boundary, a public key) and survives an identifier-only refactor;
- a retained test that fails on the baseline. Treat it as a possible product
  bug: reproduce it, then fix the owner in its own commit with a changeset.

A test that is static, slow, or shaped like the implementation can still be a
contract's only proof. Show that a keeper goes red on the same regression
before removing it.
