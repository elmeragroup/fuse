"use client";

import type { ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Info } from "../../icons/generated/info";
import { definedProps } from "../../internal/defined-props";
import { tv } from "../../styles/tv";
import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../popover/popover";
import { popoverInfoButtonStrings } from "./intl";

/** Recipe for the unit test. Not re-exported from the public entry. */
export const popoverInfoButtonStyles = tv({
  slots: {
    icon: "size-4",
    content: "text-sm w-auto",
    // One flex item for the popup's column, so a sentence with a bold word or a link flows as one
    // paragraph. Zeroes its blocks' own block margins and steps consecutive blocks by the small
    // surface tier; the selectors live in fuse.css.
    body: "rich-text-block:my-0 rich-text-gap:mt-(--surface-gap-sm)",
  },
  variants: {
    contentSize: {
      sm: {
        content: "max-w-sm",
      },
      default: {
        content: "max-w-md",
      },
      lg: {
        content: "max-w-lg",
      },
      xl: {
        content: "max-w-xl",
      },
      "2xl": {
        content: "max-w-2xl",
      },
      "3xl": {
        content: "max-w-3xl",
      },
      "4xl": {
        content: "max-w-4xl",
      },
      "5xl": {
        content: "max-w-5xl",
      },
      "6xl": {
        content: "max-w-6xl",
      },
      "7xl": {
        content: "max-w-7xl",
      },
    },
  },
  defaultVariants: {
    contentSize: "default",
  },
});

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type PopoverInfoButtonProps = DistributiveOmit<ButtonProps, "children" | "aria-label"> &
  VariantProps<typeof popoverInfoButtonStyles> & {
    /**
     * Popover body. Inline content, such as a sentence with a `<strong>` or a link, flows as one
     * paragraph; consecutive blocks, such as two `<p>`s or a `Popover.Header` and a `<p>`, are
     * spaced by the small surface gap.
     */
    children: ReactNode;
    /**
     * Accessible name (`aria-label`) of the trigger and of the popup dialog. Defaults to the
     * locale dictionary; an explicit value wins. A `Popover.Title` in `children` names the
     * dialog instead.
     */
    label?: string;
    /**
     * Portal target forwarded to `Popover.Content`. Defaults to the nearest
     * enclosing `ThemeScope` element.
     */
    container?: OverlayContainerProps["container"];
    /**
     * Max-width of the popover content. `sm`–`7xl` map to `max-w-sm`–`max-w-7xl`;
     * `"default"` is `max-w-md`.
     */
    contentSize?: VariantProps<typeof popoverInfoButtonStyles>["contentSize"];
  };

/**
 * Ghost info button that opens a Popover. It defaults to the `icon-inline` square, as tall as
 * the line it sits in, so beside a `Field.Label`'s text it centres on the label's line and
 * keeps the label one line tall. Pass an `icon*` size for a standalone control-sized trigger.
 * The resolved `label`, by default the localized "More information", names both the trigger and
 * the popup dialog, so a body without a `Popover.Title` still opens a named dialog; a
 * `Popover.Title` names the dialog when present.
 * Client — Popover state and localized name.
 */
export function PopoverInfoButton({
  children,
  size = "icon-inline",
  variant = "ghost",
  contentSize = "default",
  label,
  container,
  ...other
}: PopoverInfoButtonProps): ReactElement {
  const strings = useLocalizedStrings(popoverInfoButtonStrings);
  const accessibleName = label ?? strings.format("moreInformation");
  const { icon, content, body } = popoverInfoButtonStyles({ contentSize });

  // The Button keeps only its presentation and `ref`, whose element type is the Button's;
  // state, ARIA, handlers and `disabled` go through PopoverTrigger. Base UI merges a `render`
  // element's props over the part's, so a forwarded key on the Button, even an undefined one,
  // would beat the trigger's own value, such as `aria-expanded`. `nativeButton` goes to both:
  // each runs its own `useButton`. `className` and `style` callbacks read the Button's state,
  // where `isPending` disables the button while the trigger stays enabled. `disabled` and
  // `focusableWhenDisabled` go to both: Popover.Trigger states a non-native disabled trigger
  // through `aria-disabled` alone, so without its own `disabled` the Button would style itself
  // enabled and keep `onIntent` live.
  const {
    className,
    style,
    isVisuallyDisabled,
    isPending,
    pendingIndicator,
    predictionZoneSize,
    onIntent,
    render,
    nativeButton,
    ref,
    ...wiring
  } = other;
  // SAFETY: PopoverInfoButtonProps is a distributive Omit of ButtonProps. Reassembling
  // the icon/label union after destructuring is a TypeScript limitation; the runtime
  // props are the Button's presentation surface plus the owned aria-label.
  const trigger = (
    <Button
      {...(definedProps({
        size,
        variant,
        "aria-label": accessibleName,
        className,
        style,
        isVisuallyDisabled,
        isPending,
        pendingIndicator,
        predictionZoneSize,
        onIntent,
        render,
        nativeButton,
        disabled: wiring.disabled,
        focusableWhenDisabled: wiring.focusableWhenDisabled,
        ref,
      }) as ButtonProps)}
    />
  );

  // Popover.Trigger has no `focusableWhenDisabled`: its `useButton` gives a disabled non-native
  // trigger `tabIndex={-1}`, which reaches the Button through the merge. A consumer `tabIndex`
  // on the trigger wins over that generated one, so a focusable disabled trigger states its own.
  const tabIndex = wiring.focusableWhenDisabled === true ? (wiring.tabIndex ?? 0) : wiring.tabIndex;

  return (
    <PopoverRoot>
      <PopoverTrigger {...definedProps({ ...wiring, nativeButton, tabIndex })} render={trigger}>
        <Info aria-hidden="true" className={icon()} />
      </PopoverTrigger>
      {/* Base UI names the dialog only through a mounted `Popover.Title` (`aria-labelledby`).
          `aria-label` is the fallback: labelledby still wins when a Title is present. */}
      <PopoverContent
        side="right"
        sideOffset={8}
        showArrow
        aria-label={accessibleName}
        className={content()}
        container={container}>
        <div data-slot="popover-info-button-body" className={body()}>
          {children}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

PopoverInfoButton.displayName = "PopoverInfoButton";
