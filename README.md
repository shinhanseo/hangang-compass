# Hangang Compass

> A data-driven web app that recommends the fairest Hangang park and meeting point for your group.

한강공원 정보를 나열하는 대신, 여러 사람의 출발 위치와 약속 시점의 공공데이터를 함께 분석해 추천 공원 한 곳과 정확한 만남 지점을 결정하고 그 이유를 설명하는 서비스입니다.

## Product status

현재는 구현 전에 가장 위험한 가정을 검증하는 단계입니다.

- 제품 범위와 검수 기준 정의 완료
- 모바일 우선 반응형 웹앱으로 확정
- TypeScript + React, Node.js + Express 스택 확정
- 서울시 혼잡·날씨 데이터와 대중교통 경로 API의 공식 문서 조사 완료
- 실제 API 키를 사용한 표본 응답 및 추천 규칙 검증 예정

## MVP

- 친구들과의 한강 피크닉
- 참여자별 출발역 또는 장소 입력
- 대중교통 이동 공평성 비교
- 추천 공원 1곳과 대안 1곳
- 공원 내부의 정확한 만남 지점
- 도착 시점 혼잡·날씨·행사 근거
- 설치와 필수 회원가입 없는 링크 참여

혼잡 예측 범위 밖의 약속에는 임시 추천을 제공하고, 약속 12시간 이내에 최신 데이터를 반영합니다. 추천 장소가 달라져도 방장 승인 없이 확정 장소를 변경하지 않습니다.

## Documentation

- [Product requirements](./PRODUCT.md)
- [Acceptance criteria](./docs/ACCEPTANCE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Data source ledger](./docs/DATA_SOURCES.md)
- [Risk-first roadmap](./tasks/ROADMAP.md)
- [Data access spike](./tasks/spikes/001-data-access.md)
- [Codex working agreement](./AGENTS.md)

## Principles

- 정보 조회보다 일행의 장소 결정을 돕습니다.
- 추천 점수와 설명은 같은 테스트 가능한 근거에서 생성합니다.
- 데이터가 없거나 오래된 경우 그 사실을 숨기지 않습니다.
- 비밀키와 참여자의 정밀 위치를 브라우저 번들이나 저장소에 넣지 않습니다.
- 게임화, 소셜 피드, 과도한 로그인과 불필요한 생성형 AI는 MVP 범위에 포함하지 않습니다.

## License

No license has been selected yet. Source code and data attribution rules will be documented separately before the first public implementation release.
