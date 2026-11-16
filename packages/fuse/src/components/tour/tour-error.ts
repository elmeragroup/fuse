// The error the tour reports to `onError` in place of throwing into the page. It holds no React,
// so the server-visible tour entry may export it.

/**
 * Where an error reported to `onError` came from.
 *
 * @beta
 */
export type TourErrorSource = "storage" | "part" | "callback" | "tour";

/**
 * An error the tour caught and reported to `onError`, in place of throwing into the page. `cause`
 * holds what was thrown.
 *
 * @beta
 */
export class TourError extends Error {
  /** The error's tag. */
  readonly _tag = "TourError" as const;

  /**
   * Creates the error.
   *
   * @param source - Where the error came from.
   * @param options - What was thrown, as `cause`.
   */
  constructor(
    /** Where the error came from. */
    readonly source: TourErrorSource,
    options: ErrorOptions
  ) {
    super(`The tour caught a ${source} error.`, options);
    this.name = "TourError";
  }
}
