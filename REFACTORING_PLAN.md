# 🔄 DB 구조 재설계 - 1회성 이벤트 게임 최적화

## 📋 프로젝트 개요

### 문제 인식
현재 시스템은 일반적인 온라인 게임 구조(users + game_participants)로 설계되어 있으나, 실제 사용 시나리오는 **1회성 이벤트 게임**입니다. 이로 인해 불필요한 복잡도가 발생하고 있습니다.

### 게임 특성
- **1회성 이벤트**: 몇 달에 한 번씩 진행되는 휘발성 게임
- **네이버 카페 회원 대상**: 카페 활동의 보조 도구
- **비밀번호 없는 인증**: 운영진이 등록한 ID만으로 참여
- **세션 독립성**: 같은 ID가 다른 세션에 참여 가능 (데이터 충돌 없음)

### 핵심 개선 방향
`game_participants` 테이블을 제거하고, `users` 테이블에 게임 참가 정보를 직접 통합하여 구조를 단순화합니다.

---

## 🎯 목표

### 1단계: DB 스키마 재설계 ✅
- ✅ `users` 테이블에 게임 세션 정보 통합
- ✅ `(naver_id, session_id)` 복합 유니크 키 설정
- ✅ `game_participants` 테이블 완전 제거
- ✅ 외래 키 및 인덱스 재구성

### 2단계: 백엔드 코드 수정 ✅
- ✅ `lib/database.ts` - DatabaseService 메서드 수정
- ✅ `lib/types.ts` - GameParticipant 타입 제거
- ✅ API 엔드포인트 수정 (모든 `/api/game/*` 및 `/api/participants/*`)

### 3단계: 프론트엔드 코드 단순화 ✅
- ✅ `app/lobby/page.tsx` - 이중 상태 관리 제거
- ✅ `app/game/page.tsx` - participant 참조 제거
- ✅ 기타 페이지 수정

### 4단계: 테스트 및 검증 ✅
- ✅ 로컬 테스트
- ✅ 프로덕션 배포

---

## 📊 현재 스키마 분석

### 기존 구조 (문제점 있음)
```sql
-- users 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY,
    naver_id VARCHAR(100) UNIQUE NOT NULL,  -- ❌ UNIQUE 제약이 문제
    nickname VARCHAR(100),
    created_at TIMESTAMPTZ,
    is_active BOOLEAN
);

-- game_participants 테이블 (제거 대상)
CREATE TABLE game_participants (
    id UUID PRIMARY KEY,
    game_session_id UUID REFERENCES game_sessions(id),
    user_id UUID REFERENCES users(id),
    nickname VARCHAR(100),
    initial_lives INTEGER,
    current_lives INTEGER,
    status VARCHAR(50),
    joined_at TIMESTAMPTZ,
    eliminated_at TIMESTAMPTZ,
    UNIQUE(game_session_id, user_id)  -- 세션별 참가 기록
);
```

### 문제점
1. **users.naver_id UNIQUE 제약**: 같은 네이버 ID가 여러 세션에 참여 불가
2. **이중 테이블 구조**: users ↔ game_participants 조인 필요, 데이터 동기화 복잡
3. **불필요한 복잡도**: 1회성 게임에는 과도한 설계

---

## 🔧 새로운 스키마 설계

### 핵심 변경 사항
```sql
-- 1. users 테이블 재설계
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naver_id VARCHAR(100) NOT NULL,  -- ✅ UNIQUE 제약 제거
    session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    
    -- 게임 참가 정보 (기존 game_participants에서 이동)
    initial_lives INTEGER DEFAULT 5,
    current_lives INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'waiting',  -- waiting, in_lobby, playing, eliminated, winner
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    
    -- 기타 정보
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- ✅ 핵심: (naver_id, session_id) 복합 유니크 키
    UNIQUE(naver_id, session_id)
);

-- 2. game_participants 테이블 삭제
DROP TABLE IF EXISTS game_participants CASCADE;

-- 3. player_choices 외래 키 변경
ALTER TABLE player_choices 
    DROP CONSTRAINT IF EXISTS player_choices_participant_id_fkey,
    ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 기존 participant_id 컬럼은 user_id로 대체
```

### 기대 효과
- ✅ **단순화**: 테이블 1개 감소, 조인 불필요
- ✅ **데이터 정합성**: (naver_id, session_id) 유니크 키로 충돌 방지
- ✅ **성능 향상**: 조인 연산 제거
- ✅ **명확성**: "사용자"가 아닌 "게임 참가 기록"으로 의미 명확화

