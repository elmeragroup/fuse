"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

const toastManager = Toast.createToastManager();

// Plain code outside React, such as a timer or a query-cache listener.
function syncReadings(): void {
  const id = toastManager.add({ type: "loading", title: "Syncing readings…" });
  setTimeout(() => {
    toastManager.update(id, {
      type: "success",
      title: "Readings synced",
      description: "Three meters reported new values.",
    });
  }, 1200);
}

export function ToastModuleManager() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider toastManager={toastManager}>
        <Button variant="outline" onClick={syncReadings}>
          Sync readings
        </Button>
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
