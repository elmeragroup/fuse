/**
 * The module-private recipe. It lists every Button variant, so `VariantProps` matches Button's
 * `variant` axis, and only `destructive` and `success` add an armed style. It has no default, and
 * an unset variant adds no class.
 */
import { tv } from "../../styles/tv";

export const confirmButtonVariants = tv({
  variants: {
    variant: {
      default: "",
      outline: "",
      secondary: "",
      ghost: "",
      link: "",
      destructive:
        "data-[armed=true]:forced-highlight data-[armed=true]:bg-error data-[armed=true]:text-error-foreground",
      success:
        "data-[armed=true]:forced-highlight data-[armed=true]:bg-success data-[armed=true]:text-success-foreground",
    },
  },
  // Required shape: the `elmera/enforce-variant-standard` rule makes every recipe declare
  // `defaultVariants`. An undefined variant adds nothing here.
  defaultVariants: {},
});
