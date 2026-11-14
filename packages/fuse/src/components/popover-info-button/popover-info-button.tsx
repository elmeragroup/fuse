"use client";

import type { ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Info } from "../../icons/generated/info";
import { definedProps } from "../../internal/defined-props";
import { tv } from "../../styles/tv";
import type { ButtonProps, IconButtonSize, LabelButtonSize } from "../button/button";
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

/**
 * Button's `size` constraint, one branch per `ButtonProps` branch: an optional label size or a
 * required icon size. It is spelled out, not picked from `ButtonProps`, so the API reference shows
 * this trigger's `size` text alone instead of joining it to Button's.
 */
type PopoverInfoButtonSizeProps =
  | {
      /**
       * The trigger's size. The default `icon-inline` square is as tall as the line it sits in, so
       * beside a `Field.Label`'s text it centres on the label's line and keeps the label one line
       * tall. Pass an `icon*` size for a standalone, control-sized trigger. `label` names the
       * trigger, so no size needs an `aria-label`.
       */
      size?: LabelButtonSize;
    }
  | {
      /**
       * The trigger's size. The default `icon-inline` square is as tall as the line it sits in, so
       * beside a `Field.Label`'s text it centres on the label's line and keeps the label one line
       * tall. Pass an `icon*` size for a standalone, control-sized trigger. `label` names the
       * trigger, so no size needs an `aria-label`.
       */
      size: IconButtonSize;
    };

export type PopoverInfoButtonProps = DistributiveOmit<ButtonProps, "children" | "aria-label" | "size"> &
  PopoverInfoButtonSizeProps &
  VariantProps<typeof popoverInfoButtonStyles> & {
    /**
     * The popover body. Inline content, such as a sentence with a `<strong>` or a link, flows as
     * one paragraph, so translated rich text needs no wrapper. Consecutive blocks, such as two
     * `<p>` elements or a `Popover.Header` and a `<p>`, sit the small surface gap apart.
     */
    children: ReactNode;
    /**
     * The accessible name of the trigger and of the popover it opens. Unset, it reads
     * `popoverInfoButton.moreInformation`, "More information", from the locale dictionary.
     * Prefer a label that names the topic, such as "About grid rent". A `Popover.Title` in
     * `children` names the popover instead.
     */
    label?: string;
    /**
     * The element the popover renders into. Unset, it is the nearest enclosing `ThemeScope`
     * element.
     */
    container?: OverlayContainerProps["container"];
    /**
     * The popover's maximum width. `sm` to `7xl` cap it at Tailwind's `max-w-sm` to
     * `max-w-7xl`, and `default` at `max-w-md`. The popover is as wide as its content up to
     * that cap.
     */
    contentSize?: VariantProps<typeof popoverInfoButtonStyles>["contentSize"];
  };

/**
 * A ghost info button that opens a popover to its right. It is a client component, because it
 * holds the popover's state and reads its name from the locale dictionary.
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
