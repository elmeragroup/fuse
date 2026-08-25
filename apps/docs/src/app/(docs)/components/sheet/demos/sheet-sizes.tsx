"use client";

import { Button } from "@elmeragroup/ui/button";
import { Sheet } from "@elmeragroup/ui/sheet";

const sizes = ["sm", "md", "lg", "4xl", "8xl"] as const;

export function SheetSizes() {
  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((size) => (
        <Sheet.Root key={size}>
          <Sheet.Trigger render={<Button variant="outline" />}>{size}</Sheet.Trigger>
          <Sheet.Content size={size}>
            <Sheet.Header>
              <Sheet.Title>Size {size}</Sheet.Title>
              <Sheet.Description>
                On the right, size sets max-width from the sm breakpoint up.
              </Sheet.Description>
            </Sheet.Header>
            <Sheet.Body>
              <p>Below sm, and always on top or bottom, the panel is full width.</p>
            </Sheet.Body>
          </Sheet.Content>
        </Sheet.Root>
      ))}
      <Sheet.Root side="top">
        <Sheet.Trigger render={<Button variant="outline" />}>top (size inert)</Sheet.Trigger>
        <Sheet.Content size="sm">
          <Sheet.Header>
            <Sheet.Title>Top sheet</Sheet.Title>
            <Sheet.Description>Size does not apply on the top or bottom edges.</Sheet.Description>
          </Sheet.Header>
        </Sheet.Content>
      </Sheet.Root>
    </div>
  );
}
