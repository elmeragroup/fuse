/**
 * Module-private recipe (confirm-button.md §4/§8.3). Empty keys exist so
 * `VariantProps` aligns with Button's variant axis; only destructive/success
 * add armed styling. No recipe default — undefined variant adds nothing.
 */
import { tv } from "tailwind-variants";

export const confirmButtonVariants = tv({
  variants: {
    variant: {
      default: "",
      outline: "",
      secondary: "",
      ghost: "",
      link: "",
      destructive: "data-[armed=true]:bg-error data-[armed=true]:text-error-foreground",
      success: "data-[armed=true]:bg-success data-[armed=true]:text-success-foreground",
    },
  },
});
