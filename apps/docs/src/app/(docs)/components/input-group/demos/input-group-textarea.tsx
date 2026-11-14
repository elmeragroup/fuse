"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupTextareaDemo() {
  return (
    <InputGroup.Root>
      <InputGroup.Textarea aria-label="Message to support" placeholder="Describe the problem" />
      <InputGroup.Addon align="block-end">
        <InputGroup.Text>Replies within one working day.</InputGroup.Text>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
