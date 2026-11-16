"use client";

import type { ComponentProps, ReactElement } from "react";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { mergeClassName } from "../../styles/merge-class-name";
import { separatorClass } from "./separator-class";

type SeparatorPrimitiveProps = ComponentProps<typeof SeparatorPrimitive>;

/** `Separator` takes Base UI's separator props. */
export type SeparatorProps = Omit<SeparatorPrimitiveProps, "className"> & {
  /**
   * Extra classes, merged after the line's own. A vertical line stretches to the height of its flex
   * row. For a shorter one, add `data-vertical:h-4 data-vertical:self-auto` and centre the row with
   * `items-center`. The line's own `data-vertical:self-stretch` wins over `self-center`, so
   * `h-4 self-center` leaves the line at the top of the row.
   */
  className?: SeparatorPrimitiveProps["className"];
};

/** A 1px line in the border colour that separates content. */
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