---

## 🔄 마이그레이션 계획

### Phase 1: 스키마 백업 및 준비
```sql
-- 1. 기존 데이터 백업
CREATE TABLE game_participants_backup AS SELECT * FROM game_participants;

-- 2. 외래 키 제약 확인
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'game_participants';
```

### Phase 2: users 테이블 재구성
```sql
-- 1. 기존 users 테이블 백업
CREATE TABLE users_backup AS SELECT * FROM users;

-- 2. users 테이블 컬럼 추가
ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_naver_id_key,  -- UNIQUE 제약 제거
    ADD COLUMN session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    ADD COLUMN initial_lives INTEGER DEFAULT 5,
    ADD COLUMN current_lives INTEGER DEFAULT 5,
    ADD COLUMN status VARCHAR(50) DEFAULT 'waiting',
    ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN eliminated_at TIMESTAMPTZ,
    ADD COLUMN last_active_at TIMESTAMPTZ;

-- 3. 복합 유니크 키 생성
ALTER TABLE users ADD CONSTRAINT users_naver_id_session_id_unique UNIQUE(naver_id, session_id);

-- 4. 인덱스 재생성
DROP INDEX IF EXISTS idx_users_naver_id;
CREATE INDEX idx_users_naver_id ON users(naver_id);
CREATE INDEX idx_users_session_id ON users(session_id);
CREATE INDEX idx_users_status ON users(status);
```

### Phase 3: 데이터 마이그레이션
```sql
-- game_participants → users 데이터 이관
INSERT INTO users (
    naver_id, 
    session_id, 
    nickname, 
    initial_lives, 
    current_lives, 
    status, 
    joined_at, 
    eliminated_at,
    is_active
)
SELECT 
    u.naver_id,
    gp.game_session_id,
    gp.nickname,
    gp.initial_lives,
    gp.current_lives,
    gp.status,
    gp.joined_at,
    gp.eliminated_at,
    u.is_active
FROM game_participants gp
JOIN users_backup u ON gp.user_id = u.id
ON CONFLICT (naver_id, session_id) DO NOTHING;
```

### Phase 4: player_choices 외래 키 변경
```sql
-- 1. player_choices에 user_id 컬럼 추가
ALTER TABLE player_choices ADD COLUMN user_id UUID;

-- 2. 기존 participant_id → user_id 매핑
UPDATE player_choices pc
SET user_id = (
    SELECT u.id 
    FROM users u
    JOIN game_participants_backup gp ON u.naver_id = (
        SELECT naver_id FROM users_backup WHERE id = gp.user_id
    )
    WHERE gp.id = pc.participant_id
    LIMIT 1
);

-- 3. 외래 키 제약 추가
ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. 기존 participant_id 컬럼 제거
ALTER TABLE player_choices DROP COLUMN participant_id;

-- 5. 유니크 제약 재생성
ALTER TABLE player_choices 
    DROP CONSTRAINT IF EXISTS player_choices_round_id_participant_id_key,
    ADD CONSTRAINT player_choices_round_id_user_id_unique UNIQUE(round_id, user_id);
```

### Phase 5: game_participants 테이블 제거
```sql
-- 1. 트리거 제거
DROP TRIGGER IF EXISTS trigger_game_participants_notify ON game_participants;

-- 2. 테이블 제거
DROP TABLE IF EXISTS game_participants CASCADE;
```

### Phase 6: 트리거 재생성
```sql
-- users 테이블에 트리거 추가
DROP TRIGGER IF EXISTS trigger_users_notify ON users;
CREATE TRIGGER trigger_users_notify
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();
```

---

## 💻 코드 수정 계획

### 1. lib/types.ts
```typescript
// GameParticipant 타입 제거
// User 타입에 게임 정보 추가
export interface User {
  id: string; // UUID
  naver_id: string;
  session_id: number;
  nickname: string;
  initial_lives: number;
  current_lives: number;
  status: 'waiting' | 'in_lobby' | 'playing' | 'eliminated' | 'winner';
  joined_at: string;
  eliminated_at?: string;
  last_active_at?: string;
  created_at: string;
  is_active: boolean;
}

// PlayerChoice 타입 수정
export interface PlayerChoice {
  id: string;
  round_id: string;
  user_id: string;  // participant_id → user_id
  selected_choices?: string[];
  final_choice?: 'rock' | 'paper' | 'scissors';
  chosen_at: string;
}
```

