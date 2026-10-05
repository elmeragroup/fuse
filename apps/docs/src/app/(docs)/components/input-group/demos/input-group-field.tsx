"use client";

import { useState } from "react";

import { Field } from "@elmeragroup/fuse/field";
import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupField() {
  const [mobile, setMobile] = useState("4123");
  const isInvalid = !/^\d{8}$/.test(mobile);

  return (
    <div className="flex flex-col gap-6">
      <Field.Root>
        <Field.Label>Postal code</Field.Label>
        <InputGroup.Root>
          <InputGroup.Input defaultValue="5003" inputMode="numeric" maxLength={4} />
          <InputGroup.Addon align="inline-end">
            <Field.Description>Bergen</Field.Description>
          </InputGroup.Addon>
        </InputGroup.Root>
      </Field.Root>
      <Field.Root invalid={isInvalid}>
        <Field.Label>Mobile number</Field.Label>
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>+47</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input
            type="tel"
            value={mobile}
            onChange={(event) => {
              setMobile(event.target.value);
            }}
          />
        </InputGroup.Root>
        <Field.Description>We send the order confirmation here.</Field.Description>
        {isInvalid ? <Field.Error>Enter 8 digits.</Field.Error> : null}
      </Field.Root>
    </div>
  );
}
