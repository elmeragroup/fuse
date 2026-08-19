import { Button } from "@elmeragroup/ui/button";

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"] as const;

export function ButtonVariantMatrix() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  );
}
