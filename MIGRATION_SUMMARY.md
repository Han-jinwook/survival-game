# 🎯 마이그레이션 작업 완료 요약

## ✅ 완료된 작업

### 1. DB 스키마 재설계 ✅
- **목표**: `game_participants` 테이블 제거하고 `users` 테이블로 통합
- **핵심 변경**:
  - `users` 테이블에 `session_id`, `current_lives`, `status` 등 게임 정보 추가
  - `(naver_id, session_id)` 복합 유니크 키 설정으로 다중 세션 참여 지원
  - `player_choices.participant_id` → `user_id`로 외래 키 변경

### 2. SQL 마이그레이션 스크립트 작성 ✅
- **파일**:
  - `scripts/04_migration_consolidate_users.sql` - 마이그레이션 스크립트
  - `scripts/05_rollback_migration.sql` - 롤백 스크립트
- **내용**:
  - 백업 → 스키마 변경 → 데이터 이관 → 검증 → 정리

### 3. 타입 정의 수정 ✅
- **파일**: `lib/types.ts`
- **변경사항**:
  ```typescript
  // GameParticipant 타입 제거됨
  
  export interface User {
    id: string;
    naver_id: string;
    session_id: number;  // 추가
    nickname: string;
    initial_lives: number;  // 추가
    current_lives: number;  // 추가
    status: 'waiting' | 'in_lobby' | 'playing' | 'eliminated' | 'winner';  // 추가
    // ... 기타 게임 정보
  }
  
  export interface PlayerChoice {
    user_id: string;  // participant_id → user_id 변경
  }
  ```

### 4. DatabaseService 메서드 수정 ✅
- **파일**: `lib/database.ts`
- **변경사항**:
  | 기존 메서드 | 새 메서드 | 설명 |
  |------------|----------|------|
  | `addParticipant()` | `addUserToSession()` | 세션에 사용자 추가 |
  | `getParticipants()` | `getUsersBySession()` | 세션별 사용자 조회 |
  | `getParticipantByUserId()` | 제거 | 불필요 |
  | `updateParticipant()` | `updateUser()` | 사용자 정보 업데이트 |
  | `deleteParticipant()` | `deleteUser()` | 사용자 삭제 |
  | `getUserByNaverId()` | `getUserByNaverIdAndSession()` | 복합 키 조회 |

### 5. API 라우트 수정 ✅
- **수정된 파일**:
  - `/api/game/settings/route.ts` ✅
  - `/api/game/session/route.ts` ✅
  - `/api/participants/[id]/route.ts` ✅
  - `/api/game/choice/route.ts` ✅

- **주요 변경**:
  - `getParticipants()` → `getUsersBySession()` 사용
  - `addParticipant()` → `addUserToSession()` 사용
  - `updateParticipant()` → `updateUser()` 사용
  - `participantId` → `userId` 파라미터 변경
  - 응답 JSON에서 `participant` → `user` 변경

---

## ⏳ 남은 작업

### 1. 프론트엔드 코드 수정 ✅
**영향 받는 파일들**:
- ✅ `app/lobby/page.tsx` - 로비 페이지 (가장 중요)
- ✅ `app/game/page.tsx` - 게임 페이지
- ✅ `app/admin/admin-content.tsx` - 관리자 페이지
- ✅ 모든 주요 파일 수정 완료

**주요 수정 사항**:
```typescript
// 기존
const [players, setPlayers] = useState<Player[]>([])
const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)

// 수정 후
const [players, setPlayers] = useState<User[]>([])  // User 타입으로 통일

// API 호출 시
fetch('/api/game/session', {
  method: 'POST',
  body: JSON.stringify({
    action: 'enter_lobby',
    userId: userId,  // participantId → userId
  })
})
```

### 2. 실시간 구독 변경 ⏳
```typescript
// 기존
supabase
  .channel('lobby')
  .on('postgres_changes', {
    table: 'game_participants',  // ❌
  })

// 수정 후
supabase
  .channel('lobby')
  .on('postgres_changes', {
    table: 'users',  // ✅
    filter: `session_id=eq.${sessionId}`  // 세션 필터 추가
  })
```

### 3. DB 마이그레이션 실행 ⏳
**주의사항**:
1. 프로덕션 환경에서 마이그레이션 전 **반드시 백업**
2. 스테이징 환경에서 먼저 테스트
3. 마이그레이션 실행:
   ```sql
   -- Supabase SQL Editor에서 실행
   \i scripts/04_migration_consolidate_users.sql
   ```
4. 문제 발생 시 롤백:
   ```sql
   \i scripts/05_rollback_migration.sql
   ```

### 4. 테스트 ⏳
- [ ] 로컬 환경 테스트
- [ ] 로비 입장/퇴장 테스트
- [ ] 게임 시작 테스트
- [ ] 실시간 동기화 테스트
- [ ] 같은 ID가 다른 세션에 참여하는 시나리오 테스트

---

## 📝 핵심 개선 사항

### Before (기존)
```
[사용자 등록]
1. users 테이블에 naver_id로 사용자 생성
2. game_participants 테이블에 참가 기록 생성
3. 조인 쿼리로 사용자 + 참가 정보 조회

[문제점]
- 같은 naver_id가 여러 세션에 참여 불가 (UNIQUE 제약)
- 이중 테이블 구조로 데이터 동기화 복잡
- 조인 연산 필요
```

### After (개선 후)
```
[사용자 등록]
1. users 테이블에 (naver_id, session_id)로 사용자 생성
2. 모든 게임 정보가 users 테이블에 직접 저장

[개선점]
✅ 같은 naver_id가 다른 세션에 독립적으로 참여 가능
✅ 단일 테이블로 데이터 정합성 보장
✅ 조인 불필요, 쿼리 성능 향상
✅ 1회성 이벤트 게임에 최적화된 구조
```

---

## 🚨 주의사항

### 1. localStorage 키 변경 필요
```typescript
// 기존
localStorage.setItem('participantId', id)

// 수정 후
localStorage.setItem('userId', id)
```

### 2. API 응답 형식 변경
```typescript
// 기존 응답
{
  "participant": { "id": "...", "user_id": "...", ... }
}

// 새 응답
{
  "user": { "id": "...", "naver_id": "...", "session_id": 123, ... }
}
```

### 3. 실시간 구독 필터 추가
- `users` 테이블은 모든 세션의 사용자를 포함하므로 반드시 `session_id` 필터 적용

---

## 📚 참고 문서

- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - 상세 설계 문서
- [scripts/04_migration_consolidate_users.sql](./scripts/04_migration_consolidate_users.sql) - 마이그레이션 스크립트
- [scripts/05_rollback_migration.sql](./scripts/05_rollback_migration.sql) - 롤백 스크립트

---

## ✨ 다음 단계

1. **프론트엔드 코드 수정 완료**
2. **로컬 환경에서 테스트**
3. **Supabase에서 마이그레이션 실행**
4. **프로덕션 배포**

작업 완료 후 이 파일을 업데이트하여 진행 상황을 기록하세요.

---

**작성일**: 2025-10-18  
**작성자**: Cascade AI
