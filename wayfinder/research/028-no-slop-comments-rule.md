# 028 — Extracting Cursor's no-comments / Comment Sicko ideas into an oxlint rule

Researched: 2026-08-31, against primary sources (the two files in `cursor/plugins`, oxc.rs linter docs, the installed `@oxlint/plugins@1.78.0` type declarations, and this repo's oxlint setup). No ticket exists for this topic; numbered `028` as the next free wayfinder number (tickets end at `027-org-setup-task.md`). Placed in `wayfinder/research/` to match the existing research convention (`003…015`).

A live smoke test in this repo (rule using `context.sourceCode.getAllComments()` in `Program:exit`, run through `RuleTester` from `oxlint/plugins-dev` with `node --experimental-strip-types --test`) passed against the pinned oxlint/`@oxlint/plugins` 1.78.0 — the core mechanism this rule needs is confirmed working, not just documented.

## 1. What the two Cursor files actually say

### `pstack/agents/comment-sicko.md`

Source: <https://raw.githubusercontent.com/cursor/plugins/main/pstack/agents/comment-sicko.md>

A subagent persona ("A deranged comment-hater that savors deletion and condemns workaround code") that reviews a scoped diff (default: current diff against `main`) and flags comments for deletion. It is report-only for code: "I touch comments and identify refactor targets. I never write application code."

**Default: every comment dies.** Targets called out by name: "Narration, banners, commented-out corpses, workaround sermons."

**The only keep-list (verbatim categories):**

1. "Legal or license headers."
2. "Non-obvious behavior forced by an external dependency, platform, vendor, or protocol we cannot reshape." Crucially: "Surprises in our own code are meat" — an internal surprise gets the comment deleted **and** the symbol flagged `MUST KILL` for "rename, extract, type, or rearchitecture that makes the behavior obvious without prose."
3. "`// prettier-ignore`. Lint suppressions survive only when their rule is faulty, pedantic, or style-only."
4. "Doc comments that define a public API contract."
5. "Issue or RFC links that explain a constraint code cannot express."

**Tie-break:** "When I am not sure a keep clause applies, the comment dies."

**Suppressions:** "`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, and similar suppressions stink. Look up the rule. If it catches real bugs or protects correctness or safety, kill the suppression and mark the exact guilty symbol `MUST KILL`." (Inverse of the usual instinct: suppressions of _correctness_ rules are the worst offenders; suppressions of style-only rules may stay.)

**Emphasis words are evidence of guilt, not protection:** "`IMPORTANT`, `do not remove`, `too risky`, `fine for now`, and long justifications are scent, not conviction." Claims must be verified against nearby code / `/how` / `/why`; "A long justification without a proven keep-list exception is a confession. Kill it. Never polish meat into a shorter alibi" — comments are deleted whole, never rewritten shorter.

### `pstack/skills/no-comments/SKILL.md`

Source: <https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/no-comments/SKILL.md>

The orchestrating skill ("Spawn Comment Sicko. Act on accepted findings."). Its premise: "Authoring agents defend comments. Defer to Comment Sicko's fresh perspective" — comment review needs a reviewer without authorship bias. Workflow:

1. Spawn the agent with the scope (caller's files/diff, else diff against base branch).
2. Audit the report: reject scope escapes, exception-protected deletions, misstated `MUST KILL` reasons; "A keep survives only with proof it is about something we cannot change"; ambiguous kills are not restored, refuted/ambiguous keeps are deleted.
   3–4. Fix accepted flags at the root cause ("fix real causes, redesign as if requirements always existed, never bolt on symptom guards"), consulting an architect step for shape changes.
3. **Constraint comments become code:** for `do not remove` / `do not change wording` / `talk to X before changing` comments, "Offer the cheapest in-scope type, runtime, test, or CI lint … If approved, encode then delete." A constraint worth keeping is worth _enforcing_; prose is the weakest encoding.
4. Report deletions, restorations, encodings, and open work.

**The transferable ideas:** (a) comments are guilty until proven forced-by-the-outside-world; (b) a fixed, short allowlist with a delete-on-doubt tie-break; (c) never rewrite a bad comment, delete it and fix the code; (d) constraints should be encoded as types/tests/lint rules, not prose; (e) emphasis/panic vocabulary is a flag, not a shield.

## 2. oxlint custom JS plugin API (what a rule can actually do)

Sources: <https://oxc.rs/docs/guide/usage/linter/plugins.html>, <https://oxc.rs/docs/guide/usage/linter/js-plugins.html>, <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>, and the installed `@oxlint/plugins@1.78.0` declarations at `node_modules/.pnpm/@oxlint+plugins@1.78.0/node_modules/@oxlint/plugins/index.d.ts`.

- **Status:** "JS plugins are currently in alpha, and remain under active development" (js-plugins.html). The API targets **ESLint v9+ compatibility**; explicitly unsupported: custom parsers/file formats (Vue/Svelte/Angular), type-aware rules, and APIs ESLint removed before v9.
- **Registration:** `.oxlintrc.json` `jsPlugins` array — a path, an npm package name, or an alias object `{ "name": "...", "specifier": "..." }`; rules are then enabled under `"<name>/<rule>"` in `rules` (js-plugins.html; exactly how this repo's `.oxlintrc.json` already does it).
- **Plugin/rule shape:** ESLint-style `{ meta, rules }` with `create(context)`, or oxlint's faster variant `createOnce(context)` with `before`/`after` hooks, wrapped via `eslintCompatPlugin` / built via `defineRule` from `@oxlint/plugins` (writing-js-plugins.html). `Program` and `Program:exit` visitors are supported ("Program … always runs for every file").
- **Comment access — confirmed:** `index.d.ts` declares `getAllComments(): Comment[]` (line 1886), `getCommentsBefore(nodeOrToken)` (1904), `getCommentsAfter` (1923), `getCommentsInside(node)` (1929), all present on `SourceCode` (3443–3446). This repo already ships a comment-reading rule in production: `tooling/oxlint-anti-slop/rules/require-safety-comment-for-type-assertion.ts` uses `sourceCode.getCommentsBefore()`. And the `getAllComments()`-in-`Program:exit` pattern was verified working by the smoke test above.
- **Fixes and suggestions — supported:** `Fix`, `Fixer`, `FixFn`, `Suggestion` types and `meta.hasSuggestions` all exist in `index.d.ts` (3303–3345, 4150); js-plugins.html lists "Fixes and rule options" among supported features, and the language server surfaces quick-fixes.
- **Testing:** `RuleTester` from `oxlint/plugins-dev` (writing-js-plugins.html), the convention every `tooling/oxlint-anti-slop/rules/*.test.ts` already follows.
- **Caveats:** alpha status means API drift between minors — which is exactly why `docs/spec/tooling.md` §2 pins oxlint and `@oxlint/plugins` to the same minor, ≥ 1.78.0. One thing to verify when implementing: whether oxlint's own directive comments (`// oxlint-disable-next-line …`) are included in `getAllComments()` results (ESLint includes directives; assumed but not smoke-tested).

## 3. Where a new rule slots into this repo

Current setup (all paths repo-relative):

- `.oxlintrc.json` registers three JS plugins: `eslint-plugin-turbo`, `elmera` (`@elmeragroup/oxlint-plugin`), and `anti-slop` (`@elmeragroup/oxlint-plugin-anti-slop`).
- `tooling/oxlint-anti-slop/` is the vendored `dmmulroy/anti-slop` plugin ([research 015](015-anti-slop.md), [tooling spec §5.3](../../docs/spec/tooling.md)): `index.ts` builds `eslintCompatPlugin({ meta: { name: "anti-slop" }, rules: {…} })`; each rule is one `defineRule({ meta, createOnce })` file in `rules/`, tested by a sibling `*.test.ts` run with `node --experimental-strip-types --test`.
- `tooling/oxlint-plugin/` (`elmera`) holds repo-specific rules in plain JS, spec-scoped to `packages/ui/src/**` (tooling spec §5.2) — the wrong home for a repo-wide comment rule.

**To add `no-slop-comments`:**

1. `tooling/oxlint-anti-slop/rules/no-slop-comments.ts` — `defineRule({ meta, createOnce })`, plus `no-slop-comments.test.ts`.
2. Import and register it in `tooling/oxlint-anti-slop/index.ts` under `"no-slop-comments"`.
3. Enable in `.oxlintrc.json`: `"anti-slop/no-slop-comments": "error"` (or `"warn"` during rollout).
4. No turbo change needed: the `lint` task's `inputs` already include `tooling/oxlint-anti-slop/**` (tooling spec §4), so rule edits bust the cache.

One governance note: the anti-slop package is vendored at a recorded upstream SHA with "upstream refresh = manual diff, opt-in" (tooling spec §5.3). A local rule is a deliberate divergence — record it in `tooling/oxlint-anti-slop/README.md` next to the vendored SHA so a future refresh doesn't clobber it.

## 4. Mapping the heuristics onto a deterministic rule

The Comment Sicko keep-list is mostly _judgment_ ("is this constraint truly external?", "is this rule style-only?"). A linter can't decide those. What it _can_ do is catch the mechanically recognizable slop shapes and enforce the allowlist's recognizable forms. Split:

### Mechanically checkable (lint rule territory)

| Heuristic                                             | Detection strategy                                                                                                                                                                                                                                                                                                                                                                     | Confidence                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Commented-out code** ("commented-out corpses")      | Match conservative code shapes such as declarations, control flow, call expressions, balanced delimiter blocks, and JSX. Score evidence across multiline comments rather than treating a bare semicolon as code. (Precedent: `eslint-plugin-no-commented-out-code` uses parse attempts; syntax-shaped evidence avoids that cost while retaining fragment support.)                     | High                                                                                              |
| **Banner / section-divider comments** ("banners")     | Regex: comments that are only punctuation (`^[\s*=/#~—-]{4,}$`), or `---- Words ----` / `==== Words ====` / `/* ===== */` framings, or a bare capitalized section label sandwiched between divider comments.                                                                                                                                                                           | High                                                                                              |
| **Panic vocabulary** ("scent, not conviction")        | Case-insensitive match on `IMPORTANT`, `do not remove`, `do not change`, `too risky`, `fine for now`, `DO NOT TOUCH`, `careful!` — flag with a message that mirrors the skill's step 5: "encode this constraint as a type, test, or lint rule, then delete the comment."                                                                                                               | High to _flag_; the encoding itself stays human/agent work                                        |
| **TODO/FIXME/HACK/XXX without a tracker link**        | Regex: marker present but no `https?://` URL and no ticket id pattern (configurable, e.g. `[A-Z]{2,}-\d+`). Mirrors keep-list §5 (issue links may stay) by making the link the price of survival.                                                                                                                                                                                      | High                                                                                              |
| **Trivial restatement / narration** ("what" comments) | For a line comment directly above a statement: split the comment into words, split the next statement's identifiers/keywords (camelCase/snake_case-aware), compute overlap; flag above ~60–70% overlap of comment words (`// increment the counter` over `counter++`, `// fetch the user` over `await fetchUser()`). Catches the worst narration deterministically; misses paraphrase. | Medium — worth shipping behind an option; tune threshold against this repo before setting `error` |
| **Suppressions without justification**                | `@ts-expect-error`/`@ts-ignore`/`eslint-disable`/`oxlint-disable` with no trailing description (or description shorter than N chars). Cannot judge the _rule_ like the agent does, but can force every suppression to carry its reason. (Precedent: `@typescript-eslint/ban-ts-comment` with `ts-expect-error: "allow-with-description"`.)                                             | High — but consider leaving to `ban-ts-comment`-style rules to avoid overlap                      |

### Judgment calls (stay with the skill/agent)

- **Why vs. what in general** — whether prose explains a genuinely external constraint (keep-list §2) or buries an internal surprise. Requires reading the dependency, not the comment.
- **Whether a suppressed rule "catches real bugs"** vs. is "faulty, pedantic, or style-only" (keep-list §3).
- **Whether a doc comment truly "defines a public API contract"** vs. narrates a private helper — a lint rule can approximate (JSDoc on exported symbols), not verify the contract claim.
- **The `MUST KILL` refactor flags** — rename/extract/rearchitect so the code needs no prose. Inherently a design action.
- **Verifying a comment's factual claim** (`/how` / `/why` investigation) and **encoding constraints** as types/tests/CI (skill step 5).

The division of labor: the lint rule is the cheap always-on floor that deletes recognizable slop and _forces the escalation_ ("encode or delete") on panic comments; the `no-comments`-style skill remains the judgment pass over diffs.

### Allowlist the rule must ship with

- **Directives** (never flag): `oxlint-disable*`, `eslint-disable*`/`eslint-enable`, `@ts-ignore|@ts-expect-error|@ts-nocheck|@ts-check`, `prettier-ignore`, `biome-ignore`, `/// <reference …>`, `@jsx*` pragmas, `v8 ignore`/`istanbul ignore`, `webpackChunkName`-style magic comments, `@vite-ignore`, `#__PURE__`/`@__NO_SIDE_EFFECTS__`. (Keep-list §3, plus toolchain reality.)
- **License headers** (keep-list §1): the file's leading comment block when it matches `/copyright|license|SPDX-License-Identifier/i`.
- **JSDoc on exported/public declarations** (keep-list §4): skip `Block` comments starting `*` attached to an exported declaration; optionally all JSDoc (`checkJsdoc: false` default).
- **Comments containing an issue/RFC URL or ticket id** (keep-list §5).
- **`SAFETY:` comments** — this repo _requires_ them via `anti-slop/require-safety-comment-for-type-assertion` (`tooling/oxlint-anti-slop/rules/require-safety-comment-for-type-assertion.ts`). The two rules must not fight: `SAFETY:` is a hard allowlist entry.
- **User escape hatch:** `allowPatterns: string[]` (regexes) for repo-specific conventions.

### Recommended rule design

- **Name:** `anti-slop/no-slop-comments`.
- **`meta`:** `type: "suggestion"`, `hasSuggestions: true`; message ids per heuristic (`commentedOutCode`, `bannerComment`, `panicComment`, `todoWithoutLink`, `narrationComment`) so each carries the _reason_ and the Comment Sicko-style remedy ("delete it; if the constraint is real, encode it").
- **Options (one object):**

  ```jsonc
  {
    "banCommentedOutCode": true,
    "banBanners": true,
    "banPanicComments": true, // IMPORTANT / do not remove / too risky / fine for now
    "requireIssueLinkFor": ["TODO", "FIXME", "HACK", "XXX"],
    "ticketPattern": "[A-Z]{2,}-\\d+", // counts as a link
    "narrationSimilarity": 0.7, // false disables the fuzzy heuristic
    "allowJsdocOnExports": true,
    "allowPatterns": ["^SAFETY:"], // repo default; merged with the built-in directive/license allowlist
  }
  ```

- **Implementation:** `createOnce` with a `Program:exit` (or `before`) pass over `context.sourceCode.getAllComments()` (verified working, §2); consult `sourceCode.text`/node positions for the restatement heuristic and for "leading license block" detection; report with the comment's `loc`. **No autofix** — deleting prose is destructive and multi-comment; offer a _suggestion_ (`fixer.removeRange` over the comment plus its line's leading whitespace) so the LSP quick-fix exists but nothing rewrites files under `--fix` silently. Follow the vendored package's existing conventions: one `defineRule` per file, sibling `RuleTester` test, kebab-case filename (`unicorn/filename-case` is `error` repo-wide per `.oxlintrc.json`).
- **Rollout:** land as `"warn"`, run over `packages/`, tune `narrationSimilarity` and the banner regex against real hits, then promote to `"error"`. Keep `narrationSimilarity` conservative — false positives on legitimate why-comments are the fast way to get the rule disabled.

### What should _not_ become lint

Do not try to encode the keep-list's substantive tests (external-constraint proof, rule-quality judgment, contract verification, `MUST KILL` refactors, constraint encoding) — those need code comprehension and live in an agent/skill layer like Cursor's `no-comments`, or a repo skill wrapping this rule's output. The lint rule's job is narrower and better: make the _recognizable_ slop shapes impossible to merge, and turn every "do not remove" into a forced choice between a real encoding and deletion.
