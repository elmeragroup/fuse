# Plan 008: Return 404 for inherited-property Figma theme slugs

> **Executor instructions**: Read this file fully, follow the steps in order, and run every verification gate. A failing test is expected only in Step 3 (characterization). Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'apps/docs/src/app/api/themes/figma/[slug]/route.ts' 'apps/docs/test/theme-catalog-figma.test.ts' 'apps/docs/test/docs-server.ts' 'apps/docs/scripts/lib/theme-catalog-figma.ts' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope or reference file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 8
- **Status**: DONE

## Why this matters

`GET /api/themes/figma/[slug]` looks the slug up in a plain object literal and treats "not `undefined`" as "legal theme". Inherited `Object.prototype` members are not `undefined`, so `constructor` and `toString` produce a 200 with an empty body (`JSON.stringify` of a function is `undefined`), and `__proto__` produces a 200 whose body is `{}`. The documented contract, already asserted by the existing test "404s an illegal slug", is that every slug outside the generated index returns 404. This plan closes that gap with an own-property check and pins it with regression tests at both the handler and HTTP layers. No sensitive data is exposed and no code runs; it is a routing correctness bug.

## Current state

Files involved (paths relative to `/Users/tommy.lunde.barvag/src/work/elmera/ui`):

- `apps/docs/src/app/api/themes/figma/[slug]/route.ts` — the download route (24 lines). Only implementation file to change.
- `apps/docs/test/theme-catalog-figma.test.ts` — existing unit-project tests for the generated Figma catalog and both routes (168 lines). Only test file to change.
- `apps/docs/src/generated/theme-catalog-figma.ts` — **generated and gitignored** (`apps/docs/scripts/generate.ts` writes it; the turbo `docs#generate` task runs before `build`, `type-check`, and root `lint`). Exports `FIGMA_THEME_INDEX` (20 legal `{ slug, href }` entries) and `FIGMA_THEME_FILES`, typed `{ readonly [slug: string]: FigmaThemeDocument }`, a plain object literal keyed by slug. Do not edit; if it is missing, run the build in Step 2.
- `apps/docs/scripts/lib/theme-catalog-figma.ts` — generator source (line 227 emits the `FIGMA_THEME_FILES` declaration). Read-only reference; not in scope.
- `apps/docs/test/docs-server.ts` and `apps/docs/test/global-setup.ts` — the vitest `globalSetup` for **both** docs projects starts `next start` against the existing `apps/docs/.next` build and exports `DOCS_BASE_URL`. Read-only reference.

The route as it exists today, `apps/docs/src/app/api/themes/figma/[slug]/route.ts:1-24`:

