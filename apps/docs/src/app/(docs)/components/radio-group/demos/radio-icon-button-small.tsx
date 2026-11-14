"use client";

import { House, List, Stack } from "@elmeragroup/fuse/icons";
import { RadioGroup, RadioIconButton } from "@elmeragroup/fuse/radio-group";

export function RadioIconButtonSmall() {
  return (
    <RadioGroup label="View" orientation="horizontal" defaultValue="list">
      <RadioIconButton value="list" size="icon-sm" aria-label="List">
        <List />
      </RadioIconButton>
      <RadioIconButton value="home" size="icon-sm" aria-label="Home">
        <House />
      </RadioIconButton>
      <RadioIconButton value="stack" size="icon-sm" aria-label="Stack">
        <Stack />
      </RadioIconButton>
    </RadioGroup>
  );
}
