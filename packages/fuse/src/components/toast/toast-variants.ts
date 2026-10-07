/**
 * Module-private slot recipe. Not exported from the public entry —
 * there is no proven recipe-borrowing use. `status` is derived from the toast's
 * `type`, not a consumer prop, and is not a density rung.
 */
import { tv } from "tailwind-variants";

import { overlayPopupFillClass } from "../overlay/overlay-classes";

export const toastVariants = tv({
  slots: {
    // Each group below is one responsibility; the stack is written for a bottom edge.
    root: [
      // Box: the toast fills the viewport column and is anchored to its bottom edge, with
      // older toasts layered beneath newer ones. `box-border` keeps the padding inside
      // the column when the host ships no preflight.
      "shadow-lg absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 box-border h-[var(--height)] w-full origin-bottom rounded-lg p-4 select-none",
      // Stack metrics. `--side` is the sign of the vertical math: `1` stacks upward from a
      // bottom edge. Collapsed toasts shrink by `--scale` and peek `--peek` past the one in
      // front; expanded toasts sit `--gap` apart at Base UI's measured `--toast-offset-y`.
      "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc((var(--side)*((var(--toast-offset-y)*-1)+(var(--toast-index)*var(--gap)*-1)))+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [--side:1]",
      // Collapsed transform: follow the swipe, then lift by the peek and the height lost to
      // scaling, toward the far side of the stack.
      "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--side)*((var(--toast-index)*var(--peek))+(var(--shrink)*var(--height))))))_scale(var(--scale))] [transition:transform_0.2s_cubic-bezier(0.22,1,0.36,1),opacity_0.2s]",
      // Expanded: full height at the measured offset. The `after:` strip bridges the gap to
      // the next toast so the pointer does not collapse the stack while crossing it.
      "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-[expanded]:h-[var(--toast-height)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))]",
      // Enter and exit: slide in from beyond the anchored edge and fade out; a toast pushed
      // past the limit fades; a dismissal without a swipe slides back out the way it came.
      "data-[ending-style]:opacity-0 data-[limited]:opacity-0 data-[starting-style]:[transform:translateY(calc(var(--side)*150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(calc(var(--side)*150%))]",
      // Swipe exits continue the gesture 150% further in its direction, collapsed or
      // expanded. These follow the pointer, not the placement, so they need no sign.
      "data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
      // Top placements from `sm` up, matching the viewport: `--side:-1` mirrors the stack
      // math and the enter/exit slide; what a sign cannot flip (the anchored inset, the
      // scale origin, the hover bridge) flips here. Below `sm` they keep the bottom stack.
      "sm:data-[placement^=top]:top-0 sm:data-[placement^=top]:bottom-auto sm:data-[placement^=top]:origin-top sm:data-[placement^=top]:[--side:-1] sm:data-[placement^=top]:after:top-auto sm:data-[placement^=top]:after:bottom-full",
    ],
    content:
      "isolate flex flex-col gap-1 transition-opacity [transition-duration:250ms] data-[behind]:pointer-events-none data-[behind]:opacity-0 data-[expanded]:pointer-events-auto data-[expanded]:opacity-100",
    title: "font-medium leading-5",
    // The root publishes `--toast-copy` per status; the fallback keeps the neutral
    // and loading copy on `muted-foreground`. A consumer className still merges over
    // this slot, unlike an internal descendant selector.
    description: "leading-5 text-[var(--toast-copy,var(--muted-foreground))]",
    icon: "mt-0.5 size-4 shrink-0",
  },
  variants: {
    status: {
      // Toast takes the shared popup *fill* only, never the popup edge: it paints its
      // own hairline ring rather than `overlayPopupEdgeClass`'s elevation-plus-ring
      // pair, which is why the two constants are separate.
      neutral: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
      },
      loading: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
        icon: "animate-spin",
      },
      error: {
        root: "bg-error-soft text-error-soft-foreground ring-1 ring-error/20 [--toast-copy:var(--error-soft-foreground)]",
        icon: "text-error",
      },
      info: {
        root: "bg-info-soft text-info-soft-foreground ring-1 ring-info/20 [--toast-copy:var(--info-soft-foreground)]",
        icon: "text-info",
      },
      success: {
        root: "bg-success-soft text-success-soft-foreground ring-1 ring-success/20 [--toast-copy:var(--success-soft-foreground)]",
        icon: "text-success",
      },
      warning: {
        root: "bg-warning-soft text-warning-soft-foreground ring-1 ring-warning/20 [--toast-copy:var(--warning-soft-foreground)]",
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
 * vertical math for a top placement (see `toastVariants`).
 */
export const toastViewportVariants = tv({
  base: "sm:w-[340px] fixed top-auto right-4 bottom-4 isolate mx-auto flex w-[calc(100%-2rem)]",
  variants: {
    // Pinning both horizontal insets lets `mx-auto` center the fixed-width column; a left
    // placement frees the right inset the narrow layout pins.
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
