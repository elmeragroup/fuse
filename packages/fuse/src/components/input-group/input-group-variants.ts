import { tv } from "tailwind-variants";

/**
 * Module-private recipe for the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * The kbd rounds with the `--radius-inset` rung, the reference's 5px inside `--radius` in
 * external themes and the one radius in the internal variant.
 */
export const inputGroupAddonVariants = tv({
  base: "text-sm font-medium flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-muted-foreground select-none [&>kbd]:rounded-[--theme(--radius-inset)] [&>svg:not([class*='size-'])]:size-4",
  variants: {
    align: {
      "inline-start": "order-first pl-2 has-[>button]:-ml-1 has-[>kbd]:ml-[-0.15rem]",
      "inline-end": "order-last pr-2 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem]",
      "block-start":
        "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
      "block-end":
        "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
});

/**
 * Module-private recipe for the compact addon-button axis. These
 * four values are addon chrome inside the group, NOT the four-rung control box
 * (`xs`/`sm`/`md`/`lg`), so they are an explicit shell-local exemption from the
 * density ladder and must never grow a
 * fifth `--control-*` rung. `sm` stays empty so Button's own `sm` metrics pass
 * through. The values are applied as extra classes over Button's default size. An addon
 * button sits inside the field box, so it rounds like the field chrome and never takes
 * Button's `--radius-button`. The `sm` sizes keep `rounded-md`, and the `xs` sizes take the
 * kbd's `--radius-inset` rung.
 */
export const inputGroupButtonVariants = tv({
  base: "text-sm flex items-center gap-2 rounded-md shadow-none",
  variants: {
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      xs: "h-6 gap-1 rounded-[--theme(--radius-inset)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-xs": "size-6 rounded-[--theme(--radius-inset)] p-0 has-[>svg]:p-0",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});
