"use client";

import { useLayoutEffect } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import type { BaseUIEvent } from "@base-ui/react/types";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDown } from "../../icons/generated/caret-down";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { CaretUp } from "../../icons/generated/caret-up";
import { Pause } from "../../icons/generated/pause";
import { Play } from "../../icons/generated/play";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { IconButtonProps, IconButtonSize } from "../button/button";
import { useCarouselContext, useCarouselSnapshot } from "./carousel-context";
import { carouselVariants } from "./carousel-variants";
import { carouselStrings } from "./intl";

/** `Carousel.Controls` takes a `div`'s props plus Base UI's `render`. */
export type CarouselControlsProps = useRender.ComponentProps<"div">;

/** The props of an icon Button a Carousel control renders, which names itself. */
type CarouselIconButtonProps = Omit<IconButtonProps, "aria-label" | "size" | "children"> & {
  /** The accessible name. Defaults to the locale dictionary. */
  "aria-label"?: string;
  /** Button's square size. Defaults to `"icon-sm"`, 36px at comfortable density. */
  size?: IconButtonSize;
  /** The icon. Defaults to a caret that points along the carousel's axis. */
  children?: ReactNode;
};

/** `Carousel.Previous` takes Button's props, named and sized for an icon. */
export type CarouselPreviousProps = CarouselIconButtonProps;

/** `Carousel.Next` takes Button's props, named and sized for an icon. */
export type CarouselNextProps = CarouselIconButtonProps;

/** `Carousel.Indicators` takes a `div`'s props plus Base UI's `render`. */
export type CarouselIndicatorsProps = useRender.ComponentProps<"div">;

/** `Carousel.Indicator` takes a `button`'s props, Base UI's `render` and the page it shows. */
export type CarouselIndicatorProps = Omit<useRender.ComponentProps<"button">, "onClick"> & {
  /** The page, from 0, the indicator shows and scrolls to. */
  index: number;
  /**
   * Runs before the indicator scrolls to its page. `event.preventBaseUIHandler()` cancels that,
   * as on Base UI's own parts.
   */
  onClick?: (event: BaseUIEvent<MouseEvent<HTMLButtonElement>>) => void;
};

/** `Carousel.Status` takes a `div`'s props plus Base UI's `render`. */
export type CarouselStatusProps = useRender.ComponentProps<"div">;

/** `Carousel.Autoplay` takes Button's props, sized for an icon, and the rotation's delay. */
export type CarouselAutoplayProps = Omit<IconButtonProps, "aria-label" | "size" | "children"> & {
  /** How long each page shows, in ms, before rotation advances. Mounting the part is the opt-in. */
  delay: number;
  /** The name while the pages do not rotate. Defaults to the locale dictionary. */
  startLabel?: string;
  /** The name while the pages rotate. Defaults to the locale dictionary. */
  stopLabel?: string;
  /** Button's square size. Defaults to `"icon-sm"`, as Previous and Next. */
  size?: IconButtonSize;
};

const styles = carouselVariants();

/**
 * The Button props a control merges with the consumer's: everything but the square size and the
 * name, which the control passes on their own so the icon-button union still checks them.
 */
type MergedButton = (props: Omit<IconButtonProps, "size" | "aria-label" | "children">) => ReactElement;

/**
 * The two edges differ by their icons, their name and their step, so `Carousel.Previous` and
 * `Carousel.Next` are one component parameterised by direction.
 */
const EDGES = {
  previous: {
    slot: "carousel-previous",
    step: -1,
    labelKey: "previous",
    horizontal: CaretLeft,
    vertical: CaretUp,
  },
  next: { slot: "carousel-next", step: 1, labelKey: "next", horizontal: CaretRight, vertical: CaretDown },
} as const;

/**
 * The row the controls sit in: Previous, the indicators and Next, centred with the surface gap
 * between them, and an `Autoplay` first when the pages rotate. It is layout only.
 */
export function CarouselControls({ className, render, ...props }: CarouselControlsProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "carousel-controls",
      ...mergeProps<"div">({ className: cn(styles.controls(), className) }, props),
    },
  });
}

