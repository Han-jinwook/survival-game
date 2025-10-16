# 긴급 버그 수정 테스트 시나리오

## 🐛 수정된 버그
1. **목숨 숫자 미표시 (0개 표시)**: ✅ 수정 완료
2. **테스트 버튼 비활성화**: ✅ 세션 상태 정상 확인

---

## ✅ 수정 사항 요약

### 1. API 응답 구조 개선
- **`/api/game/state`**: `naverId`, `cafeName`, `prize` 필드 추가
- **`/api/auth/me`**: `lives` 필드 추가 (폴백용)

### 2. 디버깅 로그 추가
- 세션 상태 업데이트 추적
- 참가자 매핑 과정 추적  
- 목숨 계산 로직 추적

---

## 🧪 테스트 시나리오

### 시나리오 1: 목숨 숫자 정상 표시 확인

**전제 조건:**
- 사용자가 네이버 로그인 완료
- 게임 세션에 참가자로 등록됨
- 현재 목숨: 3개 (또는 다른 값)

**테스트 단계:**
1. 로비 페이지 접속 (`/lobby`)
2. **예상 결과:**
   - "나의 목숨: 3개" (실제 DB 값) 표시
   - 💛 이모지 3개 표시
3. **확인 방법:**
   - 브라우저 개발자 도구 → Console 탭 열기
   - 다음 로그 확인:
     ```
     [Lobby] 🍪 쿠키 인증 성공: { naverId: "...", nickname: "멀린", lives: 3 }
     [Lobby] 💛 참가자 매핑 완료: { ... }
     [Lobby] 💛 목숨 계산 추적: { finalCalculatedLives: 3, ... }
     ```

**예상 로그:**
```javascript
[Lobby] 🍪 쿠키 인증 성공: {
  naverId: "naver_123",
  nickname: "멀린", 
  lives: 3
}

[Lobby] 💛 참가자 매핑 완료: {
  원본참가자수: 1,
  매핑된참가자: [{
    naverId: "naver_123",
    nickname: "멀린",
    lives: 3,
    status: "waiting"
  }]
}

[Lobby] 💛 목숨 계산 추적: {
  currentUserNaverId: "naver_123",
  currentUserLives_from_auth: 3,
  playersCount: 1,
  matchedPlayer: { naverId: "naver_123", lives: 3 },
  finalCalculatedLives: 3
}
```

---

### 시나리오 2: 테스트 버튼 활성화 확인

**전제 조건:**
- 게임 세션 상태: `waiting`
- 로비 입장자: 3명 이상

**테스트 단계:**
1. 로비 페이지 접속
2. **예상 결과:**
   - "테스트 시작" 버튼 활성화 (파란색)
   - 버튼에 "(in_progress)" 같은 상태 텍스트 없음
3. **확인 방법:**
   - Console에서 로그 확인:
     ```
     [Lobby] 🎯 세션 상태 업데이트: { status: "waiting", ... }
     ```
4. 버튼 클릭 → 카운트다운 시작

**디버깅 (버튼이 여전히 비활성화된 경우):**
```javascript
// Console에서 실행:
console.log("sessionStatus:", sessionStatus) 
// 출력 확인: "waiting"이 아니면 DB 상태 확인 필요
```

---

### 시나리오 3: 여러 참가자 목숨 표시 확인

**전제 조건:**
- 참가자 3명
  - 멀린: 5개
  - 사용자A: 3개
  - 사용자B: 1개

**테스트 단계:**
1. 로비 페이지에서 참가자 목록 확인
2. **예상 결과:**
   - 각 참가자 옆에 정확한 💛 개수 표시
   - 목숨 순으로 정렬 (5 → 3 → 1)

---

## 🔍 추가 디버깅 방법

### 1. API 응답 직접 확인
```bash
# 게임 상태 확인
curl https://survival-game-app-chiuking369.replit.app/api/game/state | jq '.'

# 현재 사용자 정보 확인 (쿠키 필요)
curl https://survival-game-app-chiuking369.replit.app/api/auth/me \
  -H "Cookie: uid=YOUR_USER_ID" | jq '.'
```

### 2. 브라우저 Network 탭 확인
1. 개발자 도구 → Network 탭
2. `/api/game/state` 요청 찾기
3. Response 탭에서 다음 확인:
   - `participants[].naverId` 존재하는지
   - `participants[].currentLives` 값이 맞는지
   - `session.cafeName`, `session.prize` 존재하는지

---

## 🚨 문제 발생 시 체크리스트

### 목숨이 여전히 0으로 표시되는 경우:
1. ✅ Console에서 `[Lobby] 💛 목숨 계산 추적` 로그 확인
2. ✅ `matchedPlayer`가 `null`인지 확인
3. ✅ `currentUserNaverId`와 `playersInfo[].naverId`가 일치하는지 확인
4. ❌ 일치하지 않으면 → DB `users` 테이블의 `naver_id` 확인 필요

### 테스트 버튼이 비활성화된 경우:
1. ✅ Console에서 `[Lobby] 🎯 세션 상태 업데이트` 로그 확인
2. ✅ `status`가 `"waiting"`인지 확인
3. ❌ `"in_progress"` 또는 다른 값이면 → DB `game_sessions` 테이블의 `status` 확인 필요

---

## 📊 DB 상태 확인 쿼리

### 현재 세션 상태 확인
```sql
SELECT id, session_name, status, initial_lives, current_round, started_at 
FROM game_sessions 
WHERE status != 'completed' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 참가자 목숨 확인
```sql
SELECT p.nickname, p.current_lives, p.status, u.naver_id
FROM game_participants p
JOIN users u ON p.user_id = u.id
WHERE p.game_session_id = 'SESSION_ID'
ORDER BY p.joined_at DESC;
```

---

## 🎯 성공 기준
- [ ] 로비에서 정확한 목숨 개수 표시
- [ ] 테스트 버튼이 `waiting` 상태에서 활성화
- [ ] 모든 참가자의 목숨이 정확하게 표시
- [ ] Console 로그로 데이터 흐름 추적 가능

---

## 📝 알려진 이슈 및 개선 사항 (Architect 피드백)

### 성능 최적화 권장사항:
1. **`/api/auth/me` 호출 볼륨 모니터링**
   - 현재: 매 호출마다 DB 조회
   - 개선: hot path일 경우 캐싱 고려

2. **타입 안정성 개선**
   - `(p as any).naver_id` → DatabaseService 타입 정의 개선 필요

3. **프로덕션 로깅 최적화**
   - 디버그 로그를 플래그로 제어하거나 제거 고려
   - 현재는 문제 추적을 위해 유지

---

## 🔄 롤백 방법 (문제 발생 시)

이전 버전으로 되돌리려면:
```bash
git revert <commit-hash>
```

---

**테스트 완료 후 보고 사항:**
1. 목숨 숫자가 정확하게 표시되는지
2. 테스트 버튼이 정상 작동하는지
3. Console 로그에서 발견한 특이사항
4. 추가로 발견된 버그나 개선사항
