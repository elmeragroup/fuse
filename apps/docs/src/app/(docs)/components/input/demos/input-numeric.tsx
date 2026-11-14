"use client";

import { Input } from "@elmeragroup/fuse/input";

export function InputNumeric() {
  return (
    <Input type="tel" filter="numeric" maxLength={8} aria-label="Mobile number" placeholder="912 34 567" />
  );
}
