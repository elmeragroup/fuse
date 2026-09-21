"use client";

import { Avatar } from "@elmeragroup/fuse/avatar";

const src =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#5b8def"/><circle cx="16" cy="12" r="6" fill="white"/><ellipse cx="16" cy="28" rx="10" ry="8" fill="white"/></svg>'
  );

export function AvatarBasic() {
  return (
    <div className="flex items-center gap-3">
      <Avatar.Root>
        <Avatar.Image src={src} alt="" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <span className="text-sm">Ada Lovelace</span>
    </div>
  );
}
