"use client";

import { useState } from "react";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldUncontrolled() {
  const [log, setLog] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label="Quantity"
        defaultValue={2}
        onChange={(value) => {
          setLog(Number.isNaN(value) ? "NaN" : String(value));
        }}
      />
      {log ? <p>Last change: {log}</p> : null}
    </div>
  );
}
