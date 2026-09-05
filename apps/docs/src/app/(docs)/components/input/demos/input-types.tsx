"use client";

import { Input } from "@elmeragroup/ui/input";

export function InputTypes() {
  return (
    <div className="flex flex-col gap-3">
      <Input aria-label="Name" type="text" />
      <Input aria-label="Email" type="email" />
      <Input aria-label="Amount" type="number" />
      <Input aria-label="Password" type="password" />
      <Input aria-label="Attachment" type="file" />
    </div>
  );
}
