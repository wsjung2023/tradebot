# README.md — client/src/components/ai-analysis/ 폴더 가이드

ai-analysis.tsx 페이지를 탭 단위로 분리한 컴포넌트들.

## 파일 구조

| 파일 | 역할 |
|------|------|
| AIStockAnalysis.tsx | 종목 AI 분석 탭 (종목 입력 → GPT 분석 결과) |
| AIPortfolioAnalysis.tsx | 포트폴리오 AI 분석 탭 (계좌 선택 → 전략/추천) |

## 규칙

- state/mutation은 ai-analysis.tsx에서 관리, props로 전달
- 새 AI 분석 탭 추가 → 새 파일로 분리
