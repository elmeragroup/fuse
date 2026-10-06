"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";

import { buttonVariants } from "../../components/button/button-variants";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { compactCornerClass } from "../../styles/corner-radius";
import { datePickerStrings } from "../date-picker/intl";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";

// The preset pane both date pickers put beside their calendar. The public parts
// (`DatePickerPreset*`, `DateRangePickerPreset*`) differ only in their `data-slot` and in
// which RAC picker state an item closes, so each is a one-line wrapper over these.

/**
 * Whether a node a caller handed us would paint anything. `presetGroup={showPresets &&
 * <PresetGroup />}` is the idiomatic conditional, so `false` — like `null`, `undefined`
 * and `""` — has to read as "no preset pane" and leave the dialog in its single-pane
 * layout.
 */
export function isRenderableNode(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

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
      className={composeTailwindRenderProps(className, "flex flex-col gap-2 p-2")}
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
        buttonVariants({
          size: "sm",
          variant: "ghost",
          // The radio's own indicator, if a caller's children render one, stays hidden,
          // because the preset is a button-shaped choice and not a bullet list. A preset is
          // a row in a list, so it takes the compact corner instead of Button's
          // `--radius-button`.
          className: cn(
            "justify-start text-left *:data-[slot=radio-indicator]:hidden data-selected:bg-accent data-disabled:pointer-events-none",
            compactCornerClass
          ),
        })
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
