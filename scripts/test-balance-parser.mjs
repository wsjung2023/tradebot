#!/usr/bin/env node
/**
 * 잔고 파싱 로직 회귀 테스트
 *
 * server/utils/balance-parser.ts 에서 실제 parseHoldingItem / cleanStr 를 임포트해
 * 실계좌 / 모의계좌 필드명 변환이 항상 올바른지 검증한다.
 *
 * 이 파일은 테스트 케이스만 정의한다. 파싱 로직이 수정되면 여기서 자동으로 탐지된다.
 *
 * 실행: node scripts/test-balance-parser.mjs
 *   (tsx 로 컴파일 후 실행하므로 별도 빌드 불필요)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

// tsx 를 통해 TypeScript 유틸을 직접 임포트하기 위해 자신을 tsx 로 재실행
// (Node.js 는 .ts 임포트 불가이므로 이 간접 방식 사용)
const isTsx = process.argv[1]?.includes("tsx") || process.env.TSX_RUNNER === "1";
if (!isTsx) {
  const tsx = new URL("../node_modules/.bin/tsx", import.meta.url).pathname;
  if (!existsSync(tsx)) {
    console.error("tsx 를 찾을 수 없습니다. npx tsx 로 실행하세요.");
    process.exit(1);
  }
  process.env.TSX_RUNNER = "1";
  try {
    execSync(`${tsx} ${process.argv[1]}`, { stdio: "inherit" });
  } catch {
    process.exit(1);
  }
  process.exit(0);
}

// tsx 환경에서만 아래 코드 실행됨
const { parseHoldingItem, cleanStr } = await import("../server/utils/balance-parser.ts");

// ── 테스트 케이스 ─────────────────────────────────────────────────────────────

const tests = [
  {
    name: "모의계좌 표준 필드 (Kiwoom API 표준명)",
    input: {
      acnt_pdno: "005930",
      prdt_name: "삼성전자",
      hldg_qty: "10",
      pchs_avg_pric: "75000",
      prpr: "80000",
      evlu_pfls_amt: "50000",
      evlu_pfls_rt: "6.67",
    },
    expected: {
      stockCode: "005930",
      stockName: "삼성전자",
      quantity: 10,
      averagePrice: "75000",
      currentPrice: "80000",
      profitLoss: "50000",
      profitLossRate: "6.67",
    },
  },
  {
    name: "실계좌 폴백 필드 (pur_pric / prft_rt / evltv_prft / stk_cd / rmnd_qty)",
    input: {
      stk_cd: "000660",
      stk_nm: "SK하이닉스",
      rmnd_qty: "5",
      pur_pric: "150000",
      cur_prc: "160000",
      evltv_prft: "50000",
      prft_rt: "6.67",
    },
    expected: {
      stockCode: "000660",
      stockName: "SK하이닉스",
      quantity: 5,
      averagePrice: "150000",
      currentPrice: "160000",
      profitLoss: "50000",
      profitLossRate: "6.67",
    },
  },
  {
    name: "stockCode 우선순위: acnt_pdno > pdno > stk_cd > stockCode",
    input: {
      acnt_pdno: "FIRST",
      pdno: "SECOND",
      stk_cd: "THIRD",
      stockCode: "FOURTH",
      hldg_qty: "1",
      pchs_avg_pric: "100",
      prpr: "100",
      evlu_pfls_amt: "100",
      evlu_pfls_rt: "1.0",
    },
    expected: { stockCode: "FIRST" },
  },
  {
    name: "pdno > stk_cd > stockCode (acnt_pdno 없을 때)",
    input: {
      pdno: "SECOND",
      stk_cd: "THIRD",
      stockCode: "FOURTH",
      hldg_qty: "1",
      pchs_avg_pric: "100",
      prpr: "100",
      evlu_pfls_amt: "100",
      evlu_pfls_rt: "1.0",
    },
    expected: { stockCode: "SECOND" },
  },
  {
    name: "averagePrice 폴백: pchs_avg_pric 빈문자 / avg_pric '0' → pur_pric 사용",
    input: {
      stk_cd: "123456",
      hldg_qty: "3",
      pchs_avg_pric: "",
      avg_pric: "0",
      pur_pric: "8500",
      prpr: "9000",
      evlu_pfls_amt: "0",
      evltv_prft: "2500",
      evlu_pfls_rt: "0",
      prft_rt: "5.5",
    },
    expected: {
      stockCode: "123456",
      quantity: 3,
      averagePrice: "8500",
      currentPrice: "9000",
      profitLoss: "2500",
      profitLossRate: "5.5",
    },
  },
  {
    name: "profitLoss 폴백: evlu_pfls_amt '0' → evlu_pfls 빈문자 → evltv_prft 사용",
    input: {
      stk_cd: "111111",
      hldg_qty: "2",
      pur_pric: "5000",
      cur_prc: "5500",
      evlu_pfls_amt: "0",
      evlu_pfls: "",
      evltv_prft: "1000",
      prft_rt: "10.0",
    },
    expected: { profitLoss: "1000" },
  },
  {
    name: "모든 가격 필드 없거나 0 → '0' 반환",
    input: { stockCode: "999999", quantity: 0 },
    expected: {
      stockCode: "999999",
      quantity: 0,
      averagePrice: "0",
      currentPrice: "0",
      profitLoss: "0",
      profitLossRate: "0",
    },
  },
  {
    name: "quantity 우선순위: hldg_qty > rmnd_qty > quantity",
    input: {
      stockCode: "QQTEST",
      hldg_qty: "7",
      rmnd_qty: "3",
      quantity: 1,
      pchs_avg_pric: "100",
      prpr: "100",
      evlu_pfls_amt: "100",
      evlu_pfls_rt: "1.0",
    },
    expected: { quantity: 7 },
  },
  {
    name: "quantity: hldg_qty 없고 rmnd_qty 있을 때",
    input: {
      stockCode: "QQTEST2",
      rmnd_qty: "4",
      pchs_avg_pric: "100",
      prpr: "100",
      evlu_pfls_amt: "100",
      evlu_pfls_rt: "1.0",
    },
    expected: { quantity: 4 },
  },
  {
    name: "cleanStr: 공백만 있는 문자열도 빈 문자열로 처리 → 폴백",
    input: {
      stk_cd: "SPTEST",
      hldg_qty: "1",
      pchs_avg_pric: "   ",
      pur_pric: "3000",
      prpr: "3100",
      evlu_pfls_amt: "100",
      evlu_pfls_rt: "3.33",
    },
    expected: { averagePrice: "3000" },
  },
];

// ── 실행 ──────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = parseHoldingItem(test.input);
  const errors = [];
  for (const [key, expectedVal] of Object.entries(test.expected)) {
    if (result[key] !== expectedVal) {
      errors.push(`    ${key}: 기대값=${JSON.stringify(expectedVal)}, 실제값=${JSON.stringify(result[key])}`);
    }
  }
  if (errors.length === 0) {
    console.log(`✅ PASS  ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL  ${test.name}`);
    errors.forEach((e) => console.log(e));
    failed++;
  }
}

console.log(`\n── 결과: ${passed} 통과 / ${failed} 실패 ──`);
if (failed > 0) {
  console.error(
    "\n⚠️  실패한 테스트가 있습니다. server/utils/balance-parser.ts 의 필드 매핑 로직을 확인하세요."
  );
  process.exit(1);
}
