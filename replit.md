# 가위바위보 하나빼기 서바이벌 게임

## 프로젝트 현황

### 마지막 업데이트
- 날짜: 2025-10-14
- **로비 입장 시스템 구현 완료** ✅
- **AI 테스트 모드 구현 완료** ✅
- PostgreSQL DB 연동 완료 ✅

### 기술 스택
- **프레임워크**: Next.js 14.2.16 (App Router)
- **언어**: TypeScript
- **데이터베이스**: Replit PostgreSQL (Neon-backed)
- **DB 라이브러리**: pg (node-postgres)
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

5. **데이터베이스 연동 완료 (2025-10-13)** ✅
   - Replit PostgreSQL 데이터베이스 생성
   - 5개 핵심 테이블 설계 및 생성 (users, game_sessions, game_participants, game_rounds, player_choices)
   - 6개 필수 인덱스 생성 (성능 최적화)
   - PostgreSQL LISTEN/NOTIFY 실시간 동기화 시스템 구축
   - lib/database.ts: Mock → 실제 PostgreSQL 연결 (pg 라이브러리)
   - Connection Pool 기반 안전한 DB 연결 관리
   - CRUD 함수 11개 구현 (에러 처리 완료)

6. **서버 API 구현 완료 (2025-10-13)** ✅
   - **6개 핵심 API Routes** 구현 및 Architect 승인
   - `/api/auth`: 네이버 ID 기반 인증 (신규 사용자 자동 생성)
   - `/api/game/settings`: 게임 설정 + 세션 생성 (중복 방지)
   - `/api/game/session`: 세션 관리 (join/start/update/complete)
   - `/api/game/round`: 라운드 진행 (create/update + 선택 집계)
   - `/api/game/choice`: 플레이어 선택 저장/조회 (UPSERT)
   - `/api/game/state`: 실시간 상태 조회 (세션+참가자+라운드+선택)
   - TypeScript 타입 안전성 ✅ | LSP 에러 없음 ✅ | 에러 처리 완료 ✅

#### ⏳ 진행 예정 작업
1. **프론트엔드 API 연동** (진행 중)
   - ✅ 로비 입장 시스템 완료 (자동 상태 변경: waiting → playing)
   - ✅ AI 테스트 모드 구현 (관리자 페이지 "AI 자동 입장" 버튼)
   - ⏳ 게임 진행 페이지 API 연동 (다음 단계)
   - ⏳ 실시간 데이터 동기화 (폴링/SSE)
   - ⏳ 에러 핸들링 및 로딩 상태 처리

2. **게임 로직 서버사이드 처리**
   - 라운드 진행 자동화
   - 승패 판정 로직
   - 탈락자 처리

3. **네이버 카페 인증 고도화**
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
    ├── auth/route.ts           # 네이버 ID 인증
    └── game/
        ├── settings/route.ts   # 게임 설정
        ├── session/route.ts    # 세션 관리
        ├── round/route.ts      # 라운드 진행
        ├── choice/route.ts     # 플레이어 선택
        └── state/route.ts      # 실시간 상태

lib/
├── database.ts           # PostgreSQL DB 연결 및 CRUD (pg 라이브러리)
├── voice.ts             # TTS 음성 시스템
└── utils.ts             # 유틸리티

scripts/
├── 01_create_tables.sql
├── 02_seed_data.sql
└── 03_create_functions.sql
```

### 환경 변수
✅ **설정 완료**:
- `DATABASE_URL`: PostgreSQL 연결 문자열 (Replit 자동 설정)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (Replit 자동 설정)

⏳ **추후 설정 필요**:
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

### 데이터베이스 스키마
**5개 핵심 테이블** (최소 필수 설계):
1. **users** - 네이버 카페 회원 (naver_id, nickname)
2. **game_sessions** - 게임 세션 (session_name, status, initial_lives)
3. **game_participants** - 참가자 (user_id, current_lives, status)
4. **game_rounds** - 라운드 진행 (round_number, phase, survivors_count, 선택 집계)
5. **player_choices** - 플레이어 선택 (selected_choices[], final_choice)

**실시간 동기화**: PostgreSQL LISTEN/NOTIFY 트리거 (4개 테이블)

### 로비 입장 + 게임 시작 시스템 (2025-10-14 완료) ✅
**1단계: 프로덕션 환경 (실제 사용자)**
- 참가자가 로비 페이지 접속 → 자동으로 `waiting` → `playing` 상태 변경
- 로비에는 `playing` 상태인 참가자만 표시 (실제 입장자)
- `/api/game/session` POST 요청 (`enter_lobby` 액션)
- **"테스트 시작" 버튼** (로비 페이지): 실제 참가자가 수동으로 게임 시작

**2단계: AI 테스트 모드** 🤖
- **관리자 페이지** → "🤖 AI 테스트 모드" 섹션
- **"AI 자동 입장" 버튼**: 모든 `waiting` 참가자를 자동으로 로비에 입장 + 게임 시작
- v0 스타일 테스트: AI가 다른 플레이어 역할 수행하여 혼자 테스트 가능

**게임 시작 조건 (양쪽 모두 동일)** ✅
- ❌ **1명**: 게임 시작 불가 (에러 메시지: "최소 2명 이상이어야 게임을 시작할 수 있습니다")
- ✅ **2~4명**: 예선 패스 → **본선(/finals)** 직행
- ✅ **5명 이상**: **예선(/game)** 진행

### 다음 단계
1. ✅ ~~DB 연동 완료~~ (Replit PostgreSQL)
2. ✅ ~~API Routes 구현~~ (app/api/)
3. ✅ ~~로비 입장 시스템 완료~~ (2025-10-14)
4. **게임 진행 페이지 API 연동** (다음 단계)
   - 게임 진행: `/api/game/round`, `/api/game/choice` 호출
   - AI 자동 선택 로직 (게임 진행 테스트용)
5. 실시간 게임 로직 서버 구현
6. 테스트 및 디버깅
7. 프로덕션 배포

### 참고 문서
- [GAME_RULES.md](./GAME_RULES.md) - 게임 규칙 상세
- [plan.md](./plan.md) - 개발 계획 및 Phase별 진행 상황
