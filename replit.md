# 가위바위보 하나빼기 서바이벌 게임

## Overview
This project is a "Rock-Paper-Scissors One-Exclusion Survival Game" designed for internal events, specifically for Naver Cafe communities. The game features a unique "one-exclusion" rule, a lottery-style "lives" system, and differentiates between preliminary and final rounds based on participant count. The core purpose is to provide an engaging, real-time interactive game experience for community events. The project aims for a robust, scalable, and user-friendly platform with a focus on real-time synchronization and mobile responsiveness.

## 프로젝트 현황

### 마지막 업데이트
- 날짜: 2025-10-16
- **서버 중심 아키텍처로 완전 전환** ✅ (LATEST)
  - 문제: 클라이언트에서 게임 로직 실행 (calculateResults, processElimination 등)으로 인한 아키텍처 불일치
  - 원인: 서버 API는 잘 구현되어 있었지만, 클라이언트가 여전히 로컬에서 결과 계산
  - 해결: 모든 게임 로직을 서버로 완전 이동, 클라이언트는 UI 업데이트만 담당
  - 변경사항:
    - `app/game/page.tsx`: calculateResults, processElimination, 타임아웃 처리 함수 등 5개 함수 삭제
    - `app/finals/page.tsx`: 동일한 클라이언트 게임 로직 함수 삭제
    - SSE 이벤트 핸들러 개선: player_choice, phase_changed, round_result, round_created 타입별 정확한 처리
    - API 호출 버그 수정: action "start_round" → "create", /api/game/state에 sessionId 파라미터 추가
  - 게임 플로우: 라운드 시작(round_created) → 플레이어 선택(player_choice) → 자동 페이즈 전환(phase_changed) → 결과 계산+목숨 차감(round_result)
  - 결과: 서버가 모든 승패 계산, 목숨 차감, 페이즈 전환 처리. 클라이언트는 SSE 이벤트만 받아서 UI 업데이트
- **프로덕션 배포 완료** ✅
  - 문제: Next.js 프로덕션 빌드 오류 (webpack runtime 모듈 누락, PWA 관련 빌드 실패)
  - 해결: PWA 비활성화 (`next.config.mjs`에서 `disable: true` 설정)
  - 결과: 프로덕션 배포 성공, 모든 기능 정상 작동
  - URL: https://survival-game-app-chiuking369.replit.app
  - 결정: PWA 기능(오프라인 지원, 앱 설치) 없이 일반 웹사이트로 운영
- **데이터베이스 연결 안정화** ✅
  - 문제: "Cannot use pool after calling end" 에러 발생
  - 원인: `executeWithRetry()`에서 재시도 후 `pool.end()` 호출
  - 해결: `pool.end()` 제거, 연결 풀 재사용
  - 결과: 데이터베이스 안정적으로 작동, 프로덕션 DB 연결됨
- **SSE double-release 버그 수정** ✅
  - 문제: LISTEN 클라이언트가 중복 해제되는 버그
  - 원인: SSE 연결 종료 시 cleanup 로직 중복 실행
  - 해결: `isReleased` 플래그 추가로 중복 방지
  - 결과: SSE 실시간 동기화 안정적으로 작동
- **세션 생명주기 관리 시스템 구축 완료** ✅
  - 문제: 게임 완료 후 같은 세션을 재사용하면서 시간 설정 등 버그 발생
  - 해결: 완료된 세션을 닫고 새 세션 생성하는 시스템 구축
  - 기능: 'closed' 상태 추가, 세션 닫기/새 세션 생성 버튼, 닫힌 세션 수정 차단
  - 보호: API 레벨에서 closed 세션의 모든 mutating 작업 차단 (403)
  - 타이머 보호: 카운트다운 중 세션 닫아도 10초 타이머가 세션 재오픈하지 않음
- **시간 설정 UTC/KST 변환 버그 수정** ✅
  - 문제: 2~3일 후로 설정한 시간이 이미 지난 시간으로 바뀌는 버그 (10번+ 발생)
  - 원인: `datetime-local` 값("2025-10-16T13:29")을 `new Date()`로 변환할 때 시간대 정보 없어서 UTC로 잘못 해석
  - 해결: 모든 시간 변환에 명시적으로 한국 시간대 추가 `+ ':00+09:00'`
  - 수정 위치: `calculateTimeRemaining()`, 예약 시간 체크, 저장 후 메시지, 화면 표시 (5곳)
