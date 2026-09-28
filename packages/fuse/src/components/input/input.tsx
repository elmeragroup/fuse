"use client";

import type { ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { handoff } from "../../internal/part-handoff";
import { fieldBox } from "../../styles/field-box";

export type InputProps = ComponentProps<"input">;

export function Input(props: InputProps): ReactElement {
  return (
    <InputPrimitive
      {...handoff(props, {
        defaults: { "data-slot": "input" },
        classes: [
          fieldBox(),
          "file:text-sm file:font-medium min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-foreground",
        ],
      })}
    />
  );
}

Input.displayName = "Input";
