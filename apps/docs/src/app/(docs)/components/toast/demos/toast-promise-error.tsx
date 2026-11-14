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
        void toastManager
          .promise(
            wait(1200).then(() => Promise.reject(new Error("offline"))),
            {
              loading: "Saving the reading.",
              success: "Reading saved",
              error: { title: "Could not save", description: "Check the connection and try again." },
            }
          )
          .catch(() => {
            // The error toast has told the user. `promise` still rejects, so the caller handles it.
          })
      }>
      Save reading
    </Button>
  );
}

export function ToastPromiseError() {
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
