# Chart

## 1 Header

- **Canonical name**: `Chart` — namespace compound: `Chart.Container`, `Chart.Tooltip`, `Chart.TooltipContent`, `Chart.Legend`, `Chart.LegendContent`, `Chart.Style` + exported `ChartConfig` type
- **Export path**: `@elmeragroup/ui/chart` (`import { Chart, type ChartConfig } from "@elmeragroup/ui/chart"`) — separate subpath so the recharts dependency never taxes non-chart consumers
- **RSC**: client
- **Tier**: recharts composition wrappers (shadcn chart pattern). **recharts is an optional peer dependency** of `@elmeragroup/ui`; consumers who render charts install it and import primitives (`AreaChart`, `Bar`, `XAxis`, …) directly from `recharts`
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/chart/chart.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/chart/index.ts`

## 2 Anatomy

| Part                   | Renders                                                                                                            | Role                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Chart.Container`      | `<div data-chart={id}>` wrapping `ChartContext.Provider` + injected `Chart.Style` + recharts `ResponsiveContainer` | config owner; sets base typography and the recharts escape-hatch styling                                                                       |
| `Chart.Tooltip`        | recharts `Tooltip` (bare re-export)                                                                                | positioning/activation engine; pair with `content={<Chart.TooltipContent />}`                                                                  |
| `Chart.TooltipContent` | styled `<div>` tooltip body                                                                                        | config-aware label/indicator/value rows                                                                                                        |
| `Chart.Legend`         | recharts `Legend` (bare re-export)                                                                                 | pair with `content={<Chart.LegendContent />}`                                                                                                  |
| `Chart.LegendContent`  | styled `<div>` legend row                                                                                          | config-aware swatch/icon + label list                                                                                                          |
| `Chart.Style`          | `<style>` via `dangerouslySetInnerHTML`                                                                            | generates per-chart `--color-<key>` CSS custom properties from config (rendered automatically by `Chart.Container`; exported for advanced use) |

```tsx
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Chart, type ChartConfig } from "@elmeragroup/ui/chart";

const config = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

<Chart.Container config={config}>
  <AreaChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" />
    <Chart.Tooltip content={<Chart.TooltipContent />} />
    <Chart.Legend content={<Chart.LegendContent />} />
    <Area dataKey="desktop" fill="var(--color-desktop)" stroke="var(--color-desktop)" />
    <Area dataKey="mobile" fill="var(--color-mobile)" stroke="var(--color-mobile)" />
  </AreaChart>
</Chart.Container>;
```

`ChartConfig` (exported): `Record<string, { label?: ReactNode; icon?: ComponentType } & ({ color?: string; theme?: never } | { color?: never; theme: Record<"light" | "dark", string> })>`. The internal `useChart` hook and `ChartContext` stay private; `Chart.TooltipContent`/`Chart.LegendContent` throw ("useChart must be used within a <ChartContainer />") outside `Chart.Container`.

## 3 Props

**Chart.Container** — `ComponentProps<"div">` (React 19 `ref`-in-props) plus:

| Prop       | Type                           | Default   | Notes                                                                              |
| ---------- | ------------------------------ | --------- | ---------------------------------------------------------------------------------- |
| `config`   | `ChartConfig`                  | required  | drives `Chart.Style` var generation and label/icon lookup in content parts         |
| `id`       | `string`                       | `useId()` | suffix of the `data-chart="chart-…"` scope id (`:` stripped from the generated id) |
| `children` | `ResponsiveContainer` children | required  | a single recharts chart element                                                    |

**Chart.Tooltip / Chart.Legend** — recharts `Tooltip` / `Legend` props verbatim (bare re-exports; no wrapping).

**Chart.TooltipContent** — recharts `Tooltip` props (`active`, `payload`, `label`, `labelFormatter`, `labelClassName`, `formatter`, `color`) ∩ `ComponentProps<"div">` plus:

| Prop            | Type                          | Default | Notes                                                                      |
| --------------- | ----------------------------- | ------- | -------------------------------------------------------------------------- |
| `hideLabel`     | `boolean`                     | `false` | suppress the header label row                                              |
| `hideIndicator` | `boolean`                     | `false` | suppress the color swatch (config `icon` still renders)                    |
| `indicator`     | `"dot" \| "line" \| "dashed"` | `"dot"` | swatch shape; single-item non-dot payloads nest the label beside the value |
| `nameKey`       | `string`                      | —       | override payload key used for config lookup per series                     |
| `labelKey`      | `string`                      | —       | override payload key used for the header label                             |

Renders `null` unless `active && payload?.length`. Only the destructured props are consumed — arbitrary extra div props are not spread onto the root (kept from ref, documented; `className` is merged).

**Chart.LegendContent** — `ComponentProps<"div">` plus `Pick<LegendProps, "payload" | "verticalAlign">` and:

| Prop            | Type                     | Default    | Notes                                               |
| --------------- | ------------------------ | ---------- | --------------------------------------------------- |
| `hideIcon`      | `boolean`                | `false`    | force color swatch even when config provides `icon` |
| `nameKey`       | `string`                 | —          | override payload key for config lookup              |
| `verticalAlign` | `"top" \| "bottom" \| …` | `"bottom"` | flips padding side (`pb-3` vs `pt-3`)               |

Renders `null` when `payload` is empty.

**Chart.Style** — `{ id: string; config: ChartConfig }`; renders `null` when no config entry has `color`/`theme`.

## 4 Variants

None — no tv recipes. `indicator` on `Chart.TooltipContent` is a plain prop with conditional `cn` classes, not a variant axis.

## 5 Consumed tokens

