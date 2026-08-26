# Plan 002: Keep the Tooltip's accessible description link intact

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7cbf25f..HEAD -- packages/ui/src/components/tooltip/tooltip.tsx packages/ui/src/components/tooltip/tooltip.browser.test.tsx packages/ui/src/components/tooltip/tooltip.test-d.tsx docs/spec/components/tooltip.md .changeset/fix-tooltip-description-link.md`
> Plan 001 intentionally changes the first two files. Execute Plan 001 first, then compare only the Tooltip ID/role/description excerpts below. Any unrelated mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-preserve-overlay-ref-containers.md`
- **Category**: bug
- **Planned at**: commit `7cbf25f`, 2026-08-26

## Why this matters

Tooltip creates a popup ID and points its trigger's `aria-describedby` to it, but consumer props are spread afterward. A consumer-supplied trigger description, popup ID, or popup role can silently overwrite that relationship and remove the tooltip from the control's accessible description. The wrapper should merge legitimate pre-existing description IDs while owning the popup ID and semantic role that make its accessibility contract work.

## Current state

- `packages/ui/src/components/tooltip/tooltip.tsx` — owns the generated ID context and renders Trigger/Popup.
- `packages/ui/src/components/tooltip/tooltip.browser.test.tsx` — currently proves only the default one-ID description.
- `packages/ui/src/components/tooltip/tooltip.test-d.tsx` — public type-contract tests.
- `docs/spec/components/tooltip.md` — normative Tooltip API/accessibility contract.

The Trigger currently loses its generated description when `props` contains `aria-describedby` (`tooltip.tsx:58-69`):

```tsx
<TooltipPrimitive.Trigger
  data-slot="tooltip-trigger"
  aria-describedby={tooltipId ?? undefined}
  className={cn(selfFocusRing, className)}
  {...props}
/>
```

The Popup has the same ordering problem for its owned `id` and `role` (`tooltip.tsx:129-137`):

```tsx
<TooltipPrimitive.Popup
  data-slot="tooltip-content"
  id={tooltipId ?? undefined}
  role="tooltip"
  className={cn(/* recipe */, className)}
  {...props}>
```

`TooltipContentProps` currently intersects all Popup props with position/container props, so `id` and `role` are advertised as customizable. The existing browser assertion at `tooltip.browser.test.tsx:107-120` checks that the default trigger description is `Add to library`; it does not cover composition with a caller-owned description.

`docs/spec/components/tooltip.md` §7 says the Tooltip is descriptive and the trigger must be wired to the popup. Preserve that requirement. The repository uses `*.test-d.tsx` plus `@ts-expect-error` for rejected public props; see the existing rejected `as` prop in `tooltip.test-d.tsx:40-41`.

## Commands you will need

| Purpose               | Command                                                                                                           | Expected on success |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| Tooltip browser tests | `pnpm --filter @elmeragroup/ui exec vitest run --project browser src/components/tooltip/tooltip.browser.test.tsx` | file passes         |
| Tooltip type contract | `pnpm --filter @elmeragroup/ui test:types`                                                                        | all type tests pass |
| UI typecheck          | `pnpm --filter @elmeragroup/ui type-check`                                                                        | exit 0              |
| UI unit suite         | `pnpm --filter @elmeragroup/ui test`                                                                              | all unit tests pass |
| Format/lint           | `pnpm format:check && pnpm lint`                                                                                  | both exit 0         |

## Scope

**In scope** (the only files you should modify):

- `packages/ui/src/components/tooltip/tooltip.tsx`
- `packages/ui/src/components/tooltip/tooltip.browser.test.tsx`
- `packages/ui/src/components/tooltip/tooltip.test-d.tsx`
- `docs/spec/components/tooltip.md`
- `.changeset/fix-tooltip-description-link.md` (create)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- Base UI internals or dependency versions.
- Other overlay components or their ARIA behavior.
- Tooltip timing, positioning, focus styles, dismissal, or provider grouping.
- A public custom-ID API or a second ID-registration context.
- Plan 001's container resolution beyond retaining its completed changes.

## Git workflow

- Branch: `codex/002-protect-tooltip-description-link`, created after Plan 001 is complete.
- Conventional commit style: `fix(ui): protect tooltip description link` is appropriate.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Merge trigger description tokens

In `tooltip.tsx`, destructure the Trigger's `aria-describedby` under a camel-cased local (for example `ariaDescribedBy`) instead of leaving it in `props`. Add a small private helper in this module that:

- accepts nullable/undefined whitespace-delimited ID strings;
- splits on whitespace;
- removes empty tokens and duplicates while preserving first-seen order;
- returns `undefined` if there are no tokens, otherwise joins them with one space.

