# Accessibility guidelines

Normative chapter for `@elmeragroup/ui`. Every component spec's §7 (Accessibility) is read against these library-wide rules; this chapter states what no per-component spec repeats. Sources: A11y & performance guideline chapters (wayfinder ticket 026), [Component spec conventions](components/conventions.md), Testing strategy (wayfinder ticket 013).

## 1 Conformance target

- The library **targets WCAG 2.2 AA**. This is a design target documented per component, **not a conformance claim** — conformance is a per-page property only consuming apps can achieve. The docs state this split explicitly.
- Norwegian/EU legal baseline (EN 301 549 / forskrift om universell utforming) tracks WCAG 2.1 AA; 2.2 AA is a strict superset, so meeting the target keeps every consuming app ahead of the legal floor.
- **Responsibility split**: the library owns widget semantics, keyboard behavior, focus visibility, and correct-language built-in strings. Apps own page structure (landmarks, headings order, skip links), `lang` attributes, focus management across route changes, and final contrast when composing tokens in non-default pairings.

## 2 Keyboard & focus

- Focus rings render on **`:focus-visible` only**, never bare `:focus`, and always via the package-private `focusRing` recipe (`styles/utils`): **`ring-2 ring-ring ring-offset-2 ring-offset-background`**. The offset is mandatory — it keeps the brand-independent violet ring legible on colored fills and pill (`--radius-button`) shapes. The recipe supports native self-focus, focus-within containers, and RAC's explicit `isFocusVisible` state; those are selector adapters around one visual definition. The `within` adapter applies the visual ring to the group and neutralizes the marked nested control's self ring inside that same shared recipe, preventing a double ring without hiding keyboard focus. Every focusable element that a library component creates composes one adapter; a consumer-supplied `render` target or `Focusable` child must itself be a correctly styled interactive primitive. No component suppresses, recolors, or locally redefines the focus ring outside these adapters. The lint rule forbids literal classes that create or suppress a **focus** ring outside `styles/utils`; it deliberately permits invalid-state rings and static one-pixel popup hairlines.
- **Keyboard behavior inherits base-ui verbatim**: arrow-key roving with roving tabindex in composites (tabs, radio-group, menus, toggle-group), typeahead where base-ui provides it, `Escape` dismisses the topmost open overlay only, modal overlays trap focus and return it to the trigger on close.
- Components never set a **positive `tabindex`**; `tabindex={-1}` only for programmatic focus targets.
- Skip links, landmark roles, and heading hierarchy are **app responsibility**; the docs Quick start shows the expected page scaffold once.
- Disabled states: base-ui naming at the primitive level; composites' `isDisabled` renders native `disabled` where a native element exists, `aria-disabled` otherwise (base-ui default). Loader/pending states set `aria-busy` on the affected region, not on `body`.

## 3 Labeling & field composition

- **Field is the canonical labeling mechanism**: `Field.Root` wires `id`/`htmlFor`, `aria-describedby` (description and `errorMessage`), and error announcement. Every input-like component composed under Field gets its accessible name from `Field.Label` — no component invents its own label wiring.
- Rule: **every interactive element has a programmatic name — via Field, visible text content, or an explicit `aria-label`.**
- **Type-level enforcement where mechanical**: icon-only renders require the label in the type. `Button` types the icon-only case as requiring `aria-label` — a two-branch union where any `icon*` `size` also demands the label (button.md §3). Library triggers built on it satisfy that requirement internally instead of forwarding it: `PopoverInfoButton` omits `aria-label` and writes the localized name itself (`label` overrides it), and the overlay corner close buttons take a `closeLabel` that defaults through the dictionary. _(Amended 2026-09-03 — the earlier text claimed those wrappers also type `aria-label` as required; they own the name instead.)_ Everything not mechanically expressible is documented convention enforced in review — **no dev-mode runtime label warnings** (false-positive-prone with portals/async labels, and dead code in prod).
- `aria-*` boolean hygiene per [conventions](components/conventions.md): `x || undefined`, never `"false"`; guard conditional spreads so `mergeProps` can't clobber auto-wired aria with `undefined`.

## 4 Localized strings (i18n)

Adopted architecture: **the react-aria string-dictionary model, adapted to our scale** (ADR [0006](../adr/0006-intl-strings.md)). We take the tiny public runtime and skip Adobe's build machinery entirely.

