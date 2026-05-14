# 개발 환경 운영 규칙

## 서비스 재시작
- **반드시 PowerShell로**: `Start-Process cmd.exe -ArgumentList '/c d:\Projects\tradebot\restart-all.bat'`
- bash에서 직접 실행 금지 (줄 끝 인코딩 문제로 실패함)
- 서버만 재시작: `schtasks /End /TN "TradeBot-Server"` → 3초 대기 → `schtasks /Run /TN "TradeBot-Server"`
- 에이전트만 재시작: `schtasks /End /TN "TradeBot-Agent"` → `schtasks /Run /TN "TradeBot-Agent"`

## 키움 에이전트 (kiwoom-agent.py) 규칙
- **절대 직접 실행 금지**: `python kiwoom-agent.py`를 직접 실행하면 키움 토큰이 새로 발급되어 운영 중인 에이전트 토큰이 무효화됨
- 에이전트 재시작은 반드시 Task Scheduler 경유: `schtasks /Run /TN "TradeBot-Agent"`
- 토큰은 `agent/token_cache.json`에 파일로 캐싱됨 — 재시작해도 유효한 토큰 재사용

## 로그 확인
- 서버 로그: `.tmp-ui-dev.out.log` (Task Scheduler 서버는 별도 로그 없음 — PowerShell로 직접 시작해야 로그 보임)
- 포트 확인: `netstat -ano | findstr ":5000"`
- 프로세스 확인: `tasklist | Select-String "node|python"`

## 서버 코드 수정 후
- 서버 재시작 필요 (tsx는 자동 재시작 안 함)
- DB 스키마 변경 시: migration SQL 파일 + `migrations/meta/_journal.json` 모두 업데이트
- 클라이언트 코드는 Vite HMR로 자동 반영 (재시작 불필요)

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
