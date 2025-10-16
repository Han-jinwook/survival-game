# 데이터베이스 스키마 문서

## 개요
가위바위보 하나빼기 서바이벌 게임의 PostgreSQL 데이터베이스 스키마입니다.
**Replit PostgreSQL (Neon-backed)** 사용

---

## 테이블 구조

### 1. `users` - 사용자 정보
사용자(플레이어) 기본 정보를 저장합니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | VARCHAR | PRIMARY KEY | 사용자 고유 ID (UUID) |
| `naver_id` | VARCHAR | UNIQUE, NOT NULL | 네이버 카페 아이디 |
| `nickname` | VARCHAR | NOT NULL | 닉네임 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 생성 시각 |
| `is_active` | BOOLEAN | DEFAULT true | 활성 상태 |

**인덱스:**
- PRIMARY KEY on `id`
- UNIQUE INDEX on `naver_id`

---

### 2. `game_sessions` - 게임 세션
게임 세션(이벤트)의 전체 정보를 관리합니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | SERIAL | PRIMARY KEY | 세션 고유 ID |
| `session_name` | VARCHAR | NOT NULL | 세션 이름 |
| `cafe_name` | VARCHAR | NULLABLE | 카페 이름 |
| `prize` | VARCHAR | NULLABLE | 경품 정보 |
| `status` | VARCHAR | NOT NULL | 세션 상태 |
| `initial_lives` | INTEGER | DEFAULT 5 | 초기 목숨 개수 |
| `current_round` | INTEGER | DEFAULT 0 | 현재 라운드 번호 |
| `winner_id` | VARCHAR | NULLABLE | 우승자 ID (FK → users.id) |
| `started_at` | TIMESTAMP | NULLABLE | 게임 시작 시각 |
| `ended_at` | TIMESTAMP | NULLABLE | 게임 종료 시각 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 생성 시각 |

**상태(status) 값:**
- `waiting`: 대기 중
- `starting`: 카운트다운 중
- `in_progress`: 게임 진행 중
- `completed`: 완료 (우승자 결정)
- `closed`: 세션 종료 (수정 불가)

**인덱스:**
- PRIMARY KEY on `id`
- INDEX on `status`

---

### 3. `game_participants` - 게임 참가자
각 게임 세션의 참가자 정보를 저장합니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | VARCHAR | PRIMARY KEY | 참가자 고유 ID (UUID) |
| `game_session_id` | INTEGER | NOT NULL | 세션 ID (FK → game_sessions.id) |
| `user_id` | VARCHAR | NOT NULL | 사용자 ID (FK → users.id) |
| `nickname` | VARCHAR | NOT NULL | 참가자 닉네임 |
| `initial_lives` | INTEGER | NOT NULL | 초기 목숨 |
| `current_lives` | INTEGER | NOT NULL | 현재 목숨 |
| `status` | VARCHAR | NOT NULL | 참가자 상태 |
| `joined_at` | TIMESTAMP | DEFAULT NOW() | 참가 시각 |
| `eliminated_at` | TIMESTAMP | NULLABLE | 탈락 시각 |
| `last_active_at` | TIMESTAMP | NULLABLE | 마지막 활동 시각 |

**상태(status) 값:**
- `waiting`: 대기 중 (로비 입장 전)
- `playing`: 게임 진행 중 (로비 입장 후)
- `eliminated`: 탈락
- `winner`: 우승

**인덱스:**
- PRIMARY KEY on `id`
- INDEX on `game_session_id`
- INDEX on `user_id`
- INDEX on `status`

**외래키:**
- `game_session_id` → `game_sessions(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE

---

### 4. `game_rounds` - 게임 라운드
각 라운드의 진행 정보와 결과를 저장합니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | VARCHAR | PRIMARY KEY | 라운드 고유 ID (UUID) |
| `game_session_id` | INTEGER | NOT NULL | 세션 ID (FK → game_sessions.id) |
| `round_number` | INTEGER | NOT NULL | 라운드 번호 |
| `phase` | VARCHAR | NOT NULL | 현재 페이즈 |
| `survivors_count` | INTEGER | NULLABLE | 생존자 수 |
| `rock_count` | INTEGER | DEFAULT 0 | 바위 선택 수 |
| `paper_count` | INTEGER | DEFAULT 0 | 보 선택 수 |
| `scissors_count` | INTEGER | DEFAULT 0 | 가위 선택 수 |
| `losing_choice` | VARCHAR | NULLABLE | 지는 선택 (rock/paper/scissors) |
| `started_at` | TIMESTAMP | DEFAULT NOW() | 시작 시각 |
| `ended_at` | TIMESTAMP | NULLABLE | 종료 시각 |

**페이즈(phase) 값:**
- `waiting`: 대기 중
- `selectTwo`: 2개 선택 단계 (10초)
- `excludeOne`: 하나빼기 단계 (10초)
- `revealing`: 결과 공개 (5초)

**인덱스:**
- PRIMARY KEY on `id`
- INDEX on `game_session_id`
- INDEX on `round_number`

**외래키:**
- `game_session_id` → `game_sessions(id)` ON DELETE CASCADE

---

### 5. `player_choices` - 플레이어 선택
각 라운드에서 플레이어의 선택을 저장합니다.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | VARCHAR | PRIMARY KEY | 선택 고유 ID (UUID) |
| `round_id` | VARCHAR | NOT NULL | 라운드 ID (FK → game_rounds.id) |
| `participant_id` | VARCHAR | NOT NULL | 참가자 ID (FK → game_participants.id) |
| `selected_choices` | TEXT[] | NULLABLE | 2개 선택 단계의 선택 배열 |
| `final_choice` | VARCHAR | NULLABLE | 최종 선택 (rock/paper/scissors) |
| `chosen_at` | TIMESTAMP | DEFAULT NOW() | 선택 시각 |

**인덱스:**
- PRIMARY KEY on `id`
- INDEX on `round_id`
- INDEX on `participant_id`
- UNIQUE INDEX on `(round_id, participant_id)` (한 라운드에 한 번만 선택)

**외래키:**
- `round_id` → `game_rounds(id)` ON DELETE CASCADE
- `participant_id` → `game_participants(id)` ON DELETE CASCADE

---

## 관계도 (ERD)

```
users (1) ─────┐
               │
               ├─→ game_participants (N)
               │         │
