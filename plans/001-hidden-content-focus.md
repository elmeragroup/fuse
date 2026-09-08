# Plan 001: Remove hidden sidebar and footer content from keyboard navigation

> **Executor instructions**: Read this file fully, follow the steps, and run every verification gate. Expected failing regression tests are intentional only in the characterization step. Stop on the conditions below instead of broadening scope. Update this plan's status row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) when done, unless the dispatcher owns that index.
>
> **Drift check, run first**: `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/sidebar/sidebar.tsx' 'packages/ui/src/components/sidebar/sidebar.browser.test.tsx' 'packages/ui/src/components/item/item.tsx' 'packages/ui/src/components/item/item.browser.test.tsx' 'packages/ui/src/components/selection-item/selection-item.browser.test.tsx' 'apps/docs/src/app/(docs)/components/item/page.mdx' 'apps/docs/src/app/(docs)/components/selection-item/page.mdx' '.changeset/hidden-content-focus.md' 'plans/README.md'`. Compare the current-state excerpts with the live files if any in-scope file changed. Record `git status --short` before editing and preserve pre-existing work.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14057be`, 2026-09-08
- **Audit finding**: 1
- **Status**: DONE

## Why this matters

Collapsed desktop sidebars and hidden item footers keep their controls mounted and focusable. Keyboard users can reach actions they cannot see. This change makes hidden content unavailable while retaining the sidebar's mouse rail and the footer's reveal behavior.

## Current state

The following excerpts identify the implementation and its current behavior. Whitespace is condensed in some excerpts.

[packages/ui/src/components/item/item.tsx:156](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.tsx:156):

```tsx
hidden: [
  "pointer-events-none -translate-y-1.5 grid-rows-[minmax(0,0fr)] pt-0 opacity-0",
  "ease-out transition-[opacity,transform] duration-150",
],
```

[packages/ui/src/components/item/item.tsx:181](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.tsx:181):

```tsx
<div
  data-slot="item-footer"
  data-mode={mode}
  className={cn(itemFooterVariants({ mode }), className)}
  {...props}>
