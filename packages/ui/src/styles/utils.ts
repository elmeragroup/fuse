import { tv } from "tailwind-variants";

export const focusRing = tv({
  slots: {
    root: "",
    control: "",
  },
  variants: {
    target: {
      self: {
        root: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
      },
      within: {
        root: "has-[[data-focus-ring-control]:focus-visible]:ring-2 has-[[data-focus-ring-control]:focus-visible]:ring-ring has-[[data-focus-ring-control]:focus-visible]:ring-offset-2 has-[[data-focus-ring-control]:focus-visible]:ring-offset-background has-[[data-focus-ring-control]:focus-visible]:outline-none",
        control: "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
      },
      state: {
        root: "outline-none",
      },
    },
    isFocusVisible: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      target: "state",
      isFocusVisible: true,
      class: {
        root: "ring-2 ring-ring ring-offset-2 ring-offset-background",
      },
    },
  ],
  defaultVariants: {
    target: "self",
  },
});

export const disabledHatch =
  "bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgb(0_0_0/0.02)_8px,rgb(0_0_0/0.02)_16px)]";

export const iconCrossfadeTransition =
  "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
export const iconCrossfadeShown = "blur-0 scale-100 opacity-100";
export const iconCrossfadeHidden = "scale-[0.25] opacity-0 blur-[4px]";
