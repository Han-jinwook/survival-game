# 가위바위보 하나빼기 서바이벌 게임

## Overview
This project is a "Rock-Paper-Scissors One-Exclusion Survival Game" designed for internal events, specifically for Naver Cafe communities. The game features a unique "one-exclusion" rule, a lottery-style "lives" system, and differentiates between preliminary and final rounds based on participant count. The core purpose is to provide an engaging, real-time interactive game experience for community events. The project aims for a robust, scalable, and user-friendly platform with a focus on real-time synchronization and mobile responsiveness.

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