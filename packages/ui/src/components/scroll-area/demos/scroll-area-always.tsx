import { ScrollArea } from "@elmeragroup/ui/scroll-area";

const ENTRIES = Array.from({ length: 24 }, (_, index) => `Entry ${String(index + 1)}`);

export function ScrollAreaAlways() {
  return (
    <ScrollArea.Root type="always" className="h-72 rounded-md border">
      <div className="p-4">
        <h4 className="text-sm font-medium mb-4">Persistent scrollbar</h4>
        <ul className="flex flex-col gap-2">
          {ENTRIES.map((entry) => (
            <li key={entry} className="text-sm">
              {entry}
            </li>
          ))}
        </ul>
      </div>
    </ScrollArea.Root>
  );
}
