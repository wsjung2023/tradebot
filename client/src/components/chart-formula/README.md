# README.md — client/src/components/chart-formula/ 폴더 가이드

chart-formula-editor.tsx 페이지를 역할별로 분리한 컴포넌트들.

## 파일 구조

| 파일 | 역할 |
|------|------|
| ChartFormulaFormDialog.tsx | 수식 생성/수정 다이얼로그 (기본설정 + 수식&스타일 탭) |
| ChartFormulaList.tsx | 수식 목록 카드 + 평가(백테스트) 다이얼로그 |

## 규칙
- state/mutation은 chart-formula-editor.tsx에서 관리, props로 전달
- 새 섹션 추가 → 새 파일로 분리
