/**
 * The approved uses of CSS features above Fuse's browser floor in the sheets `dist/` ships, which
 * `src/styles/browser-floor.test.ts` holds `dist/styles.css` and `dist/chart.css` to.
 *
 * Each entry pins one use as the sheet writes it: the at-rules around it, its selector or at-rule,
 * its declaration and the above-floor MDN rows it relies on, plus `count` when the sheet repeats
 * it. To approve a new use, run that test and copy the fields its failure prints. Then name the
 * fallback that keeps the rule working below the floor, each of which the gate checks:
 *
 * - `declaration`: the value this property takes earlier in the same block, such as
 *   `-webkit-mask-image` before `mask-image`: the last declaration of it that relies on nothing
 *   above the floor, with `!important` beating a normal one.
 * - `rule`: a companion rule in the same sheet, inside the at-rules its `within` names, that
 *   declares this property and value, such as `.no-scrollbar::-webkit-scrollbar { display: none }`
 *   beside `scrollbar-width: none`.
 * - `none`: nothing stands in; the use degrades safely on its own, or the `@supports` guard
 *   its `within` pins keeps it from applying where it would not work.
 *
 * The reason says what renders below the floor and cites the issue that tracks any shortfall.
 * An entry that matches no use fails the gate, so delete it with the use it approved.
 */
import type { FloorApproval, FloorEquivalence, FloorFallback } from "./browser-floor";

/**
 * The above-floor selectors a forgiving `:is()` or `:where()` list may hold beside floor-safe
 * selectors that match the same elements, so a browser without the feature still matches. An
 * entry no list uses fails the gate. `:dir(ltr)` has none: left to right is the default, which no
 * `[dir="ltr"]` selector matches on a page without the attribute.
 */
export const BROWSER_FLOOR_EQUIVALENCES: readonly FloorEquivalence[] = [
  {
    selector: ":dir(rtl)",
    equivalents: ['[dir="rtl"]', '[dir="rtl"] *'],
    reason:
      'Tailwind\'s rtl: variant. Below Chrome 120 the list still matches an element with dir="rtl" or inside one; it misses only a dir="auto" element that resolves to right to left.',
  },
];

const PREFIXED =
  "The prefixed declaration before it carries the feature in the engines below its unprefixed release.";
const WEBKIT_PRINT_EXACT: FloorFallback = {
  kind: "declaration",
  property: "-webkit-print-color-adjust",
  value: "exact",
};
const FORCED_COLORS = "Forced colors only: Safari has no forced-colors mode to opt out of.";
const TEXT_WRAP = "Below the floor the text wraps greedily, as text-wrap: wrap does.";
const OVERSCROLL =
  "Below Chrome 144 and in Safari the property does not hold a container whose content fits, which is always at its scroll boundary, so a scroll there, as in a short Command or Combobox list, can move the page behind it.";
const SVG_MASK =
  "The value is url(#…) to an SVG <mask> on an SVG element, which engines at the floor apply; MDN's partial rows cover CSS masks on HTML.";
const WEBKIT_MASK_COMPOSITE =
  "Chrome and Safari's legacy operator, source-in for intersect, which composites the -webkit-mask layers below Chrome 120; Firefox drops it and reads the mask-composite after it.";
const MASK_COMPOSITE =
  "Chrome 111 to 119 use the -webkit-mask-composite: source-in before it to intersect the two -webkit-mask layers.";
const LIGHT_DARK_DECORATION =
  "Below the floor each of the rule's light-dark() declarations drops, and the underline keeps its initial currentColor.";
const ENTRY = "Below the floor the element appears without its entry transition.";
const SQUARE_BAR = "Below Chrome 119 the declaration drops, and the bar draws with square corners.";
const SPARKLINE_FILL =
  "Below Chrome 120 the area fills flat at 0.3 instead of fading toward 0, as it does in WebKit, which masks no SVG element.";
const SPARKLINE_BAND = "@supports not (clip-path:inset(0) view-box)";
/** The companion that clips the sparkline's highlight and glide band away where `view-box` fails. */
const SPARKLINE_BAND_CLIPPED: FloorFallback = {
  kind: "rule",
  within: [SPARKLINE_BAND],
  where:
    '[data-slot="sparkline-path"][data-part="highlight"],[data-slot="sparkline-glide"]>[data-part="band-start"]',
  property: "clip-path",
  value: "inset(50%)",
};
const SUBGRID_MISSING = "@supports not (grid-template-columns:subgrid)";
const ROW_SUBGRID_MISSING = "@supports not (grid-template-rows:subgrid)";
const TIMELINE_HORIZONTAL_ITEM = ':where([data-timeline-list-part="root"][data-layout="horizontal"])>';
const TAILWIND_SUPPORTS_TEST =
  "A @supports test in Tailwind's own output: an engine without a feature it tests reads that test false, which is the answer the condition selects on.";