### 2. lib/database.ts
**제거할 메서드:**
- `addParticipant()` → `addUserToSession()`으로 통합
- `getParticipantByUserId()` → `getUserByNaverIdAndSession()`으로 대체
- `getParticipants()` → `getUsersBySession()`으로 대체
- `updateParticipant()` → `updateUser()`로 대체
- `deleteParticipant()` → `deleteUser()`로 대체

**신규/수정 메서드:**
```typescript
// 세션에 사용자 추가 (기존 addParticipant 대체)
static async addUserToSession(
  sessionId: number, 
  naverId: string, 
  nickname: string, 
  initialLives: number
): Promise<User | null> {
  const { data, error } = await db
    .from('users')
    .insert({ 
      naver_id: naverId, 
      session_id: sessionId,
      nickname: nickname, 
      initial_lives: initialLives, 
      current_lives: initialLives, 
      status: 'waiting' 
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error adding user to session:', error);
    return null;
  }
  return data;
}

// 세션별 사용자 조회
static async getUsersBySession(sessionId: number): Promise<User[]> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('session_id', sessionId)
    .order('joined_at');
  
  if (error) {
    console.error('Error getting users by session:', error);
    return [];
  }
  return data || [];
}

// (naver_id, session_id)로 사용자 조회
static async getUserByNaverIdAndSession(naverId: string, sessionId: number): Promise<User | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('naver_id', naverId)
    .eq('session_id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error getting user by naver_id and session_id:', error);
    return null;
  }
  return data;
}

// 사용자 정보 업데이트
static async updateUser(userId: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
  const { data, error } = await db
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating user:', error);
    return null;
  }
  return data;
}
```

### 3. API 수정 목록

#### `/api/game/settings/route.ts`
- `DatabaseService.getUserByNaverId()` → `getUserByNaverIdAndSession()` 사용
- `DatabaseService.addParticipant()` → `addUserToSession()` 사용
- `DatabaseService.getParticipants()` → `getUsersBySession()` 사용

#### `/api/game/session/route.ts`
- `addParticipant()` → `addUserToSession()` 사용
- `getParticipants()` → `getUsersBySession()` 사용
- `updateParticipant()` → `updateUser()` 사용
- 응답 JSON에서 `participants` → `users`로 변경

#### `/api/participants/[id]/route.ts`
- 경로 변경: `/api/users/[id]/route.ts`
- `updateParticipant()` → `updateUser()` 사용
- `deleteParticipant()` → `deleteUser()` 사용

#### `/api/game/choice/route.ts`
- `participant_id` → `user_id` 사용

### 4. 프론트엔드 수정

#### `app/lobby/page.tsx`
**현재 문제:**
- `players`(users), `currentUser`, `currentParticipant` 3개 상태 관리
- 데이터 소스 2개(users, game_participants) 동기화 필요

**수정 후:**
```typescript
// ✅ 단일 데이터 소스
const [players, setPlayers] = useState<User[]>([])
const [currentUser, setCurrentUser] = useState<User | null>(null)

// ✅ 단순화된 useEffect
useEffect(() => {
  fetch('/api/game/session')
    .then(res => res.json())
    .then(data => {
      if (data.session) {
        setPlayers(data.users)  // participants → users
        
        const myId = localStorage.getItem('userId')
        if (myId) {
          const me = data.users.find((u: User) => u.id === myId)
          setCurrentUser(me || null)
        }
      }
    })
}, [])

// ✅ 실시간 구독 단순화
useEffect(() => {
  const channel = supabase
    .channel('lobby-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'users',
      filter: `session_id=eq.${sessionId}`
    }, handleRealtimeUpdate)
    .subscribe()
  
  return () => { supabase.removeChannel(channel) }
}, [sessionId])
```

#### `app/game/page.tsx`
- `participant_id` → `user_id` 사용
- API 호출 시 `participantId` → `userId` 파라미터 변경

---

## 🧪 테스트 계획

### 1. 단위 테스트
- [ ] `DatabaseService.addUserToSession()` - 새 사용자 추가
- [ ] `DatabaseService.getUsersBySession()` - 세션별 조회
- [ ] `DatabaseService.getUserByNaverIdAndSession()` - 복합 키 조회
- [ ] `DatabaseService.updateUser()` - 상태 업데이트

