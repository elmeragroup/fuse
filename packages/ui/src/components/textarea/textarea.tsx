import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps): ReactElement {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBox({ box: "content" }), "flex field-sizing-content", className)}
      {...props}
    />
  );
}

Textarea.displayName = "Textarea";