- **세션 리셋 자동 이동 버그 수정** ✅
  - 문제: 리셋 후 자동으로 게임 페이지로 이동하는 버그
  - 원인: 예약 시간이 지났을 때 자동 카운트다운 시작 → 게임 시작
  - 해결: `resetSession()` 함수에서 `gameScheduled`, `countdown` 상태도 초기화
  - 이제 리셋 후 자동 이동 없이 대기 상태 유지
- **세션 리셋 기능 개선** ✅
  - 관리자 페이지에 "세션 리셋" 버튼 추가
  - `/api/game/session` POST: `reset_session` 액션 추가
  - 세션 상태 + **모든 참가자 상태**를 "waiting"으로 초기화
  - 로비에 남아있던 참가자들도 모두 대기 상태로 변경
  - 프로덕션 배포 후 세션이 "in_progress" 상태일 때 사용 가능
- **긴급 버그 수정 완료 (이벤트 2일 전)** ✅
  - Bug #1 해결: 목숨 숫자 0개 표시 문제 → naverId 필드 추가로 해결
  - Bug #2 해결: 테스트 버튼 비활성화 → cafeName/prize 필드 추가로 해결
  - `/api/game/state`: naverId, cafeName, prize 필드 추가
  - `/api/auth/me`: 활성 세션의 참가자 lives 포함하여 반환
  - 로비 페이지: lives fallback 체인 (플레이어 매치 → currentUser.lives → 0)

## User Preferences
- I prefer simple language.
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture
The project utilizes a modern web stack with **Next.js 14.2.16 (App Router)** for the frontend and API routes, **TypeScript** for type safety, and **Tailwind CSS v4** for styling with a mobile-first approach. UI components are built using `shadcn/ui` and `Radix UI`.

**UI/UX Decisions:**
- Pages include Home, Auth (Naver ID input), Admin, Lobby, Game (preliminaries), Spectate Game, Finals, and Result pages.
- Spectator mode for finals is implemented using URL parameters, showing only participants and disabling choices for spectators.
- Mobile responsiveness is a key design goal, implemented using Tailwind's mobile-first breakpoints.

**Technical Implementations & Feature Specifications:**
- **Authentication:** Cookie-based user authentication using `httpOnly` cookies for `userId`.
- **Real-time Synchronization:** Leverages **PostgreSQL's LISTEN/NOTIFY** mechanism for real-time data updates, delivered to clients via **Server-Sent Events (SSE)** through `/api/game/stream`. This replaces polling and enables instant updates for lobby participant counts and game state changes.
- **Database:** **Replit PostgreSQL (Neon-backed)**, accessed via the `pg` (node-postgres) library. A connection pool manages database connections.
- **Core Database Schema:** Five main tables: `users`, `game_sessions`, `game_participants`, `game_rounds`, `player_choices`, with necessary indexes for performance.
- **API Routes:** Six core API categories (`/api/auth`, `/api/game/settings`, `/api/game/session`, `/api/game/round`, `/api/game/choice`, `/api/game/state`, `/api/game/stream`) handle all game logic, authentication, and state management.
- **Lobby & Game Start System:** Participants transition from `waiting` to `playing` upon entering the lobby. Game start conditions are enforced: 2-4 players proceed to finals, 5+ players go to preliminaries.
- **Participant Management:** An immediate exit system (using `beforeunload` and `useEffect` cleanup with `keepalive: true` for API calls) ensures participants are correctly removed from the lobby upon leaving.
- **Audio System:** A `GlobalAudioManager` is implemented for page-specific background music and TTS voice guidance.
- **Deployment:** Hosted on Replit with Autoscale deployment.

**System Design Choices:**
- **Server-side game logic:** ✅ **Fully implemented** - All game logic (round progression, win/loss determination, life deduction, phase transitions) is handled server-side. Clients receive real-time updates via SSE and only update UI accordingly.
- **Client responsibility:** UI rendering, user input handling, and displaying server-calculated results. No game logic execution on client.
- **Test Mode:** A simplified test mode for local development allows a single user to play against AI participants.

## External Dependencies
- **Database:** Replit PostgreSQL (Neon-backed)
- **DB Library:** `pg` (node-postgres)
- **UI Libraries:** `shadcn/ui`, `Radix UI`
- **Deployment Platform:** Replit
