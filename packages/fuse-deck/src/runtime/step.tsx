import { createContext, use } from "react";
import type { ReactNode } from "react";

/** How many of the current slide's steps are revealed. */
export const RevealedSteps = createContext(0);

/** The props the compile pass gives a `<Step>`. */
export type StepProps = {
  /**
   * The step's ordinal in its slide, from 1, as the compile pass writes it. The pass fails a slide
   * with a `<Step>` it cannot number, so every step that renders has one.
   */
  readonly index: string;
  /** Set by the compile pass for a step inside a paragraph. */
  readonly inline?: boolean;
  readonly children?: ReactNode;
};

/**
 * Content revealed one key press at a time. An unrevealed step keeps its space, is hidden, and is
 * inert, so it takes no focus and assistive technology skips it.
 */
export function Step({ index, inline, children }: StepProps) {
  const revealed = use(RevealedSteps) >= Number(index);
  const Element = inline === true ? "span" : "div";
  return (
    <Element className="deck-step" data-revealed={revealed ? "" : undefined} inert={!revealed}>
      {children}
    </Element>
  );
}
