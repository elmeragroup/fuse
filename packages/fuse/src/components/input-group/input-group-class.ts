import { cn } from "../../styles/cn";
import { readOnlyFillCancelClass } from "../../styles/field-box";
import { withinStateFaceControlClass } from "../../styles/state-face";
import { withinFocusRingControlClass } from "../../styles/utils";

/**
 * Chrome stripped off the embedded control: the Root owns border, radius, shadow, rings, the
 * disabled dim and the disabled and read-only fills, so the control contributes nothing but
 * its own box. The focus-visible and state-face neutralizations come from the shared within
 * adapters, never a local literal.
 */
export const inputGroupControlClass = cn(
  "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 disabled:bg-transparent",
  readOnlyFillCancelClass,
  withinFocusRingControlClass,
  withinStateFaceControlClass
);

/** The control chrome of an `<input>` in the group, which the field box's height never overflows. */
export const inputGroupInputControlClass = cn(inputGroupControlClass, "max-h-full");
