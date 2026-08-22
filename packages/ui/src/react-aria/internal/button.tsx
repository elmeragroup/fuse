"use client";

import type { ComponentProps, ReactElement } from "react";

import { Button as AriaButton, composeRenderProps } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { buttonVariants } from "../../components/button/button-variants";
import { cn } from "../../styles/cn";

/**
 * The private RAC Button exists solely because RAC slots — the DatePicker trigger and
 * Calendar's `previous`/`next` — cannot be filled by the base-ui Button
 * (date-picker.md §2). It borrows the PUBLIC `buttonVariants` recipe by a relative
 * package-private import, so the interim tier can never drift from Button's density
 * ladder or focus ring. It is not exported from `package.json#exports`.
 */
export type ButtonProps = ComponentProps<typeof AriaButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps): ReactElement {
  return (
    <AriaButton
      data-slot="button"
      className={composeRenderProps(className, (resolved: string | undefined) =>
        cn(buttonVariants({ variant, size }), resolved)
      )}
      {...props}
    />
  );
}

Button.displayName = "ReactAriaInternal.Button";
