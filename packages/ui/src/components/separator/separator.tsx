"use client";

import type { ComponentProps, ReactElement } from "react";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { mergeClassName } from "../../styles/merge-class-name";

export type SeparatorProps = ComponentProps<typeof SeparatorPrimitive>;

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps): ReactElement {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={mergeClassName(
        className,
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch"
      )}
      {...props}
    />
  );
}

Separator.displayName = "Separator";
