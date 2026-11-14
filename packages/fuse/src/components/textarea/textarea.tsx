import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { textareaVariants } from "./textarea-class";

/** The props of {@link Textarea}. */
export type TextareaProps = Omit<ComponentProps<"textarea">, "aria-label"> & {
  /**
   * The control size, also written as `data-size`. `default` is the md control size, and `sm`
   * the sm one. The size sets the inline inset and the text size. At both sizes the box is at
   * least 64px tall and grows with its text.
   */
  size?: "sm" | "default";
  /**
   * The textarea's name when no visible label names it. For a visible label, put it in a
   * `Field.Root` with a `Field.Label` and pass it to `Field.Control`'s `render`, as in
   * `<Field.Control render={<Textarea />} />`. A bare `Textarea` in a root is not wired to it.
   */
  "aria-label"?: ComponentProps<"textarea">["aria-label"];
};

/** A multiline text input in a field box. */
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
