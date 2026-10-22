/**
 * How the spec builder handled each compiled declaration of a recipe class. The coverage
 * table answers how much of a recipe reaches Figma, and lists every declaration that does
 * not, so a missing mapping shows up instead of disappearing.
 */

/**
 * - `bound`: the value binds a Fuse variable.
 * - `literal`: the value becomes a fixed number or color.
 * - `dropped`: Figma has no form for it, such as a cursor or a transition, or no variant of
 *   the matrix represents its state.
 * - `unmapped`: the builder has no mapping for it yet.
 */
export type CoverageOutcome = "bound" | "literal" | "dropped" | "unmapped";

/** One declaration of one recipe class, with what the builder did with it. */
export type CoverageRow = {
  readonly component: string;
  /**
   * The layer name of the part whose classes hold the declaration: the root's `data-slot`, or a
   * part's. A declaration a part inherits keeps the part that set it.
   */
  readonly part: string;
  readonly className: string;
  readonly property: string;
  readonly value: string;
  readonly outcome: CoverageOutcome;
  /** The variable it binds, the literal it became, or why it was dropped or left unmapped. */
  readonly detail: string;
};
