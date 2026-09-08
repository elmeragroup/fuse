# Implementation plans

Prepared 2026-09-08 on `codex/deep-audit-plans`, against commit `f14057be`. The user selected audit findings 1 through 11. Each numbered file is a self-contained implementation handoff; its number matches the audit finding.

[Deep audit report](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/deep-audit.md) records the broader evidence and coverage limits. Only documents under `plans/` were added. No implementation, commit, or push has been performed.

## Execution order and status

Recommended order follows the table. Plans are technically independent. Each executor should read its entire plan, honor the stop conditions, and update its own row.

| Plan                                                                                         | Title                                                             | Priority | Effort | Depends on | Status |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [001](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/001-hidden-content-focus.md)        | Remove hidden sidebar and footer content from keyboard navigation | P1       | M      | None       | DONE   |
| [003](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/003-numeric-text-field-reset.md)    | Restore native reset for uncontrolled numeric TextField           | P1       | M      | None       | DONE   |
| [011](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/011-phone-number-field-reset.md)    | Clear uncontrolled phone values on native form reset              | P1       | M      | None       | DONE   |
| [004](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/004-packed-consumer-release-age.md) | Enforce the release-age guard in isolated React consumer installs | P2       | M      | None       | DONE   |
| [005](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/005-completed-intent-cleanup.md)    | Unregister predictive intent after its callback fires             | P2       | S      | None       | DONE   |
| [002](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/002-number-field-localization.md)   | Localize NumberField stepper labels and expose copy overrides     | P2       | S      | None       | DONE   |
| [006](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/006-theme-storage-events.md)        | Synchronize theme preferences after local-storage clears          | P2       | S      | None       | TODO   |
| [007](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/007-empty-artwork-title.md)         | Render artwork with an empty title as decorative                  | P2       | S      | None       | TODO   |
| [008](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/008-figma-route-own-slugs.md)       | Return 404 for inherited-property Figma theme slugs               | P2       | S      | None       | TODO   |
| [009](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/009-flag-source-provenance.md)      | Verify the pinned flag checkout before copying assets             | P2       | M      | None       | TODO   |
| [010](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/010-keyboard-spec-exceptions.md)    | Document the existing menu and tab keyboard defaults              | P3       | S      | None       | TODO   |

Status values: TODO, IN PROGRESS, DONE, BLOCKED with a reason, or REJECTED with a rationale.

## Dependencies and shared files

- Do 003 before 011 when assigning one executor sequential work. Both use the existing textarea reset lifecycle, but each owns a different state model. Neither requires a shared hook or the other's code.
- Plans 002 and 010 both edit `docs/spec/accessibility.md`, in different sections. Execute them sequentially or reconcile their documentation edits before combining work. Run the drift check against the live file first.
- Plans 001 and 008 require rebuilt artifacts before their final browser or HTTP checks. Plan 004 requires actual tarball installs with registry access. Each plan records its exact gates.
- Each behavioral fix starts with characterization. Do not batch implementation before establishing the failing cases.
- Executors can work independently in isolated checkouts. A dispatcher combining parallel work should own index status changes to avoid competing edits to this file.
- Direction D1, first-publish readiness, and D2, a visual-baseline spike, were not selected and have no implementation plan.

## Finding 11 investigation

Confirmed on 2026-09-08, including a repeat run. The normal UI browser project, with its existing dependency optimization, ran the unchanged phone state tests alongside a small external probe. Fourteen tests passed and only the two uncontrolled native-reset expectations failed. Both the visible value and actual FormData retained the edited number. There were no unhandled React errors.

[Investigation result](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/probes/phone-reset-result.md) contains observations and the command. [Archived reproduction](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/probes/phone-reset-reproduction.md) preserves the probe source as documentation, outside ordinary test and lint discovery. Plan 011 specifies clearing digits while preserving the selected country and emitting no change callbacks.

## Considered and rejected

- Sidebar action buttons submitting forms: rejected. The clean browser probe did not submit, and installed Base UI `useRenderElement.mjs:156` automatically supplies `type="button"`. Source-level absence in the wrapper was misleading.
- Missing release/publishing workflow: deliberately inactive with documented prerequisites. Kept as a direction option.
- Missing packed Next consumer: part of first-publish readiness, not an active publish failure.
- React Aria quarantine and date migration: documented dependency decision.
- Dark token values, extra brands/locales, user density preferences, chart, source registry, and additional playgrounds: require the product triggers already recorded in the roadmap.
- Fkab palette alias, accepted focus-ring contrast deviation, selected token pairings, document density ownership, and nested providers: deliberate contracts.
- Late-attaching object portal references: limitation explicitly documented in the theming contract.
- Phosphor's unused weights and same-asset SVG ID reuse: accepted design choices; no demonstrated counterexample requiring reversal.
- DropdownMenu Escape behavior and Tabs automatic activation: intentional and tested. Only the general specification needs correction, finding 10.
- SelectionItem direct-child partitioning: explicitly documented; no new abstraction proposed.
- Omitted NumberField value coerced to null: surprising, but its JSDoc explicitly specifies this behavior. No behavior-changing plan proposed without an intent decision.
- Sidebar file length, manual entry rosters, and independent source-policy tests: insufficient grounds for a generic refactor.
- Internal extractor/lint ownership, exact canary and Effect RC exceptions: documented choices. No unverified latest-version migration proposed.
- Code highlighter HTML sink: no confirmed unsafe-input bypass.
- Fenced Markdown and heading parsing edge cases: no current authored-page failure established.
- Theme storage clear behavior is retained as finding 6; a generic missing matchMedia fallback and temporary-port reservation race were not prioritized without a supported-browser or observed-flakiness case.
- No known-compromised dependency identified. The audit returned zero advisories; finding 4 concerns an installation-policy gap.
