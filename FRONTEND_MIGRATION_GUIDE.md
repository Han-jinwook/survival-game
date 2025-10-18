# 프론트엔드 마이그레이션 가이드

## 개요
백엔드 API가 `game_participants`에서 `users`로 통합되었으므로, 프론트엔드 코드도 이에 맞춰 수정해야 합니다.

---

## 🔑 핵심 변경 사항

### 1. 용어 변경
| 기존 | 변경 후 | 설명 |
|-----|--------|------|
| `participantId` | `userId` | 사용자 식별자 |
| `participant` | `user` | 객체 변수명 |
| `participants` | `users` | 배열 변수명 |
| `game_participants` 테이블 | `users` 테이블 | Supabase 구독 |

### 2. API 응답 형식 변경
```typescript
// ❌ 기존
{
  "participant": {
    "id": "uuid",
    "user_id": "uuid",
    "game_session_id": 123,
    "nickname": "홍길동",
    "current_lives": 5,
    "status": "in_lobby"
  }
}

// ✅ 변경 후
{
  "user": {
    "id": "uuid",
    "naver_id": "user123",
    "session_id": 123,
    "nickname": "홍길동",
    "current_lives": 5,
    "status": "in_lobby"
  }
}
```

---

## 📝 파일별 수정 가이드

### 1. `app/lobby/page.tsx`

#### 수정 1: localStorage 키 변경
```typescript
// ❌ 기존
localStorage.setItem('participantId', id)
const participantId = localStorage.getItem('participantId')

// ✅ 변경 후
localStorage.setItem('userId', id)
const userId = localStorage.getItem('userId')
```

#### 수정 2: API 호출 파라미터 변경
```typescript
// ❌ 기존
const enterLobby = async (participantId: string) => {
  const response = await fetch("/api/game/session", {
    method: "POST",
    body: JSON.stringify({
      action: "enter_lobby",
      participantId: participantId,  // ❌
    }),
  })
}

// ✅ 변경 후
const enterLobby = async (userId: string) => {
  const response = await fetch("/api/game/session", {
    method: "POST",
    body: JSON.stringify({
      action: "enter_lobby",
      userId: userId,  // ✅
    }),
  })
}
```

#### 수정 3: API 응답 처리
```typescript
// ❌ 기존
const data = await response.json()
localStorage.setItem("participantInfo", JSON.stringify(data.participant))

// ✅ 변경 후
const data = await response.json()
localStorage.setItem("userInfo", JSON.stringify(data.user))
```

#### 수정 4: 실시간 구독 변경
```typescript
// ❌ 기존
const channel = supabase
  .channel('game-participants')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'game_participants',
  }, (payload) => {
    // ...
  })

// ✅ 변경 후
const channel = supabase
  .channel('game-users')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'users',
    filter: `session_id=eq.${sessionId}`,  // 중요: 세션 필터 추가
  }, (payload) => {
    // ...
  })
```

#### 수정 5: 데이터 매핑
```typescript
// ❌ 기존
const mappedPlayers = data.participants.map((p: any) => ({
  id: p.id,
  naverId: p.naverId,
  userId: p.userId,  // user_id가 별도로 존재
  nickname: p.nickname,
  lives: p.currentLives,
  status: mapStatus(p.status),
}))

// ✅ 변경 후
const mappedPlayers = data.users.map((u: any) => ({
  id: u.id,
  naverId: u.naver_id,
  nickname: u.nickname,
  lives: u.current_lives,
  status: mapStatus(u.status),
}))
```

---

### 2. `app/game/page.tsx`

#### 수정 1: 선택 저장 API
```typescript
// ❌ 기존
await fetch('/api/game/choice', {
  method: 'POST',
  body: JSON.stringify({
    roundId,
    participantId,  // ❌
    selectedChoices,
    finalChoice,
    sessionId
  })
})

// ✅ 변경 후
await fetch('/api/game/choice', {
  method: 'POST',
  body: JSON.stringify({
    roundId,
    userId,  // ✅
    selectedChoices,
    finalChoice,
    sessionId
  })
})
```

#### 수정 2: localStorage에서 ID 가져오기
```typescript
// ❌ 기존
const participantId = localStorage.getItem('participantId')
const participantInfo = JSON.parse(localStorage.getItem('participantInfo') || '{}')

// ✅ 변경 후
const userId = localStorage.getItem('userId')
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
```

---

### 3. `app/admin/page.tsx`

#### 수정 1: 참가자 목록 표시
```typescript
// ❌ 기존
{participants.map((p) => (
  <div key={p.id}>
    <span>{p.nickname}</span>
    <span>{p.currentLives}목숨</span>
    <button onClick={() => updateParticipant(p.id, lives)}>수정</button>
    <button onClick={() => deleteParticipant(p.id)}>삭제</button>
  </div>
))}

// ✅ 변경 후
{users.map((u) => (
  <div key={u.id}>
    <span>{u.nickname}</span>
    <span>{u.current_lives}목숨</span>
    <button onClick={() => updateUser(u.id, lives)}>수정</button>
    <button onClick={() => deleteUser(u.id)}>삭제</button>
  </div>
))}
```

#### 수정 2: 수정/삭제 API 호출
```typescript
// ❌ 기존
const updateParticipant = async (participantId: string, lives: number) => {
  await fetch(`/api/participants/${participantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ lives })
  })
}

const deleteParticipant = async (participantId: string) => {
  await fetch(`/api/participants/${participantId}`, {
    method: 'DELETE'
  })
}

