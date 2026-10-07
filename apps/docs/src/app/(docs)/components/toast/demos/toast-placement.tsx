"use client";

import { useRef, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

type Placement = "bottom-right" | "bottom-center";

function PlacementButtons({ onPlace }: { onPlace: (placement: Placement) => void }) {
  const toastManager = Toast.useToastManager();
  const show = (placement: Placement, title: string) => {
    onPlace(placement);
    toastManager.add({ title, description: `Placement "${placement}".` });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => show("bottom-right", "Bottom right")}>
        Bottom right
      </Button>
      <Button variant="outline" onClick={() => show("bottom-center", "Bottom center")}>
        Bottom center
      </Button>
    </div>
  );
}

export function ToastPlacement() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  return (
    <div ref={viewportRef} className="relative min-h-[28rem] w-full">
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
