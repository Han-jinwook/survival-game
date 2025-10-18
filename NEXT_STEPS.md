# 🚀 다음 단계 가이드

## ✅ 완료된 작업 (2025-10-18)

### 1. 설계 및 계획 ✅
- ✅ `REFACTORING_PLAN.md` - 상세 설계 문서
- ✅ `MIGRATION_SUMMARY.md` - 작업 요약
- ✅ `FRONTEND_MIGRATION_GUIDE.md` - 프론트엔드 수정 가이드

### 2. DB 마이그레이션 스크립트 ✅
- ✅ `scripts/04_migration_consolidate_users.sql` - 마이그레이션
- ✅ `scripts/05_rollback_migration.sql` - 롤백

### 3. 백엔드 코드 수정 ✅
- ✅ `lib/types.ts` - GameParticipant 제거, User 통합
- ✅ `lib/database.ts` - DatabaseService 메서드 변경
- ✅ `app/api/game/settings/route.ts`
- ✅ `app/api/game/session/route.ts`
- ✅ `app/api/participants/[id]/route.ts`
- ✅ `app/api/game/choice/route.ts`

---

## 📋 지금 해야 할 일

### Step 1: 로컬 환경에서 테스트 (선택사항)
로컬에 PostgreSQL이 있다면 먼저 테스트하는 것을 권장합니다.

```bash
# 1. 로컬 DB에 마이그레이션 적용
psql -U postgres -d your_database -f scripts/04_migration_consolidate_users.sql

# 2. Next.js 개발 서버 실행
npm run dev

# 3. 브라우저에서 테스트
# - TypeScript 컴파일 에러 확인
# - API 엔드포인트 호출 확인
```

### Step 2: 프론트엔드 코드 수정 ⚠️ **필수**

아래 파일들을 `FRONTEND_MIGRATION_GUIDE.md`를 참고하여 수정하세요:

**우선순위 1 (필수)**:
- [ ] `app/lobby/page.tsx` - 가장 중요
- [ ] `app/game/page.tsx` - 선택 저장 관련
- [ ] `app/admin/page.tsx` - 참가자 관리

**우선순위 2 (필요시)**:
- [ ] `app/page.tsx` - 홈페이지 (ID 입력)
- [ ] 기타 participant를 사용하는 컴포넌트

**핵심 변경사항**:
```typescript
// localStorage 키 변경
localStorage.getItem('participantId') → localStorage.getItem('userId')

// API 파라미터 변경
{ participantId: id } → { userId: id }

// API 응답 변경
data.participant → data.user
data.participants → data.users

// Supabase 구독 변경
table: 'game_participants' → table: 'users'
filter: `session_id=eq.${sessionId}` 추가 필수!
```

### Step 3: TypeScript 컴파일 확인

```bash
# 타입 에러 확인
npm run build

# 또는
npx tsc --noEmit
```

모든 에러를 수정하세요.

### Step 4: Supabase에서 DB 마이그레이션 실행

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 "SQL Editor" 클릭

3. **마이그레이션 스크립트 복사/붙여넣기**
   ```sql
   -- scripts/04_migration_consolidate_users.sql 내용 전체 복사
   ```

4. **실행 전 확인사항**
   - ⚠️ 백업이 자동으로 생성되지만, 중요 데이터가 있다면 수동 백업 권장
   - ⚠️ 실행 중 에러 발생 시 롤백 스크립트 준비

5. **실행 (Run)**
   - "Run" 버튼 클릭
   - 콘솔 출력 확인:
     - ✅ "마이그레이션 완료!" 메시지
     - ✅ 데이터 수 일치 확인
     - ⚠️ 경고 메시지가 있다면 검토

6. **결과 확인**
   ```sql
   -- users 테이블 확인
   SELECT COUNT(*) FROM users;
   
   -- game_participants 테이블이 삭제되었는지 확인
   SELECT * FROM game_participants; -- 에러가 나야 정상
   
   -- player_choices.user_id 확인
   SELECT COUNT(*) FROM player_choices WHERE user_id IS NOT NULL;
   ```

### Step 5: 배포

```bash
# Vercel 배포 (자동)
git add .
git commit -m "refactor: migrate game_participants to users table"
git push origin main

# 또는 수동 배포
vercel --prod
```

### Step 6: 프로덕션 테스트

1. **기본 기능 테스트**
   - [ ] 홈페이지 접속
   - [ ] ID 입력하여 로비 입장
   - [ ] 다른 브라우저/시크릿 모드에서 다른 ID로 입장
   - [ ] 실시간으로 참가자 목록 업데이트 확인

2. **게임 플레이 테스트**
   - [ ] 관리자 페이지에서 게임 시작
   - [ ] 선택 저장 확인
   - [ ] 라운드 결과 확인
   - [ ] 목숨 차감 확인

3. **다중 세션 테스트** (핵심!)
   - [ ] 관리자 페이지에서 새 세션 생성
   - [ ] 같은 naver_id로 두 세션에 참여
   - [ ] 각 세션에서 독립적으로 게임 진행
   - [ ] 데이터 충돌 없는지 확인

---

## 🚨 문제 발생 시

### 케이스 1: 마이그레이션 실패
```sql
-- Supabase SQL Editor에서 롤백 실행
-- scripts/05_rollback_migration.sql 내용 복사/실행
```

### 케이스 2: TypeScript 컴파일 에러
- `FRONTEND_MIGRATION_GUIDE.md`를 참고하여 누락된 수정사항 확인
- `participantId` → `userId` 전체 검색
- `data.participant` → `data.user` 전체 검색

### 케이스 3: API 호출 실패
- 브라우저 개발자도구 (F12) → Network 탭 확인
- API 요청 body에 `userId`가 올바르게 전달되는지 확인
- 서버 로그 확인

### 케이스 4: 실시간 동기화 안 됨
- Supabase 실시간 구독에 `filter: 'session_id=eq.${sessionId}'` 추가 확인
- Supabase Dashboard → Settings → API → Realtime 활성화 확인

---

## 📞 지원

문제가 계속되면:
1. `REFACTORING_PLAN.md` 재확인
2. `FRONTEND_MIGRATION_GUIDE.md`의 체크리스트 검토
3. Git에서 이전 버전과 비교 (`git diff`)

---

## 🎉 완료 후

모든 테스트가 통과하면:
- [ ] `MIGRATION_SUMMARY.md`의 체크리스트 업데이트
- [ ] 이 파일(`NEXT_STEPS.md`)에 완료 날짜 기록
- [ ] 백업 테이블 정리 (선택사항):
  ```sql
  DROP TABLE IF EXISTS users_backup;
  DROP TABLE IF EXISTS game_participants_backup;
  DROP TABLE IF EXISTS player_choices_backup;
  ```

---

**현재 상태**: 백엔드 수정 완료, 프론트엔드 수정 대기중  
**다음 작업**: 프론트엔드 코드 수정 → 마이그레이션 실행 → 배포  
**작성일**: 2025-10-18
