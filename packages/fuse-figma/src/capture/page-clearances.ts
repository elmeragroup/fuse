/**
 * The margins by which the capture's page function in `page-facts.ts` keeps a fact, each wide enough
 * that the fraction of a pixel by which Chromium sets the same text wider on one platform than on
 * the other does not move the fact, and Chromium's layout unit, below which two readings of one
 * layout are one length.
 */

/**
 * The least room, in CSS pixels, a one-column grid's column must keep past its items' least width
 * for the page to record `trackFits`. Chromium sets the same text a fraction of a pixel wider on one
 * platform than the other: on 2026-11-17 the same Roboto 600 24px words gave a grid a min-content
 * column of 140.859px on macOS and 141px in Playwright's Linux image. The page records the fact
 * only with a whole pixel to spare, the room `ellipsisFits` keeps for the same reason, so a grid
 * whose least width comes close to its column records nothing and the build leaves it unmapped. A
 * least width within the platforms' fraction of a pixel of that bound could still land on either
 * side, so `figma:capture --check` in the Linux image is what shows each kept capture agrees.
 */
export const TRACK_CLEARANCE_PX = 1;

/**
 * The least lead, in CSS pixels, by which the page counts a grid's column as wider than its items'
 * min-content width, or one item as setting its track over the others (`gridHolds`, `gridWidest`,
 * `gridTallest`). The same Roboto file sets "Selection" at 14px 57.59px wide on macOS and 56px wide in
 * Playwright's Linux image (C5 review, 2026-11-18), a gap wider than {@link TRACK_CLEARANCE_PX}, so the
 * page keeps two whole pixels.
 */
export const GRID_CLEARANCE_PX = 2;

/**
 * How far below its `max-width` a box's width must stay, in CSS pixels, for the page to record
 * `underMaxWidth`: the page lowers the maximum by this much and checks the width did not move. It
 * absorbs the fraction of a pixel by which the same text sets wider on one platform than the other,
 * which {@link TRACK_CLEARANCE_PX} records at under a pixel, many times over. No measurement of type
 * across fonts backs the 24px; `figma:capture --check` in the Linux image shows each kept capture
 * agrees.
 */
export const MAX_WIDTH_CLEARANCE_PX = 24;

/**
 * The least free space, in CSS pixels, a flex line must leave its items' auto margins along its
 * direction for the page to record `freeAlongMain`. It keeps the same margin as
 * {@link MAX_WIDTH_CLEARANCE_PX}, for the same reason and with the same evidence.
 */
export const FREE_SPACE_CLEARANCE_PX = 24;

/**
 * The least free space, in CSS pixels, a flex line must leave along its direction, with its auto
 * margins at zero, for the page to record `fitsAlongMain`: the line's items fit it. It is the whole
 * pixel {@link TRACK_CLEARANCE_PX} keeps for the same reason, so a line whose items come within the
 * platforms' fraction of a pixel of its end records nothing.
 */
export const FIT_CLEARANCE_PX = TRACK_CLEARANCE_PX;

/**
 * Chromium's layout unit, 1/64 of a CSS pixel: a box's width moves by at least this much when its
 * maximum narrows it, so a smaller difference between two readings of one layout is no change.
 */
export const LAYOUT_UNIT_PX = 1 / 64;
