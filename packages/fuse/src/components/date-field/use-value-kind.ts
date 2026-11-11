"use client";

import { useState } from "react";

import { resolveValueKind, sameKind } from "../../temporal/temporal-value";
import type { ResolvedKind, ValueKind, ValueKindSources } from "../../temporal/temporal-value";
import { isThemeDevelopment } from "../../theme/validate-theme";

/** What `useValueKind` reads each render: everything `resolveValueKind` does but the kind before. */
export type ValueKindProps = Omit<ValueKindSources, "previous">;

/** How `useValueKind` reports a kind change. */
export type ValueKindOptions = {
  /**
   * Whether to warn, in development, when the value replaces a kind a value named with another
   * kind. Only the input that edits the value warns, so a Root handing its value to one leaves it
   * off. Defaults to `false`.
   */
  readonly warnOnKindChange?: boolean;
  /**
   * The kind the control around the input supplies, as a picker does for its popup time input,
   * which owns no value: it replaces the resolution, and nothing is remembered.
   */
  readonly supplied?: ValueKind;
};

/**
 * An input's value kind, remembered across renders: `resolveValueKind` with the kind this hook
 * resolved before as `previous`. A kind a value or default value named sticks through a clear;
 * one granularity and the zone made follows them. The kind is stored again only when it or its
 * `named` changes, so a render resolving an equal kind stores nothing.
 *
 * @param props - The parsed value, default value, granularity and zone.
 * @param owner - The Root, named in the conflict error and the warning.
 * @param options - Whether to warn of a kind change, and a supplied kind; see {@link ValueKindOptions}.
 * @returns The kind, and whether a value or default value named it.
 * @throws TypeError when a time granularity meets a PlainDate value or default value, a host defect.
 */
export function useValueKind(
  props: ValueKindProps,
  owner: string,
  { warnOnKindChange = false, supplied }: ValueKindOptions = {}
): ResolvedKind {
  const [previous, setPrevious] = useState<ResolvedKind | undefined>(undefined);
  if (supplied !== undefined) {
    return { kind: supplied, named: true };
  }
  const resolved = resolveValueKind({ ...props, previous });
  if (resolved._tag === "err") {
    throw new TypeError(`${owner} granularity: ${resolved.error.message}`);
  }
  const next = resolved.value;
  // The stored kind is handed back while it holds, so it is stable as a memo dependency.
  if (previous !== undefined && previous.named === next.named && sameKind(previous.kind, next.kind)) {
    return previous;
  }
  // A zone change, such as `value.withTimeZone(...)`, keeps the kind, and a kind the props made
  // was never the input's to keep: only a value of another kind than a named one warns.
  if (
    warnOnKindChange &&
    isThemeDevelopment() &&
    previous?.named === true &&
    props.value !== null &&
    previous.kind.kind !== next.kind.kind
  ) {
    console.warn(
      `${owner} value changed kind from ${previous.kind.kind} to ${next.kind.kind}. Keep one kind per input; the input emits the kind it last held.`
    );
  }
  setPrevious(next);
  return next;
}
