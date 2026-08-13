import assert from "node:assert/strict";
import test from "node:test";

import { kakaoMapSearchUrl } from "../src/shared/lib/kakao-map-search.ts";

test("builds an encoded Kakao Map search without calling a place API", () => {
  assert.equal(
    kakaoMapSearchUrl("여의도한강공원", "cafe"),
    "https://map.kakao.com/link/search/%EC%97%AC%EC%9D%98%EB%8F%84%ED%95%9C%EA%B0%95%EA%B3%B5%EC%9B%90%20%EC%B9%B4%ED%8E%98",
  );
});
