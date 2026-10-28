"use client";

import { Input } from "@elmeragroup/fuse/input";

export function InputSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input size="sm" aria-label="Small email" placeholder="Small" className="w-48" />
      <Input aria-label="Default email" placeholder="Default" className="w-48" />
    </div>
  );
}
