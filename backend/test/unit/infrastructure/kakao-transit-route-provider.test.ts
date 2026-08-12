import assert from "node:assert/strict";
import test from "node:test";
import { KakaoTransitRouteProvider } from "../../../src/infrastructure/providers/kakao/kakao-transit-route-provider.js";

const origin = { id: "hongdae", name: "홍대입구역", query: "홍대입구역" };
const destination = {
  id: "yeouido",
  name: "여의도안내센터",
  query: "여의도한강공원 여의도안내센터",
  officialAddress: "서울 영등포구 여의동로 330",
};

test("resolves public places and returns the fastest transit route", async () => {
  const paths: string[] = [];
  const provider = new KakaoTransitRouteProvider({
    apiKey: "test-key",
    fetcher: async (input) => {
      const url = new URL(input);
      paths.push(url.pathname);
      if (url.pathname.includes("keyword")) {
        const query = url.searchParams.get("query")!;
        return Response.json({ documents: [{
          place_name: query === "홍대입구역" ? "홍대입구역 2호선" : "여의도안내센터",
          road_address_name: query === "홍대입구역" ? "" : "서울 영등포구 여의동로 330",
          address_name: "",
          x: query === "홍대입구역" ? "126.9" : "126.93",
          y: "37.5",
        }] });
      }
      return Response.json({
        status: "OK",
        routes: [
          { properties: { totalTime: 2400, transfers: 2, fare: { value: 1500 } }, steps: [] },
          { properties: { totalTime: 1200, transfers: 1, fare: { value: 1400 } }, steps: [
            { properties: { type: "WALKING", time: 180 } },
          ] },
        ],
      });
    },
  });
  const result = await provider.routeFor(origin, destination);
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.route.totalMinutes, 20);
    assert.equal(result.route.transfers, 1);
    assert.equal(result.route.walkingMinutes, 3);
  }
  await provider.routeFor(origin, destination);
  assert.equal(paths.filter((path) => path.includes("keyword")).length, 2);
  assert.equal(paths.filter((path) => path.includes("publictraffic")).length, 2);
});

test("maps no-route and network failures without exposing request details", async () => {
  const noRoute = new KakaoTransitRouteProvider({
    apiKey: "secret-test-key",
    fetcher: async (input) => new URL(input).pathname.includes("keyword")
      ? Response.json({ documents: [{ place_name: "홍대입구역 여의도안내센터", x: "1", y: "2", road_address_name: "서울 영등포구 여의동로 330" }] })
      : Response.json({ status: "NO_RESULTS" }),
  });
  assert.deepEqual(await noRoute.routeFor(origin, destination), { status: "unavailable", reason: "no_route" });

  const failed = new KakaoTransitRouteProvider({
    apiKey: "secret-test-key",
    fetcher: async () => { throw new Error("URL with secret-test-key"); },
  });
  assert.deepEqual(await failed.routeFor(origin, destination), { status: "unavailable", reason: "network_error" });
});

test("does not permanently cache an unresolved coordinate", async () => {
  let originSearches = 0;
  const provider = new KakaoTransitRouteProvider({
    apiKey: "test-key",
    fetcher: async (input) => {
      const url = new URL(input);
      if (url.pathname.includes("keyword")) {
        const isOrigin = url.searchParams.get("query") === origin.query;
        if (isOrigin) originSearches += 1;
        if (isOrigin && originSearches === 1) return Response.json({ documents: [] });
        return Response.json({ documents: [{
          place_name: isOrigin ? origin.name : destination.name,
          road_address_name: isOrigin ? "" : destination.officialAddress,
          x: isOrigin ? "126.9" : "126.93",
          y: "37.5",
        }] });
      }
      return Response.json({ status: "OK", routes: [{ properties: { totalTime: 1200 }, steps: [] }] });
    },
  });

  assert.deepEqual(await provider.routeFor(origin, destination), {
    status: "unavailable", reason: "origin_unresolved",
  });
  assert.equal((await provider.routeFor(origin, destination)).status, "available");
  assert.equal(originSearches, 2);
});
