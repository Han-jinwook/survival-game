# 가위바위보 하나빼기 서바이벌 게임 - 개발 계획

## 📋 프로젝트 개요
네이버 카페 멤버를 위한 1회성 이벤트 게임  
멀티플레이어 실시간 가위바위보 하나빼기 서바이벌 게임

**게임 규칙**: `GAME_RULES.md` 파일 참조

## 🛠️ 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS v4
- **데이터베이스**: Supabase (PostgreSQL)
- **실시간 통신**: Supabase Realtime
- **UI 컴포넌트**: shadcn/ui
- **배포**: Netlify
- **상태 관리**: React Hooks

## 🗄️ 데이터베이스 구조

### 핵심 테이블
1. **users** - 사용자 정보 (게임 참가 정보 통합)
   - `id` (UUID), `naver_id`, `session_id`, `nickname`
   - `initial_lives`, `current_lives`, `status`
   - `joined_at`, `eliminated_at`, `last_active_at`
   - **복합 유니크 키**: `(naver_id, session_id)`

2. **game_sessions** - 게임 세션
   - `id` (Serial), `session_name`, `cafe_name`, `prize`
   - `status` (waiting/starting/in_progress/completed/closed)
   - `initial_lives`, `winner_id`
   - `started_at`, `ended_at`, `created_at`

3. **game_rounds** - 게임 라운드 (라운드 중심 아키텍처)
   - `id` (UUID), `game_session_id`, `round_number`
   - `phase` (waiting/selection/final_selection/selectTwo/excludeOne/revealing)
   - `survivors_count`, `rock_count`, `paper_count`, `scissors_count`
   - `losing_choice`, `started_at`, `ended_at`

4. **player_choices** - 플레이어 선택
   - `id` (UUID), `round_id`, `user_id`
   - `selected_choices` (TEXT[]), `final_choice`
   - `chosen_at`

### DB 함수
- `process_round_results()` - 라운드 결과 계산 및 목숨 차감 (트랜잭션)

## 주요 기능

### 1. 게임 흐름 관리
- 게임 상태 관리 (대기, 예선전, 결승전)
- 라운드 진행 및 타이머 관리
- 자동 페이즈 전환

### 2. 플레이어 관리
- 닉네임 입력 및 참가
- 목숨 관리
- 탈락 처리

### 3. 선택 시스템
- 2개 선택 단계 (선택 취소 가능)
- 하나빼기 단계 (선택 취소 불가)
- 시간 제한 처리

### 4. 승부 판정
- 예선전: 다수결 방식
- 결승전: 가위바위보 규칙
- 무승부 처리 및 재시작

### 5. UI/UX
- 실시간 타이머 표시
- 플레이어 목록 및 상태
- 선택 버튼 인터랙션
- 결과 애니메이션

### 6. 관람 모드 시스템
#### 페이지 구조
- `/viewer` - 관람 대기실 (게임 시작 전 대기)
- `/spectate-game` - 예선전 관전 (외부 관람자용)
- `/game` - 예선전 (참가자용)
- `/finals` - 결승전 (참가자 + 관람자 통합)

#### 관람 모드 흐름
1. **외부 관람자**: `/viewer` → 게임 시작 시 `/spectate-game` → 결승 명단 → `/finals?spectator=true`
2. **예선 탈락자**: 예선 진행 → 탈락 → 결승 명단 → `/finals?spectator=true` (자동 전환)
3. **결승 참가자**: 예선 진행 → 결승 명단 → `/finals` (참가자 모드)

#### 결승전 통합 화면 (`/finals`)
- **참가자 모드** (`spectator=false` 또는 파라미터 없음):
  - 자기 포지션 있음
  - 선택 가능
  - 탈락 시 💀 표시되고 자리 유지, 관람 전환
  
- **관람 모드** (`spectator=true`):
  - 자기 포지션 없음
  - 결승 참가자들의 게임만 관람
  - 선택 불가
  - 예선 탈락자와 외부 관람자 모두 동일한 화면

