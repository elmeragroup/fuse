"use client";

import { House, List, Stack } from "@elmeragroup/fuse/icons";
import { RadioGroup, RadioIconButton } from "@elmeragroup/fuse/radio-group";

export function RadioIconButtonExtraExtraSmall() {
  return (
    <RadioGroup label="View" orientation="horizontal" defaultValue="list">
      <RadioIconButton value="list" size="icon-xxs" aria-label="List">
        <List />
      </RadioIconButton>
      <RadioIconButton value="home" size="icon-xxs" aria-label="Home">
        <House />
      </RadioIconButton>
      <RadioIconButton value="stack" size="icon-xxs" aria-label="Stack">
        <Stack />
      </RadioIconButton>
    </RadioGroup>
  );
}
