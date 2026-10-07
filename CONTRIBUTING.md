# Contributing

Fuse is the shared component library for Elmera Group's brands. Before opening a PR,
establish why the change belongs in Fuse and complete the review and verification below.

These rules apply to every PR, including drafts. A PR into `main` needs no formal
approval, but only a code owner listed in [CODEOWNERS](.github/CODEOWNERS) may merge it.
Meeting this guide makes a PR eligible for merge. The code owner decides whether to
merge it.

## Setup and workflow

Follow the [README prerequisites](README.md#prerequisites) to set up the repo and its
[contribution flow](README.md#contribution-flow) to implement and verify changes.
Read [AGENTS.md](AGENTS.md) for the code, styling, documentation and test conventions.

<a id="fuse-or-consumer"></a>

## Ask first: Fuse or the consumer app?

Before adding a component, prop, variant or token, ask: "Is this a good addition to
Fuse, or should it live in the consumer app?"

A Fuse addition should meet these criteria:

- Two or more apps need it now.
- It works across brands, segments, variants and both densities, and uses role tokens
  for theming.
- Its API describes shared UI behavior. `Select` belongs in Fuse. A customer picker
  tied to one app's data model belongs in that app.

Build a one-off in the consumer app using Fuse parts. When another app needs it,
reconsider it for Fuse using both apps as evidence.

The rule has exceptions. An addition only one app needs today can still belong in Fuse
when the need is general, such as a missing accessible control or a pattern the design
system already specifies. Explain the general need in the PR.

<a id="one-problem"></a>

## Solve one problem per PR

Split a PR that solves several independent problems, even when each fix is useful
on its own. Count the underlying problems, not the linked issues.

Include the source, tests, demos, documentation and generated artifacts the problem
requires. Follow the [contribution flow](README.md#contribution-flow) for changesets
and PR labels. Put unrelated cleanup and other fixes in separate PRs.

<a id="pr-title"></a>

## Title the PR in Title Case

Write the PR title as a plain-language sentence in Title Case: capitalize every word,
and keep code names and brand names in their own casing, such as
"Floor Text-Entry Type On iOS WebKit As Well As Touch". Leave out the conventional
commit prefix. This applies to the PR title only; commit messages keep the
conventional commit format.

<a id="review-before-submitting"></a>

## Review it before you open it

Complete a full review pass before opening a PR, or before marking a draft ready for
review. Review bot-created release and dependency PRs before merging them. The code
owner who merges one records that review in a PR comment.

Use a reviewer other than the code's author: another person, or an agent with a fresh
context. When an agent wrote the change, the person who directed it can review it.
The reviewer checks the complete proposed diff and relevant surrounding code against
the agreed scope, this guide and [AGENTS.md](AGENTS.md).

<a id="verification"></a>

## Show that it works

Explain how you established the problem and checked the change. Record the focused
test commands or manual checks you ran, the results and anything you could not
check.

- Behavior changes include tests, and verification follows
  [AGENTS.md](AGENTS.md#tests), including `pnpm ci:checks` before the final review
  pass.
- Visual changes include before and after screenshots. For new UI, show the result.
  Add a short recording when motion, timing or interaction is part of the change.
  Upload screenshots and recordings to the PR and keep them out of the repository.

## Merging and closing

Before merging, a code owner checks the problem, the Fuse-or-consumer decision, the
scope and the verification evidence.

A code owner may close a PR or request changes when it belongs in a consumer app,
solves several independent problems, lacks a completed review or lacks evidence.
The closing comment names the rule and explains what would change the outcome.

Address the reason and reopen the PR, or open focused replacement PRs and link them
to the original.