// ✅ 변경 후
const updateUser = async (userId: string, lives: number) => {
  await fetch(`/api/participants/${userId}`, {  // URL은 그대로 유지 가능
    method: 'PATCH',
    body: JSON.stringify({ lives })
  })
}

const deleteUser = async (userId: string) => {
  await fetch(`/api/participants/${userId}`, {
    method: 'DELETE'
  })
}
```

---

## 🔍 체크리스트

### API 호출 변경
- [ ] `participantId` → `userId` 파라미터 변경
- [ ] API 응답에서 `data.participant` → `data.user` 변경
- [ ] API 응답에서 `data.participants` → `data.users` 변경

### localStorage 변경
- [ ] `localStorage.getItem('participantId')` → `localStorage.getItem('userId')`
- [ ] `localStorage.setItem('participantId', id)` → `localStorage.setItem('userId', id)`
- [ ] `localStorage.getItem('participantInfo')` → `localStorage.getItem('userInfo')`
- [ ] `localStorage.setItem('participantInfo', data)` → `localStorage.setItem('userInfo', data)`

### Supabase 실시간 구독
- [ ] 테이블 이름: `game_participants` → `users`
- [ ] 필터 추가: `filter: 'session_id=eq.${sessionId}'`
- [ ] 채널 이름 변경 (선택 사항)

### 변수명 변경
- [ ] `participantId` → `userId`
- [ ] `participant` → `user`
- [ ] `participants` → `users`
- [ ] `currentParticipant` → `currentUser`

### 데이터 필드 접근
- [ ] `participant.user_id` → `user.id`
- [ ] `participant.game_session_id` → `user.session_id`
- [ ] `participant.naverId` → `user.naver_id`
- [ ] `participant.currentLives` → `user.current_lives`

---

## 🧪 테스트 시나리오

### 1. 로비 입장/퇴장 테스트
```
1. 홈페이지에서 ID 입력
2. 로비 입장 버튼 클릭
3. localStorage에 userId 저장 확인
4. API 호출 성공 확인
5. 실시간으로 다른 사용자에게 입장 알림 표시 확인
6. 페이지 새로고침 후에도 로비 상태 유지 확인
7. 뒤로가기 또는 퇴장 시 퇴장 API 호출 확인
```

### 2. 게임 진행 테스트
```
1. 관리자가 게임 시작
2. 로비에 있던 사용자들만 게임 진행
3. 선택 저장 시 userId 전송 확인
4. 라운드 결과 표시 확인
5. 목숨 차감 확인
```

### 3. 다중 세션 테스트
```
1. 세션 A 생성, user123 참가
2. 세션 B 생성, user123 참가
3. 두 세션에서 독립적으로 게임 진행 확인
4. 세션 A의 user123와 세션 B의 user123가 다른 레코드인지 확인
```

---

## 🚨 주의사항

### 1. 세션 필터 필수
`users` 테이블은 모든 세션의 사용자를 포함하므로, Supabase 실시간 구독 시 **반드시** `session_id` 필터를 적용해야 합니다.

```typescript
// ❌ 잘못된 예 - 모든 세션의 users 이벤트를 받음
.on('postgres_changes', {
  table: 'users',
})

// ✅ 올바른 예 - 현재 세션의 users만 받음
.on('postgres_changes', {
  table: 'users',
  filter: `session_id=eq.${sessionId}`
})
```

### 2. 마이그레이션 순서
1. **백엔드 코드 배포** (API 먼저 수정)
2. **DB 마이그레이션 실행**
3. **프론트엔드 코드 배포**

순서를 바꾸면 API 호출이 실패할 수 있습니다.

### 3. 기존 localStorage 데이터 정리
사용자들의 브라우저에 남아있는 기존 `participantId` 데이터를 정리하는 로직 추가:

```typescript
// 페이지 로드 시
useEffect(() => {
  // 기존 participantId가 있으면 userId로 마이그레이션
  const oldParticipantId = localStorage.getItem('participantId')
  if (oldParticipantId && !localStorage.getItem('userId')) {
    localStorage.setItem('userId', oldParticipantId)
    localStorage.removeItem('participantId')
  }
  
  const oldParticipantInfo = localStorage.getItem('participantInfo')
  if (oldParticipantInfo && !localStorage.getItem('userInfo')) {
    localStorage.setItem('userInfo', oldParticipantInfo)
    localStorage.removeItem('participantInfo')
  }
}, [])
```

---

## 📋 빠른 찾기/바꾸기 목록

VSCode에서 다음 패턴으로 찾기/바꾸기 수행:

| 찾기 | 바꾸기 | 설명 |
|-----|--------|------|
| `participantId` | `userId` | 변수명 |
| `participant\.` | `user.` | 객체 접근 |
| `participants\.map` | `users.map` | 배열 매핑 |
| `game_participants` | `users` | 테이블 이름 |
| `data\.participant` | `data.user` | API 응답 |
| `data\.participants` | `data.users` | API 응답 배열 |

**주의**: 전체 바꾸기 전에 각 변경 사항을 검토하세요!

---

## ✅ 완료 후 확인

- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고 없음
- [ ] 모든 페이지에서 사용자 목록 정상 표시
- [ ] 로비 입장/퇴장 정상 작동
- [ ] 게임 선택 저장 정상 작동
- [ ] 실시간 동기화 정상 작동
- [ ] localStorage에 올바른 키로 저장됨
- [ ] 브라우저 콘솔에 에러 없음

---

**작성일**: 2025-10-18  
**작성자**: Cascade AI
