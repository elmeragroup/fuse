/**
 * Runtime-free Field recipes. Not exported from the public entry, since there is no proven
 * recipe-borrowing use; the workspace-only recipe catalog re-exports them for the Figma component
 * sync. `orientation` is the Root axis. `heading` is the Title's class, and `label` is the Label's:
 * the same heading classes after the Label's own. Both are resolved once at module scope in
 * `field.tsx`. The heading reads the label type pair.
 */
import { cn } from "../../styles/cn";
import { fieldLabelCardShellClass } from "../../styles/inner-corner/field-label";
import { labelTypeClass } from "../../styles/label-type";
import { tv } from "../../styles/tv";

const headingClass = cn(labelTypeClass, "font-medium flex w-fit gap-2 group-data-disabled/field:opacity-50");

export const fieldVariants = tv({
  slots: {
    root: "group/field flex w-full gap-(--surface-gap-md) data-invalid:text-error",
    heading: headingClass,
    label: [
      fieldLabelCardShellClass,
      "group/field-label peer/field-label has-data-checked:border-primary/30",
      "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
      "has-[>[data-slot=checkbox]]:cursor-pointer has-[>[data-slot=checkbox]]:items-center",
      headingClass,
    ],
  },
  variants: {
    orientation: {
      // A vertical root stretches its children to its width, except a Checkbox or Switch, which keep
      // their own size. Stretched in a root that sized to its content, they shrank to their border
      // or thumb. `:where()` keeps the selector at the specificity of one class.
      vertical: {
        root: "flex-col [&>.sr-only]:w-auto [&>:where(:not([data-slot=checkbox],[data-slot=switch]))]:w-full",
      },
      horizontal: {
        root: "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-field-heading:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
      // The md row resets the stretch through the stretch's own child selector, so it leaves a
      // Checkbox or Switch at its size, as the horizontal orientation does. Tailwind emits that
      // reset after the stretch, since it adds a variant to the same selector, and it wins at equal
      // specificity. A `*:` reset sorts before the stretch and loses.
      responsive: {
        root: "@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>:where(:not([data-slot=checkbox],[data-slot=switch]))]:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-field-heading:flex-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px flex-col [&>.sr-only]:w-auto [&>:where(:not([data-slot=checkbox],[data-slot=switch]))]:w-full",
      },
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});