#### 구현 상태
- ✅ `/viewer` - 관람 대기실 완성
- ✅ `/spectate-game` - 예선 관전 페이지 완성 (UI만, DB 연동 대기)
- ⏳ `/finals` - spectator 파라미터 처리 추가 필요
- ⏳ 예선 탈락자 자동 전환 로직 추가 필요
- ⏳ DB 실시간 연동 (서버 구축 후)

## 📁 파일 구조

### 페이지
- `app/page.tsx` - 홈 페이지 (네이버 인증)
- `app/auth/page.tsx` - OAuth 콜백
- `app/lobby/page.tsx` - 로비 (참가자 대기실)
- `app/game/page.tsx` - 게임 화면 (예선/결승 통합)
- `app/finals/page.tsx` - 결승전
- `app/admin/page.tsx` - 관리자 페이지 (운영자 전용)

### 주요 API
- `app/api/auth/*` - 네이버 OAuth 인증
- `app/api/game/session/*` - 게임 세션 관리 (입장/퇴장/시작)
- `app/api/game/choice/*` - 플레이어 선택 저장
- `app/api/game/state/*` - 게임 상태 조회
- `app/api/game/settings/*` - 게임 설정 (관리자)
- `app/api/participants/*` - 참가자 관리

### 라이브러리
- `lib/database.ts` - DatabaseService (Supabase 클라이언트)
- `lib/supabaseClient.ts` - Supabase 연결 설정
- `lib/types.ts` - TypeScript 타입 정의
- `lib/auth.ts` - 네이버 OAuth 인증
- `lib/voice.ts` - TTS 음성 시스템

### DB 마이그레이션 스크립트
- `scripts/01_create_tables.sql` - 테이블 생성
- `scripts/02_seed_data.sql` - 초기 데이터
- `scripts/03_create_functions.sql` - DB 함수 생성
- `scripts/04_migration_consolidate_users.sql` - Users 통합 마이그레이션
- `scripts/05_remove_current_round.sql` - 라운드 중심 아키텍처 전환

## 🎯 개발 우선순위

### Phase 1: 기본 구조 ✅
- ✅ 데이터베이스 설계 및 구축
- ✅ 기본 UI 레이아웃
- ✅ 네이버 OAuth 인증
- ✅ 플레이어 참가 시스템

### Phase 2: 게임 로직 ✅
- ✅ 선택 시스템 구현
- ✅ 타이머 및 페이즈 전환
- ✅ 승부 판정 로직 (서버)
- ✅ 목숨 차감 및 탈락 처리

### Phase 3: 실시간 동기화 ✅
- ✅ Supabase Realtime 연동
- ✅ 플레이어 상태 동기화
- ✅ 게임 상태 동기화
- ✅ 로비 입장/퇴장 실시간 반영

### Phase 4: 결승전 시스템 ✅
- ✅ 결승전 UI
- ✅ 2단계 선택 시스템 (2개 선택 → 하나 빼기)
- ✅ 비주얼 선택 표시

### Phase 5: 아키텍처 개선 ✅
- ✅ `game_participants` → `users` 통합 (2025-10-18)
- ✅ 라운드 중심 아키텍처 (`current_round` 제거, 2025-10-19)
- ✅ DB 마이그레이션 스키마 정합성 확보

### Phase 6: 프로덕션 배포 ✅
- ✅ Netlify 배포
- ✅ Supabase 프로덕션 환경 설정
- ✅ 환경 변수 설정
- ✅ 실제 게임 운영 준비 완료

---

## 🏗️ 아키텍처 설계 원칙

### 1. 라운드 중심 아키텍처
- **단일 진실 공급원(SSOT)**: `game_rounds` 테이블이 라운드 정보 관리
- **`getCurrentRound(sessionId)`**: 세션의 현재 라운드 조회
- **장점**: 데이터 정합성, 쿼리 성능 향상

### 2. 단일 테이블 구조
- **Users 통합**: `game_participants` 제거, `users`에 게임 정보 통합
- **복합 키**: `(naver_id, session_id)` - 다중 세션 참여 지원
- **장점**: 조인 불필요, 1회성 이벤트 게임에 최적화

