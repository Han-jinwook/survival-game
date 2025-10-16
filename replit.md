# 가위바위보 하나빼기 서바이벌 게임

## Overview
This project is a "Rock-Paper-Scissors One-Exclusion Survival Game" designed for internal events, specifically for Naver Cafe communities. The game features a unique "one-exclusion" rule, a lottery-style "lives" system, and differentiates between preliminary and final rounds based on participant count. The core purpose is to provide an engaging, real-time interactive game experience for community events. The project aims for a robust, scalable, and user-friendly platform with a focus on real-time synchronization and mobile responsiveness.

## 프로젝트 현황

### 마지막 업데이트
- 날짜: 2025-10-16
- **시간 설정 UTC/KST 변환 버그 수정** ✅ (LATEST)
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
- **Server-side game logic:** Planned for future phases to handle round progression, win/loss determination, and elimination.
- **Test Mode:** A simplified test mode for local development allows a single user to play against AI participants.

## External Dependencies
- **Database:** Replit PostgreSQL (Neon-backed)
- **DB Library:** `pg` (node-postgres)
- **UI Libraries:** `shadcn/ui`, `Radix UI`
- **Deployment Platform:** Replit
