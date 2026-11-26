"use client";

// The parts both date pickers share around their inputs: the group (the field box), the calendar
// trigger, the popup and the preset pane. A picker Root (DatePicker's here, DateRangePicker's in
// its own module) provides `PickerShellContext`; these parts read only it.

import { createContext, use, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  RefCallback,
  RefObject,
} from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useStableCallback } from "../../hooks/use-stable-callback";
import { CalendarBlank } from "../../icons/generated/calendar-blank";
import { definedProps } from "../../internal/defined-props";
import { documentOrder, isElement } from "../../internal/dom-node";
import { fieldActionName } from "../../internal/field-action-name";
import { isRenderableNode } from "../../internal/is-renderable-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import type { ValueKind } from "../../temporal/temporal-value";
import { Button } from "../button/button";
import type { LabelButtonProps } from "../button/button";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { CalendarDayRegistryContext } from "../calendar/calendar-context";
import type { CalendarDayRegistration } from "../calendar/calendar-context";
import {
  CalendarDecrementMonth,
  CalendarHeader,
  CalendarIncrementMonth,
  CalendarMonths,
  CalendarVisibleRangeHeading,
} from "../calendar/calendar-parts";
import type { DateInputBoundary } from "../date-field/date-input-boundary";
import type { DateInputResetOwner } from "../date-field/date-input-reset";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../popover/popover";
import type { PopoverContentProps } from "../popover/popover";
import { datePickerVariants } from "./date-picker-variants";
import { datePickerStrings } from "./intl";
import type {
  DatePickerPresetValue,
  DatePickerPresetsValueChangeEventDetails,
  PickerOpenRequest,
  PickerPresetCommit,
  PickerPresetReader,
} from "./picker-change-details";
import { stateClassName } from "./picker-class-name";
import type { DatePickerClassName } from "./picker-class-name";

const styles = datePickerVariants();

/** What the shared parts read from a picker Root. */
export type PickerShellContextValue = {
  /** Whether the popup is open. */
  readonly open: boolean;
  /** Opens or closes the popup unless `onOpenChange` cancels; returns whether it changed. */
  readonly requestOpen: PickerOpenRequest;
  /** The trigger's id, which the trigger's and the popup's names start with. */
  readonly triggerId: string;
  /** The ids that label the picker: its visible label, or `undefined`. */
  readonly labelledBy: string | undefined;
  /** The picker's `aria-label` when it has no visible label. */
  readonly ariaLabel: string | undefined;
  /** The ids that describe the picker: its description and error. */
  readonly describedBy: string | undefined;
  /** Whether nothing responds. */
  readonly disabled: boolean;
  /** Whether the value cannot change; the trigger is disabled. */
  readonly readOnly: boolean;
  /** Whether the picker shows as invalid. */
  readonly invalid: boolean;
  /** The field box's size. */
  readonly size: "default" | "sm";
  /**
   * A preset pane announces itself, so a range calendar can drop rather than commit a half range,
   * with what to call when the picker's value is committed by anything but a preset press.
   */
  readonly registerPresets: PresetRegistration;
  /** Reads a preset's `dateValue` for this picker and binds its commit with the reason `"preset-press"`. */
  readonly readPreset: PickerPresetReader;
  /** Whether the picker is a range picker: its parts take the `range` layout. */
  readonly range: boolean;
  /** The inputs' focus boundary, which contains the popup; see `usePickerFocusBoundary`. */
  readonly inputBoundary: DateInputBoundary;
  /** Whether a node is inside one of this picker's inputs. */
  readonly containsInput: (node: Node) => boolean;
  /** Focuses the picker's first segment, which a range label press does; see `usePickerFocusBoundary`. */
  readonly focusFirstSegment: () => void;
  /** The popup element's ref, which marks the popup's blurs; see `usePickerFocusBoundary`. */
  readonly attachPopup: RefCallback<HTMLElement>;
  /** The segment focus was on when the popup opened, which takes focus back when it closes. */
  readonly openerRef: RefObject<HTMLElement | null>;
  /**
   * The kind the picker's values take. An empty Input part takes it in place of resolving its own,
   * so it forms the kind and zone the picker resolved; see `date-input-kind.ts`. An Input part
   * holding a value takes that value's own kind.
   */
  readonly kind: ValueKind;
  /**
   * The object that the picker's own inputs, its Input and TimeInput parts, register their form
   * reset with; see `date-input-reset.ts`. Any other DateInput in a custom popup keeps its own
   * form reset.
   */
  readonly resetOwner: DateInputResetOwner;
};

