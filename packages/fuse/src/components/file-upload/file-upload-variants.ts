import { cn } from "../../styles/cn";
import { itemDefaultShellClass, itemShellClass } from "../../styles/inner-corner/item";
import { labelTypeClass } from "../../styles/label-type";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";

/**
 * The FileUpload recipe, one slot per styled part. The Trigger takes no slot: like
 * `Dialog.Trigger` it is a plain button with the focus ring, and `render={<Button />}` gives it
 * a size. Package-private: the facade exports the parts, not the recipe.
 */
export const fileUploadVariants = tv({
  slots: {
    // A stack, so a Dropzone and an `Attachment.Group` below it space out without classes.
    root: "flex min-w-0 flex-col gap-(--surface-gap-sm)",
    // Item's default shell, so a part that rounds with `rounded-inner` sits concentric inside it.
    dropzone: cn(
      itemShellClass,
      itemDefaultShellClass,
      "flex min-w-0 items-center gap-(--surface-gap-sm) border-dashed border-border transition-colors duration-100",
      // The border strengthens on hover and while a control inside has keyboard focus.
      "has-focus-visible:border-muted-foreground/50 enabled-hover:border-muted-foreground/50",
      "data-drop-target:border-solid data-drop-target:border-primary data-drop-target:bg-primary-soft",
      dataStateFaceClass
    ),
    description: cn(labelTypeClass, "text-muted-foreground"),
  },
});
