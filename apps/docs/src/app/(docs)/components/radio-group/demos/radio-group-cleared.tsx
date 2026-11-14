"use client";

import { useState } from "react";

import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupCleared() {
  const [value, setValue] = useState<string | null>("fixed");

  return (
    <div className="flex flex-col items-start gap-4">
      <RadioGroup label="Contract" value={value} onChange={setValue}>
        <Radio value="fixed">Fixed price</Radio>
        <Radio value="spot">Spot price</Radio>
      </RadioGroup>
      <button type="button" className="text-sm underline underline-offset-4" onClick={() => setValue(null)}>
        Clear the choice
      </button>
    </div>
  );
}