/**
 * A preset pane announcing itself to its picker Root, with what to call when the picker's value is
 * committed by anything but a preset press; returns the pane's unregistration.
 */
export type PresetRegistration = (onValueCommitted: () => void) => () => void;

export const PickerShellContext = createContext<PickerShellContextValue | undefined>(undefined);

/**
 * The enclosing picker Root.
 *
 * @param part - The part asking, named in the error.
 * @returns The Root's shell context.
 * @throws Error naming the part when it renders outside a picker Root, a composition defect.
 */
export function usePickerShellContext(part: string): PickerShellContextValue {
  const value = use(PickerShellContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside DatePicker.Root or DateRangePicker.Root.`);
  }
  return value;
}

/** What a picker Root keeps of its preset panes. */
export type PresetRegistry = {
  /** Whether a preset pane is rendered. */
  readonly hasPresets: boolean;
  /** The callback a pane announces itself with; see `PickerShellContextValue.registerPresets`. */
  readonly registerPresets: PresetRegistration;
  /** Tells every pane that something other than a preset press committed the picker's value. */
  readonly valueCommitted: () => void;
};

/**
 * A picker Root's preset panes: whether one renders, and the panes to tell when the value is
 * committed by a day, an edit, a time or a form reset, so an uncontrolled pane clears its key.
 * The Root calls `valueCommitted` from its commit path, never by comparing values.
 *
 * @returns The registry.
 */
export function usePresetRegistry(): PresetRegistry {
  const [count, setCount] = useState(0);
  const listeners = useRef(new Set<() => void>());
  const registerPresets = useCallback((onValueCommitted: () => void) => {
    listeners.current.add(onValueCommitted);
    setCount((current) => current + 1);
    return () => {
      listeners.current.delete(onValueCommitted);
      setCount((current) => current - 1);
    };
  }, []);
  const valueCommitted = useCallback(() => {
    for (const listener of listeners.current) {
      listener();
    }
  }, []);
  return { hasPresets: count > 0, registerPresets, valueCommitted };
}

/**
 * Base UI Popover's Root, with every open change it asks for going through the picker's
 * transaction: a canceled transaction cancels Base UI's details too.
 */
export function PickerPopoverRoot({
  open,
  requestOpen,
  children,
}: {
  readonly open: boolean;
  readonly requestOpen: PickerOpenRequest;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <PopoverRoot
      open={open}
      onOpenChange={(next, details) => {
        if (!requestOpen(next, details.reason, details.event, details.trigger)) {
          details.cancel();
        }
      }}>
      {children}
    </PopoverRoot>
  );
}

/** The state a picker's Root and group share with their `render` callbacks and write as data attributes. */
export type PickerState = {
  /** Whether the popup is open. Written as `data-open`. */
  readonly open: boolean;
  /** Whether nothing responds. Written as `data-disabled`. */
  readonly disabled: boolean;
  /** Whether the value cannot change. Written as `data-readonly`. */
  readonly readonly: boolean;
  /** Whether the picker shows as invalid. Written as `data-invalid="true"`. */
  readonly invalid: boolean;
};

/** How `PickerState` is written: `invalid` as `data-invalid="true"`, the rest as Base UI writes them. */
export const PICKER_STATE_ATTRIBUTES = {
  invalid: (value: boolean) => (value ? { "data-invalid": "true" } : null),
};

/** The state handed to the class callback of a part that has none of its own. */
export const NO_STATE = {};

/** The state the group shares with its `render` callback and writes as data attributes. */
// A mapped copy, so the public name is a type of its own, which prints as itself rather than as
// the private `PickerState`, and keeps each field's documentation.
export type DatePickerGroupState = { readonly [K in keyof PickerState]: PickerState[K] };

/** Props for `DatePicker.Group`: a `div`'s props plus Base UI's `render`. */
export type DatePickerGroupProps = Omit<
  useRender.ComponentProps<"div", DatePickerGroupState>,
  "className"
> & {
  /** Extra classes, or a callback of the group's state that returns them. */
  className?: DatePickerClassName<DatePickerGroupState>;
};

/**
 * The field box around the inputs and the trigger: a `group` named by the picker's label and
 * described by its description and error, written `data-slot="field-group"`. Alt+ArrowDown in it
 * opens the popup with `reason: "keyboard"`, before the segment under focus sees the key.
 */
export function DatePickerGroup({ className, render, ...props }: DatePickerGroupProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Group");
  const { labelledBy, ariaLabel, describedBy, disabled, readOnly, invalid, open, size, range } = shell;
  const state = useMemo(
    (): DatePickerGroupState => ({ open, disabled, readonly: readOnly, invalid }),
    [open, disabled, readOnly, invalid]
  );
  return useRender({
    defaultTagName: "div",
    render,
    state,
    stateAttributesMapping: PICKER_STATE_ATTRIBUTES,
    props: {
      "data-slot": "field-group",
      "data-size": size,
      ...mergeProps<"div">(
        {
          role: "group",
          "aria-labelledby": labelledBy,
          "aria-label": labelledBy === undefined ? ariaLabel : undefined,
          "aria-describedby": describedBy,
          "aria-disabled": disabled || undefined,
          className: stateClassName(className, state, styles.group({ size, range })),
          onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
            // React Aria's shortcut: Alt+ArrowDown opens the calendar. Taken in capture, so the
            // segment under focus does not step its value.
            if (event.altKey && event.key === "ArrowDown" && !open && !disabled && !readOnly) {
              event.preventDefault();
              event.stopPropagation();
              shell.requestOpen(
                true,
                "keyboard",
                event.nativeEvent,
                isElement(event.target) ? event.target : undefined
              );
            }
          },
        },
        // `undefined` from a consumer must not erase the group's name or description.
        definedProps(props)
      ),
    },
  });
}

/**
 * Props for `DatePicker.Trigger`: Button's props without its name and size. The trigger is an icon
 * button named "Calendar" and the picker's label, sized to the field box.
 */
export type DatePickerTriggerProps = Omit<LabelButtonProps, "size" | "aria-label" | "aria-labelledby">;

/**
 * The calendar button inside the group. It opens the popup with `reason: "trigger-press"`. It is
 * named "Calendar" plus the picker's label, such as "Calendar Start date", as React Aria names its
 * button, with `aria-haspopup="dialog"`. Its own `disabled`, or a disabled or read-only picker, disables it.
 */
export function DatePickerTrigger({
  className,
  children,
  disabled: disabledProp = false,
  ...props
}: DatePickerTriggerProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Trigger");
  const strings = useLocalizedStrings(datePickerStrings);
  const { triggerId, labelledBy, ariaLabel, describedBy, readOnly, containsInput } = shell;
  const disabled = disabledProp || shell.disabled;
  const name = fieldActionName({
    id: triggerId,
    name: strings.format("calendar"),
    fieldLabelId: labelledBy,
    fieldAriaLabel: ariaLabel,
  });
  // As PopoverInfoButton's trigger: the Button keeps its presentation, `aria-label` (an icon size
  // requires it) and `disabled` (so it styles itself disabled); the trigger states the rest.
  const button = (
    <Button
      {...definedProps(props)}
      data-slot="date-picker-trigger"
      variant={props.variant ?? "ghost"}
      size="icon-sm"
      aria-label={name["aria-label"]}
      disabled={disabled || readOnly}
      className={cn(styles.trigger(), className)}
    />
  );
  return (
    <PopoverTrigger
      id={triggerId}
      disabled={disabled || readOnly}
      onMouseDown={(event) => {
        // A press on the trigger leaves focus in the input it came from, so opening the calendar
        // is no blur of that input (the focus boundary): focus goes from the input to the popup.
        const active = event.currentTarget.ownerDocument.activeElement;
        if (active !== null && containsInput(active)) {
          event.preventDefault();
        }
      }}
      {...name}
      aria-describedby={describedBy}
      render={button}>
      {children ?? <CalendarBlank aria-hidden="true" className={styles.icon()} />}
    </PopoverTrigger>
  );
}

/** Props for `DatePicker.Popup`: Popover's content props. */
export type DatePickerPopupProps = PopoverContentProps;

/**
 * The popup the trigger opens: a Popover `dialog` named as the trigger is, such as "Calendar Start
 * date", as React Aria's dialog is. Opening moves focus to the calendar's focused day, the selected one
 * or today; closing returns it to the segment it opened from, or to the trigger. Focus inside it
 * does not leave the picker.
 */
export function DatePickerPopup({
  className,
  children,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: DatePickerPopupProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Popup");
  const { triggerId, labelledBy, inputBoundary, attachPopup, openerRef } = shell;
  const mergedRef = useMergedRefs<HTMLDivElement>(attachPopup, ref ?? null);
  // Every calendar's days register here. On open, the first day whose rendered `tabIndex` is 0 takes
  // focus. That is the tab stop, or a day that a consumer's props made one. `inputBoundary.contains`
  // checks only the popup's own tree, which `documentOrder` ranks. This lookup does not support day
  // buttons inside shadow roots; see #713.
  const days = useRef(new Set<HTMLElement>());
  const registerDay = useCallback<CalendarDayRegistration>((button) => {
    days.current.add(button);
    return () => {
      days.current.delete(button);
    };
  }, []);
  const firstTabStop = (): HTMLElement | undefined =>
    [...days.current]
      .filter((day) => day.tabIndex === 0 && inputBoundary.contains(day))
      .sort(documentOrder)[0];
  // The provider renders outside the Popover content, so the calendars inside a `render` element
  // with its own children, which replace the content's, still register.
  return (
    <CalendarDayRegistryContext value={registerDay}>
      <PopoverContent
        data-slot="date-picker-popup"
        side="bottom"
        align="end"
        aria-labelledby={labelledBy === undefined ? triggerId : `${triggerId} ${labelledBy}`}
        initialFocus={initialFocus ?? (() => firstTabStop() ?? true)}
        // Back to the segment the popup opened from, as React Aria restores it; else the trigger.
        finalFocus={
          finalFocus ?? (() => (openerRef.current?.isConnected === true ? openerRef.current : true))
        }
        ref={mergedRef}
        className={mergeClassName(className, styles.popup())}
        {...definedProps(props)}>
        {children}
      </PopoverContent>
    </CalendarDayRegistryContext>
  );
}

/** What a preset reads from its pane. */
type PresetsContextValue = {
  /** The checked preset's key: the parent's, or the pane's own; `null` for none. */
  readonly value: string | null;
  readonly disabled: boolean;
  readonly name: string;
  /** A preset was pressed or chosen by key, or activated again while checked. See `DatePickerPresets`. */
  readonly activate: (
    key: string,
    commitPreset: PickerPresetCommit | undefined,
    event: Event,
    trigger: Element
  ) => void;
};

const PresetsContext = createContext<PresetsContextValue | undefined>(undefined);

/** Props for `DatePicker.Presets`: a `div`'s props, Base UI's `render` and the pane's own. */
export type DatePickerPresetsProps = Omit<useRender.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /**
   * The `DatePicker.PresetItem`s. Each is a native radio inside its label, so the whole row is the
   * target, and the arrow keys move between them.
   */
  children?: useRender.ComponentProps<"div">["children"];
  /**
   * The checked preset's value, when the parent owns it. `null` checks none. Clear it in the
   * picker's `onValueChange` when the value changes any other way.
   */
  value?: string | null;
  /**
   * The preset checked first, when the pane owns its value. Such a pane clears its key when the
   * picker's value changes any other way: a day, typing, a time or a form reset.
   */
  defaultValue?: string | null;
  /**
   * Called with the key of a preset pressed or chosen by key while it was not checked. A preset
   * without a `dateValue` is the caller's key to map to a date or a range and set the picker's
   * value. For a preset with one, the picker's `onValueChange` runs first: canceling there refuses
   * the whole press, and this is never called. This runs once the picker's value is committed;
   * canceling it keeps the checked preset as it was, and does not undo that value.
   * `details.reason` is `"preset-press"`, `details.event` the DOM event and `details.trigger` the
   * preset's radio.
   */
  onValueChange?: (value: string, details: DatePickerPresetsValueChangeEventDetails) => void;
  /** The pane's accessible name. An explicit `aria-label` wins over it; both win over "Date presets". */
  label?: string;
  /** Whether no preset responds. A disabled or read-only picker disables its presets too. */
  disabled?: boolean;
};

/**
 * The quick-choice pane beside the calendar: a `radiogroup` whose presets are native radios inside
 * their labels, so the label is the hit area, arrow keys move between them and only one is in
 * effect. It makes a range picker's calendar drop a half-picked range when focus leaves it, rather
 * than commit it, since leaving the grid then means reaching for a preset.
 */
export function DatePickerPresets({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  label,
  disabled: disabledProp = false,
  className,
  render,
  ...props
}: DatePickerPresetsProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Presets");
  // A disabled or read-only picker's presets do not respond either.
  const disabled = disabledProp || shell.disabled || shell.readOnly;
  const strings = useLocalizedStrings(datePickerStrings);
  const [own, setOwn] = useState<string | null>(defaultValue);
  const value = valueProp === undefined ? own : valueProp;
  const name = useId();
  // The pane's own key follows its presses alone: a value the picker commits any other way (a day,
  // typing, a time, a form reset) clears it, as the Root tells it from its commit path. A key the
  // parent controls is the parent's to clear.
  const { registerPresets } = shell;
  useLayoutEffect(() => registerPresets(() => setOwn(null)), [registerPresets]);
  const activate = useStableCallback(
    (next: string, commitPreset: PickerPresetCommit | undefined, event: Event, trigger: Element): void => {
      // Each callback refuses what it owns. The picker's value first: its cancel refuses the whole
      // press, and the pane is never asked. Then a new key, the pane's: its cancel keeps the checked
      // preset, though the value is already committed. A checked preset activated again commits its
      // `dateValue` again and reports no new key.
      if (commitPreset !== undefined && !commitPreset(event, trigger)) {
        return;
      }
      if (next === value) {
        return;
      }
      const details = createChangeEventDetails("preset-press", event, trigger, {});
      onValueChange?.(next, details);
      if (!details.isCanceled) {
        setOwn(next);
      }
    }
  );
  const context = useMemo(
    (): PresetsContextValue => ({ value, disabled, name, activate }),
    [value, disabled, name, activate]
  );
  const element = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "date-picker-presets",
      ...mergeProps<"div">(
        {
          role: "radiogroup",
          "aria-label": label ?? strings.format("presets"),
          "aria-disabled": disabled || undefined,
          className: stateClassName(className, NO_STATE, styles.presets()),
        },
        definedProps(props)
      ),
    },
  });
  return <PresetsContext value={context}>{element}</PresetsContext>;
}

/** The state a preset shares with its `render` callback and writes as data attributes. */
export type DatePickerPresetItemState = {
  /** Whether it is the pane's value. Written as `data-checked`. */
  readonly checked: boolean;
  /** Whether it does not respond. Written as `data-disabled`. */
  readonly disabled: boolean;
};

/** Props for `DatePicker.PresetItem`: a `label`'s props, Base UI's `render` and the preset's own. */
export type DatePickerPresetItemProps = Omit<
  useRender.ComponentProps<"label", DatePickerPresetItemState>,
  "children" | "className" | "render"
> & {
  /** Extra classes, or a callback of the preset's state that returns them. */
  className?: DatePickerClassName<DatePickerPresetItemState>;
  /**
   * The element that replaces the host `<label>`, or a callback of its props and state that
   * returns one. Either way, keep the preset's children directly inside the DOM element that
   * receives its props. The focus ring reads the radio as that element's direct child, so a wrapper
   * around the children hides keyboard focus.
   */
  render?: useRender.ComponentProps<"label", DatePickerPresetItemState>["render"];
  /** The preset's key, which the pane reports. */
  value: string;
  /**
   * What pressing the preset sets the picker to: a Temporal value of the picker's kind in
   * `DatePicker.Root`, a `{ start, end }` range of them in `DateRangePicker.Root`. Every
   * activation commits it through the picker's `onValueChange` with the reason `"preset-press"`: a
   * press, Space or Enter, also on the preset already checked, so it applies again after a day
   * picked or typed since. Each callback refuses what it owns: the picker's `onValueChange` runs
   * first, and canceling it refuses the whole press: the value and the checked preset stay, and
   * the pane's `onValueChange` is not called. For a preset not yet checked, the pane's runs next,
   * and canceling it keeps the checked preset but not the value, already committed. Which preset is
   * checked is the pane's key alone, never a match of dates: a pane that owns its key clears it
   * when the picker's value is committed any other way, by a day, typing, a time or a form reset, and
   * a key the parent controls is the parent's to clear. Without it the preset is
   * only a key, which the pane's `onValueChange` maps to a value. Build it in a client component.
   * A value of another kind than the picker's, a range in `DatePicker.Root` or one value in
   * `DateRangePicker.Root` throws a `TypeError` while the preset renders.
   */
  dateValue?: DatePickerPresetValue;
  /** Whether it does not respond. */
  disabled?: boolean;
  /**
   * Whether a double-click closes the popup, with `reason: "preset-press"`, after the item's own
   * `onDoubleClick`. It is a pointer shortcut. A click or Space selects without closing.
   */
  closeOnDoubleClick?: boolean;
  /** The visible name, which names the radio. */
  children?: ReactNode;
};

/**
 * One preset: a native radio inside its label, styled as a ghost `sm` button and filled while
 * checked. It is named by its children; the pane never writes copy from its value.
 */
export function DatePickerPresetItem({
  value,
  dateValue,
  disabled: disabledProp = false,
  closeOnDoubleClick = false,
  className,
  render,
  children,
  ...props
}: DatePickerPresetItemProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.PresetItem");
  const presets = use(PresetsContext);
  if (presets === undefined) {
    throw new Error("DatePicker.PresetItem must be rendered inside DatePicker.Presets.");
  }
  const disabled = disabledProp || presets.disabled;
  // Read while rendering, as the Root reads its own value props, so a value the picker does not
  // take throws at mount rather than on a press.
  const { readPreset } = shell;
  const commitPreset = useMemo(
    () => (dateValue === undefined ? undefined : readPreset(dateValue)),
    [dateValue, readPreset]
  );
  const checked = presets.value === value;
  const state = useMemo((): DatePickerPresetItemState => ({ checked, disabled }), [checked, disabled]);
  return useRender({
    defaultTagName: "label",
    render,
    state,
    props: {
      "data-slot": "date-picker-preset-item",
      ...mergeProps<"label">(
        {
          className: stateClassName(className, state, styles.preset()),
          onDoubleClick(event: MouseEvent<HTMLLabelElement>) {
            if (closeOnDoubleClick && !disabled && shell.open) {
              shell.requestOpen(false, "preset-press", event.nativeEvent, event.currentTarget);
            }
          },
          children: (
            <>
              <input
                type="radio"
                className={styles.presetInput()}
                data-focus-ring-control=""
                name={presets.name}
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  // A press, Space or an arrow key checking this preset. A canceled press leaves
                  // the pane's value as it was, and React puts the controlled radios back to it.
                  if (event.currentTarget.checked) {
                    presets.activate(value, commitPreset, event.nativeEvent, event.currentTarget);
                  }
                }}
                onClick={(event: MouseEvent<HTMLInputElement>) => {
                  // A press on the checked preset changes no radio, so no `change` comes: it
                  // applies the preset again, after another gesture moved the value.
                  if (checked) {
                    presets.activate(value, commitPreset, event.nativeEvent, event.currentTarget);
                  }
                }}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  // Enter activates a preset as a press does, as Base UI's Radio takes it, and
                  // never submits a form around the picker; Space on the checked preset applies it
                  // again, where an unchecked one checks natively and reports through `change`.
                  // Preventing the key's default keeps the engine from following it with a click,
                  // so the key is one activation.
                  const enter = event.key === "Enter";
                  if (!enter && !(event.key === " " && checked)) {
                    return;
                  }
                  event.preventDefault();
                  if (!disabled) {
                    presets.activate(value, commitPreset, event.nativeEvent, event.currentTarget);
                  }
                }}
              />
              {children}
            </>
          ),
        },
        definedProps(props)
      ),
    },
  });
}

/** The standard calendar inside a picker's popup: month buttons around the heading, then the months. */
export function DefaultCalendarChildren(): ReactElement {
  return (
    <>
      <CalendarHeader>
        <CalendarDecrementMonth />
        <CalendarVisibleRangeHeading />
        <CalendarIncrementMonth />
      </CalendarHeader>
      <CalendarMonths />
    </>
  );
}

/**
 * The popup's content in a Field composite: the calendar alone, or the preset pane beside it when
 * `presets` renders anything.
 */
export function PickerPopupPane({
  presets,
  children,
}: {
  readonly presets: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  return isRenderableNode(presets) ? (
    <div className={styles.pane()}>
      {presets}
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
