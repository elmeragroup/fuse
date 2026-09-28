"use client";

import type { ComponentProps, ReactElement } from "react";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { handoff } from "../../internal/part-handoff";

export type SeparatorProps = ComponentProps<typeof SeparatorPrimitive>;

export function Separator({ orientation = "horizontal", ...props }: SeparatorProps): ReactElement {
  return (
    <SeparatorPrimitive
      {...handoff(props, {
        defaults: { "data-slot": "separator" },
        classes: [
          "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        ],
      })}
      orientation={orientation}
    />
  );
}

Separator.displayName = "Separator";
