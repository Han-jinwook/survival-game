# 가위바위보 하나빼기 서바이벌 게임

## 프로젝트 현황

### 마지막 업데이트
- 날짜: 2025-10-13
- v0에서 Replit으로 마이그레이션 완료
- UI/UX 완성 상태, DB 연동 대기 중

### 기술 스택
- **프레임워크**: Next.js 14.2.16 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS v4 (CSS-first configuration)
- **UI 컴포넌트**: shadcn/ui + Radix UI
- **배포**: Replit (개발), Autoscale 설정 완료
- **패키지 매니저**: pnpm

### 현재 상태

#### ✅ 완료된 작업
1. **Replit 환경 설정**
   - Next.js 포트 5000 바인딩 (0.0.0.0:5000)
   - Tailwind CSS v4 호환성 문제 해결 (autoprefixer 제거)
   - 빌드 캐시 이슈 해결
   - 워크플로우 설정 완료

2. **UI/UX 완성**
   - 홈 페이지 (이벤트 정보, 게임 규칙)
   - 인증 페이지 (네이버 ID 입력)
   - 관리자 페이지 (비밀번호 로그인)
   - 로비 페이지 (참가자 대기실)
   - 게임 페이지 (예선전)
   - 관람 페이지들 (viewer, spectate-game)
   - 결승전 페이지 (finals)
   - 결과 페이지 (result)

3. **관전 모드 시스템 (2025-10-13 완료)**
   - 결승전 관전 모드 구현 (`/finals?spectator=true`)
   - URL 파라미터 기반 참가자/관전자 분리
   - 관전자: 본인 위치 없음, 선택 불가, 2~4명 결승 참가자만 표시
   - 참가자: 본인 위치 있음 ("나" 배지), 선택 가능
   - "결승 관전 모드" UI 배지 추가 (예선 관전과 일관성)
   - 2명/3명/4명 결승 시나리오별 배치 로직 완성

4. **오디오 시스템**
   - GlobalAudioManager 구현
   - 페이지별 배경음악 설정
   - 음성 안내 시스템 (TTS) 준비

5. **임시 데이터 구조**
   - localStorage 기반 상태 관리
   - Mock 데이터 (lib/database.ts)

#### ⏳ 진행 예정 작업
1. **데이터베이스 연동** (최우선)
   - Supabase 또는 Replit PostgreSQL 선택
   - 테이블 생성 (scripts/ 폴더 SQL 파일 참조)
   - 실시간 동기화 구현
   - localStorage → DB 마이그레이션

2. **서버 기능 구현**
   - API Routes 구현 (app/api/)
   - 게임 로직 서버사이드 처리
   - WebSocket/Server-Sent Events for 실시간

3. **네이버 카페 인증**
   - 네이버 OAuth 연동 고려
   - 회원 검증 로직

### 주요 파일 구조

```
app/
├── page.tsx              # 홈 (랜딩)
├── auth/page.tsx         # 회원 인증
├── lobby/page.tsx        # 로비 (참가자 대기)
├── viewer/page.tsx       # 관람 대기실
├── game/page.tsx         # 예선전 (참가자)
├── spectate-game/page.tsx # 예선전 관전
├── finals/page.tsx       # 결승전
├── result/page.tsx       # 최종 결과
├── admin/page.tsx        # 관리자
└── api/
    ├── auth/route.ts     # 인증 API
    └── game/session/route.ts

lib/
├── database.ts           # DB 유틸리티 (현재 Mock)
├── voice.ts             # TTS 음성 시스템
└── utils.ts             # 유틸리티

scripts/
├── 01_create_tables.sql
├── 02_seed_data.sql
└── 03_create_functions.sql
```

### 환경 변수 (추후 설정 필요)
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `NEXT_PUBLIC_SUPABASE_URL` (옵션)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (옵션)
- `NAVER_CLIENT_ID` (옵션)
- `NAVER_CLIENT_SECRET` (옵션)

### 게임 규칙 요약
- 가위바위보 하나빼기 방식
- 1~10개 행운권(목숨) 시스템
- 예선전: 다수결 방식 (5명 이상)
- 결승전: 가위바위보 규칙 (4명 이하)
- 시간 내 미선택 시 즉시 탈락
- 동점 최소인 경우 모두 패배

### Replit 배포 설정
- **개발**: `pnpm run dev` (포트 5000)
- **프로덕션**: Autoscale deployment
  - Build: `pnpm run build`
  - Run: `pnpm run start`

### 알려진 이슈
- ✅ Tailwind CSS v4 호환성 → 해결됨 (autoprefixer 제거)
- ✅ 빌드 캐시 문제 → 해결됨 (.next 삭제)
- ⚠️ React peer dependency 경고 (react 18.0.0 vs ^18.2.0) - 기능에는 영향 없음

### 다음 단계
1. DB 선택 및 연동 (Supabase vs Replit PostgreSQL)
2. 실시간 게임 로직 서버 구현
3. 테스트 및 디버깅
4. 프로덕션 배포

### 참고 문서
- [GAME_RULES.md](./GAME_RULES.md) - 게임 규칙 상세
- [plan.md](./plan.md) - 개발 계획 및 Phase별 진행 상황
