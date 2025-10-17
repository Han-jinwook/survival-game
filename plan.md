# 가위바위보 하나빼기 서바이벌 게임 - 개발 계획

## 프로젝트 개요
멀티플레이어 실시간 가위바위보 하나빼기 서바이벌 게임

## 게임 규칙
게임 규칙은 `GAME_RULES.md` 파일을 참조하세요.

## 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS v4
- **데이터베이스**: Supabase (PostgreSQL)
- **실시간 통신**: Supabase Realtime
- **UI 컴포넌트**: shadcn/ui
- **상태 관리**: React Hooks + SWR

## 데이터베이스 구조

### 테이블
1. **players** - 플레이어 정보
   - id, nickname, lives, is_eliminated, created_at
2. **game_state** - 게임 상태
   - id, phase, round_number, timer, created_at, updated_at
3. **player_choices** - 플레이어 선택
   - id, player_id, round_number, phase, choices, final_choice, created_at
4. **round_results** - 라운드 결과
   - id, round_number, results, created_at

### 함수
- `reset_game()` - 게임 초기화
- `start_game()` - 게임 시작
- `eliminate_players()` - 플레이어 탈락 처리

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

## 파일 구조

### 페이지
- `app/page.tsx` - 홈 페이지
- `app/lobby/page.tsx` - 로비 (참가자 대기실)
- `app/viewer/page.tsx` - 관람 대기실
- `app/game/page.tsx` - 예선전 (참가자용)
- `app/spectate-game/page.tsx` - 예선전 관전 (관람자용)
- `app/finals/page.tsx` - 결승전 (참가자 + 관람자 통합)
- `app/result/page.tsx` - 최종 결과
- `app/admin/page.tsx` - 관리자 페이지

### 컴포넌트
- `components/game-header.tsx` - 게임 헤더 (타이머, 라운드 정보)
- `components/player-list.tsx` - 플레이어 목록
- `components/choice-buttons.tsx` - 선택 버튼
- `components/game-stats.tsx` - 게임 통계
- `components/final-round-display.tsx` - 결승전 화면

### 라이브러리
- `lib/database.ts` - Supabase 클라이언트
- `lib/game-logic.ts` - 게임 로직
- `lib/voice.ts` - TTS 음성 시스템

### 스크립트
- `scripts/01_create_tables.sql` - 테이블 생성
- `scripts/02_seed_data.sql` - 초기 데이터
- `scripts/03_create_functions.sql` - 함수 생성

## 개발 우선순위

### Phase 1: 기본 구조 ✅
- 데이터베이스 설계 및 구축
- 기본 UI 레이아웃
- 플레이어 참가 시스템

### Phase 2: 게임 로직 ✅
- 선택 시스템 구현
- 타이머 및 페이즈 전환
- 승부 판정 로직

### Phase 3: 실시간 동기화 ✅
- Supabase Realtime 연동
- 플레이어 상태 동기화
- 게임 상태 동기화

### Phase 4: 결승전 시스템 ✅
- 결승전 UI
- 위치 배치 시스템
- 비주얼 선택 표시

### Phase 5: 관람 모드 시스템 🔄
- 관람 대기실 UI ✅
- 예선 관전 페이지 UI ✅
- 결승전 spectator 파라미터 처리 ⏳
- 예선 탈락자 자동 전환 ⏳
- DB 실시간 연동 ⏳

### Phase 6: 최적화 및 버그 수정 🔄
- 성능 최적화
- 버그 수정
- UX 개선

## 주요 이슈 및 해결 방법

### 타이머 동기화
- 서버 시간 기준으로 타이머 계산
- 클라이언트 시간 차이 보정

### 동시성 처리
- 낙관적 업데이트 사용
- 충돌 방지 로직

### 무승부 처리
- 즉시 재시작 로직
- 안내 메시지 표시

### 관람 모드 동기화
- localStorage 기반 (현재)
- Supabase Realtime 구독 (서버 구축 후)

## 서버 구축 후 작업 목록

### 1. DB 실시간 연동
- `/spectate-game` - localStorage → Supabase Realtime 구독
- `/finals` - spectator 모드 DB 연동

### 2. 자동 전환 로직
- 예선 탈락자 → 결승 명단 → `/finals?spectator=true` 자동 이동
- 결승 명단 1분 카운트다운 후 자동 전환

### 3. 통합 테스트
- 참가자 + 관람자 동시 접속 테스트
- 실시간 동기화 테스트

## 테스트 계획
- 단일 플레이어 테스트
- 다중 플레이어 동시 접속 테스트
- 관람자 + 참가자 혼합 테스트
- 네트워크 지연 시뮬레이션
- 엣지 케이스 테스트

## 배포
- Vercel 배포
- Supabase 프로덕션 환경 설정
- 환경 변수 설정

---

## 🐛 알려진 에러 및 이슈 (2025-10-16)

### 1. DB LISTEN 연결 끊김 문제 ⚠️
**증상:**
- 에러 메시지: "terminating connection due to administrator command"
- PostgreSQL LISTEN 클라이언트가 예기치 않게 종료됨
- SSE 연결이 끊어져 실시간 동기화 실패

**원인:**
- Neon(Replit PostgreSQL) 서버의 연결 타임아웃 또는 관리자 명령
- 장시간 idle 연결 유지 시 서버가 강제 종료

**해결 필요:**
- [ ] DB LISTEN 클라이언트 재연결 로직 강화
- [ ] Heartbeat/keep-alive 메커니즘 추가
- [ ] 연결 끊김 감지 및 자동 재연결
- [ ] 에러 로깅 및 모니터링

