"use client";

import { Avatar } from "@elmeragroup/fuse/avatar";

export function AvatarSize() {
  return (
    <Avatar.Root className="size-12">
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar.Root>
  );
}
