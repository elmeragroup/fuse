"use client";

import { Avatar } from "@elmeragroup/fuse/avatar";

export function AvatarFallback() {
  return (
    <Avatar.Root>
      <Avatar.Image src="/this-avatar-does-not-exist.png" alt="" />
      <Avatar.Fallback delay={400}>AL</Avatar.Fallback>
    </Avatar.Root>
  );
}
