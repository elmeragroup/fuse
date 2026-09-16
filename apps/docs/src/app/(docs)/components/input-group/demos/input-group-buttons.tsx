"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { X } from "@elmeragroup/ui/icons";
import { InputGroup } from "@elmeragroup/ui/input-group";

const initialMeter = "707057500012345678";

/** Editable meter number with clipboard feedback and a resettable clear action. */
export function InputGroupButtons() {
  const [meter, setMeter] = useState(initialMeter);
  const [status, setStatus] = useState("");

  async function copyMeter() {
    try {
      await navigator.clipboard.writeText(meter);
      setStatus("Meter number copied.");
    } catch {
      setStatus("Copy unavailable. Select the meter number and copy it manually.");
    }
  }

  return (
    <div className="max-w-md flex w-full flex-col gap-3">
      <InputGroup.Root>
        <InputGroup.Input
          aria-label="Meter number"
          value={meter}
          onChange={(event) => {
            setMeter(event.target.value);
            setStatus("");
          }}
        />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button disabled={!meter} onClick={() => void copyMeter()}>
            Copy
          </InputGroup.Button>
          <InputGroup.Button
            size="icon-xs"
            aria-label="Clear meter number"
            disabled={!meter}
            onClick={() => {
              setMeter("");
              setStatus("Meter number cleared.");
            }}>
            <X />
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
      <p role="status">{status}</p>
      <Button
        className="self-start"
        size="sm"
        variant="outline"
        onClick={() => {
          setMeter(initialMeter);
          setStatus("");
        }}>
        Reset example
      </Button>
    </div>
  );
}
