# README.md — client/src/components/auto-trading/ 폴더 가이드

auto-trading.tsx 페이지를 역할별로 분리한 컴포넌트들.

## 파일 구조

| 파일 | 역할 |
|------|------|
| AutoTradingModelDialog.tsx | AI 모델 생성 다이얼로그 |
| AutoTradingModelList.tsx | 모델 목록 (활성화/삭제/성과) |
| AutoTradingRecommendations.tsx | 매매 신호 추천 카드 |

## 규칙
- state/mutation은 auto-trading.tsx에서 관리, props로 전달
- 새 섹션 추가 → 새 파일로 분리
