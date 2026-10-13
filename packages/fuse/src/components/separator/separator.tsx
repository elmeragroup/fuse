"use client";

import type { ComponentProps, ReactElement } from "react";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { mergeClassName } from "../../styles/merge-class-name";
import { separatorClass } from "./separator-class";

export type SeparatorProps = ComponentProps<typeof SeparatorPrimitive>;

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps): ReactElement {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={mergeClassName(className, separatorClass)}
      {...props}
    />
  );
}

Separator.displayName = "Separator";
