"use client";

import { useRef } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

function SaveButton() {
  const toastManager = Toast.useToastManager();

  return (
    <button
      type="button"
      onClick={() => toastManager.add({ title: "Draft saved", description: "You can finish it later." })}>
      Save draft
    </button>
  );
}

export function ToastDemo() {
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
