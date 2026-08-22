import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupTextarea() {
  return (
    <InputGroup.Root>
      <InputGroup.Textarea aria-label="Message to support" placeholder="Describe the problem…" />
      <InputGroup.Addon align="block-end">
        <InputGroup.Text>Attachments are added after sending.</InputGroup.Text>
        <InputGroup.Button className="ml-auto" size="sm" variant="outline">
          Send
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
