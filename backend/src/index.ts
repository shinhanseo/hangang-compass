import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApplicationServices } from "./composition-root.js";
import { CachedCrowdDataProvider } from "./infrastructure/providers/cached-crowd-data-provider.js";
import { CachedTransitRouteProvider } from "./infrastructure/providers/cached-transit-route-provider.js";
import { KakaoTransitRouteProvider } from "./infrastructure/providers/kakao/kakao-transit-route-provider.js";
import { KakaoOriginPlaceProvider } from "./infrastructure/providers/kakao/kakao-origin-place-provider.js";
import { KakaoDrivingRouteProvider } from "./infrastructure/providers/kakao/kakao-driving-route-provider.js";
import { KakaoWalkingRouteProvider } from "./infrastructure/providers/kakao/kakao-walking-route-provider.js";
import { SeoulCitydataCrowdProvider } from "./infrastructure/providers/seoul/seoul-citydata-crowd-provider.js";
import { createApp } from "./presentation/http/app.js";
import { SqliteMeetingRepository } from "./infrastructure/persistence/sqlite-meeting-repository.js";
import { PostgresMeetingRepository } from "./infrastructure/persistence/postgres-meeting-repository.js";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const port = Number(process.env.PORT ?? 3000);
const seoulApiKey = process.env.SEOUL_OPEN_DATA_KEY;
const kakaoApiKey = process.env.KAKAO_REST_API_KEY;
const defaultDatabasePath = fileURLToPath(new URL("../../.data/meetings.sqlite", import.meta.url));
const meetingRepository = process.env.DATABASE_URL
  ? new PostgresMeetingRepository(process.env.DATABASE_URL)
  : new SqliteMeetingRepository(resolve(process.env.MEETING_DATABASE_PATH ?? defaultDatabasePath));
if (meetingRepository instanceof PostgresMeetingRepository) await meetingRepository.initialize();
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
const drivingRouteProvider = kakaoApiKey
  ? new CachedTransitRouteProvider(new KakaoDrivingRouteProvider({ apiKey: kakaoApiKey }), {
      ttlMs: 2 * 60 * 60_000,
      maxRequestsPerDay: 9_000,
    })
  : undefined;
const walkingRouteProvider = kakaoApiKey
  ? new CachedTransitRouteProvider(new KakaoWalkingRouteProvider({ apiKey: kakaoApiKey }), {
      ttlMs: 2 * 60 * 60_000,
      maxRequestsPerDay: 900,
    })
  : undefined;
const originPlaceProvider = kakaoApiKey
  ? new KakaoOriginPlaceProvider({ apiKey: kakaoApiKey })
  : undefined;
const app = createApp(createApplicationServices({
  crowdProvider,
  routeProvider,
  drivingRouteProvider,
  walkingRouteProvider,
  originPlaceProvider,
  meetingRepository,
}));

app.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ event: "api_started", port }));
});
