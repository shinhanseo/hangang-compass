# ADR 001 — 애플리케이션 하네스

상태: 채택 (`ADR 002`가 workspace 내부 구조를 구체화함)

결정일: 2026-08-12

## 결정

- 저장소: npm workspaces
- 웹: React + TypeScript + Vite
- API: Express + TypeScript
- 개발 실행: `tsx`
- 정적 검증: TypeScript strict mode
- 초기 단위/API 테스트: Node.js 내장 test runner

Vite 공식 문서가 요구하는 Node 20.19+ 또는 22.12+에 맞춰 저장소 하한을 Node 22.12로 둔다. npm은 현재 로컬 Node 설치에 포함돼 별도 패키지 관리 도구를 추가하지 않으며, workspaces로 웹·API 명령을 루트에서 통합한다.

## 이유

- 사용자가 선택한 React·Node/Express 스택을 그대로 사용한다.
- Vite는 React TypeScript 템플릿과 빠른 개발 서버·프로덕션 빌드를 제공한다.
- npm workspaces는 추가 모노레포 도구 없이 두 앱을 연결한다.
- Node test runner는 기존 도메인 테스트와 같은 실행 방식을 유지해 초기 의존성을 줄인다.
- TypeScript strict 검사를 추가해 기존 Node 실행 검증만으로 잡지 못한 타입 오류를 차단한다.

## 보류

- 데이터베이스, ORM, 인증, 배포·호스팅
- React 라우터와 서버 상태 라이브러리
- 브라우저 컴포넌트/E2E 테스트 도구
- 포매터와 린터

이 도구들은 첫 수직 슬라이스에 실제 필요해질 때 유지보수 상태·라이선스·크기·대안을 확인한 뒤 추가한다.

## 공식 근거

- Vite 시작 및 Node 요구사항: <https://vite.dev/guide/>
- npm workspaces: <https://docs.npmjs.com/cli/v11/using-npm/workspaces/>
- Express 설치: <https://expressjs.com/en/starter/installing.html>
- TypeScript 프로젝트 경계: <https://www.typescriptlang.org/docs/handbook/project-references>
