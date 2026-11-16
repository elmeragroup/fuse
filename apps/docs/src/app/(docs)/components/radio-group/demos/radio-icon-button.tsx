"use client";

import { House, List, Stack } from "@elmeragroup/fuse/icons";
import { RadioGroup, RadioIconButton } from "@elmeragroup/fuse/radio-group";

export function RadioIconButtonDemo() {
  return (
    <RadioGroup label="View" orientation="horizontal" defaultValue="list">
      <RadioIconButton value="list" aria-label="List">
        <List />
      </RadioIconButton>
      <RadioIconButton value="home" aria-label="Home">
        <House />
      </RadioIconButton>
      <RadioIconButton value="stack" aria-label="Stack">
        <Stack />
      </RadioIconButton>
    </RadioGroup>
  );
}
