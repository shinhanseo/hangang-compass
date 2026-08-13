import express, { type ErrorRequestHandler } from "express";

import { createApplicationServices, type ApplicationServices } from "../../composition-root.js";
import { createMeetingRouter } from "./meeting-router.js";

export function createApp(services: ApplicationServices = createApplicationServices()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((_request, response, next) => {
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "hangang-compass-api" });
  });
  app.use("/api", createMeetingRouter(services));
  app.use((_request, response) => {
    response.status(404).json({ error: "not_found" });
  });
  const errorHandler: ErrorRequestHandler = (_error, _request, response, next) => {
    if (response.headersSent) {
      next(_error);
      return;
    }
    response.status(500).json({ error: "internal_error" });
  };
  app.use(errorHandler);
  return app;
}
