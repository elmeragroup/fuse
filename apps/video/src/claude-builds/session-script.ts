import type { BrandCode, Density } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import type { SiteSection } from "../copy/catalog";
import { bars, beats } from "../music/beat-grid";
import { CHORD_BARS, DROP_BAR, STOP_BAR } from "./grid";

/**
 * The session's beats, in frames from its first, which is the film's. The prompt types over the
 * track's build-up, Claude answers on its riser and the split opens on the drums. Each section is
 * written on its own beat and lands in the preview half a bar later, when the write returns. The
 * camera pulls back to the whole page and the page flips faster and faster for twelve bars into
 * the drop and takes the frame on `DROP_BAR`. Through the drop it turns only on the track's chord
 * changes, and it lands on `STOP_BAR`, where the drums stop.
 */

/** The prompt starts typing one bar in and is sent on bar 5's downbeat. */
export const PROMPT = { typeAt: bars(1), charsPerSecond: 26, sendAt: bars(5) } as const;

/** Claude thinks until its task list goes up, after the drums come in. */
export const THINKING = { at: bars(5), until: bars(8.25) } as const;

/** Claude answers on the track's riser and installs Fuse a bar later. */
export const REPLY_AT = bars(6);
export const INSTALL = { at: bars(7), doneAt: bars(7.5), seconds: 2.1 } as const;

/** The task list goes up as the split opens, and comes down with Claude's last word. */
export const TODOS = { at: bars(8.25), until: bars(STOP_BAR + 1) } as const;

/** One section's write: the call, when it returns and the section lands, and what it wrote. */
export type SectionWrite = {
  readonly at: number;
  readonly lands: number;
  readonly path: string;
  readonly lines: number;
};

/** Every section's write, a section about every bar and a quarter. */
export const WRITES = {
  header: { at: bars(8.5), lands: bars(9), path: "src/site/header.tsx", lines: 38 },
  hero: { at: bars(9.5), lands: bars(10), path: "src/site/hero.tsx", lines: 61 },
  plans: { at: bars(10.75), lands: bars(11.25), path: "src/site/plans.tsx", lines: 74 },
  calculator: { at: bars(12), lands: bars(12.5), path: "src/site/price-calculator.tsx", lines: 96 },
  faq: { at: bars(15), lands: bars(15.5), path: "src/site/faq.tsx", lines: 47 },
  footer: { at: bars(16.5), lands: bars(17), path: "src/site/footer.tsx", lines: 52 },
} as const satisfies Record<SiteSection, SectionWrite>;

/** The slider glides from one yearly use to another once the calculator has landed. */
export const SLIDER = { from: bars(12.75), to: bars(13.5), startKwh: 12_000, endKwh: 16_000 } as const;

/** Claude clicks the order button in the browser; the site's toast answers and leaves later. */
export const CLICK = { call: bars(13.25), at: bars(14), toastUntil: bars(15.25) } as const;

/** The first question opens half a bar after the questions land. */
export const FAQ_OPENS_AT = bars(16);

/**
 * The camera pulls back to the whole page a bar after the footer lands, holds it through the
 * first flips, and pushes in on the hero from `until`.
 */
export const OVERVIEW = { at: bars(18), until: bars(DROP_BAR - 6) } as const;

/** Claude's word once the page is built, as the camera pulls back to show it all. */
export const BUILT_AT = bars(18.5);

/** Claude's last word, a bar after the drums stop, once the terminal has taken the frame back. */
export const DONE_AT = bars(STOP_BAR + 1);

/** The chat column's resting share of the width, once the split has opened. */
export const CHAT_REST = 0.385;

/**
 * The split: the terminal fills the frame, gives way to the preview on the drums, collapses so
 * the page takes the frame on the drop, and takes the whole frame back when the drums stop, so
 * Claude's last word lands as large as the prompt did.
 */
export const MORPHS = [
  { at: bars(8), durationInFrames: bars(1), to: CHAT_REST },
  { at: bars(DROP_BAR), durationInFrames: beats(2), to: 0 },
  // Half a bar after the stop, so the page holds still on its home look for a breath first.
  { at: bars(STOP_BAR + 0.5), durationInFrames: bars(1), to: 1 },
] as const;

/** The session's last beat, over which it lifts out for the lockup. */
export const EXIT_BEATS = 1;

