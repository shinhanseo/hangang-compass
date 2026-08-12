import { randomInt } from "node:crypto";

import type { RandomIndexProvider } from "../../application/ports/random-index-provider.js";

export class NodeRandomIndexProvider implements RandomIndexProvider {
  pickIndex(length: number): number {
    return randomInt(length);
  }
}
