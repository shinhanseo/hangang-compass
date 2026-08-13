import type { IncomingMessage, ServerResponse } from "node:http";

import { createLiveApp } from "../backend/src/runtime/create-live-app.js";

let appPromise: ReturnType<typeof createLiveApp> | undefined;

export function expressApiUrl(requestUrl: string | undefined) {
  const url = new URL(requestUrl ?? "/", "http://localhost");
  const path = url.searchParams.get("path") ?? "";
  url.searchParams.delete("path");
  return `/api/${path}${url.search}`;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  request.url = expressApiUrl(request.url);
  appPromise ??= createLiveApp();
  const app = await appPromise;
  return app(request, response);
}