```

[packages/ui/src/components/sidebar/sidebar.tsx:312](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.tsx:312):

```tsx
data-state={state}
data-collapsible={state === "collapsed" ? collapsible : ""}
```

[packages/ui/src/components/sidebar/sidebar.tsx:391](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.tsx:391):

```tsx
type="button"
data-slot="sidebar-rail"
aria-hidden
tabIndex={-1}
```

Line references above were verified against `f14057be`: the `hidden` variant spans `item.tsx:156-159`, the footer `<div>` spans `item.tsx:181-185`, the desktop root's state attributes are at `sidebar.tsx:312-313` (this `div` carries the Tailwind `group` class that every `group-data-[...]` selector below keys on; `data-collapsible` is non-empty **only while collapsed**, so `group-data-[collapsible=offcanvas]` already means "collapsed and offcanvas"), the `sidebar-container` div with its `className={cn(...)}` and `{...props}` spread starts at `sidebar.tsx:329`, and the Rail `<button>` spans `sidebar.tsx:390-407` (its `cn(...)` class list is lines 397-405).

The library owns widget semantics and focus visibility. Both `item.tsx` and `sidebar.tsx` already start with `"use client"`, so neither file's RSC boundary changes with this work; even so, Item.Footer needs no hooks for this fix, so do not add any (an `inert` attribute driven by `mode` is a pure render decision). Sidebar's offcanvas mode hides the panel contents; icon mode keeps navigation available. Sidebar.Rail is intentionally a mouse-only, aria-hidden button with tabIndex -1; Sidebar.Trigger is the accessible keyboard reopening control. Tests query roles and names rather than source spelling.

Existing tests that this plan extends, and that must keep passing unchanged in intent:

- [packages/ui/src/components/item/item.browser.test.tsx:71-89](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.browser.test.tsx:71) "emits media variant and footer mode without dark classes": locates footers through `footerHost(name)` (`textNamed(...).closest("[data-mode]")`, a `page.getByText` query) and asserts `pointer-events: none` and `opacity: 0` for `mode="hidden"`.
- [packages/ui/src/components/selection-item/selection-item.browser.test.tsx:204-240](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/selection-item/selection-item.browser.test.tsx:204) "makes hidden SubSection content unclickable": at line 222 it locates the nested button with `page.getByRole("button", { name: "Hidden details", exact: true })`. After Step 3 the footer is `inert`, and Playwright role queries may stop returning inert content; this locator is the one Step 3 tells you to replace.
- [packages/ui/src/components/sidebar/sidebar.browser.test.tsx:167-199](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.browser.test.tsx:167) `Frame` fixture: `Sidebar.Root` (with `Sidebar.Content > Group > Menu` and `Sidebar.Rail`) followed by `Sidebar.Inset` containing `Sidebar.Trigger` and an `After` button. Menu children come from the `children` prop. `railNamed(name)` (line 155) finds the Rail by `title`. Controlled collapse patterns already exist: `latest?.setOpen(false)` through `ContextProbe` (lines 422-447) and `rerender(<Frame provider={{ open: true, onOpenChange }} />)` (lines 449-460). Viewport is set to DESKTOP in `beforeEach` (line 98); mobile tests call `await page.viewport(MOBILE.width, MOBILE.height)` first (line 350).

Every browser suite imports the **built** stylesheet: `import "../../../dist/styles.css";` (item test line 4, selection-item test line 5, sidebar test line 7). The `exec vitest run` command in this plan bypasses turbo, whose `test:browser` task normally depends on `build`. Consequently any Tailwind class you add in `sidebar.tsx` is invisible to the tests until `pnpm --filter @elmeragroup/ui build` has regenerated `packages/ui/dist/styles.css`. Attribute-only changes (Step 3's `inert`) need no rebuild.

Match the existing pattern in [packages/ui/src/components/text-field/text-field.browser.test.tsx:73](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.browser.test.tsx:73):

```tsx
page.getByRole("button", { name: "Before", exact: true }).element().focus();
await userEvent.keyboard("{Tab}");
expect(document.activeElement).toBe(textboxNamed("Open"));
```

The repository uses React 19, TypeScript, package subpath exports, and colocated Vitest tests. Read [docs/component-authoring.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/component-authoring.md) for implementation conventions and [docs/spec/accessibility.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md) for the owning accessibility contract. Its responsibility split says "the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings." Tests should exercise rendered behavior or tool results, not copy the implementation into an assertion. Reference files outside Scope are read-only.

## Commands you will need

Run commands from `/Users/tommy.lunde.barvag/src/work/elmera/ui`, using Node 24 and the repository-pinned pnpm 11.20.0. `node --version` must satisfy `>=24.13.0 <25`; `pnpm --version` must print `11.20.0`. If dependencies are missing, stop and report instead of silently changing the lockfile.

| Purpose              | Command                                                                                                                                                                                                                   | Expected on success                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Targeted tests       | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx` | All selected tests run and pass after implementation |
| UI type check        | `pnpm --filter @elmeragroup/ui type-check`                                                                                                                                                                                | Exit 0                                               |
| Lint                 | `pnpm lint`                                                                                                                                                                                                               | Exit 0, no warnings                                  |
| Full completion gate | `pnpm ci:checks`                                                                                                                                                                                                          | Exit 0                                               |

`pnpm ci:checks` starts with `oxfmt --check`, and `.oxfmtrc.json` enables `sortTailwindcss` for `cn`/`tv` class lists, so the formatter may want to reorder the utilities you add in `sidebar.tsx`. If that check fails, run `pnpm format` and confirm with `git diff --name-only` that it only rewrote in-scope files; the formatter is the only permitted way to reorder classes. Browser tests need permission to bind a local port and start Chromium. Package checks need registry access. A sandbox or network failure is a verification blocker, not a passing result. The UI test configuration allows no-test runs, so exit 0 alone is insufficient: confirm the named files and expected new cases appear in the report. Builds and the full gate can regenerate files. Generated changes are allowed only within Scope; stop if unrelated committed artifacts change. Standard ignored build/test outputs are permitted.

## Scope

**In scope, the only implementation files to modify:**

- [packages/ui/src/components/sidebar/sidebar.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.tsx)
- [packages/ui/src/components/sidebar/sidebar.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.browser.test.tsx)
- [packages/ui/src/components/item/item.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.tsx)
- [packages/ui/src/components/item/item.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.browser.test.tsx)
- [packages/ui/src/components/selection-item/selection-item.browser.test.tsx](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/selection-item/selection-item.browser.test.tsx)
- [apps/docs/src/app/(docs)/components/item/page.mdx](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/item/page.mdx>)
- [apps/docs/src/app/(docs)/components/selection-item/page.mdx](</Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/(docs)/components/selection-item/page.mdx>)
- [.changeset/hidden-content-focus.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/.changeset/hidden-content-focus.md) (create)

