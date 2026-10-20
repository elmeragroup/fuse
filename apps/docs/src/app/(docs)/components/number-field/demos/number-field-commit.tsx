"use client";

import { useState } from "react";

import { NumberField } from "@elmeragroup/fuse/number-field";

/** A cleared field reports `NaN`, which the log reads as "empty". */
function describeValue(value: number): string {
  return Number.isNaN(value) ? "empty" : String(value);
}

export function NumberFieldCommit() {
  const [changed, setChanged] = useState(4);
  const [committed, setCommitted] = useState(4);
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label="Seats"
        defaultValue={4}
        minValue={1}
        maxValue={50}
        onChange={setChanged}
        onValueCommitted={setCommitted}
      />
      <p className="tabular-nums">Last change: {describeValue(changed)}</p>
      <p className="tabular-nums">Last commit: {describeValue(committed)}</p>
    </div>
  );
}
