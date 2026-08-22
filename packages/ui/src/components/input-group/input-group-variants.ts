import { tv } from "tailwind-variants";

/**
 * Module-private per input-group.md §4 — the group's addon rail. `align` places
 * the rail inline (leading/trailing) or as a full-width block row; the Root
 * switches to a column and re-pads the input from the emitted `data-align`.
 * The kbd radius keeps the reference's `calc(var(--radius)-5px)` arithmetic.
 */
export const inputGroupAddonVariants = tv({
  base: "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
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
 * Module-private per input-group.md §4 — the compact addon-button axis. These
 * four values are addon chrome inside the group, NOT the four-rung control box
 * (`xs`/`sm`/`md`/`lg`), so they are an explicit shell-local exemption from the
 * density ladder (input-group.md §4 "Exemption", §8.8) and must never grow a
 * fifth `--control-*` rung. `sm` stays empty so Button's own `sm` metrics pass
 * through. The values are applied as extra classes over Button's default size.
 */
export const inputGroupButtonVariants = tv({
  base: "flex items-center gap-2 text-sm shadow-none",
  variants: {
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- input-group.md §4 shell-local exemption: compact addon chrome, not a control rung
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- input-group.md §4 shell-local exemption: compact addon chrome, not a control rung
      "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- input-group.md §4 shell-local exemption: compact addon chrome, not a control rung
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});
