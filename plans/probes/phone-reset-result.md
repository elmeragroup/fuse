# PhoneNumberField native reset investigation

Verified on 2026-09-08 using the installed Vitest 4.1.10 Chromium browser provider and pinned Node 24.13.0.

The transient test and config are preserved in [the archived reproduction](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/probes/phone-reset-reproduction.md). Recreate them from its text blocks before rerunning. Run from the repository root:

```sh
/Users/tommy.lunde.barvag/.local/share/fnm/node-versions/v24.13.0/installation/bin/node packages/ui/node_modules/vitest/vitest.mjs run --config plans/probes/phone-reset.vitest.config.mjs --project browser
```

The command requires permission to start a local test server and Chromium. A sandbox-only attempt stopped with `listen EPERM` before running tests; the approved run below completed without unhandled errors.

The probe configuration imports the repository's existing UI Vitest configuration and reuses its browser project, including its exact `optimizeDeps` list. It adds React deduplication for the test file located outside the package and includes the unchanged `phone-state.browser.test.tsx` suite alongside the new probe. The probe uses the existing themed renderer, locale helper, role-based queries, actual PhoneNumberField, and native FormData.

## Result

**Confirmed.** The existing phone-state suite passed all 11 tests. Three probe checks passed: uncontrolled input updates its visible value and FormData, canceled native reset preserves the value, and controlled reset preserves the parent's authoritative value. Both uncontrolled reset regression cases failed at their final expected-empty assertion.

The probe first checks that all three values start empty, then enters a synthetic Norwegian test number and verifies the visible value and actual FormData. After reset and a 100 ms task allowance, both reset methods retain all three edited values:

```text
PHONE_RESET_method {"display":"41234567","submitted":"+4741234567","submittedDisplay":"41234567"}
PHONE_RESET_button {"display":"41234567","submitted":"+4741234567","submittedDisplay":"41234567"}

Test Files  1 failed | 1 passed (2)
Tests       2 failed | 14 passed (16)
Duration    2.81s
```

Expected for an uncontrolled field reset to its initially empty state:

```json
{ "display": "", "submitted": "", "submittedDisplay": "" }
```

The evidence supports a reset fix for uncontrolled PhoneNumberField. It does not establish the desired behavior of country selection on reset; that is a separate API decision the implementation plan must state. The controlled sanity check confirms that parent-owned values should remain authoritative. A repeat run returned the same 14 passing checks and two expected failures in 2.79 seconds. The transient test and configuration were then archived as Markdown; only the archived text remains in the plans branch. The probe is expected to fail until implementation, while the normal package suites remain unchanged.
