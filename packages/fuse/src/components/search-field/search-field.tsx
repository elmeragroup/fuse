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
  /**
   * The visible label, rendered as `Field.Label`, which names the searchbox. Without it, name the
   * field with `aria-label`.
   */
  label?: string;
  /** Supporting text, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` while the field is invalid: through `isInvalid`,
   * its own constraint check, or an error `Form` holds under its `name`. Without it, the field
   * shows that `Form` error or the browser's constraint message.
   */
  errorMessage?: ReactNode;
  /** The value, for a controlled field. */
  value?: string;
  /** The starting value of an uncontrolled field. A native form reset restores it. */
  defaultValue?: string;
  /** Called with the input's text on every edit and on a clear. */
  onChange?: (value: string) => void;
  /**
   * Called with the value on a plain Enter, not on a held key's repeats or an Enter with Alt,
   * Control, Meta or Shift. With it, no Enter in an editable field submits the surrounding form.
   * Without it, Enter submits the form, as in any text input.
   */
  onSubmit?: (value: string) => void;
  /**
   * Called after the clear button or Escape empties the field. Escape empties a field that holds
   * text and stops there, so a `Dialog` or `Sheet` around the field stays open. On an empty field,
   * Escape reaches them and closes them as usual.
   */
  onClear?: () => void;
  /**
   * The name the input submits its text under. Inside a `Form`, the field shows the error the
   * form holds under this name, and an edit or a clear removes it.
   */
  name?: string;
  /** The input's placeholder text. */
  placeholder?: string;
  /**
   * The clear button's name. It defaults to the `searchField.clear` row of the locale dictionary,
   * "Clear search" in English. The button shows while the field holds text. It is out of the tab
   * order, since Escape clears from the input, and a press keeps focus, and on touch the
   * on-screen keyboard, on the input.
   */
  clearLabel?: string;
  /**
   * Makes the input read-only, with the muted read-only fill. It disables the clear button, Escape
   * no longer clears, and `onSubmit` no longer runs. Enter and Escape keep their native behavior,
   * so Enter can submit a surrounding form and Escape can close an enclosing `Dialog`.
   */
  isReadOnly?: boolean;
  /** Disables the field, the input and the clear button. */
  isDisabled?: boolean;
  /** Marks the field invalid, with the invalid look. */
  isInvalid?: boolean;
  /** Makes the input required, so the browser's constraint check blocks an empty submit. */
  isRequired?: boolean;
  /**
   * The control size of the field box, also written as `data-size`. `default` is the md control
   * size, and `sm` the sm one. The clear button follows it.
   */
  size?: "sm" | "default";
  /** Extra classes for the field's root. */
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
 * A labeled search field: an `<input type="search">` with a magnifying glass and a clear button.
 * It is a client component, because it holds the uncontrolled value, the clear button and the
 * Enter and Escape keys. Other key repeats and modified keys, Escape among them, pass through. A
 * read-only field leaves both keys to the browser, and a disabled input takes no keys. The root
 * carries `data-empty` while the value is empty.
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
