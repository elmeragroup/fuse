import type { ReactElement } from "react";

import { Button } from "@elmeragroup/ui/button";
import { SpinnerGap } from "@elmeragroup/ui/icons";

export function ButtonPending(): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Save</Button>
      <Button isPending>
        <SpinnerGap className="animate-spin" />
        Saving
      </Button>
    </div>
  );
}
