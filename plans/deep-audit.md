# Deep codebase audit

Audited 2026-09-07 against commit `f14057be`. Whole-repository audit, not a branch review. The working tree was clean at the start and after verification. Only audit documents under `plans/` were added.

The existing tests and distribution checks are substantial. The strongest improvements are specific behavioral gaps, not a broad rewrite. The user selected findings 1 through 11 on 2026-09-08. Finding 11 was subsequently confirmed with a clean Chromium reproduction. The implementation plans and recommended order are in [the index](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md).

## Scope and conventions

Reviewed all four workspace packages: the published React UI library, Next docs app, Vite static-theme host, and shared TypeScript configurations. Root CI, package scripts, generators, manifests, public entry points, tests, domain glossary, owning specifications, and relevant ADRs were included. The repository contains 1,627 tracked files and 273 component demo TSX files.

The stack is React 19, Base UI 1.6, TypeScript 7, Next 16, Vite 8, pnpm 11, with Node 24 specified by the repository. React Aria date controls and interim atoms are intentionally quarantined. Components use entry facades, colocated implementations/tests, shared style recipes, role-based browser assertions, and four-locale dictionaries. Theming keeps document-owned density independent from brand/segment/variant. Existing decisions do not justify migrations, a new playground, or a generic abstraction pass.