function CarouselEdge({
  direction,
  className,
  size = "icon-sm",
  "aria-label": ariaLabel,
  children,
  ...props
}: CarouselIconButtonProps & { direction: keyof typeof EDGES }): ReactElement {
  const edge = EDGES[direction];
  const { state, meta, wiring } = useCarouselContext(
    direction === "previous" ? "Carousel.Previous" : "Carousel.Next"
  );
  const strings = useLocalizedStrings(carouselStrings);
  const Icon = edge[meta.orientation];
  const can = direction === "previous" ? state.canPrevious : state.canNext;

  return (
    <Button
      data-slot={edge.slot}
      // The consumer's props merge after the defaults, so its `onClick` runs first and
      // `event.preventBaseUIHandler()` there cancels the page change. The class stays out of the
      // merge, which would put the consumer's classes before the part's.
      {...mergeProps<MergedButton>(
        {
          variant: "outline",
          // Disabled at its end, and still focusable there, so focus that pressed Next onto the
          // last page stays on the button instead of falling back to the document.
          disabled: !can,
          focusableWhenDisabled: true,
          onClick: () => wiring.navigate(state.index + edge.step, direction),
        },
        definedProps(props)
      )}
      size={size}
      aria-label={ariaLabel ?? strings.format(edge.labelKey)}
      className={cn(styles.edge(), className)}>
      {children ?? (
        <Icon aria-hidden="true" className={carouselVariants({ orientation: meta.orientation }).edgeIcon()} />
      )}
    </Button>
  );
}

/** Scrolls to the previous page. It is disabled, and stays focusable, on the first page. */
export function CarouselPrevious(props: CarouselPreviousProps): ReactElement {
  return <CarouselEdge direction="previous" {...props} />;
}

/** Scrolls to the next page. It is disabled, and stays focusable, on the last page. */
export function CarouselNext(props: CarouselNextProps): ReactElement {
  return <CarouselEdge direction="next" {...props} />;
}

/**
 * The slide picker: a `group` named "Choose slide to display" in the locale. With no children it
 * renders one `Carousel.Indicator` per page, so the dots follow the layout. Map your own
 * `Carousel.Indicator`s inside it for thumbnails.
 */
export function CarouselIndicators({
  className,
  render,
  children,
  ...props
}: CarouselIndicatorsProps): ReactElement {
  const { state } = useCarouselContext("Carousel.Indicators");
  const strings = useLocalizedStrings(carouselStrings);
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "carousel-indicators",
      ...mergeProps<"div">(
        {
          role: "group",
          "aria-label": strings.format("indicators"),
          className: cn(styles.indicators(), className),
          children:
            children ??
            Array.from({ length: state.pageCount }, (_, page) => (
              <CarouselIndicator key={page} index={page} />
            )),
        },
        definedProps(props)
      ),
    },
  });
}

/**
 * One page's button in the slide picker. Without children it draws the design's mark, a dot that
 * becomes a pill on the current page, inside a 24px target, and is named after the first slide on
 * its page, such as "Slide 3 of 6". With children, such as a thumbnail, it draws only the focus
 * ring around them, keeps a 24px target however small they are, and the children name it. Its
 * `onClick` runs first, and `event.preventBaseUIHandler()` there keeps the page.
 *
 * The current page's indicator is `aria-disabled`, as APG's grouped carousel asks, so a screen
 * reader hears that it would do nothing and it stays in the tab order. It also carries
 * `data-current` for styling.
 */
export function CarouselIndicator({
  index,
  className,
  render,
  children,
  ...props
}: CarouselIndicatorProps): ReactElement {
  const { state, wiring } = useCarouselContext("Carousel.Indicator");
  const snapshot = useCarouselSnapshot();
  const strings = useLocalizedStrings(carouselStrings);
  const current = state.index === index;
  const slide = snapshot?.pages.leadingSlides[index] ?? index;
  const label =
    children === undefined
      ? strings.format("indicator", { position: slide + 1, count: snapshot?.slides.length ?? 0 })
      : undefined;

  return useRender({
    defaultTagName: "button",
    render,
    props: {
      "data-slot": "carousel-indicator",
      // `type="button"` is a default here, because Base UI gives it only to its fallback tag. The
      // consumer's props are filtered, as Card.SectionButton filters, so a forwarded
      // `type={undefined}` cannot erase it, nor `undefined` the current page's state. They merge
      // after the defaults, so the consumer's `onClick` runs first and can cancel the page change.
      ...mergeProps<"button">(
        {
          type: "button",
          ...definedProps({
            "aria-label": label,
            "aria-disabled": current ? "true" : undefined,
            "data-current": current ? "" : undefined,
          }),
          className: cn(children === undefined ? styles.indicator() : styles.indicatorContent(), className),
          children,
          onClick: () => wiring.navigate(index, "indicator"),
        },
        definedProps(props)
      ),
    },
  });
}

