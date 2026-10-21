// The headless filter model: pure TypeScript with no React, no TanStack runtime and no directive,
// so a server imports it as it is. The state is TanStack's own `columnFilters` slice. Fuse defines
// only each entry's value, `{ kind, operator, values }`, and the operator fixes how many values it
// holds.

/** The five filter kinds. A field's kind decides its editor, its operators and its predicate. */
export type FilterKind = "option" | "multiOption" | "text" | "number" | "date";

/** A calendar date written `YYYY-MM-DD`, with no time of day. `parseColumnFilters` checks the shape. */
export type IsoDate = string;

type One<T> = readonly [T];
type Many<T> = readonly [T, T, ...T[]];

/**
 * One column's filter, the `value` of a TanStack `columnFilters` entry. It names its kind, so a
 * server parses it without the field config, and its operator fixes how many values it holds:
 * `isAnyOf` holds two or more, `isBetween` exactly two, every other operator one.
 */
export type FilterValue =
  | { readonly kind: "option"; readonly operator: "is" | "isNot"; readonly values: One<string> }
  | { readonly kind: "option"; readonly operator: "isAnyOf" | "isNoneOf"; readonly values: Many<string> }
  | { readonly kind: "multiOption"; readonly operator: "includes" | "excludes"; readonly values: One<string> }
  | {
      readonly kind: "multiOption";
      readonly operator: "includesAnyOf" | "includesAllOf" | "excludesAnyOf" | "excludesAllOf";
      readonly values: Many<string>;
    }
  | { readonly kind: "text"; readonly operator: "contains" | "doesNotContain"; readonly values: One<string> }
  | {
      readonly kind: "number";
      readonly operator:
        | "is"
        | "isNot"
        | "isGreaterThan"
        | "isGreaterThanOrEqual"
        | "isLessThan"
        | "isLessThanOrEqual";
      readonly values: One<number>;
    }
  | {
      readonly kind: "number";
      readonly operator: "isBetween" | "isNotBetween";
      readonly values: readonly [number, number];
    }
  | {
      readonly kind: "date";
      readonly operator: "is" | "isNot" | "isBefore" | "isOnOrAfter" | "isAfter" | "isOnOrBefore";
      readonly values: One<IsoDate>;
    }
  | {
      readonly kind: "date";
      readonly operator: "isBetween" | "isNotBetween";
      readonly values: readonly [IsoDate, IsoDate];
    };

/**
 * The operators of a kind, or of every kind when `K` is left out.
 *
 * @template K - The filter kind.
 */
export type FilterOperator<K extends FilterKind = FilterKind> = Extract<
  FilterValue,
  { readonly kind: K }
>["operator"];

/** How many values an operator takes: one, two or more, or a two-value range. */
export type OperatorTarget = "single" | "multiple" | "range";

/** One `columnFilters` entry with Fuse's value. Entries combine with AND, one per column. */
export type DataTableFilterEntry = { readonly id: string; readonly value: FilterValue };

/** TanStack's `ColumnFiltersState`, narrowed to Fuse's value. */
export type DataTableFilterState = readonly DataTableFilterEntry[];

type OperatorSpec<K extends FilterKind> = {
  readonly target: OperatorTarget;
  /** The operator that means the opposite. */
  readonly negation: FilterOperator<K>;
  /** Whether the operator inverts its match, so a missing cell passes it. */
  readonly negated: boolean;
  /** The operator an option filter moves to when its value count grows past one. */
  readonly plural?: FilterOperator<K>;
  /** The operator an option filter moves to when its value count drops to one. */
  readonly singular?: FilterOperator<K>;
};

type OperatorTable = { readonly [K in FilterKind]: { readonly [O in FilterOperator<K>]: OperatorSpec<K> } };

/**
 * The operator graph: each operator's target, its negation, whether it is negated and, for option
 * kinds, its sibling when the value count crosses one. Key order is menu order. `satisfies` makes a missing
 * operator, a sibling from another kind or an unknown target a type error.
 */
