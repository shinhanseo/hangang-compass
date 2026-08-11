import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">HANGANG COMPASS</p>
        <h1 id="page-title">친구들과 어디서 만날지, 이제 계산해서 정해요.</h1>
        <p className="description">
          모두의 이동시간과 약속 시점의 한강 상황을 비교해 추천 공원과 정확한 만남 지점을 정합니다.
        </p>
        <button type="button" disabled aria-describedby="prototype-note">
          피크닉 약속 만들기
        </button>
        <p id="prototype-note" className="note">현재는 제품 하네스 검증 단계입니다.</p>
      </section>
      <section className="principles" aria-label="MVP 원칙">
        <article>
          <span>01</span>
          <h2>설치 없이 참여</h2>
          <p>친구는 공유 링크에서 바로 출발역을 제출합니다.</p>
        </article>
        <article>
          <span>02</span>
          <h2>한 사람도 너무 멀지 않게</h2>
          <p>평균뿐 아니라 가장 긴 이동과 참여자 간 차이를 함께 봅니다.</p>
        </article>
        <article>
          <span>03</span>
          <h2>위치는 최소한으로</h2>
          <p>현재 위치와 정확한 주소를 요구하지 않습니다.</p>
        </article>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("root_element_missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
