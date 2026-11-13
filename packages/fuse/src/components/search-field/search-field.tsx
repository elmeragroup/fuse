"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, ComponentProps, KeyboardEvent, ReactElement, ReactNode } from "react";

import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";

import { useEarlyInputValue } from "../../hooks/use-early-input-value";
import { useFormReset } from "../../hooks/use-form-reset";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { X } from "../../icons/generated/x";
import { definedProps } from "../../internal/defined-props";
import { isComposing } from "../../internal/is-composing";
import { FieldFrame } from "../field/field-frame";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupRoot,
} from "../input-group/input-group";
import { searchFieldStrings } from "./intl";

/**
 * The props of {@link SearchField}: the labeled-composite face TextField takes, the search
 * callbacks, and the remaining native input attributes, which reach the `<input>`.
 */
export type SearchFieldProps = {
  /** Visible label, rendered as `Field.Label`. It names the searchbox. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` while the field is invalid: through `isInvalid`, its own
   * constraint validation or an error `Form` holds under its `name`. Without it, the field shows
   * that `Form` error or the native constraint message itself.
   */
  errorMessage?: ReactNode;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value, restored by a native form reset. */
  defaultValue?: string;
  /** Called with the string value, not the native event, on every edit and on a clear. */
  onChange?: (value: string) => void;
  /**
   * Called with the value on a plain Enter, not on a held key's repeats or an Enter with Alt,
   * Control, Meta or Shift. Given, Enter in an editable field never submits the surrounding form;
   * omitted, Enter keeps its native behaviour and submits it.
   */
  onSubmit?: (value: string) => void;
  /** Called after the clear button or Escape empties the field. */
  onClear?: () => void;
  /** Native `name` forwarded to the inner input. Inside a `Form`, its errors are keyed by it. */
  name?: string;
  /** Native `placeholder` forwarded to the inner input. */
  placeholder?: string;
  /**
   * Accessible name of the clear button. Defaults to the `searchField.clear` row of the locale
   * dictionary; an explicit string wins.
   */
  clearLabel?: string;
  /**
   * Forwards `readOnly` to the inner input, which then takes the muted read-only fill. It also
   * disables the clear button, Enter and Escape.
   */
  isReadOnly?: boolean;
  /** Forwards `disabled` to `Field.Root` and the inner input, and disables the clear button. */
  isDisabled?: boolean;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwards `required` to the inner input. */
  isRequired?: boolean;
  /**
   * Control size of the field box. Emitted as `data-size`. `"default"` maps to the `md` control
   * size; `"sm"` maps to the `sm` control size. The clear button follows it.
   * @default "default"
   */
  size?: "sm" | "default";
  /** Extra classes, merged onto the root. */
  className?: string;
} & Omit<
  ComponentProps<"input">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "onSubmit"
  | "name"
  | "placeholder"
  | "className"
  | "disabled"
  | "readOnly"
  | "required"
  | "size"
  | "type"
  | "children"
>;

type SearchFieldClearProps = {
  /** The button's accessible name. */
  label: string;
  isReadOnly: boolean;
  onPress: () => void;
};

/**
 * The clear button, inside `Field.Root` so it reads the field's disabled state, which a disabled
 * `Field.Set` around the field also sets. It is out of the tab order, since Escape clears from the
 * input, and a press keeps focus on the input, which on touch keeps the keyboard up.
 */
function SearchFieldClear({ label, isReadOnly, onPress }: SearchFieldClearProps): ReactElement {
  const field = useFieldRootContext();
  return (
    <InputGroupAddon align="inline-end">
      <InputGroupButton
        size="icon-sm"
        aria-label={label}
        tabIndex={-1}
        disabled={isReadOnly || field.disabled}
        // Hidden while the field is empty, keeping its space so the text does not shift.
        className="group-data-empty/field:invisible"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={onPress}>
        <X aria-hidden />
      </InputGroupButton>
    </InputGroupAddon>
  );
}

/**
 * Whether the keydown is one React Aria's SearchField leaves alone: a held key's auto-repeat, or a
 * key with a modifier. Its `useKeyboard` skips repeats, and its shortcut table matches `Enter` and
 * `Escape` only without Alt, Control, Meta or Shift.
 */