export const OPERATORS = {
  option: {
    is: { target: "single", plural: "isAnyOf", negation: "isNot", negated: false },
    isNot: { target: "single", plural: "isNoneOf", negation: "is", negated: true },
    isAnyOf: { target: "multiple", singular: "is", negation: "isNoneOf", negated: false },
    isNoneOf: { target: "multiple", singular: "isNot", negation: "isAnyOf", negated: true },
  },
  multiOption: {
    includes: { target: "single", plural: "includesAnyOf", negation: "excludes", negated: false },
    excludes: { target: "single", plural: "excludesAnyOf", negation: "includes", negated: true },
    includesAnyOf: { target: "multiple", singular: "includes", negation: "excludesAnyOf", negated: false },
    includesAllOf: { target: "multiple", singular: "includes", negation: "excludesAllOf", negated: false },
    excludesAnyOf: { target: "multiple", singular: "excludes", negation: "includesAnyOf", negated: true },
    excludesAllOf: { target: "multiple", singular: "excludes", negation: "includesAllOf", negated: true },
  },
  text: {
    contains: { target: "single", negation: "doesNotContain", negated: false },
    doesNotContain: { target: "single", negation: "contains", negated: true },
  },
  number: {
    is: { target: "single", negation: "isNot", negated: false },
    isNot: { target: "single", negation: "is", negated: true },
    isGreaterThan: { target: "single", negation: "isLessThanOrEqual", negated: false },
    isGreaterThanOrEqual: { target: "single", negation: "isLessThan", negated: false },
    isLessThan: { target: "single", negation: "isGreaterThanOrEqual", negated: false },
    isLessThanOrEqual: { target: "single", negation: "isGreaterThan", negated: false },
    isBetween: { target: "range", negation: "isNotBetween", negated: false },
    isNotBetween: { target: "range", negation: "isBetween", negated: true },
  },
  date: {
    is: { target: "single", negation: "isNot", negated: false },
    isNot: { target: "single", negation: "is", negated: true },
    isBefore: { target: "single", negation: "isOnOrAfter", negated: false },
    isOnOrAfter: { target: "single", negation: "isBefore", negated: false },
    isAfter: { target: "single", negation: "isOnOrBefore", negated: false },
    isOnOrBefore: { target: "single", negation: "isAfter", negated: false },
    isBetween: { target: "range", negation: "isNotBetween", negated: false },
    isNotBetween: { target: "range", negation: "isBetween", negated: true },
  },
} as const satisfies OperatorTable;

/** The operator table as a lookup by an unparsed operator string. */
type OperatorLookup = { readonly [K in FilterKind]: Readonly<Record<string, OperatorSpec<FilterKind>>> };

/** The same table read by a runtime string. Widening is safe, because every spec is a subtype. */
const OPERATOR_SPECS: OperatorLookup = OPERATORS;

// The parse boundary. `columnFilters` values arrive untyped, since TanStack types each entry's
// `value` as unknown and a URL or a request body carries anything. These two guards are the only
// runtime type checks, and every predicate below builds on them.

/**
 * Whether an untyped value is a non-null object. Unlike `instanceof Object`, it holds for an
 * object from another realm, such as an iframe.
 *
 * @param value - The value to check.
 * @returns Whether it is an object.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
export function isObject(value: unknown): value is object {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over untyped filter state
  return typeof value === "object" && value !== null;
}

/**
 * Whether an untyped value is a string.
 *
 * @param value - The value to check.
 * @returns Whether it is a string.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
export function isString(value: unknown): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over untyped filter state
  return typeof value === "string";
}

/**
 * Whether an untyped value is a finite number.
 *
 * @param value - The value to check.
 * @returns Whether it is a finite number.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
export function isFiniteNumber(value: unknown): value is number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parse boundary over untyped filter state
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Whether a value names one of the five kinds.
 *
 * @param kind - The value to check.
 * @returns Whether it is a filter kind.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
function isFilterKind(kind: unknown): kind is FilterKind {
  return isString(kind) && Object.hasOwn(OPERATOR_SPECS, kind);
}

/**
 * Every operator of a kind, in menu order.
 *
 * @template K - The filter kind.
 * @param kind - The kind whose operators to list.
 * @returns The kind's operators.
 */
function operatorsFor<K extends FilterKind>(kind: K): readonly FilterOperator<K>[] {
  // SAFETY: the table's keys for `kind` are exactly `FilterOperator<K>`, which `satisfies` checks.
  return Object.keys(OPERATORS[kind]) as FilterOperator<K>[];
}

/**
 * Whether a value is one of a kind's operators.
 *
 * @template K - The filter kind.
 * @param kind - The kind.
 * @param operator - The value to check.
 * @returns Whether it is an operator of `kind`.
 */
