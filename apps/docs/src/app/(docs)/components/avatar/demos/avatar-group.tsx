"use client";

import { Avatar } from "@elmeragroup/ui/avatar";

function portrait(fill: string): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/><circle cx="16" cy="12" r="6" fill="white"/><ellipse cx="16" cy="28" rx="10" ry="8" fill="white"/></svg>`
    )
  );
}

const people = [
  { src: portrait("#5b8def"), initials: "AL", alt: "Ada Lovelace" },
  { src: portrait("#3f8f6b"), initials: "GH", alt: "Grace Hopper" },
  { src: portrait("#c47a3a"), initials: "KJ", alt: "Katherine Johnson" },
] as const;

export function AvatarGroup() {
  return (
    <div className="flex -space-x-2">
      {people.map((person) => (
        <Avatar.Root key={person.initials} className="ring-2 ring-background">
          <Avatar.Image src={person.src} alt={person.alt} />
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar.Root>
      ))}
    </div>
  );
}
