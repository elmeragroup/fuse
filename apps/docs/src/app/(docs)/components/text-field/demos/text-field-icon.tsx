"use client";

import { MagnifyingGlass } from "@elmeragroup/ui/icons";
import { TextField } from "@elmeragroup/ui/text-field";

export function TextFieldIcon() {
  return <TextField label="Search" placeholder="Meter number" icon={<MagnifyingGlass aria-hidden />} />;
}
