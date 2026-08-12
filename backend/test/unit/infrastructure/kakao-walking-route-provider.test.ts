import assert from "node:assert/strict";
import test from "node:test";
import { KakaoWalkingRouteProvider } from "../../../src/infrastructure/providers/kakao/kakao-walking-route-provider.js";

const origin = { id: "parking", name: "주차장", query: "주차장", coordinate: { x: "126.9", y: "37.5" } };
const destination = { id: "meeting", name: "집결점", query: "집결점", coordinate: { x: "126.93", y: "37.52" } };

test("returns actual Kakao walking minutes", async () => {
  const provider = new KakaoWalkingRouteProvider({ apiKey: "test-key", fetcher: async (input) => {
    assert.equal(new URL(input).pathname, "/v2/routing/walk");
    return Response.json({ status: "OK", route: { properties: { totalTime: 421 } } });
  } });
  const result = await provider.routeFor(origin, destination);
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.route.totalMinutes, 7);
    assert.equal(result.route.walkingMinutes, 7);
  }
});

test("does not invent walking time when no route exists", async () => {
  const provider = new KakaoWalkingRouteProvider({ apiKey: "test-key", fetcher: async () => Response.json({ status: "NO_RESULTS" }) });
  assert.deepEqual(await provider.routeFor(origin, destination), { status: "unavailable", reason: "no_route" });
});
