import assert from "node:assert/strict";
import test from "node:test";

import { KakaoNearbyPlaceProvider } from "../../../src/infrastructure/providers/kakao/kakao-nearby-place-provider.js";

function kakaoPlace(id: string, name: string, category: string, distance: string) {
  return {
    id,
    place_name: name,
    category_name: `관광명소 > ${category}`,
    road_address_name: "서울 영등포구 테스트로 1",
    address_name: "서울 영등포구 테스트동",
    distance,
    place_url: `http://place.map.kakao.com/${id}`,
    phone: "02-000-0000",
    x: "126.9",
    y: "37.5",
  };
}

test("returns nearby Kakao places without private coordinates and reuses the park cache", async () => {
  let calls = 0;
  const provider = new KakaoNearbyPlaceProvider({
    apiKey: "test-key",
    fetcher: async (input) => {
      calls += 1;
      const url = new URL(String(input));
      if (url.pathname.endsWith("/keyword.json")) {
        return Response.json({ documents: [{ place_name: "여의도안내센터", x: "126.9", y: "37.5" }] });
      }
      const code = url.searchParams.get("category_group_code");
      assert.equal(url.searchParams.get("sort"), "distance");
      assert.equal(url.searchParams.get("x"), "126.9");
      const documents = code === "AT4"
        ? [kakaoPlace("101", "생태숲", "숲", "120"), kakaoPlace("102", "두번째숲", "숲", "180"), kakaoPlace("103", "전망대", "전망대", "240")]
        : [kakaoPlace(code === "FD6" ? "201" : code === "CE7" ? "301" : "401", `${code} 장소`, "장소", "310")];
      return Response.json({ documents });
    },
  });

  const first = await provider.placesNear("yeouido");
  const second = await provider.placesNear("yeouido");
  assert.deepEqual(first, second);
  assert.equal(calls, 5);
  assert.equal(first.status, "available");
  if (first.status !== "available") return;
  assert.deepEqual(first.sections.find((section) => section.kind === "spot")?.places.map((place) => place.name), ["생태숲", "전망대"]);
  assert.equal(first.sections.find((section) => section.kind === "food")?.places[0]?.kakaoMapUrl, "https://place.map.kakao.com/201");
  assert.equal(JSON.stringify(first).includes("126.9"), false);
  assert.equal(JSON.stringify(first).includes("02-000-0000"), false);
});

test("keeps successful categories when one Kakao category fails", async () => {
  const provider = new KakaoNearbyPlaceProvider({
    apiKey: "test-key",
    fetcher: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/keyword.json")) return Response.json({ documents: [{ place_name: "반포안내센터", x: "127", y: "37" }] });
      if (url.searchParams.get("category_group_code") === "CE7") return Response.json({ error: "quota" }, { status: 429 });
      return Response.json({ documents: [kakaoPlace("501", "가까운 장소", "명소", "90")] });
    },
  });

  const result = await provider.placesNear("banpo");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.sections.find((section) => section.kind === "cafe")?.status, "unavailable");
  assert.equal(result.sections.find((section) => section.kind === "food")?.places[0]?.name, "가까운 장소");
});

test("reports unavailable for an unknown park or unresolved meeting point", async () => {
  const unknown = new KakaoNearbyPlaceProvider({ apiKey: "test-key", fetcher: async () => Response.json({ documents: [] }) });
  assert.deepEqual(await unknown.placesNear("not-a-park"), { status: "unavailable" });
  assert.deepEqual(await unknown.placesNear("nanji"), { status: "unavailable" });
});
