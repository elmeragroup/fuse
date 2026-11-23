import { Children, isValidElement, ViewTransition } from "react";
import type { ReactElement } from "react";

import { MORPH_NAME } from "../deck/vocabulary.ts";

/** The props a slide gives a `<Morph>`. */
export type MorphProps = {
  /** Pairs this element with the `<Morph>` of the same name on the next or previous slide. */
  readonly name: string;
  /** Exactly one HTML element, such as `<img>` or `<span>`, which travels between the two slides. */
  readonly children: ReactElement;
};

/**
 * One element that travels to its partner on the next slide. When the slide change removes a
 * `<Morph>` and inserts one with the same name, the element moves and resizes between them on the
 * in-out curve, for as long as the crossfade. A `<Morph>` without a partner fades with its slide.
 *
 * The slide compile rejects a literal name or child that breaks these rules; a name or child that
 * an expression computes is checked here, when the slide renders.
 */
export function Morph({ name, children }: MorphProps) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- MDX passes an expression's value through untyped; a number or array would otherwise coerce into a name
  if (typeof name !== "string" || !MORPH_NAME.test(name)) {
    throw new Error(
      `<Morph name=${JSON.stringify(name)}>: a name is a string of lowercase letters, digits and dashes, starting with a letter.`
    );
  }
  const [child, ...others] = Children.toArray(children);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- React types an HTML element by its tag name; a component's or a Fragment's type is not a string
  if (others.length > 0 || !isValidElement(child) || typeof child.type !== "string") {
    throw new Error(`<Morph name="${name}"> must wrap exactly one HTML element, such as <img> or <span>.`);
  }
  return (
    <ViewTransition name={`deck-morph-${name}`} default="none" share="morph">
      {child}
    </ViewTransition>
  );
}
