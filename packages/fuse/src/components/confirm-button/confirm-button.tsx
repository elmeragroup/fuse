"use client";

import type { ReactElement, ReactNode } from "react";
import { Children, Fragment, cloneElement, isValidElement, useState } from "react";

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
   * `armedChildren`, fragments included, renders in a `<span>` so the swap still works after page
   * translation replaced the text. Text your own component renders stays bare; put it in an
   * element.
   */
  armedChildren?: ReactNode;
  /** Explicit armed announcement and `aria-label` override. */
  armedAriaLabel?: string;
};

/**
 * Puts each run of adjacent text in one `<span>`, inside fragments too, so arming swaps elements
 * React owns. Page translation (Chrome's built-in translate) replaces a bare text node with its own
 * `<font>` nodes: React then threw `NotFoundError` removing the old text node, or updated the
 * detached node and left the old label showing. A run joins into one string, so the span keeps one
 * text node that React updates through `textContent`, and `Delete {count} items` stays one flex
 * item without Button's gap between its parts. Text a consumer component renders stays bare.
 */
function labelNodes(node: ReactNode): ReactNode[] {
  const nodes: ReactNode[] = [];
  let run: (string | number)[] = [];
  const flush = () => {
    if (run.length > 0) {
      nodes.push(<span key={`text-${nodes.length}`}>{run.join("")}</span>);
      run = [];
    }
  };
  for (const child of Children.toArray(node)) {
    if (isTextValueNode(child)) {
      run.push(child);
    } else {
      flush();
      nodes.push(
        isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
          ? cloneElement(child, undefined, labelNodes(child.props.children))
          : child
      );
    }
  }
  flush();
  return nodes;
}

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
  const visibleChildren = labelNodes(isArmed && armedChildren !== undefined ? armedChildren : children);

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
