"use client";

import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";

import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import { confirmButtonVariants } from "./confirm-button-variants";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ConfirmButtonProps = DistributiveOmit<ButtonProps, "onClick" | "children"> & {
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
 * Two-press confirm wrapper over the library Button (confirm-button.md §2/§7).
 * Client — owns armed state (performance.md §RSC classification).
 */
export function ConfirmButton({
  onConfirm,
  armedChildren,
  armedAriaLabel,
  disabled,
  variant,
  className,
  children,
  "aria-label": ariaLabel,
  onKeyDown,
  onBlur,
  ...rest
}: ConfirmButtonProps): ReactElement {
  const [isArmedRaw, setIsArmedRaw] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsArmedRaw(false);
    }
  }, [disabled]);

  const isArmed = isArmedRaw && !disabled;

  function handlePress() {
    if (isArmed) {
      setIsArmedRaw(false);
      onConfirm();
    } else {
      setIsArmedRaw(true);
    }
  }

  const announcement = armedAriaLabel ?? stringChild(armedChildren) ?? ariaLabel;
  const resolvedAriaLabel = isArmed ? announcement : ariaLabel;
  const visibleChildren = isArmed && armedChildren !== undefined ? armedChildren : children;

  // SAFETY: ConfirmButtonProps is a distributive Omit of ButtonProps. Reassembling
  // the icon/label union after destructuring is a TypeScript limitation; the runtime
  // props are the same Button surface plus the owned onClick.
  const buttonProps = {
    ...rest,
    variant,
    disabled,
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

/** Spec §3: only a string `armedChildren` participates in the announcement chain. */
function stringChild(node: ReactNode): string | undefined {
  // Consumer-owned ReactNode I/O: the announcement chain takes a string label only.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  if (typeof node === "string") {
    return node;
  }
  return undefined;
}