Tests should follow existing role-based assertions and verify user behavior. Match the dictionary pattern used by other localized controls. For reset work, inspect [TextareaField's reset lifecycle](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/textarea-field/textarea-field.tsx:53). Generated API artifacts must be updated by the normal generator when public props change.

## Verification

All completed baseline checks passed:

| Check                                            | Result                                            |
| ------------------------------------------------ | ------------------------------------------------- |
| Root repository-policy suite                     | 18 tests                                          |
| UI unit suite                                    | 660 tests                                         |
| UI Chromium suite                                | 864 tests                                         |
| Docs unit/integration suite                      | 359 tests                                         |
| Docs Chromium suite                              | 32 tests                                          |
| Static-theme unit/browser suites                 | 20 tests                                          |
| UI type-test suite                               | 273 type tests, no type errors                    |
| UI, docs, static-theme TypeScript checks         | Passed                                            |
| Root lint, denying warnings                      | Passed                                            |
| Root formatting check, before adding this report | Passed                                            |
| Dependency advisory audit                        | Zero advisories reported, including high/critical |

Total: 1,953 runtime/policy tests plus 273 type tests.

Commands used directly from the installed workspace binaries, avoiding Turbo's regeneration tasks:

- Root: `./node_modules/.bin/vitest run --config test/vitest.config.mjs`, `./node_modules/.bin/oxlint . --deny-warnings`, `./node_modules/.bin/oxfmt --check`.
- UI: `../../node_modules/.bin/vitest run --project unit`, `../../node_modules/.bin/vitest run --project browser`, `../../node_modules/.bin/vitest --config vitest.types.config.ts --typecheck.only --run`, `../../node_modules/.bin/tsc --noEmit`.
- Docs: `../../node_modules/.bin/vitest run --project unit`, `../../node_modules/.bin/vitest run --project browser`, `../../node_modules/.bin/tsc --noEmit --incremental false`.
- Static-theme: `../../node_modules/.bin/vitest run`, `../../node_modules/.bin/tsc --noEmit --incremental false`.
- Dependency posture: `pnpm audit --audit-level high --json`.

The docs and static-theme checks used existing build output. No fresh build, install, code generation, packed-consumer gate, or full `pnpm ci:checks` was run. Those commands can rewrite committed artifacts or install consumers. Normal implementation verification remains `pnpm ci:checks`, with package generation/builds allowed in an executor's checkout.

Local servers required expanded sandbox access; the initial docs server attempt was blocked by the sandbox, not by an application defect. The initial restricted pnpm audit could not reach signature metadata; the network-enabled audit succeeded. An initial attempt to disable incremental compilation for the composite UI project was invalid; the normal UI no-emit command subsequently passed.

## Prioritized findings

S means hours; M means roughly a day, including tests. Risk describes the proposed change, not the defect. Confidence concerns the evidence, not the priority.

| #   | Finding                                                   | Category                    | Impact                      | Effort | Fix risk | Evidence                                                                                                                                                                                                             | Confidence              |
| --- | --------------------------------------------------------- | --------------------------- | --------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Remove hidden content from keyboard navigation            | Correctness / accessibility | High                        | M      | Medium   | [Sidebar](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.tsx:332); [Item.Footer](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.tsx:156) | High                    |
| 2   | Localize NumberField stepper labels                       | Correctness / localization  | Medium                      | S      | Low      | [NumberField](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx:152)                                                                                             | High                    |
| 3   | Restore numeric TextField form reset                      | Correctness / tests         | High                        | S/M    | Medium   | [TextField](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.tsx:139)                                                                                                   | High                    |
| 4   | Apply the release-age guard to isolated consumer installs | Security / tooling          | Medium                      | S/M    | Medium   | [Packed React checks](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts:44)                                                                                                    | High                    |
| 5   | Remove completed pointer-intent registrations             | Performance                 | Medium, workload-dependent  | S      | Low      | [Intent registry](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:44)                                                                                                     | High                    |
| 6   | Handle local-storage clears and ignore session storage    | Correctness                 | Medium                      | S      | Low      | [Storage listener](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/theme-provider.tsx:121)                                                                                                        | High, code-verified     |
| 7   | Treat empty artwork titles as decorative                  | Accessibility               | Low/medium                  | S      | Low      | [SVG attributes](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke-svg.ts:21)                                                                                                               | High                    |
| 8   | Reject inherited property names in Figma download routes  | Correctness                 | Low                         | S      | Low      | [Figma route](/Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/api/themes/figma/[slug]/route.ts:14)                                                                                                    | High                    |
| 9   | Verify the flag source revision before writing provenance | Tooling / provenance        | Medium, during regeneration | S      | Low      | [Flag vendoring](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/flag-assets.ts:142)                                                                                                                | High, latent defect     |
| 10  | Document intentional keyboard exceptions                  | Docs                        | Low/medium                  | S      | Low      | [Keyboard contract](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md:14)                                                                                                                      | High                    |
| 11  | Restore uncontrolled PhoneNumberField reset               | Correctness / tests         | High                        | M      | Medium   | [PhoneNumberField](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:307)                                                                            | High, browser-confirmed |

## 1. Hidden content remains keyboard-accessible

[Sidebar](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/sidebar/sidebar.tsx:313) marks a desktop offcanvas rail collapsed and moves it outside the viewport, but leaves its descendants interactive. [Item.Footer](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/item/item.tsx:181) keeps hidden descendants mounted with opacity zero, collapsed grid rows, and pointer-event suppression. SelectionItem.SubSection delegates to that footer.

An in-memory Chromium probe placed focus on a hidden footer button and observed opacity zero. Another probe pressed Tab from the button preceding a collapsed sidebar and reached its offscreen button, whose right edge was zero. The sidebar probe shared a page with a phone dependency-loading error, so retain a clean standalone sidebar regression test as the implementation gate. The underlying missing focus exclusion is directly visible in source.

[The current subsection test](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/selection-item/selection-item.browser.test.tsx:204) checks pointer hit testing and still locates the hidden action by accessible role. Three docs demos manually pass `inert` to work around the behavior.

Make hidden content semantically unavailable, preserving animation. Keep icon-collapse mode and mobile Sheet behavior intact. Keep the reopening control usable and define where focus goes if collapse occurs while focus is inside. Tests must cover Tab order, activation, reveal, left/right sidebars, and focus during collapse. This should land before any sidebar or item-footer restructuring.

## 2. NumberField steppers remain English in every locale

[The steppers](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.tsx:152) receive no localized accessible names. The installed Base UI button helper supplies English defaults; passing `locale` to its root formats numbers without translating those names. A clean Chromium probe under `nb-NO` returned Increase and Decrease.

[Existing stepper assertions](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/number-field/number-field.browser.test.tsx:49) expect English; locale coverage checks number formatting. The library's [responsibility split](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md:9) assigns built-in strings to the library.

Add a NumberField dictionary owner and per-locale label assertions. Provide explicit copy overrides consistently with the existing public API policy, and update the string manifest and generated reference. Translation review is part of completion; do not infer approved copy from a different control.

## 3. Numeric TextField ignores native form reset

[Numeric filtering](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.tsx:103) introduces internal state. [Value resolution](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/text-field/text-field.tsx:139) then passes a controlled value and removes the native default value. No reset lifecycle restores that internal state.

A clean Chromium probe mounted an uncontrolled numeric TextField with initial value 123, edited it to 456, and clicked a native reset button. The field remained 456. This is a consumer-visible bug despite the current browser suite passing.

Restore reset behavior only for the uncontrolled numeric mode. Follow the existing textarea reset lifecycle and test native reset buttons, `form.reset()`, canceled reset, external form association, updated defaults, and submitted form data. Controlled values stay parent-owned. Include these characterizations before changing the state handling.

## 4. Packed-consumer installs bypass the repository's age guard

[The React compatibility gate](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/package-check-react.ts:44) creates isolated consumers and invokes npm without a release-age restriction or lockfile. It subsequently executes [a probe importing the package](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/test/packed-consumer/react-probe.ts:8). The published manifest includes [caret-ranged dependencies](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/entries.ts:126). The [repository policy](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/tooling.md:29) requires a three-day delay.

This is a policy gap, not evidence of a compromised package. Ignoring lifecycle scripts reduces exposure but does not prevent execution during the probe. Dependency resolution can also vary for an unchanged commit.

Preserve the real tarball installation and all React version pairs. Explicitly apply the same delay to these installations, without relying on a developer's global configuration. A supported npm version offers `min-release-age` in days; confirm the CI npm version before choosing that path. [Official npm configuration](https://docs.npmjs.com/cli/v11/using-npm/config/#min-release-age) documents the behavior. Alternatively, use isolated pnpm consumers with explicit settings. Do not replace the installation with workspace symlinks. Testing allowed dependency ranges is useful; complete reproducibility should be a separate deliberate choice, not an incidental change.

## 5. Completed pointer-intent work remains registered

[Every prediction-bearing pointer move](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:44) measures all registered elements. [Firing the callback](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/hooks/use-predicted-events.ts:96) sets a ref, but removes the registration only on effect cleanup. Subsequent moves measure the rectangle before discovering the callback already fired.

A subagent's in-memory evaluation of the actual hook recorded one callback and 99 extra rectangle reads over 100 events. I verified the cited implementation and [existing tests](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/button/button.browser.test.tsx:118). Application-level latency has not been measured, so the impact depends on how many intent-enabled buttons a page mounts.

Unregister before calling the one-shot callback. Keep cleanup idempotent and keep pending registrations active. Extend the existing test to assert no later measurements for completed buttons and listener removal after the final registration fires. No broader pointer-prediction redesign is warranted.

## 6. Color preferences do not follow whole-store clears

[The storage listener](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/theme-provider.tsx:121) rejects events with a null key and accepts matching keys from any storage area. [Persistence](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/theme/color-scheme.ts:124) exclusively uses local storage.

A clear in another tab leaves the mounted preference stale, whereas a new page uses the fallback. A same-origin frame can also emit a session-storage event for the same key, changing runtime preference without changing local storage. This was code-verified, not reproduced in a multi-tab session.

Handle relevant local-storage clears and removals, ignore session storage and unrelated keys, and preserve the stored preference while forced color mode is active. Tests should use representative storage events, including their storage area. This concerns the existing color-scheme API; deferred dark token values remain out of scope.

## 7. An empty artwork title creates an unnamed image

[decorativeSvgProps](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke-svg.ts:21) regards every defined title as meaningful. [Vipps](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/icons/bespoke/vipps.tsx:16) and the other bespoke artwork render a title element only for a truthy string. Passing an empty string therefore creates `role="img"` with no accessible name or decorative exclusion.

The rendered probe confirmed that attribute combination. The pattern occurs across 27 artwork components. Use one meaningful-title rule for both attributes and the title element. Preserve explicit accessibility overrides. Add empty-string tests, and decide explicitly whether whitespace-only titles receive the same treatment.

## 8. Invalid Figma slugs can return successful downloads

[The route](/Users/tommy.lunde.barvag/src/work/elmera/ui/apps/docs/src/app/api/themes/figma/[slug]/route.ts:14) indexes an ordinary object with the requested slug and tests only for undefined. Inherited Object properties therefore pass the existence check.

Calling the actual GET handler returned 404 for an ordinary unknown slug, but 200 with an empty or empty-object response for inherited property names. This violates the documented illegal-slug 404 contract. It is a routing defect, with no demonstrated sensitive-data exposure or code execution.

Check own-property membership or use a lookup without a prototype. Extend the theme-route tests to include inherited names and confirm every legal slug still returns the expected token document.

## 9. Flag regeneration can write inaccurate provenance

[The attributed revision](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/flag-assets.ts:15) is a constant. [vendorFlags](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/scripts/flag-assets.ts:142) copies whichever files are in the reference checkout and writes that constant beside hashes of the copied bytes. It never verifies the checkout revision or source modifications.

Re-vendoring from a different checkout can create consistent files and hashes with an incorrect source revision. No mismatch in the currently committed artwork was established.

Read the assets from the immutable recorded revision, or verify the relevant checkout and its cleanliness before copying. Add a negative test using an incorrect revision or modified source. Restrict the change to regeneration and its tests; do not re-vendor existing artwork merely to exercise the guard.

## 10. The keyboard specification contradicts intentional behavior

[The normative rule](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/accessibility.md:14) says keyboard behavior inherits Base UI verbatim and Escape closes only the topmost overlay. [DropdownMenu.Sub](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/dropdown-menu/dropdown-menu.tsx:276) deliberately enables parent closure on Escape. [Tabs.List](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/tabs/tabs.tsx:33) deliberately changes activation-on-focus to true.

Both behaviors are explicit and tested. Correct the general statement and list these exceptions. Do not change runtime behavior to match the stale wording. This is a small maintenance correction, not a new interaction-design decision.

## 11. PhoneNumberField ignores native form reset

[The phone composite](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:307) controls its displayed value and [hidden submission value](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/phone-number-field.tsx:331). Its [state hook](/Users/tommy.lunde.barvag/src/work/elmera/ui/packages/ui/src/components/phone-number-field/hooks/use-phone-number-field-state.ts:76) has no reset transition.

The original custom probe had a dependency-optimization error and a follow-up timed out, so it was excluded from the confirmed baseline. On 2026-09-08, a fresh probe reused the existing browser project's exact optimization configuration and deduplicated React for the external test location. The unchanged phone-state suite passed 11 tests; editing, canceled-reset, and controlled-value checks also passed. Only the two uncontrolled reset expectations failed. A repeat run produced the same result with no unhandled errors.

Both `form.reset()` and a native reset button retained the visible number and actual FormData values. This confirms the reset defect. [The result and archived reproduction](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/probes/phone-reset-result.md) preserve the evidence. [Plan 011](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/011-phone-number-field-reset.md) covers uncontrolled-only reset, clears digits while preserving the selected country, and requires no change callbacks. Country preservation is the plan's explicit policy choice; the probe itself establishes only the missing number reset.

## Direction options

### D1. Prepare the first publish through a packed Next consumer

The [release runbook](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/release.md:3) explicitly records publishing as inactive. Its [publish gates](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/release.md:50) require a real Next App Router consumer of the tarball, alongside the Vite consumer. A scoped readiness plan should establish that fixture and verify the stated prerequisites before activation.

Value: validate the library as a dependency in the framework used by the docs, including RSC boundaries and flag assets. Coarse effort M/L; confidence high in the stated direction. Trade-off: registry and hosting setup need owner participation. Missing activation is planned work, not a defect. Resolve finding 4 before broadening installation-based gates.

### D2. Assess whether visual baselines now justify their maintenance cost

The repo has 273 demo TSX files and a 20-theme matrix. The [existing visual-testing roadmap](/Users/tommy.lunde.barvag/src/work/elmera/ui/docs/spec/roadmap.md:23) explicitly triggers on manual review no longer scaling.

A small spike over representative controls, overlays, and both densities can measure baseline size and review noise. Coarse effort M; confidence medium because no missed visual regression or manual-review cost was measured here. Keep the roadmap's publish-gate boundary; do not automatically add screenshots to the merge gate. No visual-regression vendor was selected by this audit.

## Coverage limits

No fresh build, tarball installation, size measurement, release, deployment, remote CI inspection, browser other than Chromium, screen-reader session, or complete visual comparison was performed. Tests that consume existing generated/build artifacts do not prove those artifacts came from this exact checkout.

Every workspace and runtime component implementation was included, but not every long recipe, test assertion, generated asset, or SVG path was read line by line. Generated icon/artwork families were reviewed through their generators, adapters, and relevant tests. Third-party packages and the external internal-tooling repository were not independently audited; dependency implementation was opened only to validate specific leads. Package advisories are a point-in-time registry result.

No broad architectural refactor or migration earned a recommendation. No low-confidence speculation was promoted to a fix. Finding 11 was confirmed separately on 2026-09-08 as recorded above; the earlier baseline counts remain unchanged.

## Execution ordering

All 11 findings now have selected implementation plans. Follow [the index](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/README.md) for priority order, shared documentation files, and status. Resolve installation policy before expanding packed-consumer coverage. Numeric TextField and PhoneNumberField reset plans remain separate despite their similar native reset lifecycle.

Rejected leads and settled tradeoffs are recorded in the index so a later audit does not repeat them.
