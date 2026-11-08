import { cn } from "./cn";

/**
 * The base of a popup trigger's caret, shared by Select, Combobox, Autocomplete and
 * NavigationMenu: a 16px icon in the muted color that ignores the pointer and turns over 200ms.
 * Each recipe appends the rotation its trigger's open state drives.
 *
 * `shrink-0` stays out of the base. The public `Combobox.Trigger` and `Autocomplete.Trigger`
 * render a bare Base UI button, so a consumer that styles one as a flex row decides how its
 * caret yields to a long label. NavigationMenu's caret adds `shrink-0` itself.
 */
export const triggerCaretClass = cn(
  "ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200"
);
