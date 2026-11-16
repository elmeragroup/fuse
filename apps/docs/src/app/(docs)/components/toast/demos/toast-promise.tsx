"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function SaveButton() {
  const toastManager = Toast.useToastManager();

  return (
    <Button
      variant="outline"
      onClick={() =>
        void toastManager.promise(wait(1200), {
          loading: "Saving the reading.",
          success: { title: "Reading saved", description: "The meter reading is stored." },
          error: "Could not save the reading.",
        })
      }>
      Save reading
    </Button>
  );
}

export function ToastPromise() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    // `container` and `absolute` keep the stack inside this preview. An app renders one
    // viewport, fixed to the window.
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <SaveButton />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
