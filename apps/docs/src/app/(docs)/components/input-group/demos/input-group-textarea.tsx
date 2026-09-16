"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { InputGroup } from "@elmeragroup/ui/input-group";

/** Records a support message locally and lets the reader start again. */
export function InputGroupTextarea() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");

  return (
    <div className="max-w-md flex w-full flex-col gap-3">
      <InputGroup.Root>
        <InputGroup.Textarea
          aria-label="Message to support"
          placeholder="Describe the problem…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <InputGroup.Addon align="block-end">
          <InputGroup.Text>Demo only. Nothing is sent.</InputGroup.Text>
          <InputGroup.Button
            className="ml-auto"
            size="sm"
            variant="outline"
            disabled={!message.trim()}
            onClick={() => {
              setSent(message);
              setMessage("");
            }}>
            Send
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
      <p role="status">{sent ? `Message saved in this demo: ${sent}` : ""}</p>
      {sent ? (
        <Button className="self-start" size="sm" variant="outline" onClick={() => setSent("")}>
          Reset example
        </Button>
      ) : null}
    </div>
  );
}
