"use client";

import type { ComponentProps, ReactElement } from "react";

import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";

import { buttonVariants } from "../../components/button/button-variants";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { pickerPresetsShellClass } from "../../styles/inner-corner/picker";
import { datePickerStrings } from "../date-picker/intl";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";

// The preset pane both date pickers put beside their calendar. The public parts
// (`DatePickerPreset*`, `DateRangePickerPreset*`) differ only in their `data-slot` and in
// which RAC picker state an item closes, so each is a one-line wrapper over these.

/** The slice of RAC's DatePicker and DateRangePicker states a preset item closes. */
export type PickerOverlayState = { readonly isOpen: boolean; close(): void };

/** Props shared by both pickers' public preset groups. */
export type PickerPresetGroupProps = ComponentProps<typeof AriaRadioGroup> & {
  /**
   * Accessible name for the preset pane. An explicit `aria-label` wins over it, and
   * either wins over the `datePicker.presets` row of the locale dictionary.
   */
  label?: string;
};

/**
 * The quick-choice pane beside the calendar: a radio group whose options are the
 * caller's preset keys. Only one preset can be in effect at a time, which is why this is
 * a `radiogroup` and not a row of buttons.
 */
export function PickerPresetGroup({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: PickerPresetGroupProps): ReactElement {
  const strings = useLocalizedStrings(datePickerStrings);

  return (
    <AriaRadioGroup
      aria-label={ariaLabel ?? label ?? strings.format("presets")}
      {...props}
      className={composeTailwindRenderProps(className, cn(pickerPresetsShellClass, "flex flex-col gap-2"))}
    />
  );
}

/** Props shared by both pickers' public preset items. */
export type PickerPresetItemProps = ComponentProps<typeof AriaRadio> & {
  /**
   * Supporting copy carried alongside the preset, kept from the reference face.
   * RAC `Radio` renders only its children, so this never joins the accessible name.
   */
  description?: string;
  /**
   * Closes the picker dialog on double-click, after the caller's own `onDoubleClick`.
   * A pointer-only affordance: single click (and Space from the keyboard) selects
   * without closing, so nothing is reachable by pointer alone.
   */
  isCloseDialogOnDoubleClick?: boolean;
};

/**
 * One preset. Styled as a ghost `sm` button from the shared public `buttonVariants`
 * recipe so a preset reads as the affordance it is, and named by its visible
 * children — the library never synthesises copy from the item's `value`.
 */
export function PickerPresetItem({
  className,
  isCloseDialogOnDoubleClick,
  onDoubleClick,
  state,
  ...props
}: PickerPresetItemProps & { state: PickerOverlayState | null }): ReactElement {
  return (
    <AriaRadio
      {...props}
      className={composeTailwindRenderProps(
        className,
        cn(
          buttonVariants({
            size: "sm",
            variant: "ghost",
            // The radio's own indicator, if a caller's children render one, stays hidden,
            // because the preset is a button-shaped choice and not a bullet list.
            className:
              // oxlint-disable-next-line fuse/state-face -- a preset is an option row inside a popup list, and dropping pointer events keeps the pointer from highlighting a disabled preset
              "justify-start text-left *:data-[slot=radio-indicator]:hidden data-selected:bg-accent data-disabled:pointer-events-none",
          }),
          // A preset is a row in the preset group, so it reads the group's inner corner
          // instead of Button's `--radius-button`. `cn` knows `rounded-inner` as a radius, so
          // it replaces the recipe's corner, which the recipe's own merge would keep. With the
          // corner goes Button's branded label floor, so the preset keeps the control inset.
          "rounded-inner [--button-px-floor:0px]"
        )
      )}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);

        if (isCloseDialogOnDoubleClick === true && state !== null && state.isOpen) {
          state.close();
        }
      }}
    />
  );
}
