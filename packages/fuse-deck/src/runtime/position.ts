/**
 * Where the deck is: a slide and how many of its steps are revealed. Pure, so keyboard navigation,
 * deep links and history agree on one model.
 */

/** A slide as navigation sees it. */
export type NavigableSlide = {
  /** The slide's id, which deep links name. */
  readonly id: string;
  /** How many steps the slide has. */
  readonly steps: number;
};

/** The deck's position. `step` 0 shows no step; `steps` shows them all. */
export type Position = {
  /** The slide's index in the order. */
  readonly slide: number;
  /** How many of the slide's steps are revealed. */
  readonly step: number;
};

/**
 * The position a URL hash names: `#/<id>` or `#/<id>/<step>`. An unknown id gives the first slide
 * and a step past the last gives the last.
 *
 * @param hash - `location.hash`.
 * @param slides - The deck's slides.
 * @returns The position.
 */
export function fromHash(hash: string, slides: readonly NavigableSlide[]): Position {
  const [, id, step] = /^#\/([^/]+)(?:\/(\d+))?$/.exec(hash) ?? [];
  const slide = Math.max(
    0,
    slides.findIndex((each) => each.id === id)
  );
  const steps = slides[slide]?.steps ?? 0;
  return { slide, step: Math.min(steps, Number(step ?? 0)) };
}

/**
 * The hash that names a position.
 *
 * @param position - The position.
 * @param slides - The deck's slides.
 * @returns `#/<id>` at step 0, `#/<id>/<step>` after.
 */
export function toHash(position: Position, slides: readonly NavigableSlide[]): string {
  const id = slides[position.slide]?.id ?? "";
  return position.step === 0 ? `#/${id}` : `#/${id}/${String(position.step)}`;
}

/** A move the keyboard asks for. */
export type Move = "next" | "previous" | "first" | "last";

/**
 * The position after a move. `next` reveals the next step, then goes to the next slide; `previous`
 * hides the last revealed step, then goes to the previous slide with all its steps revealed.
 *
 * @param position - Where the deck is.
 * @param move - The move.
 * @param slides - The deck's slides.
 * @returns The new position, the same one at either end.
 */
export function moveTo(position: Position, move: Move, slides: readonly NavigableSlide[]): Position {
  const last = slides.length - 1;
  const stepsOf = (slide: number) => slides[slide]?.steps ?? 0;
  switch (move) {
    case "next":
      if (position.step < stepsOf(position.slide)) {
        return { slide: position.slide, step: position.step + 1 };
      }
      return position.slide < last ? { slide: position.slide + 1, step: 0 } : position;
    case "previous":
      if (position.step > 0) {
        return { slide: position.slide, step: position.step - 1 };
      }
      return position.slide > 0 ? { slide: position.slide - 1, step: stepsOf(position.slide - 1) } : position;
    case "first":
      return { slide: 0, step: 0 };
    case "last":
      return { slide: Math.max(0, last), step: stepsOf(Math.max(0, last)) };
  }
}

/**
 * The move a key asks for, or none for a key the deck leaves alone.
 *
 * @param event - The key and its modifiers.
 * @returns The move.
 */
export function moveForKey(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}): Move | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case "Enter":
      return "next";
    case " ":
      return event.shiftKey ? "previous" : "next";
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}
