import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { textareaClass } from "./textarea-class";

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps): ReactElement {
  return <textarea data-slot="textarea" className={cn(textareaClass, className)} {...props} />;
}

Textarea.displayName = "Textarea";
