"use client";

import { Code } from "@elmeragroup/fuse/code";

export function CodeDemo() {
  return (
    <Code
      code={`const answer = 42;
console.log(answer);`}
    />
  );
}
