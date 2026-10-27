/**
 * Runtime-free Field recipes. Not exported from the public entry, since there is no proven
 * recipe-borrowing use; the workspace-only recipe catalog re-exports them for the Figma component
 * sync. `orientation` is the Root axis and `variant` the Legend's. The Title and the Label share
 * their heading classes: `title` puts its centering before them, and `label` its composition arms.
 * `description`, `error` and `legend` are the other text parts. `set` stacks a `Field.Set`'s parts, closer
 * around a checkbox or radio group. `field.tsx` resolves the slots of the
 * parts without an axis once at module scope. The headings, the description and the error read the
 * label type pair, as a label-variant legend does.
 */
import { cn } from "../../styles/cn";
import { fieldLabelCardShellClass } from "../../styles/inner-corner/field-label";
import { labelTypeClass } from "../../styles/label-type";
import { tv } from "../../styles/tv";

const headingClass = cn(labelTypeClass, "font-medium flex w-fit gap-2 group-data-disabled/field:opacity-50");

export const fieldVariants = tv({
  slots: {
    root: "group/field flex w-full gap-(--surface-gap-md) data-invalid:text-error",
    title: ["items-center", headingClass],
    label: [
      fieldLabelCardShellClass,
      "group/field-label peer/field-label has-data-checked:border-primary/30",
      "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
      "has-[>[data-slot=checkbox]]:cursor-pointer has-[>[data-slot=checkbox]]:items-center",
      headingClass,
    ],
    description: [
      labelTypeClass,
      "font-normal text-left text-pretty text-muted-foreground group-has-data-horizontal/field:text-balance last:mt-0 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary [[data-variant=legend]+&]:-mt-1.5",
    ],
    error: [labelTypeClass, "font-normal text-error"],
    legend: "font-medium mb-3 text-balance",
    set: "flex flex-col gap-(--surface-gap-xl) has-[>[data-slot=checkbox-group]]:gap-(--surface-gap-md) has-[>[data-slot=radio-group]]:gap-(--surface-gap-md)",
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
    // `legend` titles a fieldset at a fixed 16/24px, and `label` reads the label type pair to match a
    // `Field.Label`.
    variant: {
      legend: { legend: "text-base" },
      label: { legend: labelTypeClass },
    },
  },
  defaultVariants: {
    orientation: "vertical",
    variant: "legend",
  },
});
