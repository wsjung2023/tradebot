# 수정사항_20260328 — 보유종목 수익률·평균매수가 파싱 필드명 수정

기준일: 2026-03-28
대상: 대시보드 보유종목 수익률 0% 표시 버그
중요도: 높음

---

## 1. 이슈 요약

| 항목 | 내용 |
|------|------|
| 발생 화면 | 대시보드 → 보유종목 목록 |
| 증상 | 모든 종목 수익률 0%, 평균매수가 0원 표시 (휴림에이텍만 예외) |
| DB 확인 | `average_price` 전 종목 "0.00", `profit_loss_rate` 전 종목 "0.0000" |

---

## 2. 근본 원인: 실계좌 API 응답 필드명 불일치

키움 실계좌 API의 `acnt_evlt_remn_indv_tot` 배열 항목이 실제로 반환하는 필드명과
서버가 파싱하려는 필드명이 **완전히 불일치**했음.

### 실제 API 응답 샘플 (kiwoom_jobs DB에서 확인)

```json
{
  "stk_cd":    "A007370",
  "stk_nm":    "진양제약",
  "cur_prc":   "000000004655",
  "rmnd_qty":  "000000000000510",
  "pur_pric":  "000000000006336",
  "prft_rt":   "-26.71",
  "evltv_prft": "-00000000863228",
  "poss_rt":   "10.43",
  "pur_amt":   "000000003231700",
  "evlt_amt":  "000000002374050"
}
```

### 필드명 불일치 대조표

| 항목 | 서버가 찾던 필드명 (잘못됨) | 실제 API 필드명 |
|------|--------------------------|---------------|
| 평균매수가 | `pchs_avg_pric`, `avg_pric` | **`pur_pric`** |
| 수익률(%) | `evlu_pfls_rt`, `pfls_rt` | **`prft_rt`** |
| 평가손익(원) | `evlu_pfls_amt`, `evlu_pfls` | **`evltv_prft`** |

※ `pchs_avg_pric`, `evlu_pfls_rt` 등은 모의계좌(KIS) API 필드명임.  
실계좌(키움증권)는 전혀 다른 필드명을 사용함.

---

## 3. 수정 내용

**파일**: `server/routes/account.routes.ts` (216~229번 줄)

### 변경 전

```typescript
averagePrice: cleanStr(item.pchs_avg_pric) || cleanStr(item.avg_pric) || cleanStr(item.averagePrice) || "0",
currentPrice: cleanStr(item.prpr) || cleanStr(item.cur_prc) || cleanStr(item.currentPrice) || "0",
profitLoss: cleanStr(item.evlu_pfls_amt) || cleanStr(item.evlu_pfls) || "0",
profitLossRate: cleanStr(item.evlu_pfls_rt) || cleanStr(item.pfls_rt) || "0",
```

### 변경 후

```typescript
averagePrice: cleanStr(item.pchs_avg_pric) || cleanStr(item.avg_pric) || cleanStr(item.pur_pric) || cleanStr(item.averagePrice) || "0",
currentPrice: cleanStr(item.prpr) || cleanStr(item.cur_prc) || cleanStr(item.currentPrice) || "0",
profitLoss: cleanStr(item.evlu_pfls_amt) || cleanStr(item.evlu_pfls) || cleanStr(item.evltv_prft) || "0",
profitLossRate: cleanStr(item.evlu_pfls_rt) || cleanStr(item.pfls_rt) || cleanStr(item.prft_rt) || "0",
```

**변경 원칙**:
- 실계좌 필드명(`pur_pric`, `prft_rt`, `evltv_prft`)을 폴백으로 추가
- 기존 모의계좌 필드명(`pchs_avg_pric`, `evlu_pfls_rt` 등)은 첫번째 우선순위로 유지 (폴백 삭제 금지)
- `currentPrice`는 이미 `cur_prc`를 사용 중이므로 수정 불필요

---

## 4. 왜 휴림에이텍만 수익률이 표시됐는가

휴림에이텍 DB 레코드:
- `average_price = "0.00"`
- `profit_loss_rate = "-8.7400"` ← 이 값만 남아있음

이 값은 과거 에이전트나 서버 버전에서 다른 파싱 로직으로 저장됐던 데이터가 잔재한 것.
현재 다른 종목들은 전부 `profit_loss_rate = "0.0000"` 상태.

---

## 5. 수정 후 예상 동작

- 다음 잔고 조회(`balance.get`) 이후 DB `average_price`에 실제 매수가 저장됨
- `profit_loss_rate`에 키움 API가 계산한 수익률(%)이 저장됨
- 대시보드 보유종목에 수익률이 올바르게 표시됨
- 기존 DB 데이터는 소급 업데이트 없이 다음 조회 시 자연히 갱신됨

---

## 6. 절대 수정 금지 (이번 수정 이후)

- `server/routes/account.routes.ts` 216~230번 줄의 폴백 순서 변경 금지
- `pur_pric`, `prft_rt`, `evltv_prft` 필드명 삭제 금지
- `pchs_avg_pric`, `evlu_pfls_rt` 등 모의계좌 필드명 삭제 금지 (모의계좌 호환 유지)

---

## 7. 확인 방법

```sql
-- 수정 후 잔고 조회 다음에 실행
SELECT stock_name, average_price, current_price, profit_loss_rate
FROM holdings
ORDER BY updated_at DESC LIMIT 20;
```

**기대 결과**: `average_price`가 "0.00"이 아닌 실제 매수가, `profit_loss_rate`가 "0.0000"이 아닌 실제 수익률로 표시됨.
