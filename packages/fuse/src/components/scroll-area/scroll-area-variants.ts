import { tv } from "tailwind-variants";

/**
 * Visibility face for the Radix-style `type` prop.
 * `keepMounted` is not a class, so it stays on `SCROLLBAR_KEEP_MOUNTED` in the component.
 */
export const scrollbarTypeVariants = tv({
  variants: {
    type: {
      always: "opacity-100",
      auto: "opacity-100",
      hover:
        "pointer-events-none opacity-0 transition-opacity data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0",
    },
  },
  defaultVariants: {
    type: "hover",
  },
});