Also permitted: update only this plan's row in [plans/README.md](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md). Do not edit other plans or the historical audit during implementation.

**Out of scope:** Do not change the mobile Sheet, icon-collapse layout, selection child partitioning, dimensions, public exports, locale strings, or unrelated sidebar styles. Leave the redundant `inert={... ? undefined : true}` props in the three docs demos intact (`apps/docs/src/app/(docs)/components/selection-item/demos/selection-item-subsection.tsx:20`, `.../checkbox/demos/checkbox-item-group.tsx:23`, `.../radio-group/demos/radio-item-group.tsx:23`); they become harmless duplicates of the new behavior and removing them is not required.

## Git workflow

These plans were prepared on `codex/deep-audit-plans`. Work in the checkout assigned by the operator. For isolated execution, use `codex/hidden-content-focus` from a checkout that contains this plan; do not switch or reset another agent's working directory. Do not overwrite pre-existing changes.

Use conventional commit messages if asked to commit. Existing examples include `refactor: simplify runtime state and strengthen regression tests` and `chore: simplify repository docs and component authoring`. Suggested message: `fix: remove hidden sidebar and footer content from keyboard navigation`. Do not commit, push, open a PR, or publish a release unless instructed.

## Steps

### Step 1: Check the baseline and scope

Confirm the tool versions above, record the worktree status, and run the drift check. Read the cited implementation and test exemplar. Compare actual behavior with the stated contract before writing the regression.

**Verify**: `git rev-parse --short HEAD && git status --short`, followed by `git diff --stat f14057be..HEAD -- 'packages/ui/src/components/sidebar/sidebar.tsx' 'packages/ui/src/components/sidebar/sidebar.browser.test.tsx' 'packages/ui/src/components/item/item.tsx' 'packages/ui/src/components/item/item.browser.test.tsx' 'packages/ui/src/components/selection-item/selection-item.browser.test.tsx' 'apps/docs/src/app/(docs)/components/item/page.mdx' 'apps/docs/src/app/(docs)/components/selection-item/page.mdx' '.changeset/hidden-content-focus.md' 'plans/README.md'`.

**Expected**: baseline is `f14057be`, or later commits have been checked and leave these excerpts and contracts applicable. Pre-existing changes are recorded and untouched. Stop if the implementation materially differs.

### Step 2: Add hidden-state regressions

Extend the three browser suites. For Item.Footer and SelectionItem.SubSection, put a button before the hidden part and one after it; Tab from the "Before" button must land on the "After" button, and `nestedButton.focus()` must leave `document.activeElement` unchanged. Capture the nested button's DOM reference **before** asserting (for example `document.querySelector('[data-slot="item-footer"] button')` or `footerHost("...").querySelector("button")`), because once the footer is `inert` a `page.getByRole` query may no longer return it. Treat the role-query absence (`page.getByRole("button", { name, exact: true }).query()` returning `null`) as a secondary assertion: if Chromium 1.62-era Playwright still returns inert elements from role queries, drop that one assertion rather than weakening the focus assertions. Then re-render with `mode="visible"` (use the `rerender` returned by `renderThemed`) and verify Tab reaches the nested button.

For Sidebar, use the existing `Frame` fixture and DESKTOP viewport; pass a `<Sidebar.MenuItem>` with a real link (`<Sidebar.MenuButton render={<a href="#x" />}>`) and a plain `<button type="button">` as `children`. With the sidebar collapsed (`provider={{ defaultOpen: false }}`, which yields `data-collapsible="offcanvas"` as at test line 229), focus the Trigger, press Tab, and assert focus lands on the `After` button, never on the link or the plain button; also assert `link.focus()` does not make it `document.activeElement`. Repeat for `root={{ side: "right" }}`. Demonstrate the failures before changing production code: against `f14057be` the collapsed offcanvas panel is only translated off-screen (`data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]`), so its controls are still focusable.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx`.

**Expected**: New hidden-state assertions fail against current code; existing unrelated assertions pass.

### Step 3: Make hidden footer semantics follow mode

In `ItemFooter` (`item.tsx:167-190`), add `inert` to the destructured props and render `inert={mode === "hidden" || inert || undefined}` **after** the `{...props}` spread so `mode` stays authoritative while an explicitly `inert` visible footer keeps working. `ComponentProps<"div">` already types `inert?: boolean` in the pinned `@types/react` 19.2.17, and React 19 serializes the boolean correctly, so no type changes are needed. Preserve DOM structure (`item-footer` wrapping `item-footer-content`), `data-mode`, and the recipe transitions; do not touch `itemFooterVariants`. `SelectionItem.SubSection` forwards all props to `Item.Footer` (`selection-item.tsx:101`), so it inherits the fix with no change of its own.

In `selection-item.browser.test.tsx:222`, the "makes hidden SubSection content unclickable" test locates the nested button via `page.getByRole(...)`. Replace that locator with a retained DOM reference (query the button inside `subsectionHost`/`[data-mode="hidden"]` with `querySelector`) so the test keeps working when Playwright excludes inert content; keep its `pointer-events` and `elementFromPoint` assertions as they are. The item suite's `footerHost` uses `getByText`, which is unaffected.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx`.

