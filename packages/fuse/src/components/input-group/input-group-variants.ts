import { tv } from "tailwind-variants";

/**
 * Module-private recipe for the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * The kbd radius keeps the reference's inset of 5px inside `--radius` as 2.5 radius steps,
 * so external themes keep that inset and the internal variant rounds the kbd like
 * everything else.
 */
export const inputGroupAddonVariants = tv({
  base: "text-sm font-medium flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-muted-foreground select-none [&>kbd]:rounded-[calc(var(--radius)-2.5*var(--radius-step))] [&>svg:not([class*='size-'])]:size-4",
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
 * through. The values are applied as extra classes over Button's default size. Every
 * addon size, `sm` included, replaces Button's `--radius-button` with the kbd's inset
 * radius, because the button sits inside the field box and keeps its corners concentric.
 */
export const inputGroupButtonVariants = tv({
  base: "text-sm flex items-center gap-2 rounded-[calc(var(--radius)-2.5*var(--radius-step))] shadow-none",
  variants: {
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      xs: "h-6 gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-xs": "size-6 p-0 has-[>svg]:p-0",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- compact addon chrome, not a control rung
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});