export function isOperatorOf<K extends FilterKind>(
  kind: K,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
  operator: unknown
): operator is FilterOperator<K> {
  return isString(operator) && Object.hasOwn(OPERATOR_SPECS[kind], operator);
}

/**
 * The number of values an operator takes.
 *
 * @param kind - The operator's kind.
 * @param operator - The operator.
 * @returns `single`, `multiple` or `range`.
 */
export function targetOf(kind: FilterKind, operator: FilterOperator): OperatorTarget {
  return OPERATOR_SPECS[kind][operator]?.target ?? "single";
}

/**
 * Whether an operator inverts its match, so a missing cell passes it.
 *
 * @param kind - The operator's kind.
 * @param operator - The operator.
 * @returns Whether the operator is negated.
 */
export function isNegated(kind: FilterKind, operator: FilterOperator): boolean {
  return OPERATOR_SPECS[kind][operator]?.negated ?? false;
}

/** The part of a field the policy reads: its kind, its own operator list and, for option kinds, its options. */
export type OperatorPolicy = {
  readonly kind: FilterKind;
  readonly operators?: readonly FilterOperator[] | undefined;
  readonly options?: readonly { readonly value: string }[] | undefined;
};

/**
 * Whether a field admits a filter value: the kinds match, the field allows the operator, and an
 * option value is one of the field's options. The parse and every reducer read this one rule, so
 * a value an action writes is one the Root shows as a chip.
 *
 * @param field - The field.
 * @param value - The filter value.
 * @returns Whether the field admits it.
 */
export function fieldAdmits(field: OperatorPolicy, value: FilterValue): boolean {
  if (value.kind !== field.kind || !allowedOperators(field).includes(value.operator)) {
    return false;
  }
  if (value.kind !== "option" && value.kind !== "multiOption") {
    return true;
  }
  const known = new Set((field.options ?? []).map((option) => option.value));
  return value.values.every((item) => known.has(item));
}

/** Upserts a value only when the field admits it, and otherwise leaves the state as it was. */
function upsertAdmitted(
  state: DataTableFilterState,
  id: string,
  field: OperatorPolicy,
  value: FilterValue | null
): DataTableFilterEntry[] {
  return value === null || !fieldAdmits(field, value) ? [...state] : upsertFilter(state, id, value);
}

/**
 * The operators a field allows, in menu order: its own list, else every operator of its kind. A
 * listed multi-value option operator also allows its one-value sibling, because a filter starts
 * from one tick and `isAnyOf` cannot hold one value. So `["isAnyOf"]` allows `is` too, while
 * `["is", "isNot"]` stays single-select. The parse, every reducer and every editor read this one
 * list, so every filter an action writes survives the parse.
 *
 * @param field - The field.
 * @returns The allowed operators.
 */
export function allowedOperators(field: OperatorPolicy): readonly FilterOperator[] {
  const listed: readonly FilterOperator[] = field.operators ?? operatorsFor(field.kind);
  const allowed = [...listed];
  for (const operator of listed) {
    const singular = OPERATOR_SPECS[field.kind][operator]?.singular;
    if (singular !== undefined && !allowed.includes(singular)) {
      allowed.push(singular);
    }
  }
  return allowed;
}

/**
 * The allowed operator an option filter takes at a value count, starting from `base`. Past one
 * value it is the base's plural, else another allowed multi-value operator whose one-value sibling
 * is the base, such as `includesAllOf` for `includes`. At one value it is the base's singular.
 * Otherwise it is the base itself.
 *
 * @param field - The field.
 * @param base - The current operator, or the one a new filter starts with.
 * @param count - The value count after the change.
 * @returns The operator, or undefined when the field allows none for that count.
 */
function operatorForCount(
  field: OperatorPolicy,
  base: FilterOperator,
  count: number
): FilterOperator | undefined {
  const allowed = allowedOperators(field);
  const specs = OPERATOR_SPECS[field.kind];
  const spec = specs[base];
  if (spec === undefined) {
    return undefined;
  }
  if (count >= 2 && spec.target === "single") {
    const siblings = allowed.filter((operator) => {
      const sibling = specs[operator];
      return sibling?.target === "multiple" && sibling.singular === base;
    });
    return [spec.plural, ...siblings].find(
      (operator): operator is FilterOperator => operator !== undefined && allowed.includes(operator)
    );
  }
  if (count === 1 && spec.target === "multiple") {
    return spec.singular !== undefined && allowed.includes(spec.singular) ? spec.singular : undefined;
  }
  return allowed.includes(base) ? base : undefined;
}