```ts
import { FIGMA_THEME_FILES, FIGMA_THEME_INDEX } from "../../../../../generated/theme-catalog-figma";

export const dynamic = "force-static";

export function generateStaticParams(): readonly { slug: string }[] {
  return FIGMA_THEME_INDEX.files.map((file) => ({ slug: file.slug }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;
  const document = FIGMA_THEME_FILES[slug];
  if (document === undefined) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify(document), {
    headers: {
      "content-type": "application/design-tokens+json; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.tokens.json"`,
    },
  });
}
```

The existing route tests, `apps/docs/test/theme-catalog-figma.test.ts:143-168`, are the structural pattern to extend (imports at lines 1-16 already bring in `FIGMA_THEME_FILES`, `FIGMA_THEME_INDEX`, and `docsBaseUrl`):

```ts
describe("GET /api/themes/figma", () => {
  // ...
  it("returns DTCG JSON for a legal slug", async () => {
    const response = await fetch(new URL("/api/themes/figma/external-fkas-private", docsBaseUrl()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/design-tokens+json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="external-fkas-private.tokens.json"'
    );
    const body: unknown = await response.json();
    expect(body).toEqual(FIGMA_THEME_FILES["external-fkas-private"]);
  });

  it("404s an illegal slug", async () => {
    const response = await fetch(new URL("/api/themes/figma/internal-fkab-private", docsBaseUrl()));
    expect(response.status).toBe(404);
  });
});
```

Facts that shape the work:

- **Two test layers, two sources of truth.** Direct handler tests import `GET` from source, so they see your edit immediately. HTTP tests go through `next start`, which serves whatever `apps/docs/.next` contains, so they only see your edit after a rebuild. Because `globalSetup` starts the server for every run of this file, _no_ test in the file runs (not even direct handler tests) unless a built `.next` exists.
- **Repo TypeScript is strict with `noUncheckedIndexedAccess: true`** (`tooling/typescript/base.json`), so `FIGMA_THEME_FILES[slug]` is typed `FigmaThemeDocument | undefined` and the existing `=== undefined` check stays legitimate under the `typescript/no-unnecessary-condition` lint rule after you add the own-property guard.
- **Lint rules that bite here** (`.oxlintrc.json`): `typescript/dot-notation` is an error, so never write `FIGMA_THEME_FILES["constructor"]` with a literal key in tests; drive lookups through a variable (e.g. the `it.each` parameter). `typescript/no-unsafe-*` rules are errors, so type parsed JSON as `unknown` exactly as the existing test does (`const body: unknown = await response.json()`).
- **Repo idioms for this test directory**: `it.each([...] as const)("... %s", async (slug) => { ... })` is used in `apps/docs/test/readiness-copy.test.ts:70` and `apps/docs/test/document-html.test.ts:21`; use it for the parameterized cases. Relative imports in this file use either a `.ts` extension (`../scripts/lib/theme-catalog-figma.ts`) or none; use the `.ts` form for the new route import.
- `Object.hasOwn` is already the repo's own-property idiom (`apps/docs/test/docs-server.ts:135`, `packages/ui/src/components/phone-number-field/phone-engine.ts:75`). Match it rather than `hasOwnProperty` or a `Map`.
- The `docs` app is private (no changeset needed). Tests should assert observed responses, not restate the implementation.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose                             | Command                                                                              | Expected on success                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Build docs (+ generate, + ui build) | `pnpm exec turbo run build --filter=docs`                                            | Exit 0; `apps/docs/.next` and `apps/docs/src/generated/` are fresh      |
| Targeted tests                      | `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts` | The file's suites appear in the report; all pass after Step 4           |
| Docs type check                     | `pnpm exec turbo run type-check --filter=docs`                                       | Exit 0 (runs `next typegen && tsc --noEmit` after `generate`)           |
| Lint                                | `pnpm lint`                                                                          | Exit 0, no warnings (`oxlint . --deny-warnings`; needs generated files) |
| Full completion gate                | `pnpm ci:checks`                                                                     | Exit 0                                                                  |

`pnpm --filter @elmeragroup/ui type-check` is **not** the relevant type check: the route lives in the `docs` app. Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. Vitest reports the file and case names; a run that lists zero tests, or that fails inside `globalSetup` with "docs production server ... did not become ready", is not a pass. Builds and the full gate regenerate ignored files under `apps/docs/.next` and `apps/docs/src/generated/`; that is expected. Stop if any **tracked** file outside Scope changes.

## Scope

**In scope, the only files to modify:**

- [apps/docs/src/app/api/themes/figma/[slug]/route.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/api/themes/figma/[slug]/route.ts)
- [apps/docs/test/theme-catalog-figma.test.ts](/Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/test/theme-catalog-figma.test.ts)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the audit report.

**Out of scope (do not touch, even though they look related):**

- `apps/docs/scripts/lib/theme-catalog-figma.ts` and `apps/docs/scripts/generate.ts` — changing the generated map's shape (for example to a `Map` or a null-prototype object) would ripple into the index route and the "is a projection of the catalog" test. The fix belongs in the route.
- `apps/docs/src/app/api/themes/figma/route.ts` (the index route) — it serves `FIGMA_THEME_INDEX` and takes no user input.
- `apps/docs/test/docs-server.ts`, `apps/docs/test/global-setup.ts`, `apps/docs/vitest.config.ts` — test infrastructure.
- The set of legal slugs, the `application/design-tokens+json` content type, the attachment filename, `dynamic = "force-static"`, `generateStaticParams`, caching, or any package API.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/figma-route-own-slugs` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: return 404 for inherited-property Figma theme slugs`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Read the route and the test file end to end.

**Verify**: `git rev-parse --short HEAD && git status --short`, then the drift check command from the header.

**Expected**: baseline is `f14057be`, or later commits have been inspected and leave the excerpts above accurate. Pre-existing changes are recorded and untouched. Stop if the route or the `GET /api/themes/figma` describe block materially differs from the excerpts.

### Step 2: Build once so the test server can start

Run `pnpm exec turbo run build --filter=docs`. This produces `apps/docs/src/generated/theme-catalog-figma.ts` (if absent) and a `.next` build of the **unfixed** route, which is exactly what Step 3 needs: the HTTP layer will still show the bug while the direct layer is asserted against source.

**Verify**: `pnpm exec turbo run build --filter=docs` → exit 0; `ls apps/docs/.next/BUILD_ID apps/docs/src/generated/theme-catalog-figma.ts` lists both files.

**Expected**: Exit 0. Then run the targeted test command once, unmodified, and confirm the existing 7 tests in `test/theme-catalog-figma.test.ts` pass. If `globalSetup` fails to start the server, stop and report; nothing downstream is trustworthy.

### Step 3: Characterize inherited slugs at the handler layer

In `apps/docs/test/theme-catalog-figma.test.ts`:

1. Add `import { GET as getFigmaThemeFile } from "../src/app/api/themes/figma/[slug]/route.ts";` alongside the existing imports (the alias avoids shadowing anything and keeps `typescript/consistent-type-imports` quiet since it is a value import).
2. Add a small helper near `catalogTheme` that calls the handler directly, so `Request` and `context.params` are constructed one way:

   ```ts
   async function getThemeFileDirect(slug: string): Promise<Response> {
     return await getFigmaThemeFile(new Request(`http://docs.test/api/themes/figma/${slug}`), {
       params: Promise.resolve({ slug }),
     });
   }
   ```

3. Add a new `describe("GET /api/themes/figma/[slug] handler", ...)` block with:
   - `it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "not-a-theme", "internal-fkab-private"] as const)("404s %s with an empty body", async (slug) => { ... })` asserting `response.status === 404` and `await response.text() === ""`.
   - `it.each(FIGMA_THEME_INDEX.files.map((file) => file.slug))("serves %s", async (slug) => { ... })` asserting status 200, `content-type` contains `application/design-tokens+json`, `content-disposition` equals `` `attachment; filename="${slug}.tokens.json"` ``, and `await response.json()` (typed `unknown`) `toEqual(FIGMA_THEME_FILES[slug])`.

Do not touch the route yet. Keep the existing HTTP tests unchanged in this step.

**Verify**: `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts`

**Expected**: Exactly the direct-handler cases for `constructor`, `toString`, `__proto__`, and `hasOwnProperty` fail (status 200 instead of 404); `not-a-theme` and `internal-fkab-private` pass with 404; all 20 "serves" cases pass; the pre-existing tests still pass. If the inherited-name cases already return 404, the bug has been fixed independently: stop and report.

### Step 4: Guard own-property membership in the route

In `apps/docs/src/app/api/themes/figma/[slug]/route.ts`, inside `GET`, return the existing empty 404 response before indexing when the slug is not an own property. Keep the `=== undefined` check (the index signature still types the lookup as possibly `undefined`) and leave the success branch untouched. Target shape:

```ts
const { slug } = await context.params;
if (!Object.hasOwn(FIGMA_THEME_FILES, slug)) {
  return new Response(null, { status: 404 });
}
const document = FIGMA_THEME_FILES[slug];
if (document === undefined) {
  return new Response(null, { status: 404 });
}
```

Then extend the existing `describe("GET /api/themes/figma", ...)` HTTP block: convert "404s an illegal slug" into `it.each(["internal-fkab-private", "constructor", "toString", "__proto__", "not-a-theme"] as const)("404s %s over HTTP", ...)` asserting status 404, and add `it.each(FIGMA_THEME_INDEX.files.map((file) => file.slug))("serves %s over HTTP", ...)` asserting the same 200, headers, and body as the direct "serves" cases. Keep the existing single-slug "returns DTCG JSON for a legal slug" test as is.

**Verify**: `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts`

**Expected**: All direct-handler cases pass. The new HTTP inherited-name cases may still fail because `.next` holds the old build; that is expected here and is resolved in Step 5. If a direct-handler case still fails, fix the route, not the test.

### Step 5: Rebuild and verify both layers

Run `pnpm exec turbo run build --filter=docs`, then the targeted tests again.

**Verify**: `pnpm exec turbo run build --filter=docs` → exit 0, then `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts`.

**Expected**: Every case in the file passes: 7 pre-existing tests, 6 direct 404 cases, 20 direct "serves" cases, 5 HTTP 404 cases, 20 HTTP "serves" cases. If an HTTP inherited-name case still returns 200 after a fresh build, stop and report with the response headers; do not loosen the assertion to accept either status.

### Step 6: Complete verification and handoff

Run the remaining gates. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm exec turbo run type-check --filter=docs` → exit 0.

