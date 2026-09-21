"use client";

import { useState } from "react";

import { House, List, Stack } from "@elmeragroup/fuse/icons";
import { RadioGroup, RadioIconButton } from "@elmeragroup/fuse/radio-group";

const SIZES = ["icon-xxs", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;

export function RadioIconButtonDemo() {
  const [value, setValue] = useState("list");

  return (
    <div className="flex flex-col gap-4">
      {SIZES.map((size) => (
        <RadioGroup key={size} label={size} orientation="horizontal" value={value} onChange={setValue}>
          <RadioIconButton value="list" size={size} aria-label="List">
            <List />
          </RadioIconButton>
          <RadioIconButton value="home" size={size} aria-label="Home">
            <House />
          </RadioIconButton>
          <RadioIconButton value="stack" size={size} aria-label="Stack">
            <Stack />
          </RadioIconButton>
        </RadioGroup>
      ))}
    </div>
  );
}