/**
 * The operators a chip's operator menu offers: the field's allowed operators, and for option
 * kinds only those that take the current value count, so the operator never disagrees with it.
 *
 * @param field - The field.
 * @param current - The applied filter, if any.
 * @returns The operators to offer.
 */
export function operatorChoices(
  field: OperatorPolicy,
  current: FilterValue | undefined
): readonly FilterOperator[] {
  // An applied operator the field no longer allows stays the current choice, so the Select can
  // show it. Picking another moves to an allowed one.
  const allowed = allowedOperators(field);
  const all =
    current === undefined || allowed.includes(current.operator) ? allowed : [current.operator, ...allowed];
  const { kind } = field;
  if ((kind === "option" || kind === "multiOption") && current !== undefined) {
    const target = targetOf(kind, current.operator);
    return all.filter((operator) => targetOf(kind, operator) === target);
  }
  return all;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

/**
 * Whether a value is a real calendar date written `YYYY-MM-DD`. `2026-13-01` and `2026-02-30`
 * fail.
 *
 * @param value - The value to check.
 * @returns Whether it is an ISO calendar date.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
export function isIsoDate(value: unknown): value is IsoDate {
  if (!isString(value)) {
    return false;
  }
  const match = ISO_DATE.exec(value);
  if (match === null) {
    return false;
  }
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

/**
 * Adds whole days to an ISO date.
 *
 * @param date - The start date.
 * @param days - The days to add, negative to go back.
 * @returns The new ISO date.
 */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function valuesFit(kind: FilterKind, values: readonly unknown[]): boolean {
  switch (kind) {
    case "number":
      return values.every(isFiniteNumber);
    case "date":
      return values.every(isIsoDate);
    case "text":
      return values.every((value) => isString(value) && value.trim() !== "");
    case "option":
    case "multiOption":
      return values.every(isString) && new Set(values).size === values.length;
  }
}

function countFits(target: OperatorTarget, count: number): boolean {
  switch (target) {
    case "single":
      return count === 1;
    case "multiple":
      return count >= 2;
    case "range":
      return count === 2;
  }
}

/**
 * Builds a filter value when the operator belongs to the kind, the value count fits the
 * operator, every value has the kind's type, and a range runs low to high. This is the one place
 * a runtime array becomes a typed tuple.
 *
 * @param kind - The filter kind.
 * @param operator - The operator, any string.
 * @param values - The values, any type.
 * @returns The value, or `null` when any check fails.
 */
export function toFilterValue(
  kind: FilterKind,
  operator: string,
  values: readonly unknown[]
): FilterValue | null {
  const spec = OPERATOR_SPECS[kind][operator];
  if (spec === undefined || !countFits(spec.target, values.length) || !valuesFit(kind, values)) {
    return null;
  }
  if (spec.target === "range") {
    const [low, high] = values;
    // Numbers compare by value and ISO dates by text, and valuesFit made both the same type.
    const ordered =
      isFiniteNumber(low) && isFiniteNumber(high)
        ? low <= high
        : isString(low) && isString(high) && low <= high;
    if (!ordered) {
      return null;
    }
  }
  // SAFETY: the operator belongs to `kind`, and the count and element types match its target,
  // which is exactly the FilterValue member for that kind and operator. TypeScript cannot relate
  // a runtime array to the union's tuples, so the cast goes through unknown.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- the checks above are the parse; the union of tuples has no runtime constructor
  return { kind, operator, values: [...values] } as unknown as FilterValue;
}

/**
 * Whether an unknown value is a well-formed filter value, checked from scratch.
 *
 * @param value - The value to check.
 * @returns Whether it is a `FilterValue`.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the parse boundary over untyped filter state
export function isFilterValue(value: unknown): value is FilterValue {
  if (!isObject(value) || !("kind" in value && "operator" in value && "values" in value)) {
    return false;
  }
  const { kind, operator, values } = value;
  return (
    isFilterKind(kind) &&
    isString(operator) &&
    Array.isArray(values) &&
    toFilterValue(kind, operator, values) !== null
  );
}

/**
 * Whether two filter values say the same thing: the same kind, operator and values, position by
 * position. Order counts for every kind. A text, number or date value is positional, a range's
 * start before its end, and an option list keeps the order the chip's summary shows it in, so a
 * reordered list is a change the host made. A host that parses its filters again, such as from the
 * URL, hands over equal copies, which this treats as no change.
 *
 * @param left - One filter value, or undefined for none.
 * @param right - The other.
 * @returns Whether they are equal.
 */
export function filterValuesEqual(left: FilterValue | undefined, right: FilterValue | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return (
    left.kind === right.kind &&
    left.operator === right.operator &&
    left.values.length === right.values.length &&
    left.values.every((value, index) => value === right.values[index])
  );
}

// Reducers. Every UI write is one of these, applied through one `setColumnFilters` updater. They
// never reorder entries: a changed filter keeps its chip's place, and a new one goes last.

/**
 * A field's filter.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @returns The filter, or undefined.
 */
export function findFilter(state: DataTableFilterState, id: string): FilterValue | undefined {
  return state.find((entry) => entry.id === id)?.value;
}

/**
 * Puts `value` at `id` in its place, or last when new. A `null` value removes the entry.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @param value - The new value, or `null` to remove it.
 * @returns The next state.
 */
function upsertFilter(
  state: DataTableFilterState,
  id: string,
  value: FilterValue | null
): DataTableFilterEntry[] {
  if (value === null) {
    return state.filter((entry) => entry.id !== id);
  }
  const index = state.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return [...state, { id, value }];
  }
  return state.map((entry, at) => (at === index ? { id, value } : entry));
}

