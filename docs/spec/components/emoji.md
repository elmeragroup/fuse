# Emoji

## 1 Header

- **Canonical name**: `Emoji` (namespace object over five SVG face components: `Emoji.SlightlyFrowningFace`, `Emoji.SlightlySmilingFace`, `Emoji.NeutralFace`, `Emoji.LoudlyCryingFace`, `Emoji.PartyingFace`)
- **Export path**: `@elmeragroup/ui/emoji` (also re-exported from `@elmeragroup/ui`)
- **Tier**: styled asset set (hand-inlined Twemoji-style SVG illustrations; originates only in the internal reference but is public in this package — no base-ui primitive or RAC)
- **RSC**: server — pure function components rendering static SVG; no hooks, no state, no browser APIs
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/emoji/index.tsx`

## 2 Anatomy

Each member renders a single `<svg viewBox="0 0 36 36">` with hand-inlined Twemoji-style paths. No wrapper element, no slots, no children.

| Part                         | Element | data-slot |
| ---------------------------- | ------- | --------- |
| `Emoji.SlightlyFrowningFace` | `svg`   | `emoji`   |
| `Emoji.SlightlySmilingFace`  | `svg`   | `emoji`   |
| `Emoji.NeutralFace`          | `svg`   | `emoji`   |
| `Emoji.LoudlyCryingFace`     | `svg`   | `emoji`   |
| `Emoji.PartyingFace`         | `svg`   | `emoji`   |

```tsx
<Emoji.SlightlySmilingFace className="size-5" />
<Emoji.PartyingFace label={t("Very satisfied")} className="size-4 shrink-0" />
```

App consumption (kept working verbatim): stormwind's `SatisfactionEmoji` maps `Feedback["satisfaction"]` to a face and spreads `EmojiProps` through (`components/feedback/feedback-satisfaction-emoji.tsx`); sized via `className` (`size-4`/`size-5`) in feedback stats, the feedback data-table column, and the satisfaction radio group.

## 3 Props

`EmojiProps = ComponentProps<"svg"> & { label?: string }` — exported (shared by all five members, as in the ref).

| Prop        | Type               | Default | Notes                                                                                                                           |
| ----------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `label`     | `string`           | —       | ADDED (§8): when set, the svg gets `role="img"` + `aria-label={label}`; when unset the svg is decorative (`aria-hidden="true"`) |
| `className` | `string`           | —       | sizing is consumer-driven (`size-*`); no default size class (ref behavior kept — the `viewBox` scales to the styled box)        |
| …rest       | native `svg` props | —       | spread onto the `<svg>`; an explicit `aria-hidden` from props wins (spread after the defaults)                                  |

No variant props, no `render` prop (an SVG asset is not polymorphic).

## 4 Variants

None — no tv recipe, no axes. The five faces are separate components, not a `face` variant axis (keeps per-face tree-shaking and matches every app call site).

## 5 Consumed tokens

None. The SVG `fill` values are literal hex (`#FFCC4D`, `#664500`, `#5DADEC`, …) — **intentionally exempt** from the tokens-only rule: this is brand-independent illustration artwork with a fixed palette (same category as flag icons), not themeable UI surface. It must not react to theme/brand switches. The `no-primitive-colors` lint rule targets Tailwind palette classes and is not violated; the file carries a comment documenting the exemption.

**License/provenance is part of the implementation contract.** The five path sets are Twemoji graphics for U+1F641, U+1F642, U+1F610, U+1F62D, and U+1F973. The graphics remain licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); they are not relicensed as MIT with the surrounding component code. The published tarball must include:

- `THIRD_PARTY_NOTICES.md` identifying “Twemoji — Copyright 2019 Twitter, Inc and other contributors,” the five code points, `https://github.com/jdecked/twemoji` as the maintained source, the CC BY 4.0 link, and the modifications made here (inlined as React components; accessibility/data-slot wrapper behavior added; SVG path data unchanged);
- `licenses/twemoji-CC-BY-4.0.txt`, the complete `LICENSE-GRAPHICS` text from the Twemoji repository.

The emoji source module carries a short header pointing to that notice. Package-file and packed-artifact checks fail if either notice file is absent.

## 6 Data attributes

**Emitted**: `data-slot="emoji"` (added in spec — §8; ref emits none). Placed before the props spread so wrappers can override.

**Consumed**: none.

## 7 Accessibility

- **Decorative by default**: without `label`, renders `aria-hidden="true"` and `focusable="false"` on the `<svg>` — emoji next to text (badge, stat rows) must not be announced twice. The ref relied on each call site remembering `aria-hidden` (only one of four did); the default moves that burden into the library.
- **Labeled mode**: with `label`, renders `role="img"` + `aria-label` and drops `aria-hidden`. Used when the emoji is the only carrier of meaning (e.g. a satisfaction cell with no adjacent text).
- No hardcoded user-facing strings: the component ships no default label text, so no `intl/` dictionary (accessibility.md §4) is needed — `label` copy is the consumer's, already localized at the call site.
- Never focusable, no keyboard behavior, no `focusRing` (not interactive).

## 8 Divergence from reference

1. **`label` prop + decorative default ADDED**: ref renders a bare `<svg>` with no aria at all — an unlabeled `role`-less svg whose paths may still be probed by some AT. Spec bakes in `aria-hidden="true"`/`focusable="false"` by default and the `label → role="img" + aria-label` escape hatch. Existing app call sites passing `aria-hidden` explicitly stay valid (props spread wins).
2. **`data-slot="emoji"` added** (ref emits none).
3. **Namespace export KEPT** (`Emoji.PartyingFace`): the conventions' per-icon-import rule bans the lucide `Icon.*` namespace for the Phosphor icon system; it does not govern this five-member illustration set, and the app consumes the namespace verbatim. The five faces are additionally exported as named exports (`SlightlySmilingFace`, …) so bundlers can tree-shake individual faces; the `Emoji` object remains the canonical face.
4. **Hex fills kept, exemption documented** (§5) — no tokenization, no theme reactivity, by design.
5. SVG paths are copied **verbatim** from the ref — no redrawing, no optimization pass in v1 (byte-identical rendering is the compatibility contract). The wrapper changes and retained path data are disclosed in the packaged Twemoji attribution (§5).

## 9 Test requirements

- Each of the five members renders an `<svg>` with `viewBox="0 0 36 36"` and `data-slot="emoji"` (parametrized over the namespace).
- Default render is decorative: `aria-hidden="true"`, `focusable="false"`, no `role` — and is **not** found by `getByRole("img")`.
- With `label="Very satisfied"`: `getByRole("img", { name: "Very satisfied" })` succeeds and `aria-hidden` is absent.
- Props spread wins: explicit `aria-hidden={undefined}`/`aria-hidden` from the consumer overrides the default (spread-order guard).
- `className` lands on the svg (sizing contract: `size-5` consumer class present).
- Named per-face exports exist and are reference-equal to the namespace members.
- Lint guard: file passes `no-primitive-colors` (hex fills in SVG attributes are out of the rule's scope — regression-pin the exemption).
- Packed-artifact test asserts both Twemoji notice/license files ship and contain the source, CC BY 4.0 URI, copyright attribution, five code points, and modification statement from §5.

## 10 Demo requirements

Plain runnable `.tsx` demos: `emoji-faces.tsx` (all five faces in a row at `size-8` — the full set), `emoji-labeled.tsx` (a satisfaction scale pairing decorative emoji with visible text vs a standalone labeled emoji, showing the `label` decision), `emoji-sizing.tsx` (same face at `size-4`/`size-5`/`size-8`, the app's real sizes).
