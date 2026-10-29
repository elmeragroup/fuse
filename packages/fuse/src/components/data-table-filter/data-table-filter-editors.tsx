"use client";

// The kind editors. Each renders only when the edited field has its kind, the way Command.Page
// renders only on top of its stack, so no shared component switches on the kind. None sits inside
// a list's key handler, so Home, End and the arrows edit text as they should.

import { useEffect, useId, useState } from "react";
import type { ComponentProps, KeyboardEvent, ReactElement, ReactNode } from "react";

import { useMediaQuery } from "../../hooks/use-media-query";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { definedProps } from "../../internal/defined-props";
import { numberFormat } from "../../internal/intl-cache";
import { isBackspaceOnEmpty } from "../../internal/is-backspace-on-empty";
import { cn } from "../../styles/cn";
import {
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
  ComboboxSeparator,
} from "../combobox/combobox";
import { FieldLabel, FieldRoot } from "../field/field";
import { InputGroupAddon, InputGroupInput, InputGroupRoot } from "../input-group/input-group";
import { Input } from "../input/input";
import { Kbd } from "../kbd/kbd";
import { NumberField } from "../number-field/number-field";
import { Slider } from "../slider/slider";
import { ToggleGroupItem, ToggleGroupRoot } from "../toggle-group/toggle-group";
import { useFilterInternals, useFocusRequest } from "./data-table-filter-context";
import type { DraftValues, EditorContextValue } from "./data-table-filter-editor-context";
import { useKindEditor } from "./data-table-filter-editor-context";
import { ValueListProvider } from "./data-table-filter-values-footer";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { DEFAULT_DATE_PRESETS, datePresetRange, isOneDayPreset } from "./date-presets";
import type { DatePresetKey } from "./date-presets";
import { completeValues, draftSays, stepBounds } from "./editor-draft";
import type { DateFilterField, FilterOption, NumberFilterField, TextFilterField } from "./filter-fields";
import { calendarDateIn } from "./filter-match";
import type { FilterOperator, IsoDate } from "./filter-model";
import { allowedOperators, isFiniteNumber, isIsoDate, isOperatorOf, targetOf } from "./filter-model";
import {
  LIST_KINDS,
  listSource,
  matchOptions,
  OPTION_LIMIT,
  pickedValues,
  snapshotOrder,
} from "./option-list";
import type { ListField } from "./option-list";
import { useContains } from "./use-contains";

/** The props every kind editor takes: its body's element. */
export type DataTableFilterKindEditorProps = ComponentProps<"div">;

// Option, multi-option and boolean: an inline Base UI Combobox with `multiple`, so the list is
// aria-multiselectable and each row states its selection. Each toggle applies at once.

/**
 * How many rows hold an option, beside its label in a list. Hidden from assistive technology, so
 * the option's name stays "Paid".
 */
export function OptionCount({ count }: { readonly count: number }): ReactElement {
  const { meta } = useFilterInternals("DataTableFilter.OptionCount");
  return (
    <span aria-hidden data-slot="data-table-filter-count" className={slots.count()}>
      {numberFormat(meta.locale).format(count)}
    </span>
  );
}

/**
 * Edits an option, multi-option or boolean filter. Renders nothing for other kinds. Its children
 * render below its list, outside the scrolling rows, such as a `DataTableFilter.ValuesFooter`.
 */
export function DataTableFilterOptionEditor(props: DataTableFilterKindEditorProps): ReactElement | null {
  const editor = useKindEditor("DataTableFilter.OptionEditor", LIST_KINDS);
  return editor === null ? null : <OptionEditorBody editor={editor} {...props} />;
}

type OptionGroup = { readonly value: "pinned" | "rest"; readonly items: readonly FilterOption[] };