- **Runtime**: `@internationalized/string` (`LocalizedStringDictionary` + `LocalizedStringFormatter`; ~1 kB, dependency-free, `sideEffects: false`). `useLocalizedStrings` caches one formatter per dictionary identity and locale (ADR [0006](../adr/0006-intl-strings.md), amendment 2026-09-02). No glob imports, no JSON, no string-compiler build step, no locale-subsetting plugin — none of it pays off below ~10 locales. _(Amended 2026-09-02 — ADR 0006 formatter-cache amendment.)_
- **Authoring**: components that render user-visible or AT-only strings own a co-located `intl/` directory of **plain TS modules** — `intl/nb-NO.ts`, `intl/sv-SE.ts`, `intl/en-US.ts`, `intl/fi-FI.ts` — explicitly imported into a dictionary module (`intl/index.ts`) that assembles them through the package-private `createStringDictionary({ enUS, fiFI, nbNO, svSE })` factory — the assembly was byte-identical in every `intl/index.ts`, and naming the four locales as arguments makes a missing locale a type error at the call site. Keys are flat per owner. _(Amended 2026-09-03 — ADR [0006](../adr/0006-intl-strings.md), amendment 2026-09-03.)_ Plural/number cases use `LocalizedStringFormatter`'s `plural`/`number`/`select` helpers with hand-written message functions; we do not ship an ICU parser.
- **Shipped locales v1**: `nb-NO`, `sv-SE`, `en-US`, `fi-FI` (Finnish market is imminent). All locales ship eagerly — at four locales this is a few hundred bytes per string-bearing component. If the locale set ever approaches ~10, revisit per-locale module splitting + resolver subsetting (the react-aria mitigation) as a roadmap item.
- **Locale source**: `ElmeraGroupUiProvider` carries `locale: SupportedLocale` (**required**, typed union `"nb-NO" | "sv-SE" | "en-US" | "fi-FI"`). Every string-consuming component reads it from context via a `useLocalizedStrings(dictionary)` internal hook — **apps never pass locale to individual components**. Multilingual whitelabel apps re-render the provider with the user's selected locale; single-country apps set it once. Typed callers select one of the four shipped modules directly; `LocalizedStringDictionary`'s `en-US` fallback is defensive behavior for invalid untyped JavaScript input, not a fifth public locale or a regional-variant promise.
- **Override precedence**: explicit string props on a component (e.g. combobox's empty-state message, pagination labels, toast close label) always win over the dictionary. Props are optional — the dictionary guarantees a correct-language default, props exist for copy control.
- **SSR**: the provider is plain data (no `navigator` sniffing, no hydration correction); locale is app-supplied, so server and client render identically. No inline-script string injection is needed at four eager locales.
- **Docs**: a Handbook page documents the mechanism, the supported-locale union, the override precedence, and the recipe for a language switcher.

### 4.1 Locked v1 string manifest

The keys and copy below are implementation data, not examples. Each owner keeps only its rows in a co-located dictionary; this table is the cross-component audit source. `{item}` is a message-function argument, not an ICU string. _(Amended 2026-09-02 — added `combobox.toggle` and `gridList.drag`.)_

**Ownership is per owner, and an owner may be a family.** A row belongs to whichever module is the single place the string is authored; that is normally one component, but where several components render the _same_ affordance with the _same_ copy the family owns the row instead. The one v1 case is the overlay corner/footer dismiss: Dialog, Sheet, and Toast all render `overlayCornerCloseButton` with identical copy in all four locales, so the three former `dialog.close` / `sheet.close` / `toast.close` rows are **one `overlay.close` row** held by `components/overlay/intl`. The table above keeps the three per-component key names as the audit spelling — they are what a reader looks up — and each still resolves the same four strings; each component's `closeLabel` prop still overrides at the call site. No other row is shared: `alertDialog.cancel` stays with AlertDialog even though it also appears in a dialog. _(Amended 2026-09-03 — ADR [0006](../adr/0006-intl-strings.md), amendment 2026-09-03; [dialog](components/dialog.md) §8.11, [sheet](components/sheet.md) §8.12, [toast](components/toast.md) §8.9; **pending owner confirmation**. The alternative not taken was keeping three per-component `close` rows built through the factory — three files fewer of boilerplate but the same four strings authored three times.)_

| Owner/key                           | `nb-NO`                      | `sv-SE`                     | `en-US`               | `fi-FI`                       |
| ----------------------------------- | ---------------------------- | --------------------------- | --------------------- | ----------------------------- |
| `alertDialog.cancel`                | Avbryt                       | Avbryt                      | Cancel                | Peruuta                       |
| `breadcrumb.landmark`               | Brødsmuler                   | Brödsmulor                  | Breadcrumb            | Murupolku                     |
| `breadcrumb.more`                   | Mer                          | Mer                         | More                  | Lisää                         |
| `combobox.empty`                    | Ingen resultater.            | Inga resultat.              | No results.           | Ei tuloksia.                  |
| `combobox.clear`                    | Tøm valg                     | Rensa val                   | Clear selection       | Tyhjennä valinta              |
| `combobox.removeItem({item})`       | Fjern {item}                 | Ta bort {item}              | Remove {item}         | Poista {item}                 |
| `combobox.toggle`                   | Vis eller skjul alternativer | Visa eller dölj alternativ  | Toggle options        | Näytä tai piilota vaihtoehdot |
| `datePicker.presets`                | Datoforvalg                  | Datumalternativ             | Date presets          | Päivämäärän pikavalinnat      |
| `dialog.close`                      | Lukk                         | Stäng                       | Close                 | Sulje                         |
| `gridList.drag`                     | Dra for å endre rekkefølge   | Dra för att ändra ordning   | Drag to reorder       | Vedä järjestääksesi           |
| `meter.warning`                     | Advarsel                     | Varning                     | Warning               | Varoitus                      |
| `meter.success`                     | Vellykket                    | Lyckades                    | Success               | Onnistui                      |
| `pagination.landmark`               | Sidenavigasjon               | Sidnavigering               | Pagination            | Sivutus                       |
| `pagination.previous`               | Forrige                      | Föregående                  | Previous              | Edellinen                     |
| `pagination.next`                   | Neste                        | Nästa                       | Next                  | Seuraava                      |
| `pagination.goToPrevious`           | Gå til forrige side          | Gå till föregående sida     | Go to previous page   | Siirry edelliselle sivulle    |
| `pagination.goToNext`               | Gå til neste side            | Gå till nästa sida          | Go to next page       | Siirry seuraavalle sivulle    |
| `pagination.morePages`              | Flere sider                  | Fler sidor                  | More pages            | Lisää sivuja                  |
| `phoneNumberField.selectCountry`    | Velg land                    | Välj land                   | Select country        | Valitse maa                   |
| `phoneNumberField.searchCountries`  | Søk etter land               | Sök efter länder            | Search countries      | Hae maita                     |
| `phoneNumberField.noCountries`      | Ingen land funnet.           | Inga länder hittades.       | No countries found.   | Maita ei löytynyt.            |
| `popoverInfoButton.moreInformation` | Mer informasjon              | Mer information             | More information      | Lisätietoja                   |
| `searchField.clear`                 | Tøm søket                    | Rensa sökningen             | Clear search          | Tyhjennä haku                 |
| `sheet.close`                       | Lukk                         | Stäng                       | Close                 | Sulje                         |
| `sidebar.toggle`                    | Vis eller skjul sidepanelet  | Visa eller dölj sidopanelen | Toggle sidebar        | Näytä tai piilota sivupalkki  |
| `sidebar.title`                     | Sidepanel                    | Sidopanel                   | Sidebar               | Sivupalkki                    |
| `sidebar.description`               | Viser sidepanelet.           | Visar sidopanelen.          | Displays the sidebar. | Näyttää sivupalkin.           |
| `toast.close`                       | Lukk                         | Stäng                       | Close                 | Sulje                         |

Visible consumer content is not translated by the library. In particular, preset item labels come from the radio's visible children/value, loader labels remain consumer-supplied because their surrounding pending action provides the wording, and confirm-button confirmation copy remains consumer-owned.

## 5 Semantics rulings

- **Item list-semantics gap (ruled)**: base-ui's `Item.Group` renders `role="list"` while `Item` defaults to no role — a half-list is an AT bug. Our `Item` **adopts `role="listitem"` automatically when rendered inside `Item.Group`** (one context read), overridable via the `role` prop. Recorded as a Divergence in the item spec; component specs no longer push the role to consumers.
- **Toast**: the library's manager adapter defaults neutral/info/success/warning/loading announcements to polite and error announcements to assertive; an explicit priority remains the caller override. Base-ui's type-agnostic low default is not exposed unchanged.
- **Skeleton** is `aria-hidden="true"`; the loading region it stands in for carries `aria-busy="true"` until content arrives.
- **Meter/progress** components carry their base-ui value semantics untouched (`role="meter"`/`role="progressbar"` with `aria-valuenow` etc.).

## 6 Contrast

Token values are **locked** (Brand–segment matrix gaps (wayfinder ticket 004): all mints final); this chapter's job is honest classification, not redesign.

- **Text-grade roles** — must meet **4.5:1** against their paired surface in all 20 themes: `foreground`/`background`, `card-foreground`/`card`, `card-soft-foreground`/`card-soft`, `muted-foreground`/`muted` and `/background`, every `*-soft-foreground`/`*-soft` pair, `primary-foreground`/`primary`, `secondary-foreground`/`secondary`, status `*-foreground` pairs.
- **`feature-foreground` is reclassified as accent/decorative** — the external tints (L ≈ 0.80–0.91 on L ≈ 0.55–0.58 feature panels) are kicker/eyebrow-grade, not body-text-grade. **Text on `feature` panels uses white**, which passes 3:1 large-text/non-text everywhere; body text on feature panels is out of contract.
- **Known accepted deviations** (documented, not fixed in v1):
  1. Default `--muted-foreground` `oklch(0.5555 0 0)` on white sits at ≈ 4.5:1 — at the AA line, no margin. Do not use `muted-foreground` below 14px.
  2. The brand-independent violet `--ring` falls below 3:1 non-text contrast against some strong external `--feature`/`--primary` fills; the mandatory `ring-offset-2` (white gap) is the mitigation. A per-brand ring re-mint is a **roadmap item**.
  3. External `feature-foreground` tints fail 4.5:1 by design — covered by the reclassification above.
- **Deliverable at implementation**: a generated per-theme **contrast matrix** (all text-grade pairs × 20 themes) checked as a snapshot test next to the token pipeline's CSS snapshot; new themes/brands must pass the text-grade rules or extend the documented-deviation list explicitly.

## 7 Motion

- One central **`@media (prefers-reduced-motion: reduce)`** block in the library stylesheet: transform/translate/scale motion removed, opacity fades retained (comprehension-aiding transitions survive; movement doesn't). This is a hard requirement — no component opts out or reimplements it.
- Normative motion band: **UI transitions 150–300 ms, ease-out family** (entering elements ease-out; on-screen morphs ease-in-out; exits at or faster than enters). Only `transform` and `opacity` animate (see [performance](performance.md) §6). This band is the review bar for new and contributed components; marketing-grade motion lives in apps.
- Nothing animates on keyboard-repeatable actions (e.g. no open/close animation replay while arrowing through a listbox).

## 8 Target size

Interactive controls meet **WCAG 2.2 AA 2.5.8 Target Size (Minimum)**: at least **24×24 CSS pixels**, via the rendered box or a documented `hit-area-*` expansion. The 2.5.8 spacing and inline exceptions remain available. Density does not change this floor.

Dense `xs` / `icon-xs` Button is a 24px box (`1.5rem` at a 16px root). Comfortable `xs` is 32px. `icon-inline` is line-height sized and expands with `hit-area-1`. Do not introduce a control whose undilated box and hit-area both fall under 24px.

## 9 Testing bar

Per Testing strategy (wayfinder ticket 013), restated as the a11y floor. The target-size floor in §8 is verified on the smallest interactive Button rung at each density through the rendered box or documented hit-area expansion.

- All test queries **role/label-based** (no test-ids, no class queries); this makes every test double as a semantics assertion. **No axe** — matches all reference codebases; the role-based bar plus these rules is the gate.
- Every spec §7 keyboard behavior has a browser-mode test; the `focusRing` recipe has one shared visual assertion (ring present on `:focus-visible`, absent on mouse focus).
- The icon-only `aria-label` type enforcement is covered by the **public-API type tests**.
- String-bearing components get one test per shipped locale asserting the dictionary default renders, plus one prop-override test.
- The 20-theme contract test covers the contrast matrix snapshot (§6).
