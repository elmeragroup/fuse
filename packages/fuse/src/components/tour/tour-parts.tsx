"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Button } from "../button/button";
import { useCalendarStateField } from "../calendar/calendar-store";
import { OverlayCloseButton } from "../overlay/overlay-close-button";
import { tourStrings } from "./intl";
import { useTourPopup } from "./tour-popup";
import { useTourController } from "./tour-provider";
import { tourVariants } from "./tour-variants";

const slots = tourVariants();

/**
 * The top row of the popup, for `Tour.Progress` and `Tour.Close`.
 *
 * @beta
 */
export function TourHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="tour-header" className={cn(slots.header(), className)} {...props} />;
}

/**
 * The bottom row of the popup, for `Tour.Skip`, `Tour.Prev` and `Tour.Next`.
 *
 * @beta
 */
export function TourFooter({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="tour-footer" className={cn(slots.footer(), className)} {...props} />;
}

/**
 * The run's progress: a dot per step, the count such as "2 of 4", and a polite live region that
 * announces "Step 2 of 4" when the step changes. The dots and the count are hidden from assistive
 * technology, which hears the live region instead.
 *
 * @beta
 */
export function TourProgress({ className, ...props }: ComponentProps<"div">): ReactElement | null {
  const popup = useTourPopup();
  const strings = useLocalizedStrings(tourStrings);
  if (popup === null) {
    return null;
  }
  const { index, count } = popup.view;
  const vars = { current: index + 1, total: count };
  return (
    <div data-slot="tour-progress" className={cn(slots.progress(), className)} {...props}>
      <span aria-hidden="true" className={slots.dots()}>
        {Array.from({ length: count }, (_, at) => (
          <span key={at} className={slots.dot()} data-current={at === index ? "" : undefined} />
        ))}
      </span>
      <span aria-hidden="true">{strings.format("count", vars)}</span>
      <span aria-live="polite" className={slots.announcement()}>
        {strings.format("announcement", vars)}
      </span>
    </div>
  );
}

/**
 * Props for `Tour.Close`.
 *
 * @beta
 */
export type TourCloseProps = ComponentProps<typeof PopoverPrimitive.Close> & {
  /** The button's accessible name. Defaults to `overlay.close` from the locale dictionary. */
  label?: string;
};

/**
 * The button that ends the run as `close-press`, which turns the tour down for good. It is the
 * overlay families' ghost icon close button.
 *
 * @beta
 */
export function TourClose({ label, ...props }: TourCloseProps): ReactElement | null {
  // Base UI's Close throws outside a Popover Root, so the part renders nothing outside a popup.
  if (useTourPopup() === null) {
    return null;
  }
  return (
    <PopoverPrimitive.Close data-slot="tour-close" render={<OverlayCloseButton label={label} />} {...props} />
  );
}

function useShownWords(): { readonly title: ReactNode; readonly description: ReactNode } | null {
  const popup = useTourPopup();
  // `contentRev` changes when the shown step's registered words change, so the part reads them again.
  useCalendarStateField(useTourController().store, "contentRev");
  if (popup === null) {
    return null;
  }
  const words = popup.controller.wordsOf(popup.view.tourId, popup.view.stepId);
  return { title: words?.title, description: words?.description };
}

/**
 * The step's title, which names the popup. Its children replace the step's registered title.
 *
 * @beta
 */
export function TourTitle({
  className,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Title>): ReactElement | null {
  const words = useShownWords();
  if (words === null) {
    return null;
  }
  return (
    <PopoverPrimitive.Title
      data-slot="tour-title"
      className={mergeClassName(className, slots.title())}
      {...props}>
      {children ?? words.title}
    </PopoverPrimitive.Title>
  );
}

/**
 * The step's description, which describes the popup. Its children replace the step's registered
 * description. It renders nothing for a step with no description.
 *
 * @beta
 */
export function TourDescription({
  className,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Description>): ReactElement | null {
  const words = useShownWords();
  const text = children ?? words?.description;
  if (words === null || text === undefined || text === null) {
    return null;
  }
  return (
    <PopoverPrimitive.Description
      data-slot="tour-description"
      className={mergeClassName(className, slots.description())}
      {...props}>
      {text}
    </PopoverPrimitive.Description>
  );
}

/**
 * Props for `Tour.Skip`, `Tour.Prev` and `Tour.Next`: a native `button`'s props.
 *
 * @beta
 */
export type TourStepButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** The button's label. Defaults to the locale dictionary's. */
  children?: ReactNode;
};

/** Runs the consumer's `onClick`, then the part's action unless the consumer prevented the default. */
export function composeClick(
  onClick: TourStepButtonProps["onClick"],
  action: () => void
): NonNullable<TourStepButtonProps["onClick"]> {
  return (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      action();
    }
  };
}

/**
 * The button that turns the tour down for good, ending the run as `skip-press`. On the last step it
 * stays in place, looks disabled and does nothing, so focus never lands on a removed button.
 *
 * @beta
 */
export function TourSkip({
  children,
  className,
  onClick,
  ...props
}: TourStepButtonProps): ReactElement | null {
  const popup = useTourPopup();
  const strings = useLocalizedStrings(tourStrings);
  if (popup === null) {
    return null;
  }
  const { controller, tour, view } = popup;
  const last = view.index === view.count - 1;
  return (
    <Button
      data-slot="tour-skip"
      variant="ghost"
      size="sm"
      isVisuallyDisabled={last}
      className={cn(slots.skip(), className)}
      {...definedProps(props)}
      onClick={composeClick(onClick, () => {
        if (!last) {
          controller.end(tour, "skip-press");
        }
      })}>
      {children ?? strings.format("skip")}
    </Button>
  );
}

/**
 * The button that shows the previous step. On the first step it stays in place, looks disabled and
 * does nothing, so focus never lands on a removed button.
 *
 * @beta
 */
export function TourPrev({ children, onClick, ...props }: TourStepButtonProps): ReactElement | null {
  const popup = useTourPopup();
  const strings = useLocalizedStrings(tourStrings);
  if (popup === null) {
    return null;
  }
  const { controller, tour, view } = popup;
  const first = view.index === 0;
  return (
    <Button
      data-slot="tour-prev"
      variant="outline"
      size="sm"
      isVisuallyDisabled={first}
      {...definedProps(props)}
      onClick={composeClick(onClick, () => {
        if (!first) {
          controller.prev(tour);
        }
      })}>
      {children ?? strings.format("back")}
    </Button>
  );
}

/**
 * The button that shows the next step, labeled "Done" on the last step, where it completes the tour.
 * It stays mounted for the whole run, so focus on it survives a step change.
 *
 * @beta
 */
export function TourNext({ children, onClick, ...props }: TourStepButtonProps): ReactElement | null {
  const popup = useTourPopup();
  const strings = useLocalizedStrings(tourStrings);
  if (popup === null) {
    return null;
  }
  const { controller, tour, view } = popup;
  const last = view.index === view.count - 1;
  return (
    <Button
      data-slot="tour-next"
      size="sm"
      {...definedProps(props)}
      onClick={composeClick(onClick, () => {
        controller.next(tour);
      })}>
      {children ?? strings.format(last ? "done" : "next")}
    </Button>
  );
}