`muted-foreground` (axis tick fill, tooltip/legend secondary text, icon color), `border` (grid lines at `/50`, tooltip cursor, tooltip surface border at `/50`), `background` (tooltip surface), `muted` (radial-bar background, rectangle tooltip cursor fill), `foreground` (tooltip values). Series colors are consumer-supplied via `ChartConfig` — the convention is theme chart tokens (`--chart-1`…) but any CSS color is accepted; `Chart.Style` republishes them as `--color-<key>` scoped to `[data-chart=<id>]`.

## 6 Data attributes

**Emitted**: `data-chart="chart-<id>"` on the Container root — the scoping hook for `Chart.Style`'s generated rules. No `data-slot` attributes (pre-dates the convention; kept).

**Consumed**: Container's class string targets recharts internals by class and hardcoded attribute selectors — `[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50`, `[&_.recharts-dot[stroke='#fff']]:stroke-transparent`, `[&_.recharts-sector[stroke='#fff']]:stroke-transparent`, `[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border`, `[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border`, plus `fill-muted` on radial-bar backgrounds. These `#ccc`/`#fff` literals are the documented recharts escape hatch — recharts hardcodes those defaults, and the selectors rewrite them to tokens. They are exempt from the `no-primitive-colors` rule (selector matching, not painting). The ref's descendant `outline-none` selectors are removed: Recharts may make SVG layers/sectors focusable when its accessibility layer is enabled, and dependency-owned focus targets retain their browser outline rather than being suppressed without a compatible SVG ring adapter.

## 7 Accessibility

- The chart surface is SVG rendered by recharts; enable recharts' `accessibilityLayer` prop on the chart element (consumer side) for keyboard/AT support of the data itself.
- `Chart.TooltipContent`/`Chart.LegendContent` are plain text/DOM — readable but not focusable; the tooltip is pointer/keyboard driven by recharts.
- `Chart.Style` injects a `<style>` element — invisible to AT.
- No keyboard behavior of its own; data tables remain the recommended AT-complete companion for dense charts (consumer concern, out of scope).

## 8 Divergence from reference

1. **WRAPPERS ONLY (LOCKED, user-ruled — judgment call 15)**: the ref's `chart/index.ts` does `export * from "recharts"` before re-exporting the wrappers; that re-export is **removed**. `@elmeragroup/ui/chart` exports only `Chart.Container/.Tooltip/.TooltipContent/.Legend/.LegendContent/.Style` and `ChartConfig`. recharts becomes an optional peer; consumers import its primitives directly. **Migration**: one import-source swap covering the 11 recharts symbols apps actually use today — `Area`, `AreaChart`, `Bar`, `BarChart`, `CartesianGrid`, `Cell`, `Label`, `Pie`, `PieChart`, `XAxis`, `YAxis` — from `@elmeragroup/ui/chart` → `recharts`.
2. **Theme selector (LOCKED)**: `Chart.Style`'s theme map changes `dark: ".dark"` → `dark: '[data-theme="dark"]'`, aligning with the reserved dark axis (`no-tailwind-dark-variant` conventions). Light stays the empty prefix.
3. **Falsy-zero bug FIXED**: ref renders the tooltip value with `{item.value && …}`, so a data point of `0` renders no value. Ours uses `item.value != null` — zero renders as `0`.
4. **forwardRef → React 19 ref-in-props** on Container/TooltipContent/LegendContent (minor modernization; behavior identical).
5. **Rename: flat → namespace** — `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartLegend`/`ChartLegendContent`/`ChartStyle` → `Chart.*`.
6. **KEPT verbatim + documented**: the `[stroke='#ccc']`/`[stroke='#fff']` escape-hatch selectors (§6, no-refactor) and the `dangerouslySetInnerHTML` style injection in `Chart.Style` — input is the caller's `ChartConfig` colors interpolated into CSS, same trust boundary as inline `style`.
7. **Recharts focus visibility fixed:** descendant `outline-none` selectors are deleted. Recharts-owned focusable SVG nodes keep their native browser outline; the library does not suppress focus it cannot replace with the HTML-oriented shared recipe.
8. **KEPT**: `Chart.LegendContent` forwards only `className`/`onClick` from its div props (ref drops the rest silently); `Chart.TooltipContent` likewise consumes a fixed prop list. Documented rather than widened.

## 9 Test requirements

- **`Chart.Style` unit test (config-driven CSS var generation)**: given a config with a `color` entry and a `theme: { light, dark }` entry, the emitted CSS contains ` [data-chart=<id>]` block with `--color-<key>: <light>` and a `[data-theme="dark"] [data-chart=<id>]` block with the dark value; entries with neither `color` nor `theme` are omitted; empty color config renders nothing.
- Container emits `data-chart` and renders children inside a `ResponsiveContainer`; custom `id` is reflected as `chart-<id>`.
- `Chart.TooltipContent` renders `null` when inactive; with an active payload containing `value: 0` the value `0` is rendered (regression guard for divergence 3); config `label`/`icon` resolution via `nameKey` covered.
- `Chart.TooltipContent`/`Chart.LegendContent` outside `Chart.Container` throw the `useChart` error.
- Package-shape test: `@elmeragroup/ui/chart` does **not** re-export recharts symbols (e.g. `AreaChart` is `undefined` on the module namespace).

## 10 Demo requirements

`chart-area.tsx` (area chart, grid + axes, tooltip with dot indicator), `chart-bar.tsx` (bar chart, `indicator="dashed"`, `Chart.LegendContent`), `chart-pie.tsx` (pie with `Cell`/`Label`, legend icons from config), `chart-themed.tsx` (`theme: { light, dark }` config entries proving `[data-theme="dark"]` var swap). All demos import recharts primitives from `recharts` directly — they double as the migration exemplar.