**Expected**: Footer and subsection regressions pass; sidebar regression remains the only expected failure.

### Step 4: Hide offcanvas contents while retaining the rail

In the desktop `SidebarRoot` branch, add `group-data-[collapsible=offcanvas]:invisible` (Tailwind v4 `invisible` = `visibility: hidden`) to the `sidebar-container` div's `cn(...)` list (`sidebar.tsx:331`, before the `variant === ...` ternary, alongside the existing `group-data-[collapsible=offcanvas]:left-[...]` utilities). Because `data-collapsible` is only `"offcanvas"` while `state === "collapsed"` (`sidebar.tsx:313`), this selector fires exactly when the panel is collapsed offcanvas; it never fires for `collapsible="icon"` or `"none"`, and the mobile branch renders a `Sheet` with no `group` ancestor. Then add `group-data-[collapsible=offcanvas]:visible` (`visibility: visible`) to `SidebarRail`'s `cn(...)` list (`sidebar.tsx:397-405`, next to the existing `group-data-[collapsible=offcanvas]:translate-x-0` string on line 401). CSS `visibility` is inherited but overridable per descendant, so the Rail stays hit-testable and clickable while every other descendant of the container drops out of focus order and the accessibility tree, with no React child partitioning. Do not set `inert` or `aria-hidden` on any ancestor of the Rail: unlike `visibility`, those cannot be undone by a descendant and would kill the mouse rail. Keep the mobile and icon branches unchanged.

Rebuild before the next browser run: the suites import `dist/styles.css`, so the two new utilities do not exist in the test page until `pnpm --filter @elmeragroup/ui build` regenerates it. If a test disproves this visibility approach, STOP rather than adding child introspection or portal machinery.

**Verify**: `pnpm --filter @elmeragroup/ui build`.

**Expected**: Exit 0, and `grep -c "collapsible=offcanvas" packages/ui/dist/styles.css` reports a count at least 2 higher than before the change (one `visibility: hidden` rule for the container, one `visibility: visible` rule for the rail). Then re-run the targeted vitest command: the Step 2 sidebar regressions now pass.

### Step 5: Verify closing and reopening, then document

Test externally controlled collapse while a menu control has focus: focus a menu link, collapse through `ContextProbe`'s `setOpen(false)` (pattern at sidebar test lines 422-447) or `rerender` with `provider={{ open: false }}`, then `await vi.waitFor(...)` for `data-state="collapsed"`. Chromium blurs an element whose subtree becomes `visibility: hidden`, so assert `document.activeElement` is no longer inside `sidebarRoot()`; in the `Frame` fixture the next Tab from that state reaches `Sidebar.Trigger` (`roleNamed("button", "Toggle sidebar")`), the first tabbable element left in DOM order. Do not invent global focus lookup or force focus to the mouse rail. Test reopening both through the Trigger and through `userEvent.click(railNamed("Toggle sidebar"))` while collapsed (the rail stays clickable thanks to its `visible` override), then confirm Tab reaches the menu link again. Add icon-mode (`root={{ collapsible: "icon" }}`: menu buttons stay tabbable while collapsed) and mobile (`page.viewport(MOBILE...)`, Sheet closed: no menu link is tabbable) smoke cases.

