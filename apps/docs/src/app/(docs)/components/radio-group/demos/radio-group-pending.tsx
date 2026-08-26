"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Radio, RadioGroup } from "@elmeragroup/ui/radio-group";

export function RadioGroupPending() {
  const [isPending, setIsPending] = useState(true);
  const [value, setValue] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsPending(false);
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        label="Contract"
        description="Plans load before a selection can be made."
        value={value}
        onChange={setValue}
        isPending={isPending}
        isInvalid={invalid}
        errorMessage={invalid ? "Pick a contract." : undefined}>
        <Radio value="fixed" isDisabled={isPending}>
          Fixed
        </Radio>
        <Radio value="spot" isDisabled={isPending}>
          Spot
        </Radio>
      </RadioGroup>
      <Button type="button" onClick={() => setInvalid((current) => !current)}>
        {invalid ? "Clear error" : "Show error"}
      </Button>
    </div>
  );
}