Set the Trigger's `aria-describedby` to the merge of the caller IDs followed by `tooltipId`. Keep `className` composition and all other forwarded Trigger props unchanged. A generated Tooltip ID must appear exactly once even if a caller repeats it.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

### Step 2: Make Popup ID and role wrapper-owned

Change `TooltipContentProps` to begin from:

```ts
Omit<ComponentProps<typeof TooltipPrimitive.Popup>, "id" | "role">;
```

Retain all current position and `container` additions. In the Popup JSX, spread the remaining props before the wrapper-owned `data-slot`, `id`, `role`, and composed `className`, so untyped JavaScript callers also cannot replace the generated ID or tooltip role at runtime. Do not expose an alternate ID prop in this change.

This is a deliberate contract correction: the wrapper must own both ends of its generated relationship. It is not sufficient merely to reorder the current Trigger props, because Popup overrides would still break the link.

**Verify**: `pnpm --filter @elmeragroup/ui type-check` → exit 0.

### Step 3: Lock behavior and the public type contract

In `tooltip.browser.test.tsx`, extend the accessibility coverage with a caller-owned description element whose ID is passed to `Tooltip.Trigger`. Open the Tooltip, then assert:

- the raw `aria-describedby` token list contains both the caller-owned ID and the generated Popup ID exactly once;
- the generated Popup ID resolves to the element with `role="tooltip"`;
- the trigger's accessible description contains both the caller description and tooltip text in token order.

Keep the existing default accessible-description test; it catches accidental changes for the common case.

In `tooltip.test-d.tsx`, assert `TooltipContentProps` has neither `id` nor `role`, and add JSX examples with `@ts-expect-error` for `<Tooltip.Content id="custom" />` and `<Tooltip.Content role="status" />`. Keep the existing valid position/container contract coverage.

**Verify**: run the Tooltip browser command and `pnpm --filter @elmeragroup/ui test:types` → both pass. Temporarily reverting either prop-order fix should make the corresponding new assertion fail.

### Step 4: Align the normative spec and changeset

Update `docs/spec/components/tooltip.md` in its props/accessibility sections to state:

- Trigger preserves caller-supplied `aria-describedby` IDs and appends the Tooltip Popup ID without duplicates.
- Popup `id` and `role="tooltip"` are wrapper-owned and are not public `Tooltip.Content` props.

Do not describe Base UI internals or add unrelated API prose. Create `.changeset/fix-tooltip-description-link.md` for a patch release of `@elmeragroup/ui`, explaining that consumer props can no longer disconnect Tooltip content from its trigger and that existing description IDs are preserved.

**Verify**: `pnpm format:check && pnpm lint` → exit 0.

### Step 5: Run the broader UI gates

Run UI typecheck, unit tests, type tests, and the full Tooltip browser file after all edits.

**Verify**: every command in the table exits 0; `git status --short` lists only Scope files plus the Plan 001 changes if both plans are on the same branch.

## Test plan

- Existing default case: one Tooltip ID produces exactly the Tooltip text as accessible description.
- New composition case: an external description ID and Tooltip ID both survive with deterministic ordering and no duplicates.
- Popup ownership: generated ID points to the role=tooltip element.
- Type regressions: `Tooltip.Content` rejects `id` and `role`, while position props and container remain accepted.
- Model the browser test on `tooltip.browser.test.tsx:107-120` and type failures on the existing rejected `as` example.

## Done criteria

- [ ] Trigger description IDs are tokenized, de-duplicated, and merged with the generated Tooltip ID.
- [ ] Popup ID and role cannot be overwritten at runtime by forwarded props.
- [ ] `TooltipContentProps` excludes `id` and `role`.
- [ ] Default and composed accessible-description browser tests pass.
- [ ] Type tests reject both managed props.
- [ ] The Tooltip spec documents the ownership/composition rule.
- [ ] A patch changeset exists.
- [ ] UI typecheck, unit tests, type tests, Tooltip browser tests, lint, and format pass.
- [ ] `plans/README.md` is updated and no files outside Scope/Plan 001 are modified.

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001 has not been completed or its Tooltip changes conflict with these excerpts beyond the portal hook.
- Base UI now requires consumer control of Popup `id` or `role` for a documented supported behavior.
- A maintainer requires custom Tooltip popup IDs to remain public; that needs a different registration design and explicit API ruling.
- The browser accessibility matcher orders multi-ID descriptions differently from DOM token order; report the evidence rather than weakening the raw-token assertions.
- A fix appears to require changing another component or Base UI source.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- Any future wrapper-owned ARIA relationship must protect both the referencing attribute and target ID from prop-spread overrides.
- Reviewers should scrutinize whitespace handling and stable token order in the merge helper.
- A future custom-ID request should replace the generated-ID design deliberately; it should not reintroduce an incidental `id` escape hatch.
