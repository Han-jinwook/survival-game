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

## 향후 업그레이드 계획

### 관리자 기능 고도화
#### 📋 이벤트 세션 히스토리 시스템 (보류)
**목적**: 과거 이벤트 세션을 불러와서 재사용하거나 참고할 수 있는 기능

**기능 명세**:
1. 세션 목록 드롭다운
   - `/api/game/sessions` API로 과거 세션 조회
   - 세션명, 카페명, 참가자 수, 날짜 표시
   
2. 세션 불러오기
   - 선택한 세션 데이터 로드
   - 읽기 전용 모드로 표시
   
3. 재등록 기능
   - 과거 세션 데이터를 복사해서 새 세션으로 저장
   - 기존 세션 수정 없이 새 ID로 생성

**기술적 이슈**:
- Next.js SWC 컴파일러가 JSX 이벤트 핸들러 내 인라인 async 함수를 지원하지 않음
- `onChange={async () => {...}}` 패턴 사용 불가
- 대안: 버튼 방식 또는 별도 함수 추출 패턴 필요

**우선순위**: Low (게임 핵심 기능 완성 후)

**참고**: 2025-10-14 개발 시도했으나 컴파일 이슈로 보류
