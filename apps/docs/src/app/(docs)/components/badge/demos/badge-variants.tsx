"use client";

import { Badge } from "@elmeragroup/ui/badge";

const FILLED = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "muted",
  "accent",
  "card",
] as const;

const OUTLINE = [
  "outline",
  "outline-secondary",
  "outline-destructive",
  "outline-success",
  "outline-warning",
] as const;

export function BadgeVariants() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILLED.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {OUTLINE.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
    </div>
  );
}