function OptionEditorBody({
  editor,
  className,
  children,
  ...props
}: DataTableFilterKindEditorProps & {
  readonly editor: EditorContextValue & { readonly field: ListField };
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.OptionEditor");
  const { field, fieldId, filter } = editor;
  const counts = meta.facets.counts(fieldId);
  const picked = pickedValues(field, filter);
  const source = listSource(field, { yes: meta.format("yes"), no: meta.format("no") });
  // The order is taken once, as the editor mounts, so a toggle never moves a row. Counts that
  // arrive later update in place.
  const [order] = useState(() => snapshotOrder(source, picked, counts));
  const [query, setQuery] = useState("");
  const contains = useContains(meta.locale);
  const matches = matchOptions(order, query, contains, OPTION_LIMIT);
  const inputRef = useFocusRequest<HTMLInputElement>(editor.focusKey);
  const groups: OptionGroup[] = [
    ...(order.pinned.length > 0 ? [{ value: "pinned" as const, items: order.pinned }] : []),
    { value: "rest", items: order.rest },
  ];
  // External filtering: the Combobox renders these rows, never every option of a large field.
  const shown: OptionGroup[] = [
    ...(matches.pinned.length > 0 ? [{ value: "pinned" as const, items: matches.pinned }] : []),
    ...(matches.rest.length > 0 ? [{ value: "rest" as const, items: matches.rest }] : []),
  ];
  const selected = source.options.filter((option) => picked.includes(option.value));
  const searchLabel = meta.format("searchValues", { field: field.label });
  return (
    <div
      data-slot="data-table-filter-option-editor"
      className={cn(slots.optionEditor(), className)}
      {...props}>
      <ComboboxRoot
        inline
        open
        multiple
        autoHighlight
        items={groups}
        filteredItems={shown}
        value={selected}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.isItemPress !== true) {
            setQuery(next);
          }
        }}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringLabel={(option) => option.label}
        itemToStringValue={(option) => option.value}
        onValueChange={(next) => {
          const after = new Set(next.map((option) => option.value));
          const changed =
            next.find((option) => !picked.includes(option.value)) ??
            selected.find((option) => !after.has(option.value));
          if (changed !== undefined) {
            actions.toggle(fieldId, changed.value);
          }
        }}>
        <div className={cn(slots.search(), slots.editorSearch())}>
          <ComboboxInput
            ref={inputRef}
            showTrigger={false}
            aria-label={searchLabel}
            placeholder={searchLabel}
            data-dtf-initial-focus="">
            <InputGroupAddon align="inline-start">
              <MagnifyingGlass aria-hidden />
            </InputGroupAddon>
          </ComboboxInput>
        </div>
        <ComboboxEmpty className={slots.editorEmpty()}>{meta.format("noValues")}</ComboboxEmpty>
        <ComboboxList>
          {(group: OptionGroup) => (
            <ComboboxGroup key={group.value} items={group.items} data-group={group.value}>
              <ComboboxCollection>
                {(option: FilterOption) => {
                  const count = counts === undefined ? undefined : (counts.get(option.value) ?? 0);
                  return (
                    <ComboboxItem
                      key={option.value}
                      value={option}
                      data-value={option.value}
                      data-pinned={group.value === "pinned" || undefined}
                      data-zero={count === 0 || undefined}
                      className={slots.editorOption()}>
                      {option.icon === undefined ? null : (
                        <span aria-hidden className="contents">
                          {option.icon}
                        </span>
                      )}
                      <span className="min-w-0 truncate">{option.label}</span>
                      {count === undefined ? null : <OptionCount count={count} />}
                    </ComboboxItem>
                  );
                }}
              </ComboboxCollection>
              {/* Inside the pinned group, so it leaves with the group when a search empties it. */}
              {group.value === "pinned" && matches.rest.length > 0 ? <ComboboxSeparator /> : null}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxRoot>
      <p role="status" data-slot="data-table-filter-narrow" className={slots.editorNarrowHint()}>
        {matches.more ? meta.format("narrowHint") : null}
      </p>
      {children == null ? null : (
        <ValueListProvider fieldId={fieldId} field={field} order={order} query={query} contains={contains}>
          {children}
        </ValueListProvider>
      )}
    </div>
  );
}

// Text: settles after a typing pause, the editor's one timer, on Enter, which also closes, and on
// every other exit of the editor. A Clear or a Remove discards the draft instead. An emptied
// draft removes the filter.