/**
 * Removes a field's filter.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @returns The next state.
 */
export function removeFilter(state: DataTableFilterState, id: string): DataTableFilterEntry[] {
  return upsertFilter(state, id, null);
}

/**
 * Ticks or unticks one option. The first tick creates the filter from `start`. The operator then
 * follows the count among the operators the field allows, and unticking the last value removes
 * the filter. A field that allows no multi-value operator for the current one is single-select:
 * a second tick replaces the first, and an untick that leaves values no allowed operator holds,
 * such as a multi-selection applied before the field turned single-select, removes the filter.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @param field - The field's kind, `option` or `multiOption`, and its operators.
 * @param optionValue - The option to tick or untick.
 * @param start - The operator a new filter starts from, the field's first.
 * @returns The next state.
 */
export function toggleOption(
  state: DataTableFilterState,
  id: string,
  field: OperatorPolicy & { readonly kind: "option" | "multiOption" },
  optionValue: string,
  start: FilterOperator
): DataTableFilterEntry[] {
  const { kind } = field;
  const current = admittedPart(field, findFilter(state, id));
  const values = current?.values.filter(isString) ?? [];
  const adding = !values.includes(optionValue);
  const next = adding ? [...values, optionValue] : values.filter((value) => value !== optionValue);
  if (next.length === 0) {
    return removeFilter(state, id);
  }
  const base = current?.operator ?? start;
  const operator = operatorForCount(field, base, next.length);
  if (operator !== undefined) {
    return upsertAdmitted(state, id, field, toFilterValue(kind, operator, next));
  }
  if (!adding) {
    // No allowed operator holds what is left, as when a field turned single-select under an
    // applied multi-selection: an untick deselects, and the filter goes.
    return removeFilter(state, id);
  }
  const single = operatorForCount(field, base, 1);
  return single === undefined
    ? [...state]
    : upsertAdmitted(state, id, field, toFilterValue(kind, single, [optionValue]));
}

/**
 * Sets a filter's operator and values. An empty list removes the filter, and an operator the
 * field does not allow or an invalid combination leaves the state as it was.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @param field - The field's kind and operators.
 * @param operator - The operator.
 * @param values - The values.
 * @returns The next state.
 */
export function setFilterValues(
  state: DataTableFilterState,
  id: string,
  field: OperatorPolicy,
  operator: FilterOperator,
  values: readonly (string | number)[]
): DataTableFilterEntry[] {
  if (values.length === 0) {
    return removeFilter(state, id);
  }
  // An editor that continues an applied filter whose operator the config has since left out moves
  // to an allowed one. Any other operator the field leaves out writes nothing.
  const continued =
    findFilter(state, id)?.operator === operator && !allowedOperators(field).includes(operator);
  const write = continued ? reconcileOperator(field, operator, values) : { operator, values };
  return write === undefined
    ? [...state]
    : upsertAdmitted(state, id, field, toFilterValue(field.kind, write.operator, write.values));
}