### 3. 서버 중심 게임 로직
- **클라이언트**: UI 렌더링만 담당
- **서버**: 모든 게임 로직 및 검증 처리
- **DB 함수**: `process_round_results()` 트랜잭션으로 결과 처리

---

## 📝 주요 해결 과제

### ✅ 해결된 문제

#### 1. DB 스키마 불일치 (2025-10-18~19)
- **문제**: `game_participants` 이중 테이블 구조, 같은 ID 다중 세션 참여 불가
- **해결**: `users` 테이블로 통합, `(naver_id, session_id)` 복합 키 사용

#### 2. 라운드 관리 복잡도 (2025-10-19)
- **문제**: `game_sessions.current_round`와 `game_rounds` 중복 관리
- **해결**: `current_round` 제거, `game_rounds`로 단일화

#### 3. 실시간 동기화 (2025-10-17)
- **문제**: 로비 대기자 수 불일치, 캐시 문제
- **해결**: `force-dynamic` 설정, Supabase Realtime 필터 추가

### 🔄 진행 중

#### 관람 모드 시스템
- `/finals` spectator 파라미터 처리
- 예선 탈락자 자동 전환 로직

---

## 🚀 배포 환경

### Netlify
- **빌드 명령**: `npm run build`
- **출력 디렉토리**: `.next`
- **환경 변수**: Supabase URL, Anon Key, Service Role Key, 네이버 OAuth

### Supabase
- **Realtime 활성화**: `users`, `game_sessions`, `game_rounds`
- **RLS 정책**: 공개 읽기, 서버 쓰기
- **DB 함수**: `process_round_results()`

---

## 🐛 과거 주요 이슈 (참고용)

### 1. DB LISTEN 연결 끊김 문제 ⚠️
**증상:**
- 에러 메시지: "terminating connection due to administrator command"
- PostgreSQL LISTEN 클라이언트가 예기치 않게 종료됨
- SSE 연결이 끊어져 실시간 동기화 실패

**해결:** Supabase Realtime으로 전환하여 안정성 확보

---

## 📌 최근 완료 작업 (2025-10-19)

### 1. 라운드 중심 아키텍처 전환 ✅
- **DB 마이그레이션**: `game_sessions.current_round` 컬럼 제거
- **코드 수정**: 모든 `current_round` 참조를 `getCurrentRound()` 사용으로 변경
- **장점**: 데이터 정합성, 단일 진실 공급원(SSOT) 확보

### 2. DB 마이그레이션 스키마 반영 ✅
- **`participant_id` → `user_id`**: 마이그레이션 04번 반영
- **`checkAllPlayersReady()` 메서드 추가**: 자동 페이즈 전환 지원
- **`savePlayerChoice()` upsert 조건 수정**: 스키마 정합성 확보

### 3. UI 하드코딩 제거 ✅
- **`gameRound` 초기값**: `round: 1` → `round: 0`
- **DB 데이터 기반**: 모든 라운드 정보를 DB에서 가져옴
- **로딩 화면 개선**: 데이터 로드 전까지 대기 화면 표시

---

## 🎯 향후 개선 과제

### 1. 세션 관리 시스템 개선
- **다중 세션 지원**: 여러 게임 세션 동시 관리
- **세션 목록 UI**: 과거/현재/미래 세션 조회
- **세션 재활용**: 'closed' 세션을 'waiting'으로 리셋

### 2. 관람 모드 완성
- `/finals` spectator 파라미터 처리
- 예선 탈락자 자동 전환 로직
- 관람자 전용 UI 개선

### 3. 성능 최적화
- DB 쿼리 최적화
- 실시간 구독 최적화
- 불필요한 리렌더링 제거

---

## 📚 참고 문서

- **`GAME_RULES.md`** - 게임 규칙 상세 설명
- **`README.md`** - 프로젝트 소개 및 배포 정보

---

**최종 업데이트**: 2025-10-19  
**현재 상태**: 프로덕션 배포 완료, 라운드 중심 아키텍처 전환 완료
