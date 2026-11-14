"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";

export function RadioGroupCleared() {
  const [value, setValue] = useState<string | null>("fixed");

  return (
    <div className="flex flex-col items-start gap-4">
      <RadioGroup label="Contract" value={value} onChange={setValue}>
        <Radio value="fixed">Fixed price</Radio>
        <Radio value="spot">Spot price</Radio>
      </RadioGroup>
      <Button onClick={() => setValue(null)}>Clear the choice</Button>
    </div>
  );
}
