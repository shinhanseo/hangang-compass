# Hangang Compass

> A data-driven web app that recommends the fairest Hangang park and meeting point for your group.

한강공원 정보를 나열하는 대신, 여러 사람의 출발 위치와 약속 시점의 공공데이터를 함께 분석해 추천 공원 한 곳과 정확한 만남 지점을 결정하고 그 이유를 설명하는 서비스입니다.

## Product status

현재는 위험한 가정을 검증하면서 첫 클릭 가능한 핵심 여정을 만든 단계입니다.

- 제품 범위와 검수 기준 정의 완료
- 모바일 우선 반응형 웹앱으로 확정
- TypeScript + React, Node.js + Express 스택 확정
- 서울시 혼잡·날씨 데이터와 대중교통 경로 API의 공식 문서 조사 완료
- 서울시·카카오 실제 API 키를 사용한 1차 표본 접근 검증 완료
- 한강공원 11곳의 단일 시점 필드 품질 검증 완료
- 11개 임시 만남 지점과 3×3 대중교통 경로 표본 검증 완료
- 11개 후보·9개 경계 사례로 추천 규칙 프로토타입 검증 완료
- 균형 중심 공평성 방향 승인, 대표 5조합×11개 공원 실경로 검증 완료
- 최소 위치 입력·자동 삭제·공유 링크 권한 정책 확정
- TypeScript/React/Express 애플리케이션 하네스와 CI 구성 완료
- fake 데이터 기반 약속 생성 → 친구 링크 참여 → 추천·대안 표시 수직 슬라이스 완료
- 실제 사용자 약속 사례 비교와 실데이터 통합 예정

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
- [Clean architecture decision](./docs/adr/002-clean-architecture-boundaries.md)
- [Data source ledger](./docs/DATA_SOURCES.md)
- [Meeting point catalog](./docs/MEETING_POINTS.md)
- [Experimental recommendation rules](./docs/RECOMMENDATION_RULES.md)
- [Privacy and sharing-link threat model](./docs/PRIVACY_THREAT_MODEL.md)
- [Privacy notice draft](./docs/PRIVACY_NOTICE_DRAFT.md)
- [AI-assisted development](./docs/AI_DEVELOPMENT.md)
- [Clickable fake journey](./docs/DEMO.md)
- [Risk-first roadmap](./tasks/ROADMAP.md)
- [Data access spike](./tasks/spikes/001-data-access.md)
- [Recommendation spike](./tasks/spikes/002-recommendation.md)
- [Codex working agreement](./AGENTS.md)

## Development approach

Hangang Compass는 OpenAI Codex를 활용한 하네스 기반 AI 보조 개발 프로젝트입니다. 저장소 소유자가 제품 방향과 중요한 결정을 검수하고, Codex가 구현·테스트·문서화·반복 수정을 담당합니다.

AI가 생성한 결과도 자동 테스트와 시나리오 기반 인수 기준을 통과해야 하며, 추천 결과는 생성형 AI의 판단이 아닌 재현 가능한 규칙과 실제 데이터 근거로 결정됩니다. 자세한 역할과 검증 원칙은 [AI-assisted development](./docs/AI_DEVELOPMENT.md)에 기록합니다.

## Local harness

Node.js 22.12 이상과 npm을 사용합니다.

```bash
npm install
npm run check
npm run dev:web
npm run dev:api
```

`npm run check`는 TypeScript strict 검사, 도메인·API 테스트, 웹·API 프로덕션 빌드를 순서대로 실행합니다. 로컬 비밀값은 루트 `.env`에만 두며 웹 앱으로 전달하지 않습니다. 현재 클릭 가능한 fake 여정은 [demo guide](./docs/DEMO.md)에서 확인할 수 있습니다.

## Repository structure

```text
frontend/src/
  app/          앱 진입점과 전역 설정
  pages/        URL 단위 화면
  features/     추천 등 제품 기능 UI
  shared/       API 계약과 공통 라이브러리

backend/src/
  domain/         순수 제품 규칙
  application/    유스케이스와 port
  infrastructure/ 저장소·암호화·외부 데이터 구현
  presentation/   Express HTTP 경계
```

백엔드 계층의 금지 의존성은 architecture test로 검사합니다.

## Principles

- 정보 조회보다 일행의 장소 결정을 돕습니다.
- 추천 점수와 설명은 같은 테스트 가능한 근거에서 생성합니다.
- 데이터가 없거나 오래된 경우 그 사실을 숨기지 않습니다.
- 비밀키와 참여자의 정밀 위치를 브라우저 번들이나 저장소에 넣지 않습니다.
- 게임화, 소셜 피드, 과도한 로그인과 불필요한 생성형 AI는 MVP 범위에 포함하지 않습니다.

## License

No license has been selected yet. Source code and data attribution rules will be documented separately before the first public implementation release.
