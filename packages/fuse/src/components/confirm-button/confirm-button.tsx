"use client";

import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import { isTextNode } from "../../internal/is-text-node";
import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import { confirmButtonVariants } from "./confirm-button-variants";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ConfirmButtonProps = DistributiveOmit<
  ButtonProps,
  "onClick" | "children" | "isVisuallyDisabled" | "isPending"
> & {
  /**
   * Renders Button's disabled treatment and stamps `aria-disabled` while keeping Tab focus,
   * focus-visible and any Tooltip; pointer presses do not move focus. Presses never arm or
   * confirm, and turning it on disarms. The treatment keys off `aria-disabled`, so an explicit
   * `aria-disabled={false}` hides it while presses stay ignored.
   */
  isVisuallyDisabled?: boolean;
  /**
   * Disables the element and stamps `data-pending`, blocking activation entirely.
   * Turning it on disarms, so the button rests again once it clears.
   */
  isPending?: boolean;
  /** Called on the second press only, after the button disarms. */
  onConfirm: () => void;
  /** Resting label. */
  children?: ReactNode;
  /** Label swapped in while armed; the resting label is kept when omitted. */
  armedChildren?: ReactNode;
  /** Explicit armed announcement and `aria-label` override. */
  armedAriaLabel?: string;
};

/**
 * Two-press confirm wrapper over the library Button.
 * Client — owns armed state.
 *
 * Turning `disabled` on disarms it, so re-enabling never restores a stale armed state.
 */
export function ConfirmButton({
  onConfirm,
  armedChildren,
  armedAriaLabel,
  disabled,
  isPending,
  isVisuallyDisabled,
  variant,
  className,
  children,
  "aria-label": ariaLabel,
  onKeyDown,
  onBlur,
  ...rest
}: ConfirmButtonProps): ReactElement {
  const [isArmedRaw, setIsArmedRaw] = useState(false);

  // `isVisuallyDisabled` keeps Button activatable, so it must gate arming here too.
  const inert = disabled === true || isPending === true || isVisuallyDisabled === true;

  // Reset during render so leaving the inert state cannot restore a stale armed state.
  if (inert && isArmedRaw) {
    setIsArmedRaw(false);
  }

  const isArmed = isArmedRaw && !inert;

  function handlePress() {
    if (inert) {
      return;
    }
    if (isArmed) {
      setIsArmedRaw(false);
      onConfirm();
    } else {
      setIsArmedRaw(true);
    }
  }

  // Only a string `armedChildren` participates in the announcement chain.
  const announcement = armedAriaLabel ?? (isTextNode(armedChildren) ? armedChildren : ariaLabel);
  const resolvedAriaLabel = isArmed ? announcement : ariaLabel;
  const visibleChildren = isArmed && armedChildren !== undefined ? armedChildren : children;

  // SAFETY: ConfirmButtonProps is a distributive Omit of ButtonProps. Reassembling
  // the icon/label union after destructuring is a TypeScript limitation; the runtime
  // props are the same Button surface plus the owned onClick.
  const buttonProps = {
    ...rest,
    variant,
    disabled,
    isPending,
    isVisuallyDisabled,
    className: confirmButtonVariants({ variant, className }),
    "aria-label": resolvedAriaLabel,
    onKeyDown: (event) => {
      if (event.key === "Escape" && isArmed) {
        event.preventDefault();
        setIsArmedRaw(false);
      }
      onKeyDown?.(event);
    },
    onBlur: (event) => {
      if (isArmed) {
        setIsArmedRaw(false);
      }
      onBlur?.(event);
    },
    onClick: handlePress,
  } as ButtonProps;

  return (
    <Button {...buttonProps} data-armed={isArmed ? "true" : undefined}>
      {visibleChildren}
      {isArmed && announcement ? (
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      ) : null}
    </Button>
  );
}

ConfirmButton.displayName = "ConfirmButton";