**Verify**: `pnpm lint` → exit 0, no warnings.

**Verify**: `pnpm ci:checks` → exit 0, including format, build, type, runtime, policy and packed-consumer gates.

## Test plan

All tests live in `apps/docs/test/theme-catalog-figma.test.ts`, modeled on its existing `GET /api/themes/figma` block and the `it.each` style of `apps/docs/test/readiness-copy.test.ts:70`.

- Direct handler, 404: `constructor`, `toString`, `__proto__`, `hasOwnProperty` (inherited names; the regression), `not-a-theme` (ordinary unknown), `internal-fkab-private` (documented illegal combination). Assert status 404 and empty text body.
- Direct handler, 200: every slug in `FIGMA_THEME_INDEX.files`. Assert status, `content-type`, exact `content-disposition`, and body equality with `FIGMA_THEME_FILES[slug]`.
- HTTP via `docsBaseUrl()`, 404: `internal-fkab-private`, `constructor`, `toString`, `__proto__`, `not-a-theme`. Assert status 404.
- HTTP via `docsBaseUrl()`, 200: every legal slug, same assertions as the direct 200 cases.
- Do not weaken any assertion to accept "200 or 404". Do not assert on the route's source text.

**Final targeted verification**: `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts` runs the named suites and passes every existing and new case.

