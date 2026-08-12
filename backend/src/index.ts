import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createApplicationServices } from "./composition-root.js";
import { CachedCrowdDataProvider } from "./infrastructure/providers/cached-crowd-data-provider.js";
import { CachedTransitRouteProvider } from "./infrastructure/providers/cached-transit-route-provider.js";
import { KakaoTransitRouteProvider } from "./infrastructure/providers/kakao/kakao-transit-route-provider.js";
import { SeoulCitydataCrowdProvider } from "./infrastructure/providers/seoul/seoul-citydata-crowd-provider.js";
import { createApp } from "./presentation/http/app.js";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const port = Number(process.env.PORT ?? 3000);
const seoulApiKey = process.env.SEOUL_OPEN_DATA_KEY;
const kakaoApiKey = process.env.KAKAO_REST_API_KEY;
const crowdProvider = seoulApiKey
  ? new CachedCrowdDataProvider(new SeoulCitydataCrowdProvider({
      apiKey: seoulApiKey,
      freshnessThresholdMinutes: 45,
    }), 5 * 60_000)
  : undefined;
const routeProvider = kakaoApiKey
  ? new CachedTransitRouteProvider(new KakaoTransitRouteProvider({ apiKey: kakaoApiKey }), {
      ttlMs: 2 * 60 * 60_000,
      maxRequestsPerDay: 900,
    })
  : undefined;
const app = createApp(createApplicationServices({ crowdProvider, routeProvider }));

app.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ event: "api_started", port }));
});