/** How long the text editor waits after the last keystroke before it applies. */
const TEXT_PAUSE_MS = 300;

/** Edits a text filter. Renders nothing for other kinds. */
export function DataTableFilterTextEditor(props: DataTableFilterKindEditorProps): ReactElement | null {
  const editor = useKindEditor("DataTableFilter.TextEditor", ["text"]);
  return editor === null ? null : <TextEditorBody editor={editor} {...props} />;
}

function TextEditorBody({
  editor,
  className,
  ...props
}: DataTableFilterKindEditorProps & {
  readonly editor: EditorContextValue & { readonly field: TextFilterField };
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.TextEditor");
  const { draft, settle, isComposing } = editor;
  const applied = editor.filter?.kind === "text" ? editor.filter.values[0] : "";
  const text = String(draft.values[0] ?? "");
  const inputRef = useFocusRequest<HTMLInputElement>(editor.focusKey);
  const hintId = useId();
  // Text an input method is still composing is not confirmed yet, so the pause waits for the
  // composition to end and starts over from there.
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (composing || text.trim() === applied) {
      return undefined;
    }
    const timer = setTimeout(settle, TEXT_PAUSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [composing, text, applied, settle]);

  return (
    <div
      data-slot="data-table-filter-text"
      data-dirty={text.trim() !== applied || undefined}
      className={cn(slots.body(), className)}
      {...props}>
      <InputGroupRoot>
        <InputGroupInput
          ref={inputRef}
          value={text}
          aria-label={editor.field.label}
          aria-describedby={hintId}
          placeholder={editor.field.placeholder ?? meta.format("textPlaceholder")}
          data-dtf-initial-focus=""
          onChange={(event) => {
            editor.setDraft({ operator: draft.operator, values: [event.currentTarget.value] });
          }}
          onCompositionStart={() => {
            setComposing(true);
          }}
          onCompositionEnd={() => {
            setComposing(false);
          }}
          onKeyDown={(event) => {
            if (isComposing(event)) {
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              settle();
              actions.close();
            } else if (event.key === "Escape") {
              // Settled before the overlay closes or goes back, so a focus target sees the chip it
              // keeps.
              settle();
            } else if (editor.back !== undefined && !event.repeat && isBackspaceOnEmpty(event)) {
              // In the add menu a fresh Backspace in an empty input goes back a step, as Command's
              // search does. A held Backspace that has just emptied the input is still deleting.
              event.preventDefault();
              editor.back();
            }
          }}
        />
      </InputGroupRoot>
      {/* The text applies as the user types, and Enter applies at once and closes. */}
      <p id={hintId} className={slots.hint()}>
        <Kbd>↵</Kbd>
        {meta.format("closeHint")}
      </p>
    </div>
  );
}

// Number: the operator decides the shape, one field or a range. A new range opens with the facet
// range as its draft and applies only once a value changes. Values settle when the user finishes,
// through NumberField's and Slider's `onValueCommitted`, and Enter in a field also closes.

/** Edits a number filter. Renders nothing for other kinds. */
export function DataTableFilterNumberEditor(props: DataTableFilterKindEditorProps): ReactElement | null {
  const editor = useKindEditor("DataTableFilter.NumberEditor", ["number"]);
  return editor === null ? null : <NumberEditorBody editor={editor} {...props} />;
}

/** One number per position the operator takes, with NaN for a position not yet set. */
function numberPositions(values: readonly (string | number)[], count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const value = values[index];
    return isFiniteNumber(value) ? value : Number.NaN;
  });
}

