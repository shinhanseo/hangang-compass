# ADR 002: Frontend/backend 경계와 실용적 클린 아키텍처

- 상태: 승인
- 날짜: 2026-08-12

## 맥락

첫 fake 수직 슬라이스는 제품 흐름을 검증했지만 React 단일 파일과 Express 중심 저장소에 화면, HTTP, 저장, 추천 조립 책임이 섞였다. 실데이터 공급자와 영속 저장소를 추가하기 전에 소유 경계와 의존성 방향을 고정할 필요가 있다.

## 결정

저장소 최상위를 `frontend`와 `backend` npm workspace로 나눈다.

백엔드는 다음 의존성 방향을 사용한다.

```text
presentation -> application -> domain
                       ^
                       |
                infrastructure
```

- `domain`: 약속·개인정보·추천 규칙. Express, DB, 공급자 SDK를 참조하지 않는다.
- `application`: 유스케이스, 입출력 모델, repository/token/recommendation-data port.
- `infrastructure`: 메모리 저장소, Node 암호화, fake 및 이후 실제 데이터 공급자 구현.
- `presentation`: Express 라우팅, HTTP 입력 검증, 쿠키와 상태 코드.
- `composition-root`: 구현체를 port에 연결하는 유일한 조립 지점.

프론트엔드는 백엔드 계층을 그대로 흉내 내지 않고 다음의 가벼운 경계를 사용한다.

- `app`: 실행 진입점, 라우팅, 전역 스타일
- `pages`: URL 단위 화면 조립
- `features`: 여러 화면에서 의미가 있는 제품 기능 UI
- `shared`: API 계약·HTTP·공통 라이브러리

## 강제 방법

- TypeScript strict 검사를 모든 workspace에 적용한다.
- 백엔드 architecture test가 domain/application/infrastructure의 금지 import를 검사한다.
- HTTP 통합 테스트는 구조 변경 전과 동일한 create → invite → join → recommend 계약을 검증한다.
- 브라우저 검수는 사용자 화면과 결과가 바뀌지 않았음을 검증한다.

## 의도적으로 하지 않는 것

- 파일마다 클래스와 인터페이스를 만들지 않는다.
- 프론트엔드에 백엔드식 entity/repository 계층을 강제하지 않는다.
- 현재 단계에서 DB, DI 컨테이너, 라우터 라이브러리, 상태 관리 라이브러리를 추가하지 않는다.
- 구조 변경을 이유로 제품 기능이나 API 응답을 바꾸지 않는다.

## 결과

실제 DB와 외부 데이터 공급자는 application port의 새 infrastructure 구현으로 추가할 수 있다. 대신 파일 수와 조립 코드가 늘어나므로, 새 계층은 외부 경계나 독립적으로 테스트할 정책이 있을 때만 추가한다.
