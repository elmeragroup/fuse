import type { ReactElement } from "react";

import { Gallery } from "../components/gallery";

export default function PlaygroundPage(): ReactElement {
  return (
    <main className="max-w-5xl mx-auto flex flex-col gap-10 px-6 py-8">
      <Gallery />
    </main>
  );
}
