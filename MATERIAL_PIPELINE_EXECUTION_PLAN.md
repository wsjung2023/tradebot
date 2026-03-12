# MATERIAL_PIPELINE_EXECUTION_PLAN.md

목표: 학습 고도화를 위해 뉴스/재무/공시/이슈 데이터를 수집-저장-분석-학습으로 연결한다.

## 1) 수정 파일 매트릭스 (소스 기준)

| 단계 | 파일 | 수정 내용 |
|---|---|---|
| P1 | `shared/schema.ts` | `company_filings`, `news_articles`, `analysis_material_snapshots` 테이블/insert schema/type 추가 |
| P1 | `server/storage/interface.ts` | 수집 데이터 CRUD/upsert 및 material snapshot 조회 계약 추가 |
| P1 | `server/storage/postgres-core.storage.ts` | 위 인터페이스 구현 및 upsert 로직 추가 |
| P2 | `server/services/dart.service.ts` | OpenDART 공시 조회 서비스 신규 (env 없으면 안전 fallback) |
| P2 | `server/routes/ai.routes.ts` | `POST /api/stocks/:stockCode/sync-materials`, `GET /api/stocks/:stockCode/materials` 추가 및 integrated-analysis 응답 확장 |
| P3 | `server/services/learning.service.ts` | optimizeModel 결과를 `learning_records`에 저장하도록 연결 |

## 2) 수집 알고리즘

1. 입력: `stockCode`, `stockName`, (선택) `corpCode`
2. 병렬 수집: 뉴스 + 재무비율 + 차트 + DART 공시 + market issues
3. 저장: 뉴스/공시 upsert 후 material snapshot 생성
4. 응답: 저장된 snapshot id, 개수, 원본 요약

## 3) UI/UX 연동 포인트

- 기존 `IntegratedAnalysis`에서 `materialSnapshotId`, `filings`, `marketIssues`를 표시할 수 있도록 API 응답 확장.
- 현재 단계는 백엔드 우선(데이터 파이프라인 안정화), UI 세부 시각화는 다음 단계.

## 4) 운영/배포 체크

1. `npm run db:push` (DB 스키마 반영)
2. `npm run check`
3. `npm run build`
4. 서버 재기동 후
   - `POST /api/stocks/:stockCode/sync-materials`
   - `GET /api/stocks/:stockCode/materials`
   - `POST /api/ai/integrated-analysis`
   확인
