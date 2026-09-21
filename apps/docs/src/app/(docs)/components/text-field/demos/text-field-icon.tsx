"use client";

import { MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldIcon() {
  return <TextField label="Search" placeholder="Meter number" icon={<MagnifyingGlass aria-hidden />} />;
}
