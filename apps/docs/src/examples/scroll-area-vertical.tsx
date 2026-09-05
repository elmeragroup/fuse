"use client";

import type { ReactElement } from "react";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

const TAGS = Array.from({ length: 24 }, (_, index) => `Tag ${String(index + 1)}`);

export function ScrollAreaVertical(): ReactElement {
  return (
    <ScrollArea.Root className="h-72 rounded-md border">
      <div className="p-4">
        <h4 className="text-sm font-medium mb-4">Tags</h4>
        <ul className="flex flex-col gap-2">
          {TAGS.map((tag) => (
            <li key={tag} className="text-sm">
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </ScrollArea.Root>
  );
}
