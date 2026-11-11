import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";

// One container query per split, Tailwind's `@3xl`, `@4xl` and `@5xl` container sizes. The pane
// and the probe share it, so the first paint and the client's layout read the same breakpoint.
const from3xl = cn("@min-[48rem]/list-detail:flex");
const from4xl = cn("@min-[56rem]/list-detail:flex");
const from5xl = cn("@min-[64rem]/list-detail:flex");

/** The ListDetail recipe: the root's size container, the list column and the detail pane. */
export const listDetailVariants = tv({
  slots: {
    // A named inline-size container: the split follows the room the root has, not the
    // viewport, so a rail beside it or a window around it moves the breakpoint with it.
    root: "@container/list-detail flex min-h-0 min-w-0",
    list: "flex min-w-0 flex-1 flex-col",
    // `hidden` until the root is wide enough, so a server-rendered pane never shows in a root
    // too narrow for it before the client takes over and swaps it for the Sheet.
    pane: "hidden min-h-0 w-88 shrink-0 flex-col border-s border-border bg-right-panel text-right-panel-foreground",
    // A box only while the container query matches: the client observes it appear and vanish,
    // so the layout follows the query itself, at the root's layout width and current rem.
    probe: "pointer-events-none invisible absolute hidden size-px",
  },
  variants: {
    split: {
      "3xl": { pane: from3xl, probe: from3xl },
      "4xl": { pane: from4xl, probe: from4xl },
      "5xl": { pane: from5xl, probe: from5xl },
      never: {},
    },
    // Once the client has read the query, it alone shows and removes the pane.
    settled: {
      true: { pane: "flex" },
      false: {},
    },
  },
  defaultVariants: {
    split: "4xl",
    settled: false,
  },
});
