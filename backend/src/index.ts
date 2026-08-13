import { createLiveApp } from "./runtime/create-live-app.js";

const port = Number(process.env.PORT ?? 3000);
const app = await createLiveApp();

app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  console.log(JSON.stringify({ event: "api_started", port }));
});
