import { MagnifyingGlass } from "@elmeragroup/ui/icons";
import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupKbd() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Search" placeholder="Search…" />
      <InputGroup.Addon align="inline-end">
        <kbd className="text-xs bg-muted px-1.5 py-0.5 text-muted-foreground">⌘K</kbd>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
