"use client";

import type { ReactElement, ReactNode } from "react";
import { Children, Fragment, cloneElement, isValidElement, useState } from "react";

import { isTextNode, isTextValueNode } from "../../internal/is-text-node";
import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import { confirmButtonVariants } from "./confirm-button-variants";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** ConfirmButton's props: Button's props, with `onConfirm` in place of `onClick`. */
export type ConfirmButtonProps = DistributiveOmit<
  ButtonProps,
  "onClick" | "children" | "isVisuallyDisabled"
> & {
  /**
   * Shows Button's disabled look and stamps `aria-disabled` while the button keeps Tab focus, its
   * focus ring and any Tooltip. A pointer press does not move focus to it. Presses never arm or
   * confirm, and turning it on disarms the button. The look follows `aria-disabled`, so an
   * explicit `aria-disabled={false}` hides it while presses stay ignored.
   */
  isVisuallyDisabled?: boolean;
  /**
   * Called on the second press, after the button disarms. Escape and moving focus away disarm it
   * without calling `onConfirm`, and so does turning on `disabled`, `isPending` or
   * `isVisuallyDisabled`. While armed, the button consumes Escape, so inside a Dialog, Sheet or
   * Popover the first Escape disarms the button and a second one closes the overlay.
   */
  onConfirm: () => void;
  /** The label at rest. */
  children?: ReactNode;
  /**
   * The label while armed. Without it, the label at rest stays. Text in `children` and
   * `armedChildren`, fragments included, renders in a `<span>`, so the swap still works after page
   * translation replaces the text. Text that your own component renders stays bare, so put it in
   * an element. When both labels use the same element, give each a different `key`, so the swap
   * replaces the element instead of updating the text inside it.
   */
  armedChildren?: ReactNode;
  /**
   * The `aria-label` while armed, and the text a live region announces when the button arms.
   * Without it, a string `armedChildren` is announced, then `aria-label`.
   */
  armedAriaLabel?: string;
};

/**
 * The label's children with fragments and arrays flattened into one list. An element from inside
 * a fragment gets the fragment's key as a prefix, so two fragments cannot hand out the same key.
 */
function flattenLabel(node: ReactNode, keyPrefix = ""): ReactNode[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return [child];
    }
    const key = `${keyPrefix}${String(child.key)}`;
    if (child.type === Fragment) {
      return flattenLabel(child.props.children, `${key}/`);
    }
    return [keyPrefix === "" ? child : cloneElement(child, { key })];
  });
}

/**
 * Puts each run of adjacent text in one `<span>`, across fragment boundaries, so arming swaps
 * elements React owns. Chrome's built-in page translation replaces a bare text node with its own
 * `<font>` nodes. React then threw `NotFoundError` removing the old text node, or updated the
 * detached node and left the old label showing. A run joins into one string, so the
 * span keeps one text node that React updates through `textContent`, and `Delete {count} items`
 * stays one flex item without Button's gap between its parts. A run of only whitespace stays bare:
 * as a span it would be a flex item of its own and add a gap, and translation leaves it alone.
 * Text a consumer component renders stays bare.
 */
function labelNodes(node: ReactNode): ReactNode[] {
  const nodes: ReactNode[] = [];
  let run = "";
  const flush = () => {
    if (run.trim() !== "") {
      nodes.push(<span key={`text-${nodes.length}`}>{run}</span>);
    } else if (run !== "") {
      nodes.push(run);
    }
    run = "";
  };
  for (const child of flattenLabel(node)) {
    if (isTextValueNode(child)) {
      run += String(child);
    } else {
      flush();
      nodes.push(child);
    }
  }
  flush();
  return nodes;
}

/** A Button that arms on the first press and calls `onConfirm` on the second. */
export function ConfirmButton({
  onConfirm,
  armedChildren,
  armedAriaLabel,
  disabled,
  // Restates Button's defaults so the API extractor records them, until it reads recipe defaults
  // itself (elmeragroup/internal#39).
  isPending = false,
  isVisuallyDisabled = false,
  variant = "default",
  size = "default",
  className,
  children,
  "aria-label": ariaLabel,
  onKeyDown,
  onBlur,
  ...rest
}: ConfirmButtonProps): ReactElement {
  const [isArmedRaw, setIsArmedRaw] = useState(false);

  // `isVisuallyDisabled` keeps Button activatable, so it must gate arming here too.
  const inert = disabled === true || isPending || isVisuallyDisabled;

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
    size,
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
