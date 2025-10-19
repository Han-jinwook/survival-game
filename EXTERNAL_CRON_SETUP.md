# 🕐 외부 Cron 서비스를 이용한 게임 스케줄러 설정

## 📋 개요
외부 Cron 서비스(EasyCron.com)를 사용하여 예약된 게임을 자동으로 시작하는 시스템입니다.

## 🎯 동작 원리
1. **운영자**: 관리자 페이지에서 게임 시간 설정 → DB 저장
2. **외부 Cron**: 매분마다 우리 API 호출
3. **스케줄러 API**: 예약 시간 지난 게임 자동 시작
4. **Realtime**: 모든 클라이언트에 상태 변화 전파

## 🔧 설정 단계

### 1. Netlify 환경 변수 설정
Netlify Dashboard → Site settings → Environment variables:

```
SCHEDULER_SECRET_TOKEN=game-scheduler-secret-2025-survival-xyz123
```

### 2. EasyCron.com 설정
1. **회원가입**: https://www.easycron.com/
2. **새 Cron Job 생성**:
   ```
   URL: https://your-netlify-site.netlify.app/api/game/scheduler
   Method: POST
   Headers: 
     Authorization: Bearer game-scheduler-secret-2025-survival-xyz123
     Content-Type: application/json
   Interval: Every 1 minute
   ```

### 3. 대안 Cron 서비스들
- **cron-job.org** (무료)
- **cronhub.io** (무료 플랜)
- **uptimerobot.com** (모니터링 + Cron)

## 📊 API 엔드포인트

### POST /api/game/scheduler
**용도**: 예약된 게임 자동 시작 (외부 Cron 전용)

**요청**:
```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  https://your-site.netlify.app/api/game/scheduler
```

**응답**:
```json
{
  "success": true,
  "executedAt": "2025-10-19T12:00:00.000Z",
  "processedSessions": 1,
  "results": [
    {
      "sessionId": 6,
      "sessionName": "가위바위보 하나빼기 이벤트",
      "status": "started",
      "playerCount": 3,
      "roundId": "abc123",
      "phase": "final_selection"
    }
  ]
}
```

### GET /api/game/scheduler
**용도**: 현재 스케줄러 상태 확인 (디버깅)

**요청**:
```bash
curl https://your-site.netlify.app/api/game/scheduler
```

**응답**:
```json
{
  "currentTime": "2025-10-19T12:00:00.000Z",
  "totalSessions": 5,
  "waitingSessions": 2,
  "readyToStart": 1,
  "scheduledSessions": [
    {
      "id": 6,
      "name": "가위바위보 하나빼기 이벤트",
      "startTime": "2025-10-19T11:59:00.000Z",
      "status": "waiting"
    }
  ]
}
```

## 🎮 게임 시작 로직

### 참가자 수별 처리
- **0명**: 게임 취소 (`status: completed`)
- **1명**: 자동 우승 (`status: completed`, `winner_id` 설정)
- **2명 이상**: 정상 게임 시작 (`status: in_progress`, 라운드 생성)

### 라운드 생성 규칙
- **5명 이상**: `selection` (예선)
- **4명 이하**: `final_selection` (결승)

## 🔍 모니터링 및 디버깅

### 1. Netlify Functions 로그 확인
Netlify Dashboard → Functions → 로그 확인

### 2. 수동 테스트
```bash
# 현재 상태 확인
curl https://your-site.netlify.app/api/game/scheduler

# 수동 실행 (토큰 필요)
curl -X POST \
  -H "Authorization: Bearer your-token" \
  https://your-site.netlify.app/api/game/scheduler
```

### 3. EasyCron 실행 로그
EasyCron 대시보드에서 각 실행 결과 확인

## ⚠️ 주의사항

### 보안
- `SCHEDULER_SECRET_TOKEN`은 충분히 복잡하게 설정
- API 토큰은 절대 코드에 하드코딩하지 마세요

### 시간대
- 모든 시간은 **UTC 기준**
- 한국 시간(KST) = UTC + 9시간
- DB의 `started_at`도 UTC로 저장됨

### 성능
- 매분 실행되므로 가벼운 로직 유지
- 에러 발생 시 다음 분에 재시도됨

## 🚀 장점

### 외부 Cron 방식의 장점
- ✅ **동적 스케줄링**: DB에 저장된 임의 시간에 실행 가능
- ✅ **안정성**: 전용 Cron 서비스의 높은 신뢰성
- ✅ **모니터링**: 실행 로그 및 실패 알림
- ✅ **무료**: 대부분 서비스에서 무료 플랜 제공

### GitHub Actions 대비 장점
- ✅ **유연성**: 고정 스케줄이 아닌 동적 시간 실행
- ✅ **즉시성**: 예약 시간에 정확히 실행
- ✅ **간편성**: 복잡한 워크플로우 설정 불필요

---

**작성일**: 2025-10-19  
**상태**: 구현 완료, 외부 Cron 설정 대기
