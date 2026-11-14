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
export type CarouselControlsProps = Omit<useRender.ComponentProps<"div">, "children"> & {
  /**
   * The controls, in this order: `Carousel.Previous`, `Carousel.Indicators` or `Carousel.Status`,
   * and `Carousel.Next`. With `Carousel.Autoplay`, put it first, and put the controls before the
   * `Carousel.Viewport` in the source, so the rotation control comes before the rotating content
   * in the tab order. `className="order-last"` on the controls still shows the row below the
   * slides.
   */
  children?: useRender.ComponentProps<"div">["children"];
};

/** The props of an icon Button a Carousel control renders, which names itself. */
type CarouselIconButtonProps = Omit<IconButtonProps, "aria-label" | "size" | "children" | "onClick"> & {
  /** The accessible name. Unset, it comes from the locale dictionary. */
  "aria-label"?: string;
  /** Button's square size. `icon-sm` is 36px at comfortable density. */
  size?: IconButtonSize;
  /** The icon. Unset, it is a caret that points along the carousel's axis. */
  children?: ReactNode;
  /**
   * Runs before the control changes the page, and `event.preventBaseUIHandler()` there cancels
   * the change. The pages do not loop, so Previous is disabled on the first page and Next on the
   * last. Both stay focusable there, so focus that pressed Next onto the last page stays on Next.
   */
  onClick?: IconButtonProps["onClick"];
};

/** `Carousel.Previous` takes Button's props, named and sized for an icon. */
export type CarouselPreviousProps = CarouselIconButtonProps;

/** `Carousel.Next` takes Button's props, named and sized for an icon. */
export type CarouselNextProps = CarouselIconButtonProps;

/** `Carousel.Indicators` takes a `div`'s props plus Base UI's `render`. */
export type CarouselIndicatorsProps = Omit<useRender.ComponentProps<"div">, "children"> & {
  /**
   * The indicators. Unset, the picker renders one `Carousel.Indicator` per page, so the dots
   * follow the layout. Map your own `Carousel.Indicator`s here to pick slides by thumbnail.
   */
  children?: useRender.ComponentProps<"div">["children"];
};

/** `Carousel.Indicator` takes a `button`'s props, Base UI's `render` and the page it shows. */
export type CarouselIndicatorProps = Omit<useRender.ComponentProps<"button">, "onClick" | "children"> & {
  /**
   * The page, from 0, the indicator shows and scrolls to. The current page's indicator is
   * `aria-disabled`, as APG's grouped carousel asks, and stays in the tab order. It also carries
   * `data-current`.
   */
  index: number;
  /**
   * The indicator's content, such as a thumbnail. Unset, it is a dot that becomes a pill on the
   * current page, named after the first slide on its page, such as "Slide 3 of 6". With
   * children, it draws only the focus ring and keeps a 24px target however small they are. Style
   * them for the current page with the `in-data-current:` variant, and name the indicator with
   * `aria-label` when they have no text. The dot grows into the pill with a transition, which
   * reduced motion turns off.
   */
  children?: useRender.ComponentProps<"button">["children"];
  /**
   * Runs before the indicator scrolls to its page. `event.preventBaseUIHandler()` cancels that,
   * as on Base UI's own parts.
   */
  onClick?: (event: BaseUIEvent<MouseEvent<HTMLButtonElement>>) => void;
};

/** `Carousel.Status` takes a `div`'s props plus Base UI's `render`. */
export type CarouselStatusProps = Omit<useRender.ComponentProps<"div">, "children"> & {
  /**
   * The text. Unset, it is the page count, such as "3 of 12" in the locale. Use the status in
   * place of the indicators when there are many pages. It announces each page change politely,
   * stays silent while the pages rotate, and is empty until the viewport is measured.
   */
  children?: useRender.ComponentProps<"div">["children"];
};

/** `Carousel.Autoplay` takes Button's props, sized for an icon, and the rotation's delay. */
export type CarouselAutoplayProps = Omit<IconButtonProps, "aria-label" | "size" | "children" | "onClick"> & {
  /**
   * How long each page shows, in ms, before rotation moves on. Mounting the part turns rotation
   * on, and it starts on mount unless the user prefers reduced motion. From the last page it goes
   * back to the first. While the pages rotate, the slides' live region is silent. A new `delay`
   * keeps whether the user stopped it.
   *
   * Keyboard focus on any element in the carousel stops rotation, this button included, as the
   * APG pattern asks. So does a swipe, a drag that snaps back, a wheel turn or a press of another
   * control. Keyboard focus in a slide's portal, such as a popover's field, also in a same-origin
   * frame, or inside a custom element's open shadow root counts as focus in the carousel. Focus
   * that a mouse press moved in does not stop it. Rotation pauses while a mouse or pen is over the
   * carousel and while the document is hidden.
   *
   * Mounted with the Root or later, it starts from what is already so. It is paused under a mouse
   * or pen already over the carousel, even since before the page hydrated on a device whose main
   * pointer can hover. It is stopped with keyboard focus already inside it, as with an `autoFocus`
   * field in a slide.
   */
  delay: number;
  /**
   * The button's name while the pages do not rotate. Unset, it comes from the locale dictionary,
   * "Start automatic slide show" in English.
   */
  startLabel?: string;
  /**
   * The button's name while the pages rotate. Unset, it comes from the locale dictionary, "Stop
   * automatic slide show" in English.
   */
  stopLabel?: string;
  /** Button's square size, as on Previous and Next. */
  size?: IconButtonSize;
  /**
   * Runs before the button starts or stops rotation, and `event.preventBaseUIHandler()` there
   * cancels it. Only this button starts rotation again after it stops. Once the user presses it to
   * start, keyboard focus and hover no longer stop or pause rotation until they press it again.
   */
  onClick?: IconButtonProps["onClick"];
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

/** The row the controls sit in, centred with the surface gap between them. It is layout only. */
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
  size,
  "aria-label": ariaLabel,
  children,
  ...props
}: CarouselIconButtonProps & { direction: keyof typeof EDGES; size: IconButtonSize }): ReactElement {
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
export function CarouselPrevious({ size = "icon-sm", ...props }: CarouselPreviousProps): ReactElement {
  return <CarouselEdge direction="previous" size={size} {...props} />;
}

/** Scrolls to the next page. It is disabled, and stays focusable, on the last page. */
export function CarouselNext({ size = "icon-sm", ...props }: CarouselNextProps): ReactElement {
  return <CarouselEdge direction="next" size={size} {...props} />;
}

/** The slide picker: a `group` named "Choose slide to display" in the locale. */
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

/** One page's button in the slide picker, inside a 24px target. */
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

/** The visible page count, such as "3 of 6" in the locale. */
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
 * Automatic rotation, and the APG rotation control that starts and stops it. The button's name
 * says what pressing it does, so it carries no `aria-pressed`.
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
