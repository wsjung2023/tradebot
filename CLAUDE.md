# 개발 환경 운영 규칙

## 서비스 재시작
- **반드시 PowerShell로**: `Start-Process cmd.exe -ArgumentList '/c d:\Projects\tradebot\restart-all.bat'`
- bash에서 직접 실행 금지 (줄 끝 인코딩 문제로 실패함)
- 서버만 재시작: `schtasks /End /TN "TradeBot-Server"` → 3초 대기 → `schtasks /Run /TN "TradeBot-Server"`
  - 운영(포트5000)=`TradeBot-Server`, 개발(포트5002)=`TradeBot-Dev-Server`. 둘 다 `npm run dev`(tsx)로 구동.
- ⚠️ `TradeBot-Agent` task는 **현재 존재하지 않음** (아래 "키움 연동" 참고).

## 키움 연동 (현재: REST 직접 인증)
- **현재 구조 (2026-06 확인)**: 서버가 키움 REST(`mockapi.kiwoom.com`)에 앱키/시크릿으로 **직접 인증**. 별도 파이썬 에이전트 불필요 — `TradeBot-Agent` task도, 실행 중인 `kiwoom-agent.py`도 없음.
- 토큰은 코드가 캐싱·자동 갱신(만료 시 재발급).
- (참고/장래) OpenAPI COM 방식 파이썬 에이전트를 다시 쓸 경우에만: `python kiwoom-agent.py` 직접 실행 금지(운영 토큰 무효화), Task Scheduler 경유.

## 로그 확인
- 서버 로그: `.tmp-ui-dev.out.log` (Task Scheduler 서버는 별도 로그 없음 — PowerShell로 직접 시작해야 로그 보임)
- 포트 확인: `netstat -ano | findstr ":5000"`
- 프로세스 확인: `tasklist | Select-String "node|python"`

## 서버 코드 수정 후
- 서버 재시작 필요 (tsx는 자동 재시작 안 함)
- DB 스키마 변경 시: migration SQL 파일 + `migrations/meta/_journal.json` 모두 업데이트
- 클라이언트 코드는 Vite HMR로 자동 반영 (재시작 불필요)

## 코드베이스 / DB 구조
- **운영(prod)**: `D:\Projects\tradebot` — 브랜치 `main`, 포트5000, DB `tradebot`. 라이브 모의투자 매매 중.
- **개발(dev)**: `D:\Projects\tradebot-dev` — 브랜치 `dev`, 포트5002, DB `tradebot_dev`. **여기가 작업 폴더.**
- ⚠️ `main`과 `dev`는 git 히스토리가 **무관**(공통 조상 없음). 그래서 배포는 git 머지가 아니라 **deploy.bat의 파일 복사**로 한다.

## 운영 배포 (deploy.bat)
- `deploy.bat` 실행 = dev→prod 파일 복사(server/client/shared/migrations) + **package.json/lock 복사 + npm install** + git push(dev) + 운영 서버 재시작. (cmd로 실행: `cmd /c "D:\Projects\tradebot-dev\deploy.bat"`)
- ⚠️ **의존성 추가 시 npm install 필수** — 누락하면 운영이 `ERR_MODULE_NOT_FOUND`로 부팅 실패(2026-06-21 `@sentry/node` 누락 사고). deploy.bat이 이제 자동 처리.
- ⚠️ **DB 마이그레이션은 자동 적용 안 됨.** 새 컬럼/테이블 추가 시 운영 DB(`tradebot`)에 **수동 additive 적용** 필요(`ADD COLUMN/CREATE TABLE IF NOT EXISTS`). 운영/개발 DB가 다르므로 양쪽 모두 확인. 미적용 시 신코드 부팅·기록 실패.

---

# Karpathy Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```
