# Vercel 배포

프론트엔드와 Express API는 하나의 Vercel 프로젝트에 배포하고, 약속 데이터는 Supabase PostgreSQL에 저장한다. GitHub `main` 푸시는 운영 배포, 다른 브랜치 푸시는 Preview 배포를 만든다.

## 최초 연결

1. Vercel에서 **Add New → Project**를 누르고 GitHub의 `shinhanseo/hangang-compass`를 가져온다.
2. Root Directory는 저장소 루트인 `./`로 둔다. `vercel.json`이 Vite 빌드 결과와 `/api` Express Function 라우팅을 지정한다.
3. 다음 Environment Variables를 Production과 Preview에 등록한다.

| 이름 | 범위 | 값 |
|---|---|---|
| `DATABASE_URL` | 서버 전용 | Supabase **Transaction pooler** 연결 문자열 |
| `KAKAO_REST_API_KEY` | 서버 전용 | 카카오 REST API 키 |
| `SEOUL_OPEN_DATA_KEY` | 서버 전용 | 서울 열린데이터광장 키 |
| `VITE_KAKAO_JAVASCRIPT_KEY` | 브라우저 공개키 | 카카오 JavaScript 키 |

`.env` 파일을 업로드하거나 커밋하지 않는다. Vercel이 자동으로 제공하는 `VERCEL` 환경에서는 `DATABASE_URL`이 없으면 기동을 거부하며 임시 SQLite로 대체하지 않는다.

## 최초 배포 후

1. `https://<project>.vercel.app`에서 `/api/health`가 `200`과 `status: ok`를 반환하는지 확인한다.
2. 홈에서 약속을 만들고, 카카오 개발자 콘솔의 JavaScript SDK 도메인에 정확한 운영 origin인 `https://<project>.vercel.app`을 추가한다.
3. 카카오톡 나와의 채팅으로 초대한 뒤 카카오 인앱 브라우저에서 장소 제출·새로고침·추천 복원을 확인한다.
4. 이후 `main` 푸시마다 같은 운영 주소가 자동 갱신된다. Preview URL은 도메인이 달라 카카오 공유 검수 전에 해당 고정 Preview 도메인을 별도로 등록해야 한다.

## 운영 제한

- Vercel Function 인스턴스는 늘어나거나 교체될 수 있다. 현재 2시간 경로 캐시와 일일 호출 방어선은 인스턴스 메모리 기준이므로 전체 배포 단위의 정확한 호출 한도를 보장하지 않는다.
- 무료 공개 파일럿 동안 공급자 대시보드 사용량을 함께 확인한다. 공개 규모 확대 전 공유 저장소 기반 호출 계수나 공급자 사용량 알림을 추가한다.
- Supabase 무료 프로젝트의 저활동 일시 정지와 자동 백업 부재는 그대로 남는다.
- 배포 오류 로그에 API 키, 초대 토큰, 장소 원문을 기록하지 않는다.

## 롤백

Vercel Deployments에서 이전 성공 배포를 선택해 Promote/Rollback한다. DB 스키마는 현재 추가형 멱등 생성만 사용하므로 애플리케이션 롤백 시 파괴적 마이그레이션이 발생하지 않는다.
