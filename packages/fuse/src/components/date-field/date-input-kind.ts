"use client";

// This module is the private interface through which the control around a DateInput supplies the
// kind of the values the input edits. The supplied kind replaces the input's own kind resolution
// and memory in `useValueKind`. It is separate from the units the input shows, in
// `date-input-scope.ts`. A control may cut an input to the time, supply its kind, or both.
//
// A date picker decides its values' kind. Each input it renders edits one value, the picker's or
// one range end's. While that value is set, the picker supplies the value's own kind. While it is
// empty, the picker supplies the kind it resolved from its value and default value, which the input
// never sees. An empty input therefore still forms the kind and zone that the picker's default value
// or an earlier value named. The picker remembers that kind. The input keeps no kind history of its
// own, so a kind that one of its earlier values named does not outlive that value.

import { createContext } from "react";

import type { ValueKind } from "../../temporal/temporal-value";

/** The kind the control around a DateInput supplies for its values, or `undefined` outside one. */
export const DateInputKindContext = createContext<ValueKind | undefined>(undefined);
