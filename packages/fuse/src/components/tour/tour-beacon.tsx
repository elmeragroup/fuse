"use client";

import type { ComponentProps, ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { useCalendarSelector } from "../calendar/calendar-store";
import { tourStrings } from "./intl";
import type { TourDefinition } from "./tour-definition";
import { composeClick } from "./tour-parts";
import { useTourController, useTourStep } from "./tour-provider";
import { tourStateOf } from "./tour-session";
import { tourVariants } from "./tour-variants";

const slots = tourVariants();

/**
 * Props for `Tour.Beacon`, a native `button`'s props.
 *
 * @template S - The tour's step ids.
 *
 * @beta
 */
export type TourBeaconProps<S extends string> = Omit<ComponentProps<"button">, "children"> & {
  /** The tour the beacon starts, usually a tour of one step. */
  tour: TourDefinition<S>;
  /** The step the beacon is the element of. Defaults to the tour's first step. */
  step?: NoInfer<S>;
  /** The beacon's accessible name. Defaults to the locale dictionary's "Show tip". */
  "aria-label"?: string;
};

/**
 * A small pulsing dot that starts a tour when pressed, for a tip beside a feature. It is the
 * element of the tour's step, so the popup points at it. It renders nothing until storage answers
 * and nothing once the tour is completed or dismissed, so a finished tip never flashes. The pulse
 * runs three times and only with motion allowed.
 *
 * @beta
 */
export function TourBeacon<S extends string>({
  tour,
  step,
  className,
  onClick,
  "aria-label": label,
  ref: consumerRef,
  ...props
}: TourBeaconProps<S>): ReactElement | null {
  const controller = useTourController();
  const strings = useLocalizedStrings(tourStrings);
  const stepId = step ?? tour.steps[0];
  // A tour with no steps shows no beacon, and its empty registration names no step.
  const { ref: registrationRef } = useTourStep<string>(tour, stepId ?? "");
  const ref = useMergedRefs<HTMLButtonElement>(registrationRef, consumerRef);
  const state = useCalendarSelector(controller.store, (session) => tourStateOf(session, tour.id));
  if (stepId === undefined || state === "unknown" || state === "completed" || state === "dismissed") {
    return null;
  }
  return (
    <Button
      ref={ref}
      data-slot="tour-beacon"
      variant="ghost"
      size="icon-sm"
      aria-label={label ?? strings.format("beacon")}
      aria-haspopup="dialog"
      aria-expanded={state === "active"}
      className={cn(slots.beacon(), className)}
      {...definedProps(props)}
      onClick={composeClick(onClick, () => {
        if (state !== "active") {
          controller.start(tour, { origin: "user", at: stepId });
        }
      })}>
      <span aria-hidden="true" className={slots.beaconPulse()} />
      <span aria-hidden="true" className={slots.beaconDot()} />
    </Button>
  );
}
