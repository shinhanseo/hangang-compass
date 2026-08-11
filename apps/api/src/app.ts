import express from "express";

export function createApp() {
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

  app.use((_request, response) => {
    response.status(404).json({ error: "not_found" });
  });
  return app;
}
