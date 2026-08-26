# Plan 001: Preserve explicit ref containers until Base UI resolves them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cbf25f..HEAD -- packages/ui/src/theme/theme-scope-container.ts packages/ui/src/components/dialog/dialog.tsx packages/ui/src/components/popover/popover.tsx packages/ui/src/components/sheet/sheet.tsx packages/ui/src/components/tooltip/tooltip.tsx packages/ui/src/components/dropdown-menu/dropdown-menu.tsx packages/ui/src/components/select/select.tsx packages/ui/src/components/dialog/dialog.browser.test.tsx packages/ui/src/components/tooltip/tooltip.browser.test.tsx .changeset/fix-overlay-ref-containers.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7cbf25f`, 2026-08-26

## Why this matters

Every public Base UI overlay accepts an explicit portal container as either an element or a React ref. The shared resolver currently reads `ref.current` during render. For a normal sibling object ref, that value is still `null`, and assigning the DOM node during commit does not schedule another render; the overlay can therefore remain unmounted forever. Passing the ref object through to Base UI lets its portal resolve attachment while retaining the rule that an unattached scoped container must never fall back to `document.body`.

## Current state

- `packages/ui/src/theme/theme-scope-container.ts` — shared resolver used by both Base UI overlays and the private React Aria adapters.
- `packages/ui/src/components/{dialog,popover,sheet,tooltip,dropdown-menu,select}/*.tsx` — Base UI portal callers; each resolves the container early and returns `null` for a resolved literal `null`.
- `packages/ui/src/react-aria/internal/modal.tsx` and `packages/ui/src/react-aria/internal/popover.tsx` — private React Aria callers that require an `HTMLElement`, not a ref; they are deliberately out of scope.
- `packages/ui/src/components/dialog/dialog.browser.test.tsx` and `packages/ui/src/components/tooltip/tooltip.browser.test.tsx` — browser-mode regression homes.

The resolver currently discards ref identity (`theme-scope-container.ts:14-24`):

```ts
export function useThemeScopeContainer(
  container?: HTMLElement | RefObject<HTMLElement | null>
): HTMLElement | null | undefined {
  const scope = use(ThemeScopeContainerContext);
  if (container === undefined) return scope;
  if (isElementRef(container)) return container.current;
  return container;
}
```

Tooltip shows the common caller shape (`tooltip.tsx:112-122`):

```tsx
const resolvedContainer = useThemeScopeContainer(container);
if (resolvedContainer === null) return null;
return <TooltipPrimitive.Portal container={resolvedContainer}>…</TooltipPrimitive.Portal>;
```

The existing explicit-container tooltip test avoids the bug by storing the node in state and not rendering `Tooltip.Content` until the node exists. The “never attached” test proves only that a null ref does not portal to the body; it never attaches the ref.

The normative behavior in `docs/spec/theming.md` §7.4 is:

> explicit container element/ref → nearest ThemeScope → primitive default. If an explicit ref or nearest scope exists but its element is still null, content waits. Base UI entries forward the resolved target to their Portal.

Base UI's installed Portal types accept a `RefObject` (`packages/ui/node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.d.ts`). React Aria's private portal adapter accepts an element, which is why the two resolution modes must stay separate.

## Commands you will need

