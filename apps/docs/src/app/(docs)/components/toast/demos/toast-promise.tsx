"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Toast } from "@elmeragroup/ui/toast";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function PromiseButtons() {
  const toastManager = Toast.useToastManager();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          void toastManager.promise(
            wait(1200).then(() => "ok"),
            {
              loading: "Saving reading…",
              success: { title: "Saved", description: "The meter reading is stored." },
              error: "Could not save the reading.",
            }
          )
        }>
        Save (success)
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          void toastManager
            .promise(
              wait(1200).then(() => Promise.reject(new Error("offline"))),
              {
                loading: "Saving reading…",
                success: "Saved",
                error: { title: "Could not save", description: "Check the connection and try again." },
              }
            )
            .catch(() => {
              // The toast has presented this expected, simulated failure.
            })
        }>
        Save (error)
      </Button>
    </div>
  );
}

export function ToastPromise() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <PromiseButtons />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
