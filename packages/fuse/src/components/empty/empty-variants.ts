/**
 * Module-private recipes. Not exported from the public entry, since there is no proven
 * recipe-borrowing use; the workspace-only recipe catalog re-exports them for the Figma component
 * sync.
 *
 * `emptyVariants` holds a slot per part but Media: `variant` on Root is the frame, and `empty.tsx`
 * resolves the other slots once at module scope. `emptyMediaVariants` is Media's own recipe, whose
 * `variant` is the icon or illustration box. Neither axis is a density rung.
 */
import { emptyBorderedShellClass, emptyShellClass } from "../../styles/inner-corner/empty";
import { tv } from "../../styles/tv";

export const emptyVariants = tv({
  slots: {
    root: [
      emptyShellClass,
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-center text-balance",
    ],
    header: "max-w-sm flex flex-col items-center gap-2 text-center",
    title: "text-lg font-medium tracking-tight",
    description:
      "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
    content: "max-w-sm text-sm flex w-full min-w-0 flex-col items-center gap-4 text-balance",
  },
  variants: {
    variant: {
      default: {},
      outline: { root: [emptyBorderedShellClass, "border border-border"] },
      "outline-dashed": { root: [emptyBorderedShellClass, "border border-dashed border-border"] },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const emptyMediaVariants = tv({
  base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "size-10 rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
