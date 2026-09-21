"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";

const sides = [
  { side: "right", swipe: "right" },
  { side: "left", swipe: "left" },
  { side: "top", swipe: "up" },
  { side: "bottom", swipe: "down" },
] as const;

export function SheetSides() {
  return (
    <div className="flex flex-wrap gap-2">
      {sides.map(({ side, swipe }) => (
        <Sheet.Root key={side} side={side}>
          <Sheet.Trigger render={<Button variant="outline" />}>{side}</Sheet.Trigger>
          <Sheet.Content>
            <Sheet.Header>
              <Sheet.Title>{side} sheet</Sheet.Title>
              <Sheet.Description>
                Swipe {swipe} toward the anchored edge to dismiss on touch.
              </Sheet.Description>
            </Sheet.Header>
            <Sheet.Body>
              <p>The panel sits on the {side}. Size is inert on top and bottom.</p>
            </Sheet.Body>
          </Sheet.Content>
        </Sheet.Root>
      ))}
    </div>
  );
}
