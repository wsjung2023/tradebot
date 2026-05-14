# README.md — client/src/components/condition-formulas/ 폴더 가이드

condition-formulas.tsx 페이지를 역할별로 분리한 컴포넌트들.

## 파일 구조

| 파일 | 역할 |
|------|------|
| ConditionFormDialog.tsx | 조건식 생성/수정 다이얼로그 |
| ConditionList.tsx | 조건식 목록 카드 (실행/수정/삭제) |

## 규칙
- state/mutation은 condition-formulas.tsx에서 관리, props로 전달
- 새 섹션 추가 → 새 파일로 분리
