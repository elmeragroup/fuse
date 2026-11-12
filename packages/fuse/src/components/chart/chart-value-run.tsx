/**
 * A formatted value laid out as its number and the text around it, which every polar centre prints:
 * the number in its own part, which a centre may roll, and the unit before or after it in parts of
 * their own, joined by a breakable space where the formatter wrote a space. A unit breaks at its
 * first space too, so a long unit such as `øre/kWh inkl. mva` wraps inside a narrow centre as
 * `øre/kWh` over `inkl. mva` instead of overflowing it or splitting its phrase.
 */
import type { ReactElement, ReactNode } from "react";

import type { ValueRun } from "./format/value-format";

/** A unit's text as a centre prints it, and whether a space parts it from the number. */
type UnitText = { readonly text: string; readonly apart: boolean };

/**
 * A unit's text, breakable at its first space only, and whether the formatter set it apart from the
 * number. The run's spaces are canonical, every one U+00A0. The first space parts the unit from what
 * qualifies it, such as `øre/kWh` from `inkl. mva`, so a narrow centre wraps there and keeps each
 * phrase whole.
 */
function unitOf(text: string, apart: RegExp): UnitText {
  const kept = text.replace(/^\u00a0+|\u00a0+$/gu, "");
  return { text: kept.replace("\u00a0", " "), apart: apart.test(text) };
}

/**
 * A value's number and the unit text around it.
 *
 * @param props - The value's run, and the number as the centre draws it, such as a digit roll.
 * @returns The parts, in the order the formatter wrote them.
 */
export function ChartValueRun({
  run,
  number,
}: {
  readonly run: ValueRun;
  readonly number: ReactNode;
}): ReactElement {
  const before = unitOf(run.before, /\u00a0$/u);
  const after = unitOf(run.after, /^\u00a0/u);
  return (
    <>
      {before.text === "" ? null : <span data-part="unit">{before.text}</span>}
      {before.text !== "" && before.apart ? " " : null}
      <span data-part="number">{number}</span>
      {after.text !== "" && after.apart ? " " : null}
      {after.text === "" ? null : <span data-part="unit">{after.text}</span>}
    </>
  );
}

Object.assign(ChartValueRun, { displayName: "Chart.ValueRun" });
