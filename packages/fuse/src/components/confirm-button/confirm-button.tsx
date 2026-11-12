"use client";

import type { ReactElement, ReactNode } from "react";
import { Children, useState } from "react";

import { isTextNode, isTextValueNode } from "../../internal/is-text-node";
import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import { confirmButtonVariants } from "./confirm-button-variants";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ConfirmButtonProps = DistributiveOmit<
  ButtonProps,
  "onClick" | "children" | "isVisuallyDisabled"
> & {
  /**
   * Renders Button's disabled treatment and stamps `aria-disabled` while keeping Tab focus,
   * focus-visible and any Tooltip; pointer presses do not move focus. Presses never arm or
   * confirm, and turning it on disarms. The treatment keys off `aria-disabled`, so an explicit
   * `aria-disabled={false}` hides it while presses stay ignored.
   */
  isVisuallyDisabled?: boolean;
  /** Called on the second press only, after the button disarms. */
  onConfirm: () => void;
  /** Resting label. */
  children?: ReactNode;
  /**
   * Label swapped in while armed; the resting label is kept when omitted. Text in `children` and
   * `armedChildren`, directly or in an array, renders in its own `<span>` so the swap still works
   * after page translation replaced the text. Text inside a fragment or your own component stays
   * bare; put it in an element.
   */
  armedChildren?: ReactNode;
  /** Explicit armed announcement and `aria-label` override. */
  armedAriaLabel?: string;
};

/**
 * Two-press confirm wrapper over the library Button.
 * Client — owns armed state.
 *
 * Turning `disabled` or `isPending` on disarms it, so re-enabling never restores a stale armed state.
 * Escape disarms without confirming; while armed the button consumes the key, so inside a Dialog,
 * Sheet or Popover the first Escape disarms and a second one closes the overlay.
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
  // Text goes in its own span, so arming swaps elements React owns. Page translation (Chrome's
  // built-in translate) replaces a bare text node with its own `<font>` nodes: React then threw
  // `NotFoundError` removing the old text node, or updated the detached node and left the old
  // label showing. Children.map flattens arrays but not fragments, so text inside a fragment
  // stays bare.
  const visibleChildren = Children.map(
    isArmed && armedChildren !== undefined ? armedChildren : children,
    (child) => (isTextValueNode(child) ? <span>{child}</span> : child)
  );

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
        // Consume the Escape: Base UI's overlay dismiss ignores defaultPrevented, so an armed button must stop it reaching the popup and the document.
        event.stopPropagation();
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
