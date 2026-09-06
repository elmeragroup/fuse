"use client";

import type { ReactElement, Ref } from "react";

import type { FileTriggerProps as FileTriggerPrimitiveProps } from "react-aria-components";
import { FileTrigger as FileTriggerPrimitive } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import type { buttonVariants } from "../../components/button/button-variants";
import { Camera } from "../../icons/generated/camera";
import { Folder } from "../../icons/generated/folder";
import { Paperclip } from "../../icons/generated/paperclip";
import { cn } from "../../styles/cn";
import { Button } from "../internal/button";

/**
 * Named file-picking button over RAC `FileTrigger`.
 * Client — RAC owns the hidden file input and press-to-open.
 *
 * `variant`, `size`, `isDisabled`, and `className` route to the visible Button;
 * they never land on the primitive. `ref` is the hidden
 * `<input type="file">`.
 */
export type FileTriggerProps = {
  /**
   * Leading icon on/off. Defaults to on, and adds `gap-x-2` between the icon
   * and the label when on.
   */
  withIcon?: boolean;
  /** Disables the visible Button (and picker activation). */
  isDisabled?: boolean;
  /** The hidden file input. */
  ref?: Ref<HTMLInputElement>;
  /** Merged onto the visible Button. */
  className?: string;
} & FileTriggerPrimitiveProps &
  VariantProps<typeof buttonVariants>;

export function FileTrigger({
  size = "sm",
  withIcon = true,
  variant,
  isDisabled,
  ref,
  className,
  children,
  defaultCamera,
  acceptDirectory,
  ...props
}: FileTriggerProps): ReactElement {
  return (
    <FileTriggerPrimitive
      {...props}
      ref={ref}
      defaultCamera={defaultCamera}
      acceptDirectory={acceptDirectory}>
      <Button
        className={cn(withIcon && "gap-x-2", className)}
        isDisabled={isDisabled}
        size={size}
        variant={variant}>
        {withIcon ? (
          defaultCamera ? (
            <Camera aria-hidden />
          ) : acceptDirectory ? (
            <Folder aria-hidden />
          ) : (
            <Paperclip aria-hidden />
          )
        ) : null}
        {children}
      </Button>
    </FileTriggerPrimitive>
  );
}

FileTrigger.displayName = "FileTrigger";