/**
 * Converts values when the operator's target changes. A single value becomes `[v, upper]`, with
 * `upper` the known maximum when it is above `v`, else `[v, v]`. A range becomes its first value.
 * The same target keeps the values.
 *
 * @param kind - The field's kind.
 * @param from - The current operator.
 * @param to - The new operator.
 * @param values - The current values.
 * @param upper - The known maximum, for a range.
 * @returns The converted values.
 */
export function convertValues(
  kind: FilterKind,
  from: FilterOperator,
  to: FilterOperator,
  values: readonly (string | number)[],
  upper?: string | number
): readonly (string | number)[] {
  const fromTarget = targetOf(kind, from);
  const toTarget = targetOf(kind, to);
  const first = values[0];
  if (fromTarget === toTarget || first === undefined) {
    return values;
  }
  if (toTarget === "range") {
    return [first, upper !== undefined && upper > first ? upper : first];
  }
  if (toTarget === "single") {
    return [first];
  }
  return values;
}

/**
 * Sets a filter's operator and converts its values to the new target.
 *
 * @param state - The filter state.
 * @param id - The column id.
 * @param field - The field's kind and operators.
 * @param operator - The new operator.
 * @param upper - The known maximum, for a change to a range.
 * @returns The next state, unchanged when the field has no filter or does not allow `operator`, and
 *   without the filter when none of its values is still an option.
 */
export function setFilterOperator(
  state: DataTableFilterState,
  id: string,
  field: OperatorPolicy,
  operator: FilterOperator,
  upper?: string | number
): DataTableFilterEntry[] {
  const current = admittedPart(field, findFilter(state, id));
  if (current === undefined || !allowedOperators(field).includes(operator)) {
    return [...state];
  }
  // Every value left the config, so no value remains to take the operator: the pick removes it.
  if (current.values.length === 0) {
    return removeFilter(state, id);
  }
  const values = convertValues(field.kind, current.applied, operator, current.values, upper);
  // An option filter that lost values to the config takes the picked operator's form for its count.
  const counted =
    field.kind === "option" || field.kind === "multiOption"
      ? (operatorForCount(field, operator, values.length) ?? operator)
      : operator;
  return upsertAdmitted(state, id, field, toFilterValue(field.kind, counted, values));
}

/** An applied filter's admitted operator, if any, its applied operator, and its admitted values. */
type AdmittedPart = {
  readonly operator: FilterOperator | undefined;
  readonly applied: FilterOperator;
  readonly values: readonly (string | number)[];
};

/**
 * The part of an applied filter its field still admits, which an edit starts from: its option
 * values that are still options, and its operator when the field still allows it. A filter
 * applied before the config changed stays visible until a person edits it, and then the edit
 * drops what the config left out, all in that edit's one write.
 *
 * @param field - The field.
 * @param current - The applied filter, if any.
 * @returns Its admitted values and operator, or undefined without a filter of the field's kind.
 */
function admittedPart(field: OperatorPolicy, current: FilterValue | undefined): AdmittedPart | undefined {
  if (current?.kind !== field.kind) {
    return undefined;
  }
  const known = new Set((field.options ?? []).map((option) => option.value));
  const values =
    current.kind === "option" || current.kind === "multiOption"
      ? current.values.filter((value) => known.has(value))
      : current.values;
  return {
    operator: allowedOperators(field).includes(current.operator) ? current.operator : undefined,
    applied: current.operator,
    values,
  };
}

/**
 * An allowed operator for values written under one the field has left out: the first allowed
 * operator that takes that many values, else the field's first allowed operator with the values
 * converted to its form.
 *
 * @param field - The field.
 * @param operator - The operator the field has left out.
 * @param values - The values.
 * @returns The write, or undefined when the field allows nothing.
 */
function reconcileOperator(
  field: OperatorPolicy,
  operator: FilterOperator,
  values: readonly (string | number)[]
): { readonly operator: FilterOperator; readonly values: readonly (string | number)[] } | undefined {
  const allowed = allowedOperators(field);
  const fitting = allowed.find((candidate) =>
    countFits(OPERATOR_SPECS[field.kind][candidate]?.target ?? "single", values.length)
  );
  if (fitting !== undefined) {
    return { operator: fitting, values };
  }
  const [first] = allowed;
  return first === undefined
    ? undefined
    : { operator: first, values: convertValues(field.kind, operator, first, values) };
}
