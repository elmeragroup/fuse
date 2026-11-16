"use client";

import { Avatar } from "@elmeragroup/fuse/avatar";

export function AvatarGroup() {
  return (
    <Avatar.Group className="w-fit">
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root>
        <Avatar.Fallback>GH</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root>
        <Avatar.Fallback>KJ</Avatar.Fallback>
      </Avatar.Root>
    </Avatar.Group>
  );
}