Document the behavior: in `apps/docs/src/app/(docs)/components/item/page.mdx` add one sentence to the existing `<Prose>` block (or a short new `## Footer reveal` paragraph above the `footer-reveal` demo) stating that `mode="hidden"` renders the footer `inert`, so its content is removed from tab order, pointer events, and the accessibility tree until the mode changes; in `apps/docs/src/app/(docs)/components/selection-item/page.mdx` add the equivalent sentence about `SelectionItem.SubSection mode="hidden"` to the existing `<Prose>` block. Keep both MDX files' frontmatter, imports, and `<Demo>` blocks unchanged. Then create `.changeset/hidden-content-focus.md` with frontmatter `"@elmeragroup/ui": patch` and a consumer-facing summary covering both fixes; model the format on `.changeset/initial-release.md`.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx`.

**Expected**: All selected suites pass, including keyboard, pointer rail, reveal, both sides, and mobile cases.

### Step 6: Complete verification and handoff

The scoped changeset must name `"@elmeragroup/ui": patch` and describe the consumer-visible result. Run the completion commands below. Inspect `git diff --name-only` and `git ls-files --others --exclude-standard` against the recorded baseline. Update only this plan's index row to DONE after every gate passes; otherwise mark BLOCKED with the concrete failing gate. Report changed behavior, checks run, and any remaining blocker.

**Verify**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx`.

**Expected**: All targeted tests pass; no unhandled errors or silent zero-test result.

**Verify**: `pnpm --filter @elmeragroup/ui type-check`.

**Expected**: Exit 0.

**Verify**: `pnpm lint`.

**Expected**: Exit 0, no warnings.

**Verify**: `pnpm ci:checks`.

**Expected**: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.

## Test plan

Use the existing sidebar viewport helpers and roleNamed/renderThemed fixtures. Cover hidden/visible/default footer modes, an explicitly inert visible footer, descendants in SelectionItem.SubSection, controlled sidebar collapse, offcanvas left/right, icon mode, mobile Sheet, external Trigger, and pointer Rail. Use eventual assertions only for animation completion; avoid arbitrary sleeps.

**Final targeted verification**: `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx` must run the named suites and pass all existing and newly specified cases.

## Done criteria

- [ ] `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/sidebar/sidebar.browser.test.tsx src/components/item/item.browser.test.tsx src/components/selection-item/selection-item.browser.test.tsx`: All targeted tests pass; no unhandled errors or silent zero-test result.
- [ ] `pnpm --filter @elmeragroup/ui type-check`: Exit 0.
- [ ] `pnpm lint`: Exit 0, no warnings.
- [ ] `pnpm ci:checks`: Exit 0, including format, build, type, runtime, policy and packed-consumer gates.
- [ ] The new regression cases named in this plan exist and pass.
- [ ] `grep -n 'inert={mode === "hidden"' packages/ui/src/components/item/item.tsx` returns exactly one match.
- [ ] `grep -c 'group-data-\[collapsible=offcanvas\]:invisible' packages/ui/src/components/sidebar/sidebar.tsx` prints `1` and `grep -c 'group-data-\[collapsible=offcanvas\]:visible' packages/ui/src/components/sidebar/sidebar.tsx` prints `1`.
- [ ] `grep -rn "inert\|aria-hidden" packages/ui/src/components/sidebar/sidebar.tsx` shows `aria-hidden` only on the Rail button (unchanged) and no new `inert` attribute.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --name-only` and `git ls-files --others --exclude-standard` contain no new changes outside Scope after accounting for the recorded baseline.
- [ ] The scoped changeset declares `"@elmeragroup/ui": patch`.
- [ ] Row 001 in `plans/README.md` is DONE, or a dispatcher explicitly owns the index update.

## STOP conditions

Stop and report if the current-state code has materially drifted, a verification step fails twice after one reasonable repair attempt, or a correct solution requires another file or public contract outside Scope. Do not weaken assertions, skip a gate, suppress an error, or update unrelated snapshots to make verification pass.

STOP if hiding the offcanvas panel also disables the mouse rail, if the fix appears to need a hook or state in `ItemFooter` (it should be a render-only `inert` attribute), if a public focus API is needed, if `tsc` rejects `inert` on `ComponentProps<"div">` (would indicate an unexpected `@types/react` drift from 19.2.17), or if the current accessibility semantics differ from these excerpts. Do not solve this by unmounting children or dropping form state.

## Maintenance notes

Review keyboard semantics whenever a CSS-only hidden state is added; browser suites read `dist/styles.css`, so a utility-class change without a rebuild silently tests the old stylesheet. Keep the mouse rail outside semantic hiding through its explicit visibility override; do not replace the panel's visibility rule with ancestor inert without redesigning that rail.
