# Code

## 1 Header

- **Canonical name**: `Code` (single component, no namespace)
- **Export path**: `@elmeragroup/ui/code` (also re-exported from `@elmeragroup/ui`)
- **RSC**: server
- **Tier**: plain-element leaf (no base-ui primitive, no client state — server-component safe, no `"use client"`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/code.tsx`

## 2 Anatomy

| Part | Renders | Notes |
| --- | --- | --- |
| `Code` | `<pre data-slot="code"><code /></pre>` | inner `<code>` receives `sugar-high` highlighter output via `dangerouslySetInnerHTML` |

```tsx
<Code code={`const answer = 42;`} />
```

Single part; the inner `<code>` element is not independently addressable.

## 3 Props

`ComponentProps<"pre">` (spread onto the `<pre>`; `className` merged via `cn`) plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `code` | `string` | required | raw source text; passed through `highlight()` from `sugar-high` |

No `children` — content comes exclusively from `code`. Base classes: `max-h-160 overflow-auto font-mono text-xs leading-relaxed`.

**Dependency**: `sugar-high` (tiny, zero-dependency JS/TS highlighter) is a regular dependency of `@elmeragroup/ui` — small enough not to warrant peer status.

## 4 Variants

None — no tv recipe, no variant axes.

## 5 Consumed tokens

Syntax colors come entirely from the **`--sh-*` token family** that `sugar-high` reads: `--sh-class`, `--sh-identifier`, `--sh-sign`, `--sh-property`, `--sh-entity`, `--sh-jsxliterals`, `--sh-string`, `--sh-keyword`, `--sh-comment`. Their v1 Ayu Light values are defined at `:root` as part of the canonical token contract; `[data-theme="dark"]` is reserved but has no values at v1, so no dark syntax override is specified. The component itself paints no colors. The `<pre>` inherits `foreground` from context.

## 6 Data attributes

**Emitted**: `data-slot="code"` on the `<pre>`. `sugar-high` emits `.sh__token--<kind>` classed spans inside — internal, not a styling contract.

**Consumed**: none.

## 7 Accessibility

- `<pre><code>` is the semantically correct pairing for source listings; content is plain text to AT.
- The scroll container (`max-h-160 overflow-auto`) should be keyboard-reachable when content overflows: emit `tabIndex={0}` + `role="region"` and require consumers to supply `aria-label` for long listings (overridable via props spread).
- No interactive behavior; no focus management beyond the scroll region.

## 8 Divergence from reference

1. **KEPT + documented: `dangerouslySetInnerHTML`** — the injected HTML is `sugar-high`'s highlighter output over the caller-supplied `code` string. `highlight()` HTML-escapes token text; the trust boundary is the calling component, same as ordinary `children`. Do not pass pre-built HTML — only raw source text.
2. **Added**: `data-slot="code"` (ref emits none) and the `tabIndex`/`role="region"` scroll-region affordance from §7 (ref's overflow container is mouse-only).
3. Otherwise verbatim: prop shape, base classes, no client directive.

## 9 Test requirements

- Renders the highlighted source: token spans exist and the accessible text content equals the input `code`.
- HTML in the `code` string is escaped, not executed (`<img onerror>` payload renders as text — trust-note regression guard).
- `className` merges onto the `<pre>`; arbitrary `pre` props (`id`, `aria-label`) pass through.
- Scroll region is focusable (`tabIndex 0`) and exposes `role="region"`.

## 10 Demo requirements

`code-basic.tsx` (short TS snippet), `code-scroll.tsx` (long listing exercising `max-h-160` + keyboard-scrollable region with `aria-label`).
