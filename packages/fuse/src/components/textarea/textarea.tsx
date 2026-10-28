import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { textareaVariants } from "./textarea-class";

export type TextareaProps = ComponentProps<"textarea"> & {
  /**
   * Control size of the field box. Emitted as `data-size`. `"default"` maps to the `md` control
   * size; `"sm"` maps to the `sm` control size. The size sets the inline inset and the type; the
   * box keeps its 64px minimum and grows with its text at both sizes.
   * @default "default"
   */
  size?: "sm" | "default";
};

export function Textarea({ className, size = "default", ...props }: TextareaProps): ReactElement {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  );
}

Textarea.displayName = "Textarea";