/** Each approved above-floor use, with the fallback that keeps it working below the floor. */
export const BROWSER_FLOOR_APPROVALS: readonly FloorApproval[] = [
  // styles.css
  {
    sheet: "styles.css",
    where:
      "@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b))))",
    features: [
      "css.properties.-moz-orient",
      "css.properties.-moz-orient.inline",
      "css.properties.margin-trim",
      "css.properties.margin-trim.inline",
      "css.types.color.rgb.relative_syntax",
    ],
    fallback: { kind: "none" },
    reason: TAILWIND_SUPPORTS_TEST,
  },
  {
    sheet: "styles.css",
    where: ".no-scrollbar::-webkit-scrollbar",
    features: ["css.selectors.-webkit-scrollbar"],
    fallback: { kind: "none" },
    reason: "Chrome and Safari's own scrollbar hook; Firefox drops the rule and reads scrollbar-width.",
  },
  {
    sheet: "styles.css",
    where: ".no-scrollbar",
    property: "scrollbar-width",
    value: "none",
    features: ["css.properties.scrollbar-width", "css.properties.scrollbar-width.none"],
    fallback: { kind: "rule", where: ".no-scrollbar::-webkit-scrollbar", property: "display", value: "none" },
    reason:
      "Chrome and Safari below their scrollbar-width releases hide the scrollbar through the ::-webkit-scrollbar companion.",
  },
  {
    sheet: "styles.css",
    where: ".field-sizing-content",
    property: "field-sizing",
    value: "content",
    features: ["css.properties.field-sizing", "css.properties.field-sizing.content"],
    fallback: { kind: "none" },
    reason: "Below the floor the field keeps its fixed size and scrolls what overflows it.",
  },
  {
    sheet: "styles.css",
    where: ".scroll-fade-inline:dir(ltr)",
    features: ["css.selectors.dir"],
    fallback: {
      kind: "rule",
      where: ".scroll-fade-inline",
      property: "--scroll-fade-toward",
      value: "right",
    },
    reason:
      "Chromium before 120 drops the :dir() rule and keeps the rtl variant's answer over the bare rule's, as fuse.css explains beside @utility scroll-fade-inline.",
  },
  {
    sheet: "styles.css",
    where: ".scroll-fade-inline",
    property: "mask-image",
    value:
      "linear-gradient(to var(--scroll-fade-toward),transparent,black var(--scroll-fade-start),black calc(100% - var(--scroll-fade-end)),transparent)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value:
        "linear-gradient(to var(--scroll-fade-toward),transparent,black var(--scroll-fade-start),black calc(100% - var(--scroll-fade-end)),transparent)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: "@supports (animation-timeline:scroll())",
    features: ["css.properties.animation-timeline", "css.properties.animation-timeline.scroll"],
    fallback: { kind: "none" },
    reason: "A @supports test: below the floor it reads false and its block does not apply.",
  },
  {
    sheet: "styles.css",
    within: ["@supports (animation-timeline:scroll())"],
    where: ".scroll-fade-inline",
    property: "animation-timeline",
    value: "scroll(self inline),scroll(self inline)",
    features: ["css.properties.animation-timeline", "css.properties.animation-timeline.scroll"],
    fallback: { kind: "none" },
    reason: "The @supports guard it sits in tests the feature itself.",
  },
  {
    sheet: "styles.css",
    within: ["@supports (animation-timeline:scroll())"],
    where: ".scroll-fade-inline",
    property: "animation-range",
    value: "0 var(--scroll-fade-size),calc(100% - var(--scroll-fade-size)) 100%",
    features: ["css.properties.animation-range"],
    fallback: { kind: "none" },
    reason:
      "MDN ships animation-range in the same Chrome, Safari and Firefox releases as animation-timeline, which the guard tests.",
  },
  {
    sheet: "styles.css",
    where: "@supports not (animation-timeline:scroll())",
    features: ["css.properties.animation-timeline", "css.properties.animation-timeline.scroll"],
    count: 2,
    fallback: { kind: "none" },
    reason: "A @supports test: below the floor it reads true, and the block draws the static end fade.",
  },
  {
    sheet: "styles.css",
    where: ".grid-cols-subgrid",
    property: "grid-template-columns",
    value: "subgrid",
    features: ["css.properties.grid-template-columns.subgrid"],
    fallback: {
      kind: "rule",
      within: [SUBGRID_MISSING],
      where:
        ":where(.supports-\\[not\\(grid-template-columns\\:subgrid\\)\\]\\:\\[\\:where\\(\\&\\.grid-cols-subgrid\\)\\]\\:grid-cols-\\[inherit\\].grid-cols-subgrid)",
      property: "grid-template-columns",
      value: "inherit",
    },
    reason:
      "Below Chrome 117 the companion gives each DescriptionList.Item that still has grid-cols-subgrid its list's column template, including one a consumer sets on the list. The companion has zero specificity, so a consumer's grid-cols-* utility on the Item wins. Each Item sizes the inherited tracks on its own. The default term track, min(50%, calc(var(--spacing) * 80)) from sm, depends on the list's width alone, so terms and details line up across Items. From sm, an unbroken details wider than its track widens every Item alike, so terms and details still line up, but the details can start farther from the inline start than with subgrid, until the term track reaches its cap. An intrinsic template, such as max-content 1fr, sizes each Item's term track to its own term, so those terms do not line up. Below Chrome 117 SelectionItem's sub-section band lays its spacer and SubSections out on columns of its own, so a SubSection takes the full row width. In a row whose control leads, it starts under the control instead of under the label text. In a row whose control trails, it runs under the control. Its text and controls stay usable.",
  },
  {
    sheet: "styles.css",
    where: SUBGRID_MISSING,
    features: ["css.properties.grid-template-columns.subgrid"],
    fallback: { kind: "none" },
    reason:
      "A @supports test: below Chrome 117 it reads true, and its block gives a DescriptionList.Item that still has grid-cols-subgrid its list's column template.",
  },
  {
    sheet: "styles.css",
    where: `${TIMELINE_HORIZONTAL_ITEM}.timeline-list-horizontal\\:grid-rows-subgrid`,
    property: "grid-template-rows",
    value: "subgrid",
    features: ["css.properties.grid-template-rows.subgrid"],
    fallback: {
      kind: "rule",
      within: [ROW_SUBGRID_MISSING],
      where: `${TIMELINE_HORIZONTAL_ITEM}.timeline-list-horizontal\\:supports-\\[not\\(grid-template-rows\\:subgrid\\)\\]\\:grid-rows-\\[\\[rail\\]_auto_\\[opposite\\]_auto_\\[content\\]_1fr\\]`,
      property: "grid-template-rows",
      value: "[rail]auto[opposite]auto[content]1fr",
    },
    reason:
      "Below Chrome 117 each horizontal TimelineList.Item lays out its own rows, the rail first, then the opposite content, then the body, so every rail sits in the first row and the track stays straight. A date above the rail moves under it, and a body or date that wraps no longer moves the neighboring Items' rows.",
  },
  {
    sheet: "styles.css",
    where: ROW_SUBGRID_MISSING,
    features: ["css.properties.grid-template-rows.subgrid"],
    fallback: { kind: "none" },
    reason:
      "A @supports test: below Chrome 117 it reads true, and its block gives each horizontal TimelineList.Item its own rows, the rail first.",
  },
  {
    sheet: "styles.css",
    where: ".overscroll-contain",
    property: "overscroll-behavior",
    value: "contain",
    features: ["css.properties.overscroll-behavior"],
    fallback: { kind: "none" },
    reason: OVERSCROLL,
  },
  {
    sheet: "styles.css",
    where: ".overscroll-x-contain",
    property: "overscroll-behavior-x",
    value: "contain",
    features: ["css.properties.overscroll-behavior-x"],
    fallback: { kind: "none" },
    reason: OVERSCROLL,
  },
  {
    sheet: "styles.css",
    where: ".overscroll-y-contain",
    property: "overscroll-behavior-y",
    value: "contain",
    features: ["css.properties.overscroll-behavior-y"],
    fallback: { kind: "none" },
    reason: OVERSCROLL,
  },
  {
    sheet: "styles.css",
    where: ".box-decoration-clone",
    property: "box-decoration-break",
    value: "clone",
    features: ["css.properties.box-decoration-break", "css.properties.box-decoration-break.clone"],
    fallback: { kind: "declaration", property: "-webkit-box-decoration-break", value: "clone" },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: ".text-balance",
    property: "text-wrap",
    value: "balance",
    features: ["css.properties.text-wrap", "css.properties.text-wrap.balance"],
    fallback: { kind: "none" },
    reason: TEXT_WRAP,
  },
  {
    sheet: "styles.css",
    where: ".text-pretty",
    property: "text-wrap",
    value: "pretty",
    features: ["css.properties.text-wrap", "css.properties.text-wrap.pretty"],
    fallback: { kind: "none" },
    reason: TEXT_WRAP,
  },
  {
    sheet: "styles.css",
    where:
      ".decoration-\\[color\\:light-dark\\(color-mix\\(in_oklab\\,currentcolor_35\\%\\,transparent\\)\\,color-mix\\(in_oklab\\,currentcolor_65\\%\\,transparent\\)\\)\\]",
    property: "text-decoration-color",
    value: "light-dark(currentColor,currentColor)",
    features: ["css.types.color.light-dark"],
    fallback: { kind: "none" },
    reason: LIGHT_DARK_DECORATION,
  },
  {
    sheet: "styles.css",
    within: ["@supports (color:color-mix(in lab,red,red))"],
    where:
      ".decoration-\\[color\\:light-dark\\(color-mix\\(in_oklab\\,currentcolor_35\\%\\,transparent\\)\\,color-mix\\(in_oklab\\,currentcolor_65\\%\\,transparent\\)\\)\\]",
    property: "-webkit-text-decoration-color",
    value:
      "light-dark(color-mix(in oklab,currentcolor 35%,transparent),color-mix(in oklab,currentcolor 65%,transparent))",
    features: ["css.types.color.light-dark"],
    count: 2,
    fallback: { kind: "none" },
    reason: LIGHT_DARK_DECORATION,
  },
  {
    sheet: "styles.css",
    within: ["@supports (color:color-mix(in lab,red,red))"],
    where:
      ".decoration-\\[color\\:light-dark\\(color-mix\\(in_oklab\\,currentcolor_35\\%\\,transparent\\)\\,color-mix\\(in_oklab\\,currentcolor_65\\%\\,transparent\\)\\)\\]",
    property: "text-decoration-color",
    value:
      "light-dark(color-mix(in oklab,currentcolor 35%,transparent),color-mix(in oklab,currentcolor 65%,transparent))",
    features: ["css.types.color.light-dark"],
    fallback: { kind: "none" },
    reason: LIGHT_DARK_DECORATION,
  },
  {
    sheet: "styles.css",
    where: '.data-selected\\:forced-color-adjust-none:where([data-selected]:not([data-selected="false"]))',
    property: "forced-color-adjust",
    value: "none",
    features: ["css.properties.forced-color-adjust", "css.properties.forced-color-adjust.none"],
    fallback: { kind: "none" },
    reason: FORCED_COLORS,
  },
  {
    sheet: "styles.css",
    where: ".focus\\:forced-color-adjust-none:focus",
    property: "forced-color-adjust",
    value: "none",
    features: ["css.properties.forced-color-adjust", "css.properties.forced-color-adjust.none"],
    fallback: { kind: "none" },
    reason: FORCED_COLORS,
  },
  {
    sheet: "styles.css",
    where: ".select-none",
    property: "user-select",
    value: "none",
    features: ["css.properties.user-select"],
    fallback: { kind: "declaration", property: "-webkit-user-select", value: "none" },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: ".\\[overflow-anchor\\:none\\]",
    property: "overflow-anchor",
    value: "none",
    features: ["css.properties.overflow-anchor", "css.properties.overflow-anchor.none"],
    fallback: { kind: "none" },
    reason: "Safari before 27 has no scroll anchoring to turn off.",
  },
  {
    sheet: "styles.css",
    where:
      '.group-has-data-horizontal\\/field\\:text-balance:is(:where(.group\\/field):has(:where([data-orientation="horizontal"])) *)',
    property: "text-wrap",
    value: "balance",
    features: ["css.properties.text-wrap", "css.properties.text-wrap.balance"],
    fallback: { kind: "none" },
    reason: TEXT_WRAP,
  },
  {
    sheet: "styles.css",
    where:
      '.group-data-\\[state\\=processing\\]\\/attachment\\:shimmer:is(:where(.group\\/attachment)[data-state="processing"] *)',
    property: "background-clip",
    value: "text",
    features: ["css.properties.background-clip.text"],
    fallback: { kind: "declaration", property: "-webkit-background-clip", value: "text" },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where:
      '.group-data-\\[state\\=uploading\\]\\/attachment\\:shimmer:is(:where(.group\\/attachment)[data-state="uploading"] *)',
    property: "background-clip",
    value: "text",
    features: ["css.properties.background-clip.text"],
    fallback: { kind: "declaration", property: "-webkit-background-clip", value: "text" },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where:
      ".data-has-overflow-x\\:\\[mask-image\\:linear-gradient\\(var\\(--attachment-fade\\)\\,transparent_0\\,black_min\\(2\\.5rem\\,var\\(--scroll-area-overflow-x-start\\,0px\\)\\)\\,black_calc\\(100\\%_-_min\\(2\\.5rem\\,var\\(--scroll-area-overflow-x-end\\,0px\\)\\)\\)\\,transparent_100\\%\\)\\][data-has-overflow-x]",
    property: "mask-image",
    value:
      "linear-gradient(var(--attachment-fade),transparent 0,black min(2.5rem,var(--scroll-area-overflow-x-start,0px)),black calc(100% - min(2.5rem,var(--scroll-area-overflow-x-end,0px))),transparent 100%)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value:
        "linear-gradient(var(--attachment-fade),transparent 0,black min(2.5rem,var(--scroll-area-overflow-x-start,0px)),black calc(100% - min(2.5rem,var(--scroll-area-overflow-x-end,0px))),transparent 100%)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: "@supports ((-webkit-backdrop-filter:var(--tw)) or (backdrop-filter:var(--tw)))",
    features: ["css.properties.backdrop-filter"],
    fallback: { kind: "none" },
    reason: "A @supports test: its -webkit-backdrop-filter branch holds in Safari before 18.",
  },
  {
    sheet: "styles.css",
    within: ["@supports ((-webkit-backdrop-filter:var(--tw)) or (backdrop-filter:var(--tw)))"],
    where: ".supports-backdrop-filter\\:backdrop-blur-md",
    property: "backdrop-filter",
    value:
      "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )",
    features: ["css.properties.backdrop-filter"],
    fallback: {
      kind: "declaration",
      property: "-webkit-backdrop-filter",
      value:
        "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )",
    },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    within: ["@supports ((-webkit-backdrop-filter:var(--tw)) or (backdrop-filter:var(--tw)))"],
    where: ".supports-backdrop-filter\\:backdrop-blur-xs",
    property: "backdrop-filter",
    value:
      "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )",
    features: ["css.properties.backdrop-filter"],
    fallback: {
      kind: "declaration",
      property: "-webkit-backdrop-filter",
      value:
        "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )",
    },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: "@starting-style",
    features: ["css.at-rules.starting-style"],
    fallback: { kind: "none" },
    reason: ENTRY,
  },
  {
    sheet: "styles.css",
    within: ["@media (prefers-reduced-motion:no-preference)"],
    where: "@starting-style",
    features: ["css.at-rules.starting-style"],
    fallback: { kind: "none" },
    reason: ENTRY,
  },
  {
    sheet: "styles.css",
    where: "@supports (-webkit-touch-callout:none)",
    features: ["css.properties.-webkit-touch-callout"],
    count: 2,
    fallback: { kind: "none" },
    reason:
      "A @supports test that singles out iOS WebKit; elsewhere it reads false and its block does not apply.",
  },
  {
    sheet: "styles.css",
    where: ".\\[\\&\\:\\:-webkit-search-cancel-button\\]\\:hidden::-webkit-search-cancel-button",
    features: ["css.selectors.-webkit-search-cancel-button"],
    fallback: { kind: "none" },
    reason:
      "Chromium and WebKit's own search-field hook; Firefox has no cancel button to hide and drops the rule.",
  },
  {
    sheet: "styles.css",
    where: ":where(abbr:where([title])[data-slot])",
    property: "text-decoration",
    value: "underline dotted",
    features: ["css.properties.text-decoration.dotted"],
    fallback: { kind: "declaration", property: "-webkit-text-decoration", value: "underline dotted" },
    reason: PREFIXED,
  },
  {
    sheet: "styles.css",
    where: ":where(code[data-slot]),:where(kbd[data-slot]),:where(samp[data-slot]),:where(pre[data-slot])",
    property: "font-family",
    value:
      'var(--default-mono-font-family,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
    features: ["css.properties.font-family.ui-monospace"],
    fallback: { kind: "none" },
    reason:
      "A browser without the generic family skips it as a missing font, and the stack falls through to SFMono-Regular and the rest.",
  },
  {
    sheet: "styles.css",
    where: "@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px)",
    features: ["css.properties.contain-intrinsic-size"],
    fallback: { kind: "none" },
    reason: TAILWIND_SUPPORTS_TEST,
  },
  {
    sheet: "styles.css",
    where: ":where([data-slot])::-webkit-inner-spin-button",
    features: ["css.selectors.-webkit-inner-spin-button"],
    fallback: { kind: "none" },
    reason: "Chromium and WebKit's own number-spinner hook; Firefox drops the rule.",
  },
  // chart.css
  {
    sheet: "chart.css",
    where: "@media (scripting:enabled)",
    features: ["css.at-rules.media.scripting"],
    fallback: { kind: "none" },
    reason:
      "Below Chrome 120 the block never applies, so a polar chart shows in full without waiting for its entrance, as it does with JavaScript off.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-frame"]>[data-slot="chart-panel"]',
    property: "grid-template-columns",
    value: "subgrid",
    features: ["css.properties.grid-template-columns.subgrid"],
    fallback: {
      kind: "declaration",
      property: "grid-template-columns",
      value: "[start]auto[plot]minmax(0,1fr)[end]auto[legend-end]",
    },
    reason:
      "Below Chrome 117 each Panel lays out its own copy of the frame's tracks, so its plot takes the width its value axes leave, but Root's pointer surface no longer lines up with that plot. With a value axis on the Panel's left, the marks start one axis width right of the pointer slots, so hovering a bar can report another and the last marks run past the plot. With axes only on the right, the marks can run into the axis labels.",
  },
  {
    sheet: "chart.css",
    where:
      '[data-slot="chart-bar"],[data-slot="chart-bar-active"],[data-slot="chart-bar-detail"],[data-slot="chart-bar-path"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-bar"],[data-slot="chart-bar-active"]',
    property: "clip-path",
    value: "inset(0 round var(--_tl) var(--_tr) var(--_br) var(--_bl)) fill-box",
    features: ["css.properties.clip-path.fill-box"],
    fallback: { kind: "none" },
    reason: SQUARE_BAR,
  },
  {
    sheet: "chart.css",
    where:
      ':is([data-slot="pie-chart-center"],[data-slot="gauge-chart-center"],[data-slot="live-line-chart-badge"]) [data-part="digits"]',
    property: "line-height",
    value: "round(1lh,1px)",
    features: ["css.types.round"],
    fallback: { kind: "none" },
    reason:
      "Below Chrome 125 the reels keep the inherited line height, and may draw up to two device pixels off the text beside them.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="radar-chart-dot"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where:
      '[data-slot="clock-chart-area"]:not([data-variant="solid"]) [data-slot="clock-chart-area-path"][data-part="solid"]',
    property: "mask",
    value: "var(--_look)",
    features: ["css.properties.mask"],
    fallback: { kind: "none" },
    reason: SVG_MASK,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="clock-chart-wedge"][data-part="marked"]',
    property: "mask",
    value: "none",
    features: ["css.properties.mask"],
    fallback: { kind: "declaration", property: "-webkit-mask", value: "none" },
    reason: "The -webkit-mask: none before it resets the prefixed mask, as mask: none resets this one.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="clock-chart-area-path"][data-part="marked"]',
    property: "mask",
    value: "var(--_quality)",
    features: ["css.properties.mask"],
    fallback: { kind: "none" },
    reason: SVG_MASK,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="clock-chart-wedge"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where:
      '[data-slot="clock-chart-column"][data-variant="gradient"] [data-slot="clock-chart-wedge"]:not([data-part])',
    property: "mask",
    value: "var(--_fade)",
    features: ["css.properties.mask"],
    fallback: { kind: "none" },
    reason: SVG_MASK,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="clock-chart-dot"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where:
      ':is([data-slot="radar-chart-angle-label"],[data-slot="clock-chart-angle-label"]):not([data-hidden])',
    property: "text-box",
    value: "trim-both cap text",
    features: [
      "css.properties.text-box",
      "css.properties.text-box.cap",
      "css.properties.text-box.text",
      "css.properties.text-box.trim-both",
    ],
    fallback: { kind: "none" },
    reason:
      "Below the floor the angle labels center on their line box instead of their cap height, a few pixels off.",
  },
  {
    sheet: "chart.css",
    where:
      '[data-slot="chart-skeleton"]:is([data-variant="pie"],[data-variant="radial"],[data-variant="radar"],[data-variant="clock"]) [data-slot="chart-skeleton-mark"]',
    property: "mask",
    value:
      "radial-gradient(circle,transparent calc(var(--chart-skeleton-hole,0)*50%),#000 calc(var(--chart-skeleton-hole,0)*50% + .5px))",
    features: ["css.properties.mask"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask",
      value:
        "radial-gradient(circle,transparent calc(var(--chart-skeleton-hole,0)*50%),#000 calc(var(--chart-skeleton-hole,0)*50% + .5px))",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: "@supports (color:light-dark(#000,#fff))",
    features: ["css.types.color.light-dark"],
    fallback: { kind: "none" },
    reason:
      "A @supports test: below Chrome 123 and Safari 17.5 it reads false, and the gauge track keeps the light tint the rule before it sets.",
  },
  {
    sheet: "chart.css",
    within: ["@supports (color:light-dark(#000,#fff))"],
    where: '[data-slot="gauge-chart-track"]',
    property: "--_paint",
    value:
      "light-dark(color-mix(in oklab,var(--muted-foreground) 32%,transparent),color-mix(in oklab,var(--muted-foreground) 26%,transparent))",
    features: ["css.types.color.light-dark"],
    fallback: {
      kind: "rule",
      where: '[data-slot="gauge-chart-track"]',
      property: "--_paint",
      value: "color-mix(in oklab,var(--muted-foreground) 32%,transparent)",
    },
    reason:
      "The @supports guard it sits in tests light-dark() itself; below it the unguarded rule's light 32 % tint paints the track in both schemes, a shade stronger than the dark 26 %.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="gauge-chart-sector"]',
    property: "-webkit-mask-composite",
    value: "source-in",
    features: ["css.properties.-webkit-mask-composite"],
    fallback: { kind: "none" },
    reason: WEBKIT_MASK_COMPOSITE,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="gauge-chart-sector"]',
    property: "mask",
    value:
      "conic-gradient(from var(--_sector-from) at var(--_at),#000 0 var(--_sector-span),transparent 0),radial-gradient(var(--_reach-x) var(--_reach-y) at var(--_at),transparent calc(var(--_hole)*100% - .5px),#000 calc(var(--_hole)*100%) calc(100% - .5px),transparent 100%)",
    features: ["css.properties.mask"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask",
      value:
        "conic-gradient(from var(--_sector-from) at var(--_at),#000 0 var(--_sector-span),transparent 0),radial-gradient(var(--_reach-x) var(--_reach-y) at var(--_at),transparent calc(var(--_hole)*100% - .5px),#000 calc(var(--_hole)*100%) calc(100% - .5px),transparent 100%)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="gauge-chart-sector"]',
    property: "mask-composite",
    value: "intersect",
    features: ["css.properties.mask-composite", "css.properties.mask-composite.intersect"],
    fallback: { kind: "none" },
    reason: MASK_COMPOSITE,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-skeleton"][data-variant="gauge"] [data-slot="chart-skeleton-mark"]',
    property: "mask",
    value:
      "radial-gradient(closest-side circle,transparent calc(var(--chart-skeleton-hole)*100%),#000 calc(var(--chart-skeleton-hole)*100% + .5px) calc(100% - .5px),transparent 100%),conic-gradient(from var(--_from),#000 0 var(--_sweep),transparent 0)",
    features: ["css.properties.mask"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask",
      value:
        "radial-gradient(closest-side circle,transparent calc(var(--chart-skeleton-hole)*100%),#000 calc(var(--chart-skeleton-hole)*100% + .5px) calc(100% - .5px),transparent 100%),conic-gradient(from var(--_from),#000 0 var(--_sweep),transparent 0)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-skeleton"][data-variant="gauge"] [data-slot="chart-skeleton-mark"]',
    property: "-webkit-mask-composite",
    value: "source-in",
    features: ["css.properties.-webkit-mask-composite"],
    fallback: { kind: "none" },
    reason: WEBKIT_MASK_COMPOSITE,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-skeleton"][data-variant="gauge"] [data-slot="chart-skeleton-mark"]',
    property: "mask-composite",
    value: "intersect",
    features: ["css.properties.mask-composite", "css.properties.mask-composite.intersect"],
    fallback: { kind: "none" },
    reason: MASK_COMPOSITE,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-skeleton"][data-variant="radar"] [data-slot="chart-skeleton-mark"]',
    property: "mask",
    value: "none",
    features: ["css.properties.mask"],
    fallback: { kind: "declaration", property: "-webkit-mask", value: "none" },
    reason:
      "Chrome 111 to 119 read the -webkit-mask: none before it, which clears the hole the round skeletons' -webkit-mask cuts, so the radar skeleton fills its hexagon.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-crosshair"][data-fade="both"]',
    property: "mask-image",
    value: "linear-gradient(var(--_fade-to),transparent,#000 10%,#000 90%,transparent)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value: "linear-gradient(var(--_fade-to),transparent,#000 10%,#000 90%,transparent)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-crosshair"][data-fade="top"]',
    property: "mask-image",
    value: "linear-gradient(var(--_fade-to),transparent,#000 10%)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value: "linear-gradient(var(--_fade-to),transparent,#000 10%)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-crosshair"][data-fade="bottom"]',
    property: "mask-image",
    value: "linear-gradient(var(--_fade-to),#000 90%,transparent)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value: "linear-gradient(var(--_fade-to),#000 90%,transparent)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-swatch"]',
    property: "forced-color-adjust",
    value: "none",
    features: ["css.properties.forced-color-adjust", "css.properties.forced-color-adjust.none"],
    fallback: { kind: "none" },
    reason: FORCED_COLORS,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-takeaway"]',
    property: "text-wrap",
    value: "pretty",
    features: ["css.properties.text-wrap", "css.properties.text-wrap.pretty"],
    fallback: { kind: "none" },
    reason: TEXT_WRAP,
  },
  {
    sheet: "chart.css",
    where: ':is([data-slot="chart-line-series"],[data-slot="chart-area-series"])',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-dot"]',
    property: "paint-order",
    value: "stroke",
    features: ["css.properties.paint-order"],
    fallback: { kind: "none" },
    reason:
      "SVG only: MDN's partial rows before Chrome 123 lack only stroked HTML text, and on an SVG dot the stroke paints first.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-dot"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="chart-points-path"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where:
      '[data-slot="chart"][data-chart-depth="0"][data-active] [data-slot="chart-reveal"]:not([data-chart-depth="0"] :is([data-slot="chart"],[data-polar]) *)>[data-variant]:is([data-chart-part="line-series"],[data-chart-part="area-series"],[data-chart-part="dots"]),[data-slot="chart"][data-chart-depth="1"][data-active] [data-slot="chart-reveal"]:not([data-chart-depth="1"] :is([data-slot="chart"],[data-polar]) *)>[data-variant]:is([data-chart-part="line-series"],[data-chart-part="area-series"],[data-chart-part="dots"]),[data-slot="chart"][data-chart-depth="2"][data-active] [data-slot="chart-reveal"]:not([data-chart-depth="2"] :is([data-slot="chart"],[data-polar]) *)>[data-variant]:is([data-chart-part="line-series"],[data-chart-part="area-series"],[data-chart-part="dots"]),[data-slot="chart"][data-chart-depth="3"][data-active] [data-slot="chart-reveal"]:not([data-chart-depth="3"] :is([data-slot="chart"],[data-polar]) *)>[data-variant]:is([data-chart-part="line-series"],[data-chart-part="area-series"],[data-chart-part="dots"])',
    property: "mask-image",
    value:
      "linear-gradient(var(--_root-reveal-to),#000 var(--chart-active-x,100%),rgb(0 0 0/var(--chart-hover-dim)) var(--chart-active-x,100%))",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value:
        "linear-gradient(var(--_root-reveal-to),#000 var(--chart-active-x,100%),rgb(0 0 0/var(--chart-hover-dim)) var(--chart-active-x,100%))",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-path"][data-part="fill"]',
    property: "mask-image",
    value: "linear-gradient(#000,transparent var(--_fill-zero,100%),#000)",
    features: ["css.properties.mask-image"],
    fallback: { kind: "none" },
    reason: SPARKLINE_FILL,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-path"][data-part="fill"]',
    property: "mask-origin",
    value: "view-box",
    features: ["css.properties.mask-origin", "css.properties.mask-origin.view-box"],
    fallback: { kind: "none" },
    reason: SPARKLINE_FILL,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-path"][data-part="fill"]',
    property: "mask-clip",
    value: "view-box",
    features: ["css.properties.mask-clip", "css.properties.mask-clip.view-box"],
    fallback: { kind: "none" },
    reason: SPARKLINE_FILL,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-bar"]',
    property: "clip-path",
    value: "inset(0 round var(--_far) var(--_far)0 0) fill-box",
    features: ["css.properties.clip-path.fill-box"],
    fallback: { kind: "none" },
    reason: SQUARE_BAR,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-bar"][data-negative]',
    property: "clip-path",
    value: "inset(0 round 0 0 var(--_far) var(--_far)) fill-box",
    features: ["css.properties.clip-path.fill-box"],
    fallback: { kind: "none" },
    reason: SQUARE_BAR,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-path"][data-part="highlight"]',
    property: "clip-path",
    value: "inset(-50% calc(100% - var(--_band-end)*1%) -50% calc(var(--_band-start)*1%)) view-box",
    features: ["css.properties.clip-path.view-box"],
    fallback: SPARKLINE_BAND_CLIPPED,
    reason:
      "Below Chrome 119 the clip fails at substitution, and the companion clips the highlight away, so a hover shows the crosshair and the dot over the dimmed line instead of a segment that strays off the line at both ends.",
  },
  {
    sheet: "chart.css",
    where: '[data-slot="sparkline-glide"]>[data-part="band-start"]',
    property: "clip-path",
    value: "inset(-50% -100% -50% calc(var(--_band-start)*1%)) view-box",
    features: ["css.properties.clip-path.view-box"],
    fallback: SPARKLINE_BAND_CLIPPED,
    reason:
      "Below Chrome 119 the clip fails at substitution, and the companion clips the glide band away, so a hover shows the gliding crosshair and dot over the dimmed line instead of the whole line at full strength.",
  },
  {
    sheet: "chart.css",
    where: '[data-part="band-start"]>[data-part="band-end"]',
    property: "clip-path",
    value: "inset(-50% calc(100% - var(--_band-end)*1%) -50% -100%) view-box",
    features: ["css.properties.clip-path.view-box"],
    fallback: SPARKLINE_BAND_CLIPPED,
    reason:
      "Below Chrome 119 this clip fails at substitution, and the companion clips away the band-start group it sits in, so nothing of the band draws.",
  },
  {
    sheet: "chart.css",
    where: SPARKLINE_BAND,
    features: ["css.properties.clip-path.view-box"],
    fallback: { kind: "none" },
    reason:
      "A @supports test: below Chrome 119 it reads true, and its block clips the sparkline's highlight and glide band away.",
  },
  {
    sheet: "chart.css",
    within: ["@media (hover:hover)"],
    where: "@starting-style",
    features: ["css.at-rules.starting-style"],
    fallback: { kind: "none" },
    reason: "Below the floor a hovered value's marks show at once instead of fading in.",
  },
  {
    sheet: "chart.css",
    where: ':is([data-slot="live-line-chart-line"],[data-slot="live-line-chart-area"])',
    property: "mask-image",
    value: "linear-gradient(to right,#0000,#000 2rem)",
    features: ["css.properties.mask-image"],
    fallback: {
      kind: "declaration",
      property: "-webkit-mask-image",
      value: "linear-gradient(to right,#0000,#000 2rem)",
    },
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="live-line-chart-line-path"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="live-line-chart-area-path"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    where: '[data-slot="live-line-chart-badge"] [data-part="pill"]',
    property: "print-color-adjust",
    value: "exact",
    features: ["css.properties.print-color-adjust", "css.properties.print-color-adjust.exact"],
    fallback: WEBKIT_PRINT_EXACT,
    reason: PREFIXED,
  },
  {
    sheet: "chart.css",
    within: ["@media (forced-colors:active)"],
    where:
      '[data-slot="chart-bar-series"],[data-slot="chart-line-series"],[data-slot="chart-area-series"],[data-slot="chart-dots"],[data-slot="chart-points"],[data-slot="chart-active-dot"],[data-slot="chart-marker"]>svg,[data-slot="pie-chart-pie"],[data-slot="pie-chart-glow"],[data-slot="radial-chart-bar"],[data-slot="gauge-chart-track"],[data-slot="gauge-chart-fill"],[data-slot="gauge-chart-glow"],[data-slot="gauge-chart-zone"],[data-slot="gauge-chart-progress-ring"],[data-slot="gauge-chart-dots"],[data-slot="gauge-chart-sector"],[data-radar-series],[data-clock-series],[data-slot="sparkline"],[data-slot="chart-swatch"]',
    property: "forced-color-adjust",
    value: "none",
    features: ["css.properties.forced-color-adjust", "css.properties.forced-color-adjust.none"],
    fallback: { kind: "none" },
    reason: FORCED_COLORS,
  },
];
