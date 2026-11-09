import type { ReactElement, ReactNode } from "react";

import { InlineCode } from "../../../../../components/inline-code";
import { DATE_KINDS, DATE_RECIPES } from "./date-recipes";
import type { RecipeCode } from "./date-recipes";
import { MappingTable, c } from "./mapping-table";
import type { Row } from "./mapping-table";

function temporalCell(temporal: RecipeCode): ReactNode {
  switch (temporal.kind) {
    case "standalone":
    case "any": {
      return c(temporal.code);
    }
    case "none": {
      return temporal.text;
    }
    case "per-kind": {
      return (
        <dl className="m-0 grid gap-1">
          {DATE_KINDS.flatMap((kind) => {
            const code = temporal.code[kind];
            return code === undefined
              ? []
              : [
                  <div key={kind}>
                    <dt className="text-xs text-muted-foreground">{kind}</dt>
                    <dd className="m-0">{c(code)}</dd>
                  </div>,
                ];
          })}
        </dl>
      );
    }
  }
}

const ROWS: readonly Row[] = DATE_RECIPES.map((recipe) => {
  const note = recipe.note === undefined ? null : <InlineCode text={recipe.note} />;
  return [c(recipe.from), temporalCell(recipe.temporal), note];
});

/** The `@internationalized/date` → Temporal table, rendered from the tested recipes. */
export function DateApiSection(): ReactElement {
  return (
    <>
      <h2 id="date-api">From @internationalized/date to Temporal</h2>
      <p>
        <code>CalendarDate</code> → <code>Temporal.PlainDate</code>, <code>CalendarDateTime</code> →{" "}
        <code>Temporal.PlainDateTime</code>, <code>ZonedDateTime</code> → <code>Temporal.ZonedDateTime</code>,{" "}
        <code>Time</code> → <code>Temporal.PlainTime</code>. React Aria&apos;s <code>DateValue</code>, the
        union of the first three, is Fuse&apos;s <code>DateInputValue</code>. Values are immutable in both, so
        no <code>copy()</code> is needed. Where a kind lacks a method or needs another one, the row gives each
        kind its own recipe; a kind a row leaves out has no counterpart. Fuse&apos;s docs tests run each
        expression below twice, on Node&apos;s native Temporal and on <code>temporal-polyfill</code> (what the
        entry installs where an engine has none), for every kind it lists, against written-out results. In
        them <code>date</code>, <code>a</code> and <code>b</code> are values of the row&apos;s kind,{" "}
        <code>tz</code> a zone, <code>firstDay</code> the locale&apos;s first weekday (Monday 1 to Sunday 7)
        and <code>time</code> a <code>Temporal.PlainTime</code>.
      </p>
      <MappingTable columns={["@internationalized/date", "Temporal", "Notes"]} rows={ROWS} />
    </>
  );
}