/**
 * The visible page count, such as "3 of 6" in the locale, for carousels with many pages or in
 * place of the indicators. It announces a page change politely, and stays silent while the pages
 * rotate. Before the viewport is measured it is empty. Children replace the text.
 */
export function CarouselStatus({ className, render, children, ...props }: CarouselStatusProps): ReactElement {
  const { state, wiring } = useCarouselContext("Carousel.Status");
  const strings = useLocalizedStrings(carouselStrings);
  const text =
    state.pageCount === 0
      ? null
      : strings.format("status", { position: state.index + 1, count: state.pageCount });
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "carousel-status",
      ...mergeProps<"div">(
        {
          "aria-live": wiring.live,
          "aria-atomic": true,
          className: cn(styles.status(), className),
          children: children ?? text,
        },
        definedProps(props)
      ),
    },
  });
}

/**
 * Automatic rotation, and the APG rotation control that starts and stops it. Mounting it is the
 * opt-in, and `delay` has no default. The button's name says what pressing it does, "Stop
 * automatic slide show" or "Start automatic slide show", so it carries no `aria-pressed`. Place
 * it first in `Carousel.Controls` and put the controls before the Viewport in the source, so it
 * precedes the rotating content in the tab order; `className="order-last"` on the controls still
 * shows the row below the slides.
 *
 * Rotation starts on mount, unless the user prefers reduced motion. Keyboard focus on any element
 * in the carousel, this button included, stops it, as the APG pattern asks, and so does any swipe,
 * drag, wheel turn or press of another control; only this button starts it again. Once the user
 * presses it to start rotation, keyboard focus and hover no longer stop or pause it, so it keeps
 * running with focus on this button, until it is pressed again. Until then it pauses while a mouse
 * or pen is over the carousel. It pauses while the document is hidden. A new `delay` keeps the
 * user's choice to play or stop. It advances from the last page back to the first. Mounted with
 * the Root or after it, it starts from what is already so: paused under a mouse or pen already
 * over the carousel, even since before the page hydrated, and stopped with keyboard focus already
 * inside it, as an `autoFocus` field in a slide takes. Keyboard focus inside a custom element's
 * open shadow root counts as focus in the carousel. Focus that a mouse press moved in does not
 * stop it.
 */
export function CarouselAutoplay({
  delay,
  startLabel,
  stopLabel,
  className,
  size = "icon-sm",
  ...props
}: CarouselAutoplayProps): ReactElement {
  const { state, actions, wiring } = useCarouselContext("Carousel.Autoplay");
  const strings = useLocalizedStrings(carouselStrings);
  const { mountAutoplay, setAutoplayDelay } = wiring;

  // Mounting resets the user's choice; a new delay keeps it, so a stopped carousel stays stopped.
  useLayoutEffect(() => mountAutoplay(), [mountAutoplay]);
  useLayoutEffect(() => setAutoplayDelay(delay), [setAutoplayDelay, delay]);

  return (
    <Button
      data-slot="carousel-autoplay"
      // The consumer's props merge after the defaults, so its `onClick` runs first and
      // `event.preventBaseUIHandler()` there cancels the toggle.
      {...mergeProps<MergedButton>(
        { variant: "outline", onClick: state.rotating ? actions.stop : actions.play },
        definedProps(props)
      )}
      size={size}
      aria-label={
        state.rotating
          ? (stopLabel ?? strings.format("stopRotation"))
          : (startLabel ?? strings.format("startRotation"))
      }
      className={cn(styles.edge(), className)}>
      {state.rotating ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </Button>
  );
}

CarouselControls.displayName = "Carousel.Controls";
CarouselPrevious.displayName = "Carousel.Previous";
CarouselNext.displayName = "Carousel.Next";
CarouselIndicators.displayName = "Carousel.Indicators";
CarouselIndicator.displayName = "Carousel.Indicator";
CarouselStatus.displayName = "Carousel.Status";
CarouselAutoplay.displayName = "Carousel.Autoplay";
