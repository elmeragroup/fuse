// A tour's definition: its id, version, ordered step ids and the plain-string words for steps that
// no component carries. It holds no React and no directive, so a Server Component may import a
// definition module and pass the same object to client parts.

import { isThemeDevelopment } from "../../theme/validate-theme";

/**
 * Where a step shows its popup. `"target"` anchors the popup to the step's element. `"center"`
 * shows it in the middle of the viewport with no element, for a welcome or a wrap-up.
 */
export type TourStepPlacement = "target" | "center";

/** A step's words in its definition, for a step with no component to carry them. */
export type TourDefinitionStep = {
  /** The step's title. */
  readonly title: string;
  /** The step's description. */
  readonly description?: string;
  /** Where the step shows its popup. Defaults to `"target"`. */
  readonly placement?: TourStepPlacement;
};

/**
 * A tour: its id, version and ordered steps. Create it with `defineTour`.
 *
 * @template S - The step ids, as a union.
 */
export type TourDefinition<S extends string = string> = {
  /** The tour's id, unique among the tours under one `Tour.Provider`. */
  readonly id: string;
  /** The definition's version. A record written against another version loses its progress. */
  readonly version: number;
  /** The step ids in the order the tour shows them, without duplicates. */
  readonly steps: readonly S[];
  /** Plain-string words for steps no component carries, by step id. */
  readonly content: { readonly [K in S]?: TourDefinitionStep };
  /** How long a step waits for its element before the tour skips it, in milliseconds. */
  readonly targetTimeoutMs: number;
  /** The rank among auto-started tours that are due at once. The highest starts. */
  readonly priority: number;
};

/** How long a step waits for its element by default, in milliseconds. */
export const DEFAULT_TARGET_TIMEOUT_MS = 1000;

/**
 * Input for `defineTour`.
 *
 * @template S - The step ids, as a union.
 */
export type TourDefinitionInput<S extends string> = {
  /** The tour's id, unique among the tours under one `Tour.Provider`. */
  readonly id: string;
  /**
   * The definition's version. Raise it when the steps change in a way a user who stopped half way
   * should see again. Raising it resets the saved step, and a finished tour stays finished.
   */
  readonly version?: number;
  /** The step ids in the order the tour shows them. A repeated id is dropped, in development with a warning. */
  readonly steps: readonly S[];
  /**
   * Plain-string words for a step no component carries: a `"center"` step, or a step whose element
   * is marked with `data-tour-step` in plain HTML. Put words that need translation on
   * `Tour.Target` or `useTourStep` instead.
   */
  readonly content?: { readonly [K in S]?: TourDefinitionStep };
  /** How long a step waits for its element before the tour skips it, in milliseconds. Defaults to 1,000. */
  readonly targetTimeoutMs?: number;
  /**
   * The rank among auto-started tours that are due at once. The highest starts, and a tie goes to the
   * tour whose `useAutoStartTour` mounted first.
   */
  readonly priority?: number;
};

/**
 * A tour definition. The step ids become a union type, so a part that names a step outside it fails
 * to compile. It is a plain object, safe to create in a module a Server Component imports.
 *
 * @template S - The step ids, inferred from `steps`.
 * @param input - The tour's id, steps and options.
 * @returns The definition.
 */
export function defineTour<const S extends string>(input: TourDefinitionInput<S>): TourDefinition<S> {
  const steps = [...new Set(input.steps)];
  if (steps.length !== input.steps.length && isThemeDevelopment()) {
    console.warn(`Tour "${input.id}" repeats a step id. The tour keeps the first and drops the rest.`);
  }
  return {
    id: input.id,
    version: input.version ?? 1,
    steps,
    content: input.content ?? {},
    targetTimeoutMs: input.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS,
    priority: input.priority ?? 0,
  };
}

/**
 * The key that names one step of one tour, `"<tourId>.<stepId>"`. A `data-tour-step` attribute holds
 * one or more such keys.
 *
 * @param tourId - The tour's id.
 * @param stepId - The step's id.
 * @returns The key.
 */
export function tourStepKey(tourId: string, stepId: string): string {
  return `${tourId}.${stepId}`;
}
