"use client";

import type { ReactElement, ReactNode } from "react";

import { useRender } from "@base-ui/react/use-render";

import type { TourDefinition } from "./tour-definition";
import { useTourStep } from "./tour-provider";

/**
 * Props for `Tour.Target`, a `div`'s props and `render`.
 *
 * @template S - The tour's step ids.
 *
 * @beta
 */
export type TourTargetProps<S extends string> = Omit<useRender.ComponentProps<"div">, "title"> & {
  /** The tour the step belongs to. */
  tour: TourDefinition<S>;
  /** The step this element is the target of. */
  step: NoInfer<S>;
  /** The step's title, which names the popup. It overrides the definition's. */
  title?: ReactNode;
  /** The step's description. It overrides the definition's. */
  description?: ReactNode;
};

/**
 * The element a step points at. It registers the step while it is mounted, with the words beside
 * it, and writes `data-active` while the step is on screen. Pass `render` to make another element,
 * such as a `Card.Root`, the target.
 *
 * @beta
 */
export function TourTarget<S extends string>({
  tour,
  step,
  title,
  description,
  render,
  ref,
  ...props
}: TourTargetProps<S>): ReactElement {
  const words = title === undefined && description === undefined ? undefined : { title, description };
  const binding = useTourStep(tour, step, words);
  return useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? binding.ref : [binding.ref, ref],
    props: {
      "data-slot": "tour-target",
      "data-active": binding.active ? "" : undefined,
      ...props,
    },
  });
}
