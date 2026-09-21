"use client";

import { Avatar } from "@elmeragroup/fuse/avatar";

const sizes = ["size-6", "size-8", "size-10", "size-12"] as const;

export function AvatarSizes() {
  return (
    <div className="flex items-center gap-4">
      {sizes.map((size) => (
        <Avatar.Root key={size} className={size}>
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      ))}
    </div>
  );
}
