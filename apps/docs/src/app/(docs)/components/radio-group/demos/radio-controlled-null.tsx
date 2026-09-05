"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Radio, RadioGroup } from "@elmeragroup/ui/radio-group";

export function RadioControlledNull() {
  const [value, setValue] = useState<string | null>("fixed");

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup label="Contract" value={value} onChange={setValue}>
        <Radio value="fixed">Fixed</Radio>
        <Radio value="spot">Spot</Radio>
      </RadioGroup>
      <Button type="button" onClick={() => setValue(null)}>
        Clear
      </Button>
    </div>
  );
}