/** A look the page wears: a brand, a scheme and a density. */
export type Look = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  readonly density: Density;
};

/** The look the page is built in and lands on: Elmera, light, comfortable. */
export const HOME_LOOK: Look = { brand: "elma", scheme: "light", density: "comfortable" };

/** A flip of the page's look, from frame `at`. */
export type Flip = {
  readonly at: number;
  readonly look: Look;
};

/** The brands after Elmera, in the landing's order; the flips cycle through them and back home. */
const BRAND_CYCLE: readonly BrandCode[] = ["fkas", "tkas", "guen", "fkab", "fkse", "ngfi", "elma"];

/** A stretch of flips: from a bar, `count` flips every `beatsApart` beats, in one scheme. */
type FlipRun = {
  readonly bar: number;
  readonly count: number;
  readonly beatsApart: number;
  readonly scheme: ResolvedColorScheme;
};

/**
 * The flips into the drop, faster and faster, at the home density: a bar apart, then half a bar,
 * a beat and half a beat. The scheme changes at most once a beat and holds for a bar while flips come faster than
 * that, so the frame never flashes between light and dark more than three times a second.
 */
const FLIP_RUNS: readonly FlipRun[] = [
  { bar: DROP_BAR - 12, count: 2, beatsApart: 4, scheme: "light" },
  { bar: DROP_BAR - 10, count: 4, beatsApart: 2, scheme: "light" },
  { bar: DROP_BAR - 8, count: 4, beatsApart: 1, scheme: "dark" },
  { bar: DROP_BAR - 7, count: 4, beatsApart: 1, scheme: "light" },
  { bar: DROP_BAR - 6, count: 4, beatsApart: 1, scheme: "dark" },
  { bar: DROP_BAR - 5, count: 4, beatsApart: 1, scheme: "light" },
  { bar: DROP_BAR - 4, count: 8, beatsApart: 0.5, scheme: "dark" },
  { bar: DROP_BAR - 3, count: 8, beatsApart: 0.5, scheme: "light" },
  { bar: DROP_BAR - 2, count: 8, beatsApart: 0.5, scheme: "dark" },
  { bar: DROP_BAR - 1, count: 8, beatsApart: 0.5, scheme: "light" },
];

/**
 * The page's looks through the drop, one per chord, while the camera visits the hero, the plans,
 * the calculator and the hero again. Each brand's hue is far from the one before it, the scheme
 * turns every time, and the page goes dense for the plans and the calculator.
 */
const DROP_LOOKS: readonly Look[] = [
  { brand: "tkas", scheme: "dark", density: "comfortable" },
  { brand: "fkas", scheme: "light", density: "dense" },
  { brand: "guen", scheme: "dark", density: "dense" },
  { brand: "ngfi", scheme: "light", density: "comfortable" },
];

if (DROP_BAR + DROP_LOOKS.length * CHORD_BARS !== STOP_BAR) {
  throw new Error(
    "The drop's looks must hold one chord each from the drop to the stop; re-time DROP_LOOKS in session-script.ts."
  );
}

/**
 * Every flip in time order: the runs cycling the brands into the drop, a look on each chord
 * through it, then home on the stop.
 */
export const FLIPS: readonly Flip[] = [
  ...FLIP_RUNS.flatMap((run, runIndex) => {
    const before = FLIP_RUNS.slice(0, runIndex).reduce((total, earlier) => total + earlier.count, 0);
    return Array.from({ length: run.count }, (_, index): Flip => {
      const brand = BRAND_CYCLE[(before + index) % BRAND_CYCLE.length] ?? HOME_LOOK.brand;
      return {
        at: bars(run.bar) + beats(index * run.beatsApart),
        look: { brand, scheme: run.scheme, density: HOME_LOOK.density },
      };
    });
  }),
  ...DROP_LOOKS.map((look, index): Flip => ({ at: bars(DROP_BAR + index * CHORD_BARS), look })),
  { at: bars(STOP_BAR), look: HOME_LOOK },
];

/**
 * The page's look on a frame: the last flip at or before it, or home before the first.
 *
 * @param frame - The session's frame.
 * @returns The look.
 */
export function lookAt(frame: number): Look {
  return FLIPS.findLast((flip) => flip.at <= frame)?.look ?? HOME_LOOK;
}
