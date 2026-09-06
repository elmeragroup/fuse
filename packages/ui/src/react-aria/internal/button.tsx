"use client";

import type { ComponentProps, ReactElement } from "react";

import { Button as AriaButton } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { buttonVariants } from "../../components/button/button-variants";
import { composeTailwindRenderProps } from "./utils";

/**
 * The private RAC Button exists solely because RAC slots — the DatePicker trigger and
 * Calendar's `previous`/`next` — cannot be filled by the base-ui Button.
 * It borrows the PUBLIC `buttonVariants` recipe by a relative
 * package-private import, so the interim tier can never drift from Button's density
 * ladder or focus ring. It is not exported from `package.json#exports`.
 */
export type ButtonProps = ComponentProps<typeof AriaButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps): ReactElement {
  return (
    <AriaButton
      data-slot="button"
      className={composeTailwindRenderProps(className, buttonVariants({ variant, size }))}
      {...props}
    />
  );
}

Button.displayName = "ReactAriaInternal.Button";
