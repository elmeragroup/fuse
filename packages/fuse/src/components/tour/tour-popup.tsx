"use client";

import { Component, createContext, use, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { definedProps } from "../../internal/defined-props";
import { isHTMLElement } from "../../internal/dom-node";
import { mergeClassName } from "../../styles/merge-class-name";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { createCalendarStore, useCalendarStateField } from "../calendar/calendar-store";
import type { CalendarStore } from "../calendar/calendar-store";
import { overlayPositionerClass, overlaySpotlightBackdropClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { TourController } from "./tour-controller";
import { TourCutout } from "./tour-cutout";
import { tourStepKey } from "./tour-definition";
import type { TourDefinition } from "./tour-definition";
import { useTourController } from "./tour-provider";
import type { TourShownStep } from "./tour-session";
import { tourVariants } from "./tour-variants";

const slots = tourVariants();

/** The registration-only parts mounted in a popup, which change what the popup renders. */
export type TourPopupParts = {
  /** The mounted `Tour.Spotlight`'s padding, or `null` while none is mounted. */
  readonly spotlight: { readonly padding: number } | null;
  /** How many `Tour.Close` parts are mounted. */
  readonly closes: number;
};

/** What the parts inside a `Tour.Popup` read. */
type TourPopupContextValue = {
  readonly controller: TourController;
  readonly tour: TourDefinition;
  /** The step on screen, or the last one while the popup closes. */
  readonly view: TourShownStep;
  /** The parts that register with the popup. */
  readonly parts: CalendarStore<TourPopupParts>;
};

const TourPopupContext = createContext<TourPopupContextValue | null>(null);

let warnedOutsidePopup = false;

/**
 * The popup's context for a part, or `null` outside a `Tour.Popup`, where the part renders nothing.
 * The first part outside a popup warns once in development, as hooks outside a Provider do.
 *
 * @returns The context, or `null`.
 */
export function useTourPopup(): TourPopupContextValue | null {
  const popup = use(TourPopupContext);
  useEffect(() => {
    if (popup === null && !warnedOutsidePopup && isThemeDevelopment()) {
      warnedOutsidePopup = true;
      console.warn("Tour: a tour part rendered outside Tour.Popup, so it renders nothing.");
    }
  }, [popup]);
  return popup;
}

type BoundaryProps = {
  readonly resetKey: string;
  readonly onError: (error: Error) => void;
  readonly children: ReactNode;
};

type BoundaryState = { readonly key: string; readonly failed: boolean };

/**
 * Keeps a throwing part from reaching the page. The run ends as `error` and the popup renders
 * nothing until another step shows, so a part that throws on every render cannot loop.
 */
class TourBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { key: this.props.resetKey, failed: false };

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): BoundaryState | null {
    if (props.resetKey === state.key) {
      return null;
    }
    // The run ending clears the key; only a new step clears the failure.
    return { key: props.resetKey, failed: state.failed && props.resetKey === "" };
  }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

type VirtualAnchor = {
  readonly getBoundingClientRect: () => DOMRect;
  readonly contextElement?: Element;
};

/**
 * The popup's anchor for a step. A step with an element follows it, and keeps its last box once the
 * element leaves the page, so a route change between steps does not move the popup. A centered step
 * anchors to a point in the upper middle of the viewport.
 */
function stepAnchor(element: Element | null): VirtualAnchor {
  if (element === null) {
    return {
      getBoundingClientRect: () => new DOMRect(window.innerWidth / 2, window.innerHeight * 0.3, 0, 0),
    };
  }
  let last = element.getBoundingClientRect();
  return {
    getBoundingClientRect: () => {
      if (element.isConnected) {
        last = element.getBoundingClientRect();
      }
      return last;
    },
    contextElement: element,
  };
}

/**
 * Whether `target` keeps the Arrow keys for itself: any `input`, a `textarea`, a `select`, a
 * `role="textbox"` element or editable content, where the keys move a caret or a value. It is wider
 * than `internal/text-entry.ts`'s `isTextEntry`, which leaves out `select` and the input types that
 * take no typed text, `range` and `radio` among them. It checks the node against its own realm's
 * `HTMLElement`, through `isHTMLElement`.
 */
function ownsArrowKeys(target: EventTarget | null): boolean {
  return (
    isHTMLElement(target) &&
    (target.isContentEditable || target.matches("input, textarea, select, [role=textbox]"))
  );
}

/**
 * Props for `Tour.Popup`, Base UI's popover popup props and the positioner props.
 *
 * @beta
 */
export type TourPopupProps = ComponentProps<typeof PopoverPrimitive.Popup> & {
  /** The tour whose steps the popup shows. A popup shows nothing for another tour's run. */
  tour: TourDefinition;
  /** The side of the step's element the popup opens on. */
  side?: ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  /** How the popup lines up with the step's element along that side. */
  align?: ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
  /** The gap between the step's element and the popup, in pixels. */
  sideOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>["sideOffset"];
  /** The popup's shift along the side it opens on, in pixels. */
  alignOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>["alignOffset"];
  /**
   * The element the popup renders into. Defaults to the nearest enclosing `ThemeScope` element, so
   * the popup keeps the theme of the place the tour runs in.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
  /**
   * Whether the popup holds focus and blocks the page. Leave it `false` for a coachmark, which
   * keeps the page usable: a press outside the popup and focus leaving it do not end the run.
   * Pass `"trap-focus"` with a `Tour.Spotlight`, and put a `Tour.Close` in the popup, so Base UI
   * holds focus in the popup while the dim blocks the page.
   */
  modal?: ComponentProps<typeof PopoverPrimitive.Root>["modal"];
  /**
   * The space the popup keeps from the viewport edge, in pixels. Pass an object, such as
   * `{ top: 64 }`, to clear a sticky header. Defaults to Base UI's `5`.
   */
  collisionPadding?: ComponentProps<typeof PopoverPrimitive.Positioner>["collisionPadding"];
  /** How the popup avoids the viewport edge: whether it flips or shifts, per axis. */
  collisionAvoidance?: ComponentProps<typeof PopoverPrimitive.Positioner>["collisionAvoidance"];
  /** The popup's parts, such as `Tour.Title`, `Tour.Description` and `Tour.Footer`. */
  children?: ReactNode;
};

/**
 * The popup a tour's run shows, anchored to the shown step's element. It is Base UI's labeled
 * `dialog`: `Tour.Title` names it and `Tour.Description` describes it. Escape ends the run, unless
 * another overlay, such as a tooltip, closes on the same press. The Arrow keys move between steps
 * while focus is on the popup and not in a text field, and the forward key does nothing on the last
 * step. When the run ends, focus returns to the element focused before the popup opened, unless the
 * user moved it.
 *
 * @beta
 */
export function TourPopup(props: TourPopupProps): ReactElement {
  const controller = useTourController();
  const { tour } = props;
  useLayoutEffect(() => {
    controller.register(tour);
  }, [controller, tour]);
  const shown = useCalendarStateField(controller.store, "shown");
  const mine = shown?.tourId === props.tour.id ? shown : null;
  return (
    <TourBoundary
      resetKey={mine === null ? "" : tourStepKey(mine.tourId, mine.stepId)}
      onError={(error) => {
        controller.fail(props.tour.id, error);
      }}>
      <TourPopupRoot controller={controller} shown={mine} {...props} />
    </TourBoundary>
  );
}

function TourPopupRoot({
  controller,
  shown,
  tour,
  modal = false,
  side = "bottom",
  align = "center",
  sideOffset = 12,
  alignOffset = 0,
  collisionPadding,
  collisionAvoidance,
  container,
  className,
  children,
  onKeyDown: consumerKeyDown,
  ...props
}: TourPopupProps & {
  readonly controller: TourController;
  readonly shown: TourShownStep | null;
}): ReactElement {
  // The parts keep showing the last step while the popup closes. React's pattern for a value from
  // an earlier render: the set re-renders this component before its children, and stops once equal.
  const [last, setLast] = useState(shown);
  if (shown !== null && shown !== last) {
    setLast(shown);
  }
  const view = shown ?? last;
  const [parts] = useState(() => createCalendarStore<TourPopupParts>({ spotlight: null, closes: 0 }));
  const spotlight = useCalendarStateField(parts, "spotlight");
  const target = view === null ? null : controller.targetOf(view);
  const anchor = useMemo(() => (view === null ? null : stepAnchor(target)), [view, target]);
  const context = useMemo(
    () => (view === null ? null : { controller, tour, view, parts }),
    [controller, tour, view, parts]
  );
  const centered = anchor !== null && anchor.contextElement === undefined;

  const onKeyDown: NonNullable<TourPopupProps["onKeyDown"]> = (event) => {
    consumerKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      ownsArrowKeys(event.target)
    ) {
      return;
    }
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    // On the last step the forward key does nothing: only Done, Skip, Close and Escape finish a tour.
    if (event.key === forward && view !== null && view.index < view.count - 1) {
      event.preventDefault();
      controller.next(tour);
    } else if (event.key === backward) {
      event.preventDefault();
      controller.prev(tour);
    }
  };

  return (
    <PopoverPrimitive.Root
      open={shown !== null}
      modal={modal}
      onOpenChange={(open, details) => {
        if (open) {
          return;
        }
        const { reason } = details;
        if (reason === "escape-key") {
          // Escape also reaches overlays that hold no focus, such as a tooltip the pointer opened, and
          // a Base UI overlay that closes on it marks the keydown handled. The popup holds its own
          // close until the keydown's other listeners ran, and ends the run only when none handled it,
          // so one Escape never closes a tooltip and turns the tour down for good.
          details.cancel();
          const { event } = details;
          setTimeout(() => {
            if (!event.defaultPrevented) {
              controller.end(tour, reason);
            }
          }, 0);
          return;
        }
        // Under a spotlight the backdrop takes every press outside the popup, the lit hole included,
        // and the press ends the run without a status. Around a coachmark, a press outside the popup
        // and focus leaving it keep the run going, so the page stays usable.
        if (reason === "close-press" || (reason === "outside-press" && parts.get().spotlight !== null)) {
          controller.end(tour, reason);
        } else {
          details.cancel();
        }
      }}>
      {context === null ? null : (
        <OverlayPortal portal={PopoverPrimitive.Portal} container={container}>
          {spotlight === null ? null : (
            <PopoverPrimitive.Backdrop data-slot="tour-backdrop" className={overlaySpotlightBackdropClass}>
              <TourCutout element={target} padding={spotlight.padding} />
            </PopoverPrimitive.Backdrop>
          )}
          <PopoverPrimitive.Positioner
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={centered ? 0 : sideOffset}
            anchor={anchor}
            {...definedProps({ collisionPadding, collisionAvoidance })}
            className={overlayPositionerClass}>
            <PopoverPrimitive.Popup
              data-slot="tour-popup"
              data-placement={centered ? "center" : "target"}
              className={mergeClassName(className, slots.popup())}
              {...definedProps(props)}
              onKeyDown={onKeyDown}>
              <TourPopupContext value={context}>{children}</TourPopupContext>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </OverlayPortal>
      )}
    </PopoverPrimitive.Root>
  );
}
