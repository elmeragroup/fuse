"use client";

import { useState } from "react";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardGroup() {
  const [value, setValue] = useState<string[]>(["insurance"]);

  return (
    <CheckboxGroup name="addons" label="Add-ons" value={value} onChange={setValue}>
      <CheckboxCard value="insurance" title="Insurance" description="Covers everything." tags={["Popular"]} />
      <CheckboxCard value="roadside" title="Roadside" description="Towing included." />
      <CheckboxCard value="glass" title="Glass" description="Windscreen and lights." />
    </CheckboxGroup>
  );
}
