# Secret Rotation & Repository Re-contamination Runbook

목표: **1) 시크릿 즉시 회전 + 2) 레포 재오염 차단**을 운영 절차로 고정합니다.

## 1. 즉시 회전 대상
- Kiwoom APP KEY / APP SECRET (모든 계정)
- `SESSION_SECRET`
- `AGENT_KEY`

> 주의: `.replit` 또는 커밋 히스토리에 노출된 값은 유출된 값으로 간주하고 재사용하지 않습니다.

## 2. 새 시크릿 생성
```bash
npm run ops:generate-secrets
```
출력값을 Replit Secrets(또는 운영 비밀 저장소)에 등록합니다.

## 3. 레포 재오염 차단 검사
```bash
npm run check:secret-hygiene
```
검사 항목:
- 금지 파일(`.replit`, `.env*`, 토큰 캐시) git 추적 여부
- 고정 fallback 문자열 잔존 여부
- 키움 계정 키/시크릿 평문 패턴
- PRIVATE KEY 블록 패턴

## 4. Replit 설정 파일 관리 규칙
- 레포에는 `.replit.example`만 유지
- 실제 `.replit`은 로컬/플랫폼 전용 파일로 관리 (git ignore)
- `[userenv]`, `[userenv.shared]` 블록에 실제 값 저장 금지

## 5. CI/릴리즈 전 필수 커맨드
```bash
npm run check:secret-hygiene
npm run verify:replit
```
