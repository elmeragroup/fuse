/**
 * Module-private Field recipes (field.md §4). Not exported from the public
 * entry — there is no proven recipe-borrowing use. `orientation` is the Root
 * axis; `heading` is the Label/Title shared class, resolved once at module
 * scope in `field.tsx`.
 */
import { tv } from "tailwind-variants";

export const fieldVariants = tv({
  slots: {
    root: "group/field flex w-full gap-3 data-invalid:text-error",
    heading: "text-sm font-medium flex w-fit gap-2 group-data-disabled/field:opacity-50",
  },
  variants: {
    orientation: {
      vertical: {
        root: "flex-col *:w-full [&>.sr-only]:w-auto",
      },
      horizontal: {
        root: "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-field-heading:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
      responsive: {
        root: "@md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-field-heading:flex-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px flex-col *:w-full [&>.sr-only]:w-auto",
      },
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});
