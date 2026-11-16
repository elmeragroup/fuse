import { toastShellClass } from "../../styles/inner-corner/toast";
/**
 * The module-private slot recipe. The public entry does not export it, because no consumer has
 * needed to borrow it. Toast derives `status` from the toast's `type`. It is not a consumer prop
 * and not a control size.
 */
import { tv } from "../../styles/tv";
import { overlayPopupFillClass } from "../overlay/overlay-classes";

export const toastVariants = tv({
  slots: {
    // Each class string below sets one concern. The stack math assumes a bottom edge.
    root: [
      toastShellClass,
      // The toast fills the viewport column and sits on its bottom edge, with older toasts
      // layered beneath newer ones. `box-border` keeps the padding inside
      // the column when the host ships no preflight.
      "shadow-lg absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 box-border h-[var(--height)] w-full origin-bottom select-none",
      // The stack's variables. `--side` is the sign of the vertical math, and `1` stacks upward
      // from a bottom edge. Collapsed toasts shrink by `--scale` and show `--peek` past the one in
      // front. Expanded toasts sit `--gap` apart at Base UI's measured `--toast-offset-y`.
      "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc((var(--side)*((var(--toast-offset-y)*-1)+(var(--toast-index)*var(--gap)*-1)))+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [--side:1]",
      // A collapsed toast follows the swipe, then lifts by the peek and the height lost to
      // scaling, toward the far side of the stack.
      "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--side)*((var(--toast-index)*var(--peek))+(var(--shrink)*var(--height))))))_scale(var(--scale))] [transition:transform_0.2s_cubic-bezier(0.22,1,0.36,1),opacity_0.2s]",
      // An expanded toast has its full height at the measured offset. The `after:` strip covers
      // the gap to the next toast, so a pointer that crosses the gap does not collapse the stack.
      "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-[expanded]:h-[var(--toast-height)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))]",
      // A toast slides in from beyond the anchored edge and fades out. A toast pushed past the
      // limit fades, and a dismissal without a swipe slides back out the way it came.
      "data-[ending-style]:opacity-0 data-[limited]:opacity-0 data-[starting-style]:[transform:translateY(calc(var(--side)*150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(calc(var(--side)*150%))]",
      // Swipe exits continue the gesture 150% further in its direction, collapsed or
      // expanded. These follow the pointer, not the placement, so they need no sign.
      "data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
      // Top placements from `sm` up, as the viewport places them. `--side:-1` mirrors the stack
      // math and the enter and exit slide. This string flips what a sign cannot: the anchored
      // inset, the scale origin and the hover strip. Below `sm` they keep the bottom stack.
      "sm:data-[placement^=top]:top-0 sm:data-[placement^=top]:bottom-auto sm:data-[placement^=top]:origin-top sm:data-[placement^=top]:[--side:-1] sm:data-[placement^=top]:after:top-auto sm:data-[placement^=top]:after:bottom-full",
    ],
    content:
      "isolate flex flex-col gap-1 transition-opacity [transition-duration:250ms] data-[behind]:pointer-events-none data-[behind]:opacity-0 data-[expanded]:pointer-events-auto data-[expanded]:opacity-100",
    title: "font-medium leading-5",
    // The root sets `--toast-copy` per status, and the fallback keeps the neutral and
    // loading copy on `muted-foreground`. A consumer className still merges over
    // this slot, unlike an internal descendant selector.
    description: "leading-5 text-[var(--toast-copy,var(--muted-foreground))]",
    icon: "mt-0.5 size-4 shrink-0",
  },
  variants: {
    status: {
      // Toast takes the shared popup fill only, never the popup edge. It paints its own
      // hairline ring instead of the elevation and ring pair in `overlayPopupEdgeClass`,
      // which is why the two constants are separate.
      neutral: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
      },
      loading: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
        icon: "animate-spin",
      },
      // The focus ring is drawn flush, so on a status soft surface it takes that surface's
      // foreground, which the contrast matrix's text-grade pairs hold to 4.5:1 in every
      // theme and scheme. The neutral gray falls under 3:1 on the dark soft fills. This
      // overrides a brand-tuned `--ring` inside status toasts on purpose.
      error: {
        root: "bg-error-soft text-error-soft-foreground ring-1 ring-error/20 [--ring:var(--error-soft-foreground)] [--toast-copy:var(--error-soft-foreground)]",
        icon: "text-error",
      },
      info: {
        root: "bg-info-soft text-info-soft-foreground ring-1 ring-info/20 [--ring:var(--info-soft-foreground)] [--toast-copy:var(--info-soft-foreground)]",
        icon: "text-info",
      },
      success: {
        root: "bg-success-soft text-success-soft-foreground ring-1 ring-success/20 [--ring:var(--success-soft-foreground)] [--toast-copy:var(--success-soft-foreground)]",
        icon: "text-success",
      },
      warning: {
        root: "bg-warning-soft text-warning-soft-foreground ring-1 ring-warning/20 [--ring:var(--warning-soft-foreground)] [--toast-copy:var(--warning-soft-foreground)]",
        icon: "text-warning",
      },
    },
  },
  defaultVariants: {
    status: "neutral",
  },
});

/**
 * Module-private viewport recipe. Below `sm` the viewport sits at the bottom and spans the
 * screen minus a 1rem gutter whatever the placement; `placement` only moves the 340px
 * column from `sm` up. Toast roots stack from the viewport's edge, so the root mirrors its
 * vertical math for a top placement, as `toastVariants` describes.
 */
export const toastViewportVariants = tv({
  base: "sm:w-[340px] fixed top-auto right-4 bottom-4 isolate mx-auto flex w-[calc(100%-2rem)]",
  variants: {
    // With both horizontal insets set, `mx-auto` centers the fixed-width column. A left
    // placement frees the right inset that the narrow layout sets.
    placement: {
      "top-left": "sm:top-8 sm:bottom-auto sm:left-8 sm:right-auto",
      "top-center": "sm:top-8 sm:bottom-auto sm:inset-x-0",
      "top-right": "sm:top-8 sm:bottom-auto sm:right-8",
      "bottom-left": "sm:bottom-8 sm:left-8 sm:right-auto",
      "bottom-center": "sm:bottom-8 sm:inset-x-0",
      "bottom-right": "sm:bottom-8 sm:right-8",
    },
  },
  defaultVariants: {
    placement: "bottom-right",
  },
});