game_sessions (1) ────────┤
               │         │
               └─→ game_rounds (N)
                         │
                         └─→ player_choices (N)
```

**관계 설명:**
- 1 세션(`game_sessions`) : N 참가자(`game_participants`)
- 1 세션 : N 라운드(`game_rounds`)
- 1 라운드 : N 플레이어 선택(`player_choices`)
- 1 사용자(`users`) : N 참가자 (여러 세션 참여 가능)

---

## 실시간 동기화

### PostgreSQL LISTEN/NOTIFY
실시간 게임 상태 동기화를 위해 PostgreSQL의 LISTEN/NOTIFY 메커니즘 사용

**채널:**
- `game_updates`: 모든 게임 상태 변경 알림

**트리거:**
- `game_sessions`, `game_participants`, `game_rounds`, `player_choices` 테이블에서
- INSERT, UPDATE, DELETE 발생 시 자동으로 NOTIFY 실행

**전달 방식:**
- PostgreSQL NOTIFY → Node.js Server → SSE (Server-Sent Events) → 클라이언트

---

## 주요 쿼리 패턴

### 1. 활성 세션 조회
```sql
SELECT * FROM game_sessions 
WHERE status IN ('waiting', 'starting', 'in_progress') 
ORDER BY created_at DESC 
LIMIT 1;
```

### 2. 세션의 생존 참가자 조회
```sql
SELECT * FROM game_participants 
WHERE game_session_id = ? 
  AND status = 'playing' 
  AND current_lives > 0
ORDER BY nickname;
```

### 3. 현재 라운드 조회
```sql
SELECT * FROM game_rounds 
WHERE game_session_id = ? 
ORDER BY round_number DESC 
LIMIT 1;
```

### 4. 라운드 결과 계산
```sql
SELECT 
  final_choice,
  COUNT(*) as count
FROM player_choices
WHERE round_id = ?
  AND final_choice IS NOT NULL
GROUP BY final_choice;
```

---

## 데이터베이스 마이그레이션

**사용 도구:** 직접 SQL 실행 (마이그레이션 도구 없음)

**변경 방법:**
1. `lib/database.ts`에서 인터페이스 수정
2. SQL 스크립트 작성 및 실행
3. 프로덕션 DB에는 Replit Database 콘솔에서 직접 실행

**주의사항:**
- PRIMARY KEY 타입 변경 금지 (기존 데이터 손실)
- 외래키 제약조건 확인
- CASCADE 동작 주의

---

## 성능 최적화

### 인덱스 전략
- 자주 조회되는 컬럼에 인덱스: `status`, `game_session_id`, `round_number`
- 복합 인덱스: `(round_id, participant_id)` for player_choices

### 연결 풀 관리
- **node-postgres (pg)** 사용
- 최대 연결 수: 20
- Idle timeout: 30초
- **중요**: `pool.end()` 호출 금지 (재사용을 위해)

### 쿼리 최적화
- JOIN 대신 필요 시 여러 쿼리 실행
- 트랜잭션 사용으로 데이터 일관성 보장
- EXPLAIN ANALYZE로 성능 분석

---

## 백업 및 복구

**Replit PostgreSQL (Neon) 자동 백업:**
- 자동 스냅샷: 매일
- 보관 기간: 7일
- 복구 방법: Replit Console → Database → Rollback

**수동 백업:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

**복구:**
```bash
psql $DATABASE_URL < backup.sql
```

---

## 보안

### 접근 제어
- 환경 변수 `DATABASE_URL`로 연결 정보 관리
- Replit Secret으로 프로덕션 DB URL 보호

### SQL Injection 방지
- Parameterized queries 사용 (node-postgres)
- 사용자 입력 검증 및 sanitize

### 데이터 보호
- `is_active` 플래그로 soft delete
- CASCADE 삭제 신중하게 사용
- 민감 정보 암호화 (현재 미적용)

---

## 문제 해결

### 자주 발생하는 에러

#### 1. "Cannot use pool after calling end"
**원인:** pool.end() 호출 후 재사용 시도
**해결:** pool.end() 제거, 연결 풀 재사용

#### 2. "terminating connection due to administrator command"
**원인:** Neon 서버의 강제 연결 종료
**해결:** LISTEN 클라이언트 재연결 로직 구현 필요

#### 3. "duplicate key value violates unique constraint"
**원인:** PRIMARY KEY 또는 UNIQUE 제약조건 위반
**해결:** INSERT 전 기존 데이터 확인 또는 UPSERT 사용

---

## 개발 vs 프로덕션

### 개발 환경
- Replit 내장 PostgreSQL
- `DATABASE_URL` 자동 설정
- 로컬 개발용

### 프로덕션 환경
- Replit PostgreSQL (Neon-backed)
- Replit Deployments에서 자동 연결
- 동일한 `DATABASE_URL` 사용

**차이점:**
- 프로덕션은 자동 백업 활성화
- 프로덕션은 성능 모니터링 가능
- 개발 환경에서만 테스트 데이터 생성
