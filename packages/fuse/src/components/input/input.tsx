"use client";

import type { ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";

export type InputProps = ComponentProps<"input">;

export function Input({ className, type, ...props }: InputProps): ReactElement {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldBox(),
        "file:text-sm file:font-medium min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-foreground",
        className
      )}
      {...props}
    />
  );
}

Input.displayName = "Input";
