import assert from "node:assert/strict";
import test from "node:test";
import { KakaoDrivingRouteProvider } from "../../../src/infrastructure/providers/kakao/kakao-driving-route-provider.js";

const origin = { id: "origin", name: "출발지", query: "출발지", coordinate: { x: "126.9", y: "37.5" } };
const destination = { id: "parking", name: "주차장", query: "주차장", coordinate: { x: "126.93", y: "37.52" } };

test("returns actual Kakao driving minutes and toll", async () => {
  const provider = new KakaoDrivingRouteProvider({ apiKey: "test-key", fetcher: async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v1/directions");
    assert.equal(url.searchParams.get("priority"), "TIME");
    return Response.json({ routes: [{ result_code: 0, summary: { duration: 1_501, fare: { toll: 2_000 } } }] });
  } });
  const result = await provider.routeFor(origin, destination);
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.route.totalMinutes, 25);
    assert.equal(result.route.tollWon, 2_000);
    assert.equal(result.route.source, "kakao_driving");
  }
});

test("maps a driving no-route response without estimating", async () => {
  const provider = new KakaoDrivingRouteProvider({ apiKey: "test-key", fetcher: async () => Response.json({ routes: [{ result_code: 104, summary: {} }] }) });
  assert.deepEqual(await provider.routeFor(origin, destination), { status: "unavailable", reason: "no_route" });
});
