/**
 * The shots a run takes: one per state, theme, density, engine and window size, each with its
 * file name and the alt text that says what it shows.
 */

import type {
  ColorScheme,
  DensityChoice,
  Engine,
  ResolvedFrame,
  ShotOptions,
  ThemeChoice,
  Viewport,
} from "./options.ts";

/** Which side of the change a shot shows. */
export type ShotState = "before" | "after";

/** One point of a run's matrix: the conditions a before and an after shot share. */
export type Coordinate = {
  /** The theme the page renders in. */
  readonly theme: ThemeChoice;
  /** The density the frame renders in. */
  readonly density: DensityChoice;
  /** The browser engine. */
  readonly engine: Engine;
  /** The browser window's size. */
  readonly viewport: Viewport;
};

/** One screenshot the run writes. */
export type Shot = Coordinate & {
  /** Which side of the change it shows. */
  readonly state: ShotState;
  /** What the shot covers. */
  readonly frame: ResolvedFrame;
  /** The PNG's file name inside the run directory. */
  readonly file: string;
  /** What the image shows, for the Markdown alt text. */
  readonly alt: string;
};

/** One row of the before/after table: the same coordinate on both sides of the change. */
export type ShotRow = Coordinate & {
  /** The shot of the base. */
  readonly before: Shot;
  /** The shot of the change. */
  readonly after: Shot;
  /** The pixel diff's file name, the pair's coordinate with a `-diff` suffix. */
  readonly diffFile: string;
};

/**
 * Expand a run into its matrix, themes outermost, then densities, engines and window sizes.
 *
 * @param options - The parsed run.
 * @returns One coordinate per theme, density, engine and window size.
 */
export function planCoordinates(options: ShotOptions): readonly Coordinate[] {
  return options.themes.flatMap((theme) =>
    options.densities.flatMap((density) =>
      options.engines.flatMap((engine) =>
        options.viewports.map((viewport) => ({ theme, density, engine, viewport }))
      )
    )
  );
}

/**
 * The first coordinate `planCoordinates` lists: the first theme, density, engine and window
 * size. Every axis has at least one entry, so a run always has it.
 *
 * @param options - The parsed run.
 * @returns The coordinate of the run's first shot.
 */
export function firstCoordinate({ themes, densities, engines, viewports }: ShotOptions): Coordinate {
  return { theme: themes[0], density: densities[0], engine: engines[0], viewport: viewports[0] };
}

/**
 * Expand a run into its table rows once its frame is known, in `planCoordinates` order.
 *
 * @param options - The parsed run.
 * @param frame - What every shot of the run covers.
 * @returns One row per coordinate, with both shots' file names and alt text.
 */
export function planShots(options: ShotOptions, frame: ResolvedFrame): readonly ShotRow[] {
  return planCoordinates(options).map((at) => ({
    ...at,
    before: makeShot(options, "before", at, frame),
    after: makeShot(options, "after", at, frame),
    diffFile: `${coordinateName(options, at, frame)}-diff.png`,
  }));
}

/**
 * The words a theme choice reads as in file names and captions.
 *
 * @param theme - The theme choice.
 * @returns The slug, or `default-theme` for the page's own theme.
 */
export function themeName(theme: ThemeChoice): string {
  return theme._tag === "picked" ? theme.slug : "default-theme";
}

/**
 * The words a density choice reads as in file names. An override says so, because it differs
 * from what the page shows for the theme. Without one, a demo stage takes the deployment default
 * for its theme, and any other frame the page's own density.
 *
 * @param density - The density choice.
 * @param frame - What the shot covers.
 * @returns `stage-density`, `page-density`, or `<density>-override`.
 */
export function densityName(density: DensityChoice, frame: ResolvedFrame): string {
  if (density._tag === "override") {
    return `${density.density}-override`;
  }
  return frame === "stage" || frame === "target" ? "stage-density" : "page-density";
}

/**
 * A window size as file names and table rows spell it.
 *
 * @param viewport - The window size.
 * @returns Such as `1280x900`.
 */
export function viewportName({ width, height }: Viewport): string {
  return `${String(width)}x${String(height)}`;
}

/**
 * The click steps as alt text and the table's lead line read them.
 *
 * @param options - The parsed run.
 * @returns Such as `, after clicking button "Internal", then combobox "Rows per page"`, or an
 * empty string for a run without clicks.
 */
export function clickWords({ clicks }: ShotOptions): string {
  return clicks.length === 0
    ? ""
    : `, after clicking ${clicks.map(({ role, name }) => `${role} "${name}"`).join(", then ")}`;
}

function makeShot(options: ShotOptions, state: ShotState, at: Coordinate, frame: ResolvedFrame): Shot {
  return {
    ...at,
    state,
    frame,
    file: `${state}-${coordinateName(options, at, frame)}.png`,
    alt: altText(options, state, at, frame),
  };
}

/** A row's theme, density, scheme, engine, window size and frame, as file names spell them. */
function coordinateName(options: ShotOptions, at: Coordinate, frame: ResolvedFrame): string {
  return [
    themeName(at.theme),
    densityName(at.density, frame),
    options.colorScheme,
    at.engine,
    viewportName(at.viewport),
    frame,
  ].join("-");
}

function altText(options: ShotOptions, state: ShotState, at: Coordinate, frame: ResolvedFrame): string {
  const subject = options.target === null ? null : `${options.target.role} "${options.target.name}"`;
  const framing = {
    stage: `${subject ?? "the target"} in its demo stage on ${options.route}`,
    target: `${subject ?? "the target"} on ${options.route}`,
    viewport: `the visible part of ${options.route}`,
    page: `the whole of ${options.route}`,
  }[frame];
  const filled =
    options.fill === null
      ? ""
      : frame === "stage" || frame === "target" || subject === null
        ? `, filled with "${options.fill}"`
        : `, with ${subject} filled with "${options.fill}"`;
  const themeWords = at.theme._tag === "picked" ? `${at.theme.slug} theme` : "the page's default theme";
  const densityWords =
    at.density._tag === "override"
      ? `${at.density.density} density (override)`
      : "the theme's default density";
  const windowWords = `${String(at.viewport.width)} × ${String(at.viewport.height)} window`;
  return `${capitalize(state)}: ${framing}${clickWords(options)}${filled}, ${themeWords}, ${densityWords}, ${schemeWords(options.colorScheme)}, ${engineWords(at.engine)}, ${windowWords}`;
}

function schemeWords(scheme: ColorScheme): string {
  return `${scheme} mode`;
}

function engineWords(engine: Engine): string {
  return { chromium: "Chromium", webkit: "WebKit", firefox: "Firefox" }[engine];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
