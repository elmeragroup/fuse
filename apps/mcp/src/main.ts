/**
 * Starts the Fuse MCP server. It reads its settings from the environment (`config.ts`), and a
 * catalog or skill that does not load stops it with a nonzero exit before it listens.
 *
 * Usage: node dist/main.mjs, beside catalog.json and skills/, or set FUSE_CATALOG_FILE and
 * FUSE_SKILLS_DIR.
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Layer from "effect/Layer";

import { ServerLive } from "./server.ts";

NodeRuntime.runMain(Layer.launch(ServerLive));