function NumberEditorBody({
  editor,
  className,
  ...props
}: DataTableFilterKindEditorProps & {
  readonly editor: EditorContextValue & { readonly field: NumberFilterField };
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.NumberEditor");
  const { field, fieldId, draft, settle } = editor;
  const step = field.step ?? 1;
  const range = meta.facets.range(fieldId);
  const bounds = range === undefined ? undefined : stepBounds(range, step);
  const target = targetOf("number", draft.operator);
  const count = target === "range" ? 2 : 1;
  // Each endpoint keeps its position, so a Maximum typed first stays in Maximum.
  const [low, high] = numberPositions(draft.values, count);
  const invalid = target === "range" && low !== undefined && high !== undefined && low > high;
  const firstRef = useFocusRequest<HTMLDivElement>(editor.focusKey);
  // An invalid range marks the field the user just edited, not its partner.
  const [lastEdited, setLastEdited] = useState(1);

  /** The latest draft with one position set. */
  const withAt =
    (index: number, value: number) =>
    (current: DraftValues): DraftValues => {
      const next = numberPositions(current.values, targetOf("number", current.operator) === "range" ? 2 : 1);
      next[index] = value;
      return { operator: current.operator, values: next };
    };
  /** A person's change to one position. */
  const setAt = (index: number, value: number) => {
    setLastEdited(index);
    editor.updateDraft(withAt(index, value));
  };
  /** A control's commit of one position, which settles it within the current session. */
  const commitAt = (index: number, value: number) => {
    editor.commitDraft(withAt(index, value));
  };

  const names = target === "range" ? [meta.format("minimum"), meta.format("maximum")] : [field.label];
  return (
    <div
      data-slot="data-table-filter-number"
      data-invalid={invalid || undefined}
      className={cn(slots.body(), className)}
      {...props}>
      {bounds === undefined ? null : target === "range" ? (
        <Slider<readonly [number, number]>
          aria-label={field.label}
          thumbLabels={names}
          minValue={bounds[0]}
          maxValue={bounds[1]}
          step={step}
          largeStep={step * 10}
          {...definedProps({ formatOptions: field.format })}
          value={[
            Number.isNaN(low) ? bounds[0] : (low ?? bounds[0]),
            Number.isNaN(high) ? bounds[1] : (high ?? bounds[1]),
          ]}
          onChange={(next) => {
            editor.setDraft({ operator: draft.operator, values: [next[0], next[1]] });
          }}
          onValueCommitted={(next) => {
            editor.commitDraft((current) => ({ operator: current.operator, values: [next[0], next[1]] }));
          }}
        />
      ) : (
        <Slider
          aria-label={field.label}
          minValue={bounds[0]}
          maxValue={bounds[1]}
          step={step}
          largeStep={step * 10}
          {...definedProps({ formatOptions: field.format })}
          value={low === undefined || Number.isNaN(low) ? bounds[0] : low}
          onChange={(next) => {
            setAt(0, next);
          }}
          onValueCommitted={(next) => {
            commitAt(0, next);
          }}
        />
      )}
      <div
        ref={firstRef}
        role="group"
        aria-label={field.label}
        data-dtf-initial-focus=""
        className={slots.numberStack()}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          // NumberField commits on blur, not on Enter. Enter settles what the fields show and
          // closes, as it does in the text editor.
          if (event.key === "Enter" && !editor.isComposing(event)) {
            event.preventDefault();
            settle();
            actions.close();
          }
        }}>
        {names.map((name, index) => (
          <NumberField
            key={name}
            label={name}
            value={[low, high][index] ?? Number.NaN}
            onChange={(next) => {
              setAt(index, next);
            }}
            onValueCommitted={(next) => {
              commitAt(index, next);
            }}
            step={step}
            {...definedProps({ formatOptions: field.format })}
            isInvalid={invalid && index === lastEdited}
            errorMessage={invalid && index === lastEdited ? meta.format("invalidRange") : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// The date editor offers the field's presets, in the field's order, and the default five when it
// lists none. A preset applies and closes. It writes `isBetween` over its range. On a field without
// `isBetween`, Today and Yesterday, the one-day presets, write `is`, and the editor leaves the
// other presets out. The body is one or two date inputs by default, and a function child
// replaces it, such as with a calendar the app imports, since the entry cannot import React Aria.
// From the small breakpoint up the presets of a function child stand in a column beside it, as the
// date pickers set their preset pane beside the calendar, and the popup widens to that layout.
// Above the date inputs, or on a narrow viewport, they wrap above.

/** What the date editor hands its function child. */
export type DateEditorState = {
  /** The edited field. */
  readonly field: DateFilterField;
  /** The current operator. */
  readonly operator: FilterOperator<"date">;
  /** Whether the operator takes one date or a range. */
  readonly target: "single" | "range";
  /** The draft's dates in their positions, start then end. Empty until every date is set. */
  readonly values: readonly IsoDate[];
  /** Applies complete values. A single date also closes the popover. A completed range stays open. */
  readonly onValueChange: (values: readonly IsoDate[]) => void;
};

type PresetWrite = { readonly operator: FilterOperator<"date">; readonly values: readonly IsoDate[] };

/**
 * The filter a preset writes, in an operator the field allows: `isBetween` over its range, or `is`
 * on its day for a one-day preset when the field allows no range. A preset the field cannot
 * express writes nothing, and the editor leaves it out.
 */
function presetWrite(
  key: DatePresetKey,
  range: readonly [IsoDate, IsoDate],
  allowed: readonly FilterOperator[]
): PresetWrite | undefined {
  if (allowed.includes("isBetween")) {
    return { operator: "isBetween", values: range };
  }
  if (isOneDayPreset(key) && allowed.includes("is")) {
    return { operator: "is", values: [range[0]] };
  }
  return undefined;
}

/**
 * The viewports wide enough for the presets beside a slot, Tailwind's `sm`. It is a viewport query
 * because the popup sizes to this layout, so a query on the popup would be circular. It drives the
 * layout and the presets' arrow-key axis together, so the two never disagree.
 */
const PRESETS_BESIDE_QUERY = "(min-width: 40rem)";

/** The props of `DataTableFilter.DateEditor`. */
export type DataTableFilterDateEditorProps = Omit<DataTableFilterKindEditorProps, "children"> & {
  /**
   * Replaces the date inputs, such as with a calendar. The presets and the header stay. On a
   * viewport 40rem wide or more the presets stand in a column beside it, and the popup widens to fit.
   */
  children?: (editor: DateEditorState) => ReactNode;
};

/**
 * Edits a date filter with presets and date inputs. Renders nothing for other kinds. The presets
 * are the field's `presets`, and each writes `isBetween` over its range. On a field whose operators
 * leave out `isBetween`, the one-day presets, Today and Yesterday, write `is` if the field allows
 * it, and the editor leaves the other presets out. Beside a function child they form a column,
 * from a 40rem viewport up.
 */
export function DataTableFilterDateEditor(props: DataTableFilterDateEditorProps): ReactElement | null {
  const editor = useKindEditor("DataTableFilter.DateEditor", ["date"]);
  return editor === null ? null : <DateEditorBody editor={editor} {...props} />;
}

/** The date in a draft position, or an empty string while it is not set. */
function dateAt(values: readonly (string | number)[], index: number): string {
  const value = values[index];
  return isIsoDate(value) ? value : String(value ?? "");
}

function DateEditorBody({
  editor,
  className,
  children,
  ref,
  ...props
}: DataTableFilterDateEditorProps & {
  readonly editor: EditorContextValue & { readonly field: DateFilterField };
}): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.DateEditor");
  const { field, filter, draft } = editor;
  // The clock is read once per open; the zone stays live, so a changed `timeZone` re-resolves today.
  const [openedAt] = useState(() => new Date());
  const today = calendarDateIn(openedAt, meta.timeZone);
  const target = targetOf("date", draft.operator) === "range" ? "range" : "single";
  const allowed = allowedOperators(field);
  // A key listed twice shows once, at its first place, so React keys and toggle values stay unique.
  const presets = [...new Set(field.presets ?? DEFAULT_DATE_PRESETS)].flatMap((key) => {
    const write = presetWrite(key, datePresetRange(key, today, meta.locale), allowed);
    return write === undefined ? [] : [{ key, write }];
  });
  const pressed = presets.find(({ write }) => draftSays("date", write, filter))?.key;
  const focusRef = useFocusRequest<HTMLDivElement>(editor.focusKey);
  const bodyRef = useMergedRefs(ref, focusRef);
  const operator = isOperatorOf("date", draft.operator) ? draft.operator : "isBetween";
  const wide = useMediaQuery(PRESETS_BESIDE_QUERY);
  let layout: "above" | "beside" | undefined;
  if (presets.length > 0) {
    layout = children !== undefined && wide ? "beside" : "above";
  }
  const beside = layout === "beside";

  const complete = completeValues("date", draft);
  const state: DateEditorState = {
    field,
    operator,
    target,
    values: complete === undefined ? [] : complete.filter(isIsoDate),
    onValueChange: (next) => {
      editor.setDraft({ operator: draft.operator, values: next });
      if (completeValues("date", { operator: draft.operator, values: next }) !== undefined) {
        editor.settle();
        if (target === "single") {
          actions.close();
        }
      }
    },
  };

  return (
    <div
      ref={bodyRef}
      data-slot="data-table-filter-date"
      data-target={target}
      {...definedProps({ "data-presets": layout })}
      className={cn(beside ? slots.dateBeside() : slots.body(), className)}
      {...props}>
      {presets.length === 0 ? null : (
        <ToggleGroupRoot
          variant={beside ? "default" : "outline"}
          size="sm"
          orientation={beside ? "vertical" : "horizontal"}
          aria-label={meta.format("datePresets")}
          value={pressed === undefined ? [] : [pressed]}
          className={beside ? slots.presetsBeside() : slots.presets()}
          onValueChange={(next) => {
            const key = next[0] ?? pressed;
            const preset = presets.find((item) => item.key === key);
            if (preset !== undefined) {
              editor.setDraft({ operator: preset.write.operator, values: preset.write.values });
              editor.settle();
              actions.close();
            }
          }}>
          {presets.map((preset) => (
            <ToggleGroupItem
              key={preset.key}
              value={preset.key}
              {...definedProps({
                className: beside ? slots.presetBeside() : undefined,
                "data-dtf-initial-focus": preset.key === (pressed ?? presets[0]?.key) ? "" : undefined,
              })}>
              {meta.format(preset.key)}
            </ToggleGroupItem>
          ))}
        </ToggleGroupRoot>
      )}
      {children === undefined ? (
        <DateInputs editor={editor} target={target} />
      ) : (
        // One wrapper in both layouts, boxless above, so a viewport crossing the breakpoint
        // restyles the slot without remounting it.
        <div className={beside ? slots.dateSlotBeside() : slots.dateSlot()}>{children(state)}</div>
      )}
    </div>
  );
}

/**
 * The default body: one or two native date inputs over the editor's one draft, From and To each in
 * its own position. Typing changes the draft, and a blur settles it, which writes only once every
 * date is set, so an incomplete range survives between blurs. Each input is a Fuse Field, so Field
 * wires its label.
 */
function DateInputs({
  editor,
  target,
}: {
  readonly editor: EditorContextValue & { readonly field: DateFilterField };
  readonly target: "single" | "range";
}): ReactElement {
  const { meta } = useFilterInternals("DataTableFilter.DateEditor");
  const names = target === "range" ? [meta.format("from"), meta.format("to")] : [editor.field.label];
  return (
    <div className={target === "range" ? slots.dateFields() : undefined}>
      {names.map((name, index) => (
        <FieldRoot key={name} className={slots.dateField()}>
          <FieldLabel>{name}</FieldLabel>
          <Input
            type="date"
            value={dateAt(editor.draft.values, index)}
            onChange={(event) => {
              const { value } = event.currentTarget;
              editor.updateDraft((current) => ({
                operator: current.operator,
                values: names.map((_, at) => (at === index ? value : dateAt(current.values, at))),
              }));
            }}
            onBlur={editor.settle}
          />
        </FieldRoot>
      ))}
    </div>
  );
}

DataTableFilterOptionEditor.displayName = "DataTableFilter.OptionEditor";
DataTableFilterTextEditor.displayName = "DataTableFilter.TextEditor";
DataTableFilterNumberEditor.displayName = "DataTableFilter.NumberEditor";
DataTableFilterDateEditor.displayName = "DataTableFilter.DateEditor";
