/**
 * Module-private slot recipe (toast.md §4). Not exported from the public entry —
 * there is no proven recipe-borrowing use. `status` is derived from the toast's
 * `type`, not a consumer prop, and is not a density rung.
 */
import { tv } from "tailwind-variants";

import { overlayPopupFillClass } from "../overlay/overlay-classes";

export const toastVariants = tv({
  slots: {
    root: "shadow-lg absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 h-[var(--height)] w-full origin-bottom [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-lg p-4 select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_0.2s_cubic-bezier(0.22,1,0.36,1),opacity_0.2s] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-[ending-style]:opacity-0 data-[expanded]:h-[var(--toast-height)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-[limited]:opacity-0 data-[starting-style]:[transform:translateY(150%)] data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
    content:
      "isolate flex flex-col gap-1 transition-opacity [transition-duration:250ms] data-[behind]:pointer-events-none data-[behind]:opacity-0 data-[expanded]:pointer-events-auto data-[expanded]:opacity-100",
    title: "font-medium leading-5",
    description: "leading-5 text-muted-foreground",
    icon: "mt-0.5 size-4 shrink-0",
  },
  variants: {
    status: {
      // Toast takes the shared popup *fill* only, never the popup edge: it paints its
      // own hairline ring rather than `overlayPopupEdgeClass`'s elevation-plus-ring
      // pair, which is why the two constants are separate (toast.md §8.10).
      neutral: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
      },
      loading: {
        root: `${overlayPopupFillClass} ring-1 ring-border`,
        icon: "animate-spin",
      },
      error: {
        root: "bg-error-soft text-error-soft-foreground ring-1 ring-error/20 [&_[data-slot=toast-title]]:text-error",
        icon: "text-error",
      },
      info: {
        root: "bg-info-soft text-info-soft-foreground ring-1 ring-info/20 [&_[data-slot=toast-title]]:text-info",
        icon: "text-info",
      },
      success: {
        root: "bg-success-soft text-success-soft-foreground ring-1 ring-success/20 [&_[data-slot=toast-title]]:text-success",
        icon: "text-success",
      },
      warning: {
        root: "bg-warning-soft text-warning-soft-foreground ring-1 ring-warning/20 [&_[data-slot=toast-title]]:text-warning",
        icon: "text-warning",
      },
    },
  },
  defaultVariants: {
    status: "neutral",
  },
});