| Purpose                | Command                                                                                                                                                         | Expected on success    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Targeted browser tests | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/dialog/dialog.browser.test.tsx src/components/tooltip/tooltip.browser.test.tsx` | both files pass        |
| UI typecheck           | `pnpm --filter @elmeragroup/ui type-check`                                                                                                                      | exit 0, no errors      |
| Full UI browser suite  | `pnpm --filter @elmeragroup/ui test:browser`                                                                                                                    | all browser tests pass |
| Format                 | `pnpm format:check`                                                                                                                                             | exit 0                 |
| Lint                   | `pnpm lint`                                                                                                                                                     | exit 0, no warnings    |

## Scope

**In scope** (the only files you should modify):

- `packages/ui/src/theme/theme-scope-container.ts`
- `packages/ui/src/components/dialog/dialog.tsx`
- `packages/ui/src/components/popover/popover.tsx`
- `packages/ui/src/components/sheet/sheet.tsx`
- `packages/ui/src/components/tooltip/tooltip.tsx`
- `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx`
- `packages/ui/src/components/select/select.tsx`
- `packages/ui/src/components/dialog/dialog.browser.test.tsx`
- `packages/ui/src/components/tooltip/tooltip.browser.test.tsx`
- `.changeset/fix-overlay-ref-containers.md` (create)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `packages/ui/src/react-aria/internal/modal.tsx` and `popover.tsx`; their upstream API needs a concrete element.
- The public `ThemeScope` API or context value shape.
- Base UI vendored/package code or dependency versions.
- Focus, dismissal, animation, stacking, or other overlay behavior.
- Adding a `document.body` fallback for any attached-later scope.

## Git workflow

- Branch: `codex/001-preserve-overlay-ref-containers`
- Use conventional commits; recent style includes `fix(ui): ...`. Keep the implementation/tests/changeset in one logical commit unless review requires otherwise.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add a ref-preserving Base UI resolver

In `packages/ui/src/theme/theme-scope-container.ts`, add an exported, package-private hook named `useThemeScopePortalContainer` with this return contract:

```ts
HTMLElement | RefObject<HTMLElement | null> | null | undefined;
```

It must read `ThemeScopeContainerContext`, return the context value only when `container === undefined`, and otherwise return the explicit element or ref unchanged. Refactor the existing `useThemeScopeContainer` to call the new hook and dereference a ref only for element-only consumers. Preserve all four states: absent scope (`undefined`), attached-later scope (`null`), concrete element, explicit ref.

Do not add effects, state, polling, callback-ref composition, or body fallback.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

### Step 2: Switch every Base UI portal caller

Replace the `useThemeScopeContainer` import/call with `useThemeScopePortalContainer` in all six component modules in scope. Include both portal sites in `dropdown-menu.tsx` (root content and sub-content). Keep the existing `if (resolvedContainer === null) return null` guard: a ThemeScope publishes `null` while its callback ref is unattached, but an explicit object ref is now a non-null object and must reach Base UI.

Use `rg -n 'useThemeScopeContainer' packages/ui/src/components packages/ui/src/react-aria` after the edits. Expected result: matches remain only in the private React Aria adapters; no Base UI component match remains.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0 and every Base UI Portal accepts the widened value.

### Step 3: Add real sibling-ref regressions

Add one regression to each browser test file:

1. In `dialog.browser.test.tsx`, render a component that creates `useRef<HTMLDivElement | null>(null)`, renders `<div ref={containerRef} role="region" aria-label="Theme island" />` as a sibling, and passes `container={containerRef}` to an otherwise normal uncontrolled Dialog content. Do not gate content rendering on ref state. Click its trigger, then assert the dialog is a descendant of the region and is not a direct child of `document.body`.
2. In `tooltip.browser.test.tsx`, use the same ordinary sibling object-ref arrangement with an uncontrolled Tooltip Root/Trigger. Do not use `useState`, a callback ref, `open`, or `defaultOpen` to manufacture a second render. Hover the trigger, then assert the tooltip is inside the region and not a direct body child.

Keep the existing element-container, never-attached-ref, and ThemeScope tests. Those cover distinct states and must not be weakened.

**Verify**: run the targeted browser command from the table → both files pass, and the new tests fail if their components are temporarily switched back to `useThemeScopeContainer`.

### Step 4: Record the public bug fix

Create `.changeset/fix-overlay-ref-containers.md` using the repository's existing changeset format. Mark `@elmeragroup/ui` for a patch release and state that overlays now mount correctly when an explicit portal-container ref attaches during commit. Do not claim changes to React Aria interim components.

**Verify**: `pnpm format:check` → exit 0.

### Step 5: Run the full gates for this change

Run the full UI browser suite, UI typecheck, root lint, and root format check from the command table.

**Verify**: every command exits 0; `git status --short` lists only the in-scope files plus the status update in `plans/README.md`.

## Test plan

- New Dialog browser regression: an ordinary attached sibling object ref works without state-gating content.
- New Tooltip browser regression: the same lifecycle works through hover-open behavior.
- Existing never-attached ref tests: content remains absent and never escapes to the body.
- Existing ThemeScope tests: callback-ref state still rerenders and scopes the popup.
- Existing explicit element tests: direct `HTMLElement` containers still work.
- Structural patterns: use the explicit-container and ThemeScope tests already adjacent in each browser test file, but remove their state-gating workaround in the new cases.

## Done criteria

- [ ] `useThemeScopePortalContainer` preserves explicit ref identity; `useThemeScopeContainer` still returns only element/null/undefined.
- [ ] All Base UI overlay portal sites use the ref-preserving hook, including DropdownMenu sub-content.
- [ ] Private React Aria adapters still use the element-only hook.
- [ ] The two new sibling-ref browser regressions pass without `useState`, `open`, or conditional Content rendering.
- [ ] Never-attached and ThemeScope tests still pass.
- [ ] A patch changeset exists.
- [ ] UI typecheck, full UI browser suite, lint, and format check exit 0.
- [ ] No files outside Scope are modified; `plans/README.md` is updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The installed Base UI Portal types no longer accept a React ref object.
- Any in-scope portal has stopped using `useThemeScopeContainer` or no longer has the shown literal-null guard.
- Passing a never-attached ref to Base UI portals renders content under `document.body`; do not fix that by deleting the safety regression.
- The change appears to require modifying a React Aria adapter, ThemeScope's public contract, or upstream package code.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- New Base UI overlays with a `container` prop must use `useThemeScopePortalContainer`; element-only integrations use `useThemeScopeContainer`.
- Reviewers should inspect the DropdownMenu sub-content site because it is easy to miss.
- Explicit object-ref support for the private React Aria interim components remains deferred until a public interim component requires it; their portal API cannot consume a ref directly.
