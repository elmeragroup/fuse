import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Tabs. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Tabs list: `rounded-lg` and 4px padding, never under 4px at a small root, around triggers
 * floored at the 24px target, so a trigger and its 4px focus ring fit inside. The `line` variant
 * has no corner and publishes none, and keeps the 3px its underline sits on.
 */
export const tabsListShellClass = cn(
  "rounded-lg p-[max(var(--spacing),4px)] [--shell-inner:max(0px,--theme(--radius-lg)-max(var(--spacing),4px))] group-data-horizontal/tabs:min-h-[calc(max(1.5rem,24px)+1px+2*max(var(--spacing),4px))] data-[variant=line]:rounded-none data-[variant=line]:p-[3px] data-[variant=line]:[--shell-inner:initial]",
  publishShellBoundary
);

/**
 * A Tabs trigger: an inner part of the list, floored at the 24px target, and a `rounded-md` outer
 * corner in the `line` variant. Both corners weigh nothing, so a consumer's `rounded-*` class wins.
 */
export const tabsTriggerShellClass = cn(
  "min-h-[max(1.5rem,24px)] [:where(&)]:rounded-inner group-data-[variant=line]/tabs-list:[:where(&)]:rounded-md"
);
