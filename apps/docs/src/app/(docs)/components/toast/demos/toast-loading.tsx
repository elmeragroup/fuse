"use client";

import { useRef } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

function ShowButton() {
  const toastManager = Toast.useToastManager();

  return (
    <button
      type="button"
      onClick={() =>
        toastManager.add({
          type: "loading",
          title: "Syncing readings",
          description: "Three meters are reporting.",
        })
      }>
      Sync readings
    </button>
  );
}

export function ToastLoading() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    // `container` and `absolute` keep the stack inside this preview. An app renders one
    // viewport, fixed to the window.
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <ShowButton />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
