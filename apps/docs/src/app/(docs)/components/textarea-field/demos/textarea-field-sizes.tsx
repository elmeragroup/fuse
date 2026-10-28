"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <TextareaField size="sm" label="Small" placeholder="Write a short note." className="w-56" />
      <TextareaField label="Default" placeholder="Write a short note." className="w-56" />
    </div>
  );
}
