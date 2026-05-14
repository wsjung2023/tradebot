# Runtime Introspection (Replit/Ops)

`GET /api/runtime-introspection`는 자동매매 런타임 상태를 기계적으로 점검하기 위한 JSON 엔드포인트입니다.

## 목적
- Replit 에이전트/운영 스크립트가 현재 상태를 추적 가능하도록 제공
- 가짜 fallback 상태 대신 실측 기반 상태와 DB 접근 가능 여부를 노출

## 인증
- 로그인 세션 필요 (`isAuthenticated`)

## 관련 엔진 알림 API
- `GET /api/auto-trading/notifications/summary` : `total/unreadTotal/unreadCrit/unreadWarn` 요약 조회

## 주요 필드
- `environment`
  - `nodeEnv`
  - `isReplit`
  - `replitDomainsConfigured`
- `security`
  - `sessionSecretConfigured`
  - `sessionSecretLength`
  - `agentKeyConfigured`
  - `browserCredentialsEndpointDisabled` (`/api/kiwoom/credentials`는 410으로 고정)
- `autoTrading`
  - `persistenceAvailable`
  - `persistenceError`
  - `runState`
  - `unreadNotificationCount`
  - `notificationSummary`
    - `total`
    - `unreadTotal`
    - `unreadCrit`
    - `unreadWarn`
  - `latestNotifications`
  - `derived`
    - `heartbeatAgeSec`
    - `lastCycleLagSec`
    - `agentCooldownRemainingSec`
    - `lastErrorHash`
    - `lastDurationMs`
    - `lastCycleId`

## 샘플 응답 (축약)
```json
{
  "measuredAt": "2026-03-29T12:34:56.789Z",
  "environment": { "nodeEnv": "production", "isReplit": true },
  "security": { "sessionSecretConfigured": true, "agentKeyConfigured": true },
  "autoTrading": {
    "persistenceAvailable": true,
    "runState": { "state": "running", "lastHeartbeatAt": "..." },
    "derived": { "heartbeatAgeSec": 12, "lastErrorHash": null }
  }
}
```

## 운영 권장
- `heartbeatAgeSec` > 120 이면 경고
- `lastCycleLagSec` > 300 이면 사이클 정체 의심
- `agentCooldownRemainingSec` > 0 이면 agent timeout 반복으로 엔진 쿨다운 상태
  - 정상 사이클이 돌면 `agentCooldownRemainingSec`는 0으로 복귀
- `persistenceAvailable=false`면 DB 마이그레이션/권한 즉시 점검

## 사전 점검 커맨드
- 시크릿 생성(배포 Secret Manager 입력용):
  - `npm run ops:generate-secrets`
- 런타임 상태 테이블 생성(최초 1회):
  - `npm run db:runtime-schema`
  - 생성 + 강검증(권장): `npm run db:runtime-bootstrap`
- 런타임 상태 테이블 존재 여부:
  - `npm run check:runtime-schema`
  - CI에서 DB 필수 강제: `CI=true npm run check:runtime-schema` 또는 `STRICT_RUNTIME_SCHEMA=1 npm run check:runtime-schema`
  - `npm run verify:replit` 실행 시 CI 환경이면 내부적으로 strict 모드(`STRICT_RUNTIME_SCHEMA=1`)가 적용됨
- 기존 핵심 API 계약(호환성) 점검:
  - `npm run check:legacy-contracts`
- 런타임 관측/알림 API 계약 점검:
  - `npm run check:runtime-contracts`
- 에이전트 인증/레거시 큐 보안 계약 점검:
  - `npm run check:agent-contracts`
- 보안 설정 점검(특히 production):
  - `npm run check:security-config`
- readiness 통합 리포트(JSON):
  - `npm run verify:replit` 실행 후 `artifacts/replit-readiness.json` 생성
  - `diff.statusChanges`에 이전 실행 대비 상태 변화가 기록됨
