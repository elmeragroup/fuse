"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

const MESSAGES = [
  { type: "success" as const, title: "Invoice sent", description: "Customer 1001." },
  { type: "info" as const, title: "Price updated", description: "Spot price refreshed." },
  { type: "warning" as const, title: "Missing reading", description: "Meter 442 is late." },
  { type: "error" as const, title: "Export failed", description: "CSV could not be built." },
  { title: "Draft stored", description: "Neutral toast." },
];

function StackingButtons() {
  const toastManager = Toast.useToastManager();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => {
          for (const [index, message] of MESSAGES.entries()) {
            window.setTimeout(() => {
              toastManager.add({ ...message, timeout: 8000 });
            }, index * 180);
          }
        }}>
        Fire five
      </Button>
      <Button variant="outline" onClick={() => toastManager.close()}>
        Close all
      </Button>
    </div>
  );
}

export function ToastStacking() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider limit={3}>
        <StackingButtons />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