**임시 해결책:**
- SSE 클라이언트 재연결 로직 존재 (3초 후 재시도)
- 하지만 서버측 LISTEN 재연결 필요

### 2. SSE 연결 안정성 문제 ⚠️
**증상:**
- 브라우저 콘솔: "[Home] SSE 연결 오류"
- 간헐적 SSE 연결 실패

**원인:**
- DB LISTEN 연결 문제로 인한 영향
- 네트워크 불안정성

**해결 필요:**
- [ ] 서버측 LISTEN 재연결 로직 구현
- [ ] SSE 연결 상태 모니터링
- [ ] 재연결 시 상태 복구 로직

### 3. 수정 완료된 버그 ✅

#### 3.1 서버-클라이언트 아키텍처 불일치
**문제:** 클라이언트에서 게임 로직(calculateResults, processElimination 등) 실행
**해결:** 모든 게임 로직을 서버로 이동, 클라이언트는 UI만 담당

#### 3.2 SSE 이벤트 핸들러 sessionId 버그
**문제:** `sessionId` 없으면 조용히 실패 (`if (!sessionIdStr) return`)
**해결:** `/api/game/state`는 sessionId 없이도 작동하므로 불필요한 체크 제거

#### 3.3 API 호출 오류
**문제:** `action: "start_round"` → 서버에 존재하지 않는 액션
**해결:** `action: "create"`로 수정

### 4. 프로덕션 배포 이슈 ✅

#### 4.1 PWA 빌드 실패
**문제:** Next.js 프로덕션 빌드 시 PWA 관련 에러
**해결:** `next.config.mjs`에서 PWA 비활성화 (`disable: true`)

#### 4.2 Database 연결 풀 관리
**문제:** "Cannot use pool after calling end" 에러
**해결:** `executeWithRetry()`에서 `pool.end()` 제거

---

## ✅ 최근 해결된 주요 문제 (2025-10-17)

### 1. 실시간 동기화 문제 해결
- **홈/로비 대기자 수 불일치**: API 응답 캐시 문제(`force-dynamic`으로 해결) 및 클라이언트 상태 계산 로직 불일치 문제를 해결하여 데이터 정합성을 확보했습니다.
- **로비 퇴장 시 상태 미반영**: `visibilitychange` 이벤트를 사용하여 사용자가 페이지를 벗어났을 때 퇴장 처리가 즉시 DB에 반영되도록 수정했습니다.

### 2. 게임 시작 로직 오류 해결
- **참가자 수 계산 오류**: 로비에 입장한 실제 인원을 기준으로 게임 시작 조건을 확인하도록 수정하여, 2명 이상일 때 정상적으로 카운트다운이 시작됩니다.

### 3. 운영자 페이지 기능 오류 해결
- **참가자 수정/삭제 불가**: 운영자 페이지가 로컬 state만 변경하던 문제를 해결했습니다. 이제 모든 수정/삭제 작업은 즉시 API를 통해 DB에 반영됩니다.

### 4. 빌드 및 배포 오류 해결
- **문법 오류로 인한 빌드 실패**: 코드 수정 과정에서 발생한 문법 오류를 해결했습니다.
- **API Key 오류**: 잘못된 키 사용으로 인한 서버의 DB 접근 불가 문제를 해결했습니다.

---

## 🚀 다음 목표: 세션 관리 시스템 개선

현재 시스템은 단일 게임 세션만 가정하고 설계되어 있어, 여러 게임을 동시에 또는 순차적으로 운영하기 어렵습니다. 다음 단계에서는 이 문제를 해결하기 위해 세션 관리 시스템을 개선합니다.

### 1. 문제점 (Current Issues)
- **단일 활성 세션**: `getActiveGameSession`은 항상 마지막 활성 세션 하나만 가져옵니다. 과거 세션 기록을 보거나, 여러 세션을 미리 만들어 둘 수 없습니다.
- **수정의 어려움**: 현재 세션 정보를 수정하는 유일한 방법은 운영자 페이지에서 전체 설정을 다시 저장하는 것뿐입니다. 이는 매우 비효율적입니다.
- **'닫힌' 세션의 재활용 불가**: 'closed' 상태의 세션은 다시 'waiting'으로 되돌릴 수 없어, 매번 새로운 세션을 만들어야 합니다.

### 2. 개선 목표 (Goals)
- **세션 목록 관리**: 운영자 페이지에서 모든 세션(과거, 현재, 미래)의 목록을 보고 관리할 수 있어야 합니다.
- **세션 상태 변경**: 각 세션의 상태(`waiting`, `in_progress`, `completed`, `closed`)를 개별적으로 쉽게 변경할 수 있어야 합니다.
- **세션 재활용**: 'closed' 또는 'completed' 상태의 세션을 다시 'waiting' 상태로 되돌려 재사용할 수 있어야 합니다. (참가자는 초기화)
- **신규 세션 생성**: 운영자 페이지에서 간단한 버튼 클릭으로 새로운 빈 세션을 생성할 수 있어야 합니다.

### 3. 구현 계획 (Action Plan)
1.  **API 수정**: `/api/game/settings` 및 `/api/game/session` API를 수정하여, `sessionId`를 기준으로 특정 세션을 조작할 수 있도록 변경합니다.
2.  **`DatabaseService` 확장**: 세션 목록을 가져오는 `getAllGameSessions`, 세션 상태를 리셋하는 `resetSession` 등의 메서드를 추가합니다.
3.  **운영자 페이지 UI/UX 개편**:
    - 세션 목록을 보여주는 테이블/리스트를 추가합니다.
    - 각 세션별로 '상태 변경', '리셋', '삭제' 등의 관리 버튼을 추가합니다.
    - '새 세션 만들기' 버튼을 추가합니다.
