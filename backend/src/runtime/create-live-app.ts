import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApplicationServices } from "../composition-root.js";
import type { MeetingRepository } from "../application/ports/meeting-repository.js";
import { SqliteMeetingRepository } from "../infrastructure/persistence/sqlite-meeting-repository.js";
import { PostgresMeetingRepository } from "../infrastructure/persistence/postgres-meeting-repository.js";
import { CachedCrowdDataProvider } from "../infrastructure/providers/cached-crowd-data-provider.js";
import { CachedTransitRouteProvider } from "../infrastructure/providers/cached-transit-route-provider.js";
import { KakaoDrivingRouteProvider } from "../infrastructure/providers/kakao/kakao-driving-route-provider.js";
import { KakaoOriginPlaceProvider } from "../infrastructure/providers/kakao/kakao-origin-place-provider.js";
import { KakaoTransitRouteProvider } from "../infrastructure/providers/kakao/kakao-transit-route-provider.js";
import { KakaoWalkingRouteProvider } from "../infrastructure/providers/kakao/kakao-walking-route-provider.js";
import { SeoulCitydataCrowdProvider } from "../infrastructure/providers/seoul/seoul-citydata-crowd-provider.js";
import { createApp } from "../presentation/http/app.js";

type RuntimeEnvironment = Record<string, string | undefined>;

export function databaseTarget(environment: RuntimeEnvironment) {
  if (environment.DATABASE_URL) return { kind: "postgres" as const, connectionString: environment.DATABASE_URL };
  if (environment.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
  const defaultPath = fileURLToPath(new URL("../../../.data/meetings.sqlite", import.meta.url));
  return { kind: "sqlite" as const, path: resolve(environment.MEETING_DATABASE_PATH ?? defaultPath) };
}

async function meetingRepository(environment: RuntimeEnvironment): Promise<MeetingRepository> {
  const target = databaseTarget(environment);
  if (target.kind === "sqlite") return new SqliteMeetingRepository(target.path);
  const repository = new PostgresMeetingRepository(target.connectionString);
  await repository.initialize();
  return repository;
}

export async function createLiveApp(environment: RuntimeEnvironment = process.env) {
  const envPath = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (!environment.VERCEL && existsSync(envPath)) process.loadEnvFile(envPath);

  const seoulApiKey = environment.SEOUL_OPEN_DATA_KEY ?? process.env.SEOUL_OPEN_DATA_KEY;
  const kakaoApiKey = environment.KAKAO_REST_API_KEY ?? process.env.KAKAO_REST_API_KEY;
  const repository = await meetingRepository({ ...process.env, ...environment });
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
  const originPlaceProvider = kakaoApiKey ? new KakaoOriginPlaceProvider({ apiKey: kakaoApiKey }) : undefined;

  return createApp(createApplicationServices({
    crowdProvider,
    routeProvider,
    drivingRouteProvider,
    walkingRouteProvider,
    originPlaceProvider,
    meetingRepository: repository,
  }));
}
