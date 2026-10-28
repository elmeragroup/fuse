"use client";

import { Textarea } from "@elmeragroup/fuse/textarea";

export function TextareaSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Textarea size="sm" aria-label="Small notes" placeholder="Small" className="w-56" />
      <Textarea aria-label="Default notes" placeholder="Default" className="w-56" />
    </div>
  );
}
