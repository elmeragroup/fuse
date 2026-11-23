import { registerRoot } from "remotion";

// Fuse's date components need Temporal, which Remotion's headless Chrome may lack.
import "@elmeragroup/fuse/temporal-polyfill";

import { RemotionRoot } from "./root";

registerRoot(RemotionRoot);