### 2. 통합 테스트
- [ ] 운영자 페이지: 참가자 등록/수정/삭제
- [ ] 로비 페이지: 입장/퇴장, 실시간 동기화
- [ ] 게임 페이지: 선택 저장, 라운드 진행

### 3. 시나리오 테스트
- [ ] **시나리오 1**: 같은 naver_id가 다른 세션에 참여
  - 세션 A에 "user123" 참여
  - 세션 B에 "user123" 참여
  - 각 세션에서 독립적으로 게임 진행
  
- [ ] **시나리오 2**: 1회성 게임 흐름
  - 운영자가 참가자 등록
  - 참가자들 로비 입장
  - 게임 시작
  - 게임 종료
  - 세션 닫기

### 4. 성능 테스트
- [ ] 100명 참가자 동시 로비 입장
- [ ] 실시간 동기화 지연 시간 측정
- [ ] API 응답 시간 비교 (before/after)

---

## 📝 체크리스트

### Phase 1: 준비 단계 ✅
- [x] 현재 스키마 분석 완료
- [x] 새 스키마 설계 문서 작성
- [x] 마이그레이션 SQL 스크립트 작성
- [x] 백업 계획 수립

### Phase 2: DB 마이그레이션 ⏳
- [ ] Supabase에서 기존 데이터 백업
- [ ] 마이그레이션 스크립트 실행
- [ ] 데이터 정합성 검증
- [ ] 롤백 테스트

### Phase 3: 백엔드 코드 수정 ⏳
- [ ] `lib/types.ts` 수정
- [ ] `lib/database.ts` 수정
- [ ] API 라우트 수정 (8개 파일)
- [ ] 테스트 코드 작성

### Phase 4: 프론트엔드 코드 수정 ⏳
- [ ] `app/lobby/page.tsx` 단순화
- [ ] `app/game/page.tsx` 수정
- [ ] 기타 페이지 수정
- [ ] localStorage 키 변경

### Phase 5: 테스트 및 검증 ⏳
- [ ] 로컬 환경 테스트
- [ ] 스테이징 환경 테스트
- [ ] 시나리오 테스트
- [ ] 성능 테스트

### Phase 6: 배포 ⏳
- [ ] 프로덕션 DB 백업
- [ ] 마이그레이션 실행
- [ ] 코드 배포 (Vercel)
- [ ] 모니터링

---

## 🚨 주의 사항

### 1. 데이터 손실 방지
- 모든 단계에서 백업 필수
- 마이그레이션 전 롤백 스크립트 준비
- 프로덕션 환경에서는 점진적 배포

### 2. 외래 키 제약
- `player_choices.participant_id` → `user_id` 변경 시 기존 데이터 매핑 필요
- CASCADE 옵션 확인

### 3. 실시간 동기화
- Supabase Realtime 구독 테이블 변경: `game_participants` → `users`
- 채널 이름 및 필터 조건 확인

### 4. 타입 안전성
- TypeScript 타입 변경 후 전체 빌드 확인
- API 응답 형식 변경 시 프론트엔드 영향 확인

---

## 📅 예상 작업 시간

- **Phase 1 (준비)**: 1시간 ✅
- **Phase 2 (DB 마이그레이션)**: 2시간
- **Phase 3 (백엔드)**: 3시간
- **Phase 4 (프론트엔드)**: 2시간
- **Phase 5 (테스트)**: 2시간
- **Phase 6 (배포)**: 1시간

**총 예상 시간**: 11시간

---

## 🎉 기대 효과

### 코드 복잡도 감소
- 테이블 1개 감소 (game_participants 제거)
- API 호출 단순화 (조인 불필요)
- 상태 관리 단순화 (프론트엔드)

### 성능 향상
- 조인 연산 제거로 쿼리 속도 향상
- 실시간 동기화 채널 1개 감소

### 유지보수성 향상
- 명확한 데이터 구조 (1회성 게임에 최적화)
- 같은 ID의 다중 세션 참여 보장
- 비즈니스 로직과 DB 구조 일치

---

## 🔗 참고 자료

- [Supabase 문서 - Foreign Keys](https://supabase.com/docs/guides/database/tables#foreign-keys)
- [PostgreSQL UNIQUE 제약](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**작성일**: 2025-10-18  
**작성자**: Cascade AI  
**버전**: 1.0
