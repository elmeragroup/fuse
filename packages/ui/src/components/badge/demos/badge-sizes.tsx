import { Badge } from "@elmeragroup/ui/badge";

export function BadgeSizes() {
  return (
    <div className="flex items-center gap-2">
      <Badge size="sm">Small</Badge>
      <Badge size="default">Default</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  );
}
