"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Dialog as AriaDialog } from "react-aria-components";

import { cn } from "../../styles/cn";
import { racDialogShellClass } from "../../styles/inner-corner/picker";
import { tv } from "../../styles/tv";

/**
 * The interim tier's styled dialog chrome: the RAC Dialog both picker popovers render.
 * Package-private. The public dialog family is the base-ui `@elmeragroup/fuse/dialog`
 * entry, and this module never reaches `package.json#exports`.
 */
const dialogVariants = tv({
  slots: {
    base: [
      racDialogShellClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- dialog surface; focusable descendants own the adapter
      "relative max-h-[inherit] overflow-y-auto outline-none",
    ],
    // The content stacks its groups, such as a calendar and its presets, by the large surface gap.
    content: "flex flex-col gap-(--surface-gap-lg)",
  },
});

/** Resolved once at module scope — the recipe has no axes (no per-render work). */
const dialogSlots = dialogVariants();
const dialogBaseClass = dialogSlots.base();
const dialogContentClass = dialogSlots.content();

function DialogContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="dialog-content" className={cn(dialogContentClass, className)} {...props} />;
}

export type DialogProps = Omit<ComponentProps<typeof AriaDialog>, "children"> & {
  children?: ReactNode;
};

/**
 * The styled dialog. It renders no heading, and that is what keeps it nameable.
 *
 * RAC's `Dialog` (`Dialog.mjs:84-97`) hands `useDialog` only the `aria-labelledby` that
 * arrived as a *prop*, and falls back to the `DialogContext` value — the name a
 * `DialogTrigger`, `useDatePicker` or `useDateRangePicker` publishes — only when nothing
 * resolves a `<Heading slot="title">`. `useDialog` resolves that slot through
 * `useSlotId`, which drops the id when no element claims it. So a heading, even an empty
 * one, wins the name race and can leave the dialog announced as nothing at all; rendering
 * none lets the context name through.
 */
export function Dialog({ children, className, ...props }: DialogProps): ReactElement {
  return (
    <AriaDialog data-slot="dialog" {...props} className={cn(dialogBaseClass, className)}>
      <DialogContent>{children}</DialogContent>
    </AriaDialog>
  );
}

Dialog.displayName = "ReactAriaInternal.Dialog";
DialogContent.displayName = "ReactAriaInternal.DialogContent";