function isRepeatOrModified(event: KeyboardEvent): boolean {
  return event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * Labeled search composite over Field and InputGroup: a `<input type="search">` with a leading
 * magnifying glass and a clear button. Client component, because it owns the uncontrolled value,
 * the clear button and the Enter and Escape keys.
 *
 * Escape empties a non-empty field and stops there, so a Dialog or Sheet around it stays open; on
 * an empty field it passes through. Given `onSubmit`, no Enter in an editable field submits the
 * surrounding form, and only a plain Enter calls `onSubmit`: not a held key's repeats, and not an
 * Enter with Alt, Control, Meta or Shift. Other repeats and modified keys, Escape among them, pass
 * through untouched. A read-only field leaves both keys to the browser; a disabled input takes no
 * keys. The root carries `data-empty` while the value is empty.
 */
export function SearchField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  onSubmit,
  onClear,
  name,
  placeholder,
  clearLabel,
  isReadOnly = false,
  isDisabled = false,
  isInvalid = false,
  isRequired = false,
  size = "default",
  className,
  onKeyDown,
  ref,
  ...props
}: SearchFieldProps): ReactElement {
  const strings = useLocalizedStrings(searchFieldStrings);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);
  const isControlled = value !== undefined;
  // The field always hands Field.Control a value, so a clear reaches the DOM, and Base UI's dirty,
  // filled and error state, whether or not the caller controls it.
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? value : uncontrolledValue;
  const { clearErrors } = useFormContext();
  useFormReset(
    inputRef,
    isControlled
      ? null
      : () => {
          setUncontrolledValue(defaultValue ?? "");
        }
  );

  function commit(next: string): void {
    if (!isControlled) {
      setUncontrolledValue(next);
    }
    onChange?.(next);
  }

  // Text typed (or autofilled) before hydration is proposed as an edit.
  useEarlyInputValue(inputRef, currentValue, isReadOnly || isDisabled ? null : commit);

  function clear(): void {
    commit("");
    onClear?.();
  }

  // The value React holds is already empty, so no render writes the scripted text back, and
  // Field.Control, which clears a Form error when its value changes, sees no change. Empty the
  // input and clear the error under `name` as Field.Control does.
  function clearScriptedText(input: HTMLInputElement): void {
    input.value = "";
    if (name !== undefined) {
      clearErrors(name);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    commit(event.currentTarget.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    onKeyDown?.(event);
    if (event.defaultPrevented || isReadOnly || isComposing(event)) {
      return;
    }
    if (event.key === "Enter" && onSubmit) {
      // Enter on an input submits its form; `onSubmit` takes that over, repeats and modifiers too.
      event.preventDefault();
      if (!isRepeatOrModified(event)) {
        onSubmit(currentValue);
      }
      return;
    }
    if (isRepeatOrModified(event)) {
      return;
    }
    if (event.key === "Escape" && (currentValue !== "" || event.currentTarget.value !== "")) {
      event.preventDefault();
      // Base UI's overlay dismiss ignores defaultPrevented, so stop the Escape reaching an overlay.
      event.stopPropagation();
      if (currentValue === "") {
        clearScriptedText(event.currentTarget);
      }
      clear();
    }
  }

  function handleClearPress(): void {
    clear();
    inputRef.current?.focus();
  }

  return (
    <FieldFrame
      isEmpty={currentValue === ""}
      className={className}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}
      // The copy shows only while the field is invalid.
      isErrorMessageAlwaysShown={isInvalid}>
      <InputGroupRoot size={size}>
        <InputGroupAddon align="inline-start" className="text-foreground">
          <MagnifyingGlass aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          name={name}
          placeholder={placeholder}
          // The native cancel button would double the clear button.
          className="[&::-webkit-search-cancel-button]:hidden"
          {...definedProps(props)}
          ref={mergedRef}
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={isReadOnly}
          required={isRequired}
          disabled={isDisabled}
        />
        <SearchFieldClear
          label={clearLabel ?? strings.format("clear")}
          isReadOnly={isReadOnly}
          onPress={handleClearPress}
        />
      </InputGroupRoot>
    </FieldFrame>
  );
}

SearchField.displayName = "SearchField";
