"use client";

import { useRef, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

const PLACEMENTS = [
  { placement: "top-left", label: "Top left" },
  { placement: "top-center", label: "Top center" },
  { placement: "top-right", label: "Top right" },
  { placement: "bottom-left", label: "Bottom left" },
  { placement: "bottom-center", label: "Bottom center" },
  { placement: "bottom-right", label: "Bottom right" },
] as const;

type Placement = (typeof PLACEMENTS)[number]["placement"];

function PlacementButtons({ onPlace }: { onPlace: (placement: Placement) => void }) {
  const toastManager = Toast.useToastManager();

  return (
    <div className="max-w-md grid grid-cols-3 gap-2">
      {PLACEMENTS.map(({ placement, label }) => (
        <Button
          key={placement}
          variant="outline"
          onClick={() => {
            onPlace(placement);
            toastManager.add({ title: label, description: `Placement "${placement}".` });
          }}>
          {label}
        </Button>
      ))}
    </div>
  );
}

export function ToastPlacement() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  return (
    // The buttons sit mid-stage so a stack at either edge leaves them uncovered.
    <div ref={viewportRef} className="relative flex min-h-[36rem] w-full items-center justify-center">
      <Toast.Provider>
        <PlacementButtons onPlace={setPlacement} />
        {/* `absolute` keeps the stack inside this preview, and the width cap keeps the 340px
            column inside it when the preview is narrower. An app keeps the fixed default. */}
        <Toast.Viewport
          container={viewportRef}
          placement={placement}
          className="sm:max-w-[calc(100%-4rem)] absolute"
        />
      </Toast.Provider>
    </div>
  );
}
