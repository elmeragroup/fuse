"use client";

import { Input } from "@elmeragroup/fuse/input";

export function InputReadOnly() {
  return <Input aria-label="Email" defaultValue="ada@example.com" readOnly />;
}
