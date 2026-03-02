# README.md — client/src/components/settings/ 폴더 가이드

settings.tsx 페이지를 카드 단위로 분리한 컴포넌트들.

## 파일 구조

| 파일 | 역할 |
|------|------|
| SettingsKiwoom.tsx | 키움증권 APP KEY / SECRET 입력 카드 |
| SettingsTrading.tsx | 모의투자 / 실전투자 모드 전환 카드 |
| SettingsAI.tsx | AI 분석 모델 선택 카드 (GPT 모델) |
| SettingsNotifications.tsx | 가격 알림 / 거래 알림 on/off 카드 |
| SettingsStockAlerts.tsx | 종목별 알림 생성 및 목록 카드 |

## 사용법

```tsx
import { SettingsKiwoom } from "@/components/settings/SettingsKiwoom";
```

## 규칙

- 각 카드는 독립적 — 다른 카드의 state 직접 접근 금지
- 모든 상태/핸들러는 settings.tsx에서 props로 전달
- 새 설정 섹션 추가 → 새 파일로 분리
