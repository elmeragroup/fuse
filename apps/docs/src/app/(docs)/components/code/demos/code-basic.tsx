"use client";

import { Code } from "@elmeragroup/ui/code";

export function CodeBasic() {
  return (
    <Code
      code={`const answer = 42;
console.log(answer);`}
    />
  );
}