## Done criteria

- [ ] `pnpm exec turbo run build --filter=docs` exits 0 after the route change (HTTP tests run against the fixed build).
- [ ] `pnpm --filter docs exec vitest run --project unit test/theme-catalog-figma.test.ts` exits 0 and its report lists the new "handler" describe block and the new HTTP `it.each` cases.
- [ ] `grep -n "Object.hasOwn(FIGMA_THEME_FILES, slug)" 'apps/docs/src/app/api/themes/figma/[slug]/route.ts'` returns one match.
- [ ] `pnpm exec turbo run type-check --filter=docs` exits 0.
- [ ] `pnpm lint` exits 0 with no warnings.
- [ ] `pnpm ci:checks` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no tracked or new files outside Scope beyond the recorded baseline.
- [ ] Row 008 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report (do not improvise) if:

- The route or the `GET /api/themes/figma` test block differs materially from the "Current state" excerpts.
- In Step 3 the inherited-name direct cases already return 404 (fix landed elsewhere) or the ordinary unknown slug returns 200 (a different bug than planned).
- `globalSetup` cannot start `next start` (port binding refused, or `.next` missing after a successful build).
- After a fresh build in Step 5 an HTTP inherited-name case still returns 200 — this would mean Next serves those paths from a layer above the handler, and the plan's assumption "the handler runs for non-generated slugs" is false.
- A verification fails twice after one reasonable repair attempt.
- A correct fix appears to require editing `apps/docs/scripts/**`, the generated file, the index route, or test infrastructure.
- `pnpm lint` reports `typescript/dot-notation` or `typescript/no-unsafe-*` in the test file and the only fix you can see is disabling the rule — restructure the test instead, or stop.

Never weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

## Maintenance notes

- Any user-controlled key indexed into a plain-object catalog must go through `Object.hasOwn` (or an equivalent own-property check) before the lookup. If `FIGMA_THEME_FILES` is ever regenerated as a `Map` or a null-prototype object, keep the inherited-name test cases; they are cheap and document the contract.
- Reviewers should confirm the 404 branch still returns an empty body (`null`) and that the success branch, content type, and attachment filename are byte-for-byte unchanged.
- Deferred on purpose: hardening the generator to emit a prototype-free map. It is a larger change touching the index route and generator tests for no additional user-visible benefit once the route guards its input.
