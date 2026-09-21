"use client";

import { useState } from "react";

import { FileTrigger } from "@elmeragroup/fuse/react-aria/file-trigger";

export function FileTriggerBasic() {
  const [names, setNames] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-3">
      <FileTrigger
        acceptedFileTypes={["image/png", "image/jpeg", ".pdf"]}
        allowsMultiple
        onSelect={(files) => {
          setNames(files ? [...files].map((file) => file.name) : []);
        }}>
        Attach files
      </FileTrigger>
      {names.length > 0 ? <p className="text-sm text-muted-foreground">{names.join(", ")}</p> : null}
    </div>
  );
}
