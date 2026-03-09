# client/src/components/

## 역할
재사용 가능한 UI 컴포넌트. 특정 페이지에 종속되지 않아야 합니다.

## 구조
| 폴더/파일 | 역할 |
|-----------|------|
| `ui/` | Shadcn UI 기본 컴포넌트 (수정 금지) |
| `ai-analysis/` | AI 분석 관련 컴포넌트 |
| `auto-trading/` | 자동매매 관련 컴포넌트 |
| `chart-formula/` | 차트 수식 편집기 컴포넌트 |
| `condition-formulas/` | 조건식 관련 컴포넌트 |
| `settings/` | 설정 관련 컴포넌트 |
| `app-sidebar.tsx` | 전역 사이드바 내비게이션 |
| `rainbow-chart.tsx` | 레인보우 차트(10선) 시각화 컴포넌트 |

## 규칙
- `ui/` 폴더 파일은 절대 수정 금지 (Shadcn 원본)
- 비즈니스 로직은 hooks로 분리
