"use client";

import { Fragment } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";

const VARIANTS = ["default", "outline", "secondary", "ghost"] as const;
const ACTIONS = ["Archive", "Snooze", "Report"] as const;
// Filled Buttons paint under their transparent border, so joined segments take a Separator.
const FILLED = new Set<(typeof VARIANTS)[number]>(["default", "secondary"]);

export function ButtonGroupBasic() {
  return (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <ButtonGroup.Root key={variant} aria-label={`${variant} actions`}>
          {ACTIONS.map((action, index) => (
            <Fragment key={action}>
              {index > 0 && FILLED.has(variant) ? <ButtonGroup.Separator /> : null}
              <Button variant={variant}>{action}</Button>
            </Fragment>
          ))}
        </ButtonGroup.Root>
      ))}
    </div>
  );
}
