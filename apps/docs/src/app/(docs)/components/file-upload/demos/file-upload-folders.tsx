"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import { Folder } from "@elmeragroup/fuse/icons";

/** How many paths the demo lists before it counts the rest. */
const SHOWN = 5;

export function FileUploadFolders() {
  const [paths, setPaths] = useState<readonly string[]>([]);

  return (
    <FileUpload.Root
      directory
      multiple
      onSelect={(files) => setPaths(files.map((file) => file.webkitRelativePath || file.name))}
      className="max-w-md w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger render={<Button variant="outline" size="sm" />}>
          <Folder data-icon="inline-start" />
          Add folder
        </FileUpload.Trigger>
        <FileUpload.Description>Drop a folder here or choose one.</FileUpload.Description>
      </FileUpload.Dropzone>
      {paths.length > 0 ? (
        <ul className="text-sm text-muted-foreground">
          {paths.slice(0, SHOWN).map((path) => (
            <li key={path}>{path}</li>
          ))}
          {paths.length > SHOWN ? <li>and {paths.length - SHOWN} more</li> : null}
        </ul>
      ) : null}
    </FileUpload.Root>
  );
}
