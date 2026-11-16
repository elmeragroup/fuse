"use client";

import { House, List, Stack } from "@elmeragroup/fuse/icons";
import { RadioGroup, RadioIconButton } from "@elmeragroup/fuse/radio-group";

export function RadioIconButtonLarge() {
  return (
    <RadioGroup label="View" orientation="horizontal" defaultValue="list">
      <RadioIconButton value="list" size="icon-lg" aria-label="List">
        <List />
      </RadioIconButton>
      <RadioIconButton value="home" size="icon-lg" aria-label="Home">
        <House />
      </RadioIconButton>
      <RadioIconButton value="stack" size="icon-lg" aria-label="Stack">
        <Stack />
      </RadioIconButton>
    </RadioGroup>
  );
}
