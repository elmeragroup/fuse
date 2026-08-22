"use client";

import type { ComponentProps, ReactElement, RefObject } from "react";

import {
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import type { OverlaySize } from "../../components/overlay/overlay-classes";
import {
  overlayLayer,
  overlayScrimClass,
  overlaySizeClasses,
} from "../../components/overlay/overlay-classes";
import { cn } from "../../styles/cn";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { OVERLAY_CONTAINER_POPOVER_SELECTOR } from "./overlay-container";

const modalVariants = tv({
  slots: {
    overlay: cn(
      overlayScrimClass,
      "fixed top-0 left-0 isolate flex h-(--visual-viewport-height) w-full items-center justify-center overflow-auto p-4 text-center",
      overlayLayer
    ),
    base: cn(
      "group/modal max-h-full w-full overflow-hidden rounded-xl bg-popover bg-clip-padding text-left align-middle text-popover-foreground ring-1 ring-foreground/10 transition-[max-width]",
      overlayLayer
    ),
  },
  variants: {
    position: {
      default: { base: "" },
      right: { base: "fixed inset-y-0 right-0 w-full rounded-r-none outline-hidden" },
      left: { base: "fixed inset-y-0 left-0 w-full rounded-l-none outline-hidden" },
      top: { base: "fixed inset-x-0 top-0 h-96 w-full rounded-t-none outline-hidden" },
      bottom: { base: "fixed inset-x-0 bottom-0 h-96 w-full rounded-b-none outline-hidden" },
    },
    // The same 13-value axis the public Dialog renders (dialog.md §4), landed on this
    // recipe's `base` slot — the literals live in one place so the tiers cannot drift.
    size: {
      sm: { base: overlaySizeClasses.sm },
      md: { base: overlaySizeClasses.md },
      lg: { base: overlaySizeClasses.lg },
      xl: { base: overlaySizeClasses.xl },
      "2xl": { base: overlaySizeClasses["2xl"] },
      "3xl": { base: overlaySizeClasses["3xl"] },
      "4xl": { base: overlaySizeClasses["4xl"] },
      "5xl": { base: overlaySizeClasses["5xl"] },
      "6xl": { base: overlaySizeClasses["6xl"] },
      "7xl": { base: overlaySizeClasses["7xl"] },
      "8xl": { base: overlaySizeClasses["8xl"] },
      "9xl": { base: overlaySizeClasses["9xl"] },
      "10xl": { base: overlaySizeClasses["10xl"] },
      // `satisfies` makes the re-keying total: a 14th width added to overlaySizeClasses
      // fails this recipe to compile rather than silently going missing on this tier.
    } satisfies Record<OverlaySize, { base: string }>,
    scroll: {
      true: { base: "overflow-y-auto" },
      false: { base: "" },
    },
    isEntering: {
      true: { base: "ease-out animate-in duration-200", overlay: "animate-in duration-200 fade-in" },
      false: {},
    },
    isExiting: {
      true: { base: "ease-in animate-out duration-200", overlay: "animate-out duration-200 fade-out" },
      false: {},
    },
  },
  compoundVariants: [
    { isEntering: true, position: "default", class: { base: "zoom-in-95" } },
    { isExiting: true, position: "default", class: { base: "zoom-out-95" } },
    { isEntering: true, position: "right", class: { base: "slide-in-from-right" } },
    { isExiting: true, position: "right", class: { base: "slide-out-to-right" } },
    { isEntering: true, position: "left", class: { base: "slide-in-from-left" } },
    { isExiting: true, position: "left", class: { base: "slide-out-to-left" } },
    { isEntering: true, position: "top", class: { base: "slide-in-from-top" } },
    { isExiting: true, position: "top", class: { base: "slide-out-to-top" } },
    { isEntering: true, position: "bottom", class: { base: "slide-in-from-bottom" } },
    { isExiting: true, position: "bottom", class: { base: "slide-out-to-bottom" } },
  ],
  defaultVariants: {
    position: "default",
    size: "md",
    scroll: false,
  },
});

/**
 * The seam itself, kept as one named decision so it can be exercised directly: an
 * interaction that landed inside a private RAC popover never reaches the caller's own
 * predicate, and anything else is the caller's call (default: dismiss).
 */
export function shouldCloseForInteraction(
  element: Element,
  delegate: ((element: Element) => boolean) | undefined
): boolean {
  if (element.closest(OVERLAY_CONTAINER_POPOVER_SELECTOR)) {
    return false;
  }
  return delegate === undefined ? true : delegate(element);
}

export type ModalProps = ComponentProps<typeof AriaModalOverlay> &
  VariantProps<typeof modalVariants> & {
    container?: HTMLElement | RefObject<HTMLElement | null>;
  };

/**
 * The interim tier's modal shell. Package-private — the public overlay family is
 * base-ui Dialog/Sheet; this exists only so the private RAC Dialog has a host.
 *
 * `shouldCloseOnInteractOutside` is the DatePicker-inside-Modal seam (date-picker.md
 * §6): an interaction that landed inside a private RAC popover must never dismiss the
 * modal underneath it. The selector is built from `OVERLAY_CONTAINER_POPOVER_SELECTOR`,
 * never from a hardcoded DOM string as in the reference.
 */
export function Modal({
  children,
  className,
  container,
  position,
  scroll,
  shouldCloseOnInteractOutside,
  size,
  ...props
}: ModalProps): ReactElement | null {
  const resolvedContainer = useThemeScopeContainer(container);
  const { base } = modalVariants({ position, size, scroll });

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body.
  if (resolvedContainer === null) {
    return null;
  }

  return (
    <AriaModalOverlay
      {...props}
      UNSTABLE_portalContainer={resolvedContainer}
      className={composeRenderProps(className, (resolved: string | undefined, renderProps) =>
        cn(
          modalVariants({
            position,
            size,
            scroll,
            isEntering: renderProps.isEntering,
            isExiting: renderProps.isExiting,
          }).overlay(),
          resolved
        )
      )}
      shouldCloseOnInteractOutside={(element: Element) =>
        shouldCloseForInteraction(element, shouldCloseOnInteractOutside)
      }>
      <AriaModal data-position={position} className={base()}>
        {children}
      </AriaModal>
    </AriaModalOverlay>
  );
}

Modal.displayName = "ReactAriaInternal.Modal";

export { modalVariants };
