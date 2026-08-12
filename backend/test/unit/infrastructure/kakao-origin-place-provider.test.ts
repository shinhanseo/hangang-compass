import assert from "node:assert/strict";
import test from "node:test";

import { KakaoOriginPlaceProvider } from "../../../src/infrastructure/providers/kakao/kakao-origin-place-provider.js";

test("searches Kakao places without exposing coordinates and reuses the query cache", async () => {
  let calls = 0;
  const provider = new KakaoOriginPlaceProvider({
    apiKey: "test-key",
    fetcher: async () => {
      calls += 1;
      return Response.json({ documents: [{
        id: "26338954",
        place_name: "카카오프렌즈 코엑스점",
        category_name: "가정,생활 > 디자인문구 > 카카오프렌즈",
        category_group_name: "",
        road_address_name: "서울 강남구 영동대로 513",
        address_name: "서울 강남구 삼성동 159",
        x: "127.059",
        y: "37.512",
      }] });
    },
  });

  const first = await provider.search("카카오프렌즈");
  const second = await provider.search("카카오프렌즈");
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  assert.deepEqual(first, {
    status: "ok",
    places: [{
      id: "26338954",
      name: "카카오프렌즈 코엑스점",
      address: "서울 강남구 영동대로 513",
      category: "카카오프렌즈",
    }],
  });
  assert.equal(JSON.stringify(first).includes("127.059"), false);
  assert.deepEqual(await provider.resolve({ id: "26338954", name: "카카오프렌즈 코엑스점" }), {
    id: "26338954",
    name: "카카오프렌즈 코엑스점",
    query: "카카오프렌즈 코엑스점",
    coordinate: { x: "127.059", y: "37.512" },
  });
});

test("rejects short searches and forged selections without leaking failures", async () => {
  let calls = 0;
  const provider = new KakaoOriginPlaceProvider({
    apiKey: "test-key",
    fetcher: async () => {
      calls += 1;
      return Response.json({ documents: [] });
    },
  });

  assert.deepEqual(await provider.search("강"), { status: "ok", places: [] });
  assert.equal(calls, 0);
  assert.equal(await provider.resolve({ id: "forged", name: "임의 장소" }), null);
  assert.equal(calls, 1);

  const unavailable = new KakaoOriginPlaceProvider({
    apiKey: "secret-key",
    fetcher: async () => { throw new Error("secret-key"); },
  });
  assert.deepEqual(await unavailable.search("강남역"), { status: "unavailable" });
});
