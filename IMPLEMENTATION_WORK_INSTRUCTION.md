# 구현 작업지시서 (소스코드 기반)

목표:
1) **HTS 관심종목 동기화(서버 동기화/저장/재동기화)**
2) **차트 시그널 시각화(키움 유사한 오버레이 마커)**

## A. HTS 관심종목 동기화 구조

### A-1. `shared/schema.ts`
- `watchlist_sync_snapshots` 테이블 추가
  - `userId`, `stockCode`, `stockName`, `source`, `syncedPrice`, `rawPayload`, `syncedAt`, `updatedAt`
- insert schema/type export 추가

### A-2. `server/storage/interface.ts`
- 아래 메서드 추가
  - `getWatchlistSyncSnapshots(userId)`
  - `upsertWatchlistSyncSnapshot(snapshot)`

### A-3. `server/storage/postgres-core.storage.ts`
- 실제 구현 추가
  - 유저별 스냅샷 조회
  - `(userId, stockCode)` 기준 upsert(있으면 update, 없으면 insert)

### A-4. `server/routes/watchlist.routes.ts`
- `POST /api/watchlist/sync/kiwoom`
  - 서버가 Kiwoom에서 현재 watchlist 종목 시세를 조회
  - 조회 결과를 DB 스냅샷으로 저장/갱신
  - 동기화 카운트/시각/아이템 반환
- `GET /api/watchlist/sync-snapshots`
  - 누적된 최신 동기화 스냅샷 조회

## B. 차트 시그널 오버레이

### B-1. `server/routes/trading.routes.ts`
- `GET /api/stocks/:stockCode/chart-signals`
  - 사용자 조건식 결과(`condition_results`)를 종목코드 기준 필터링
  - 차트 오버레이용 데이터로 정규화
  - `signal`(buy/hold), `matchScore`, `currentPrice`, `createdAt` 포함

### B-2. `client/src/pages/trading.tsx`
- 차트 시그널 쿼리 추가
  - `['/api/stocks', stockCode, 'chart-signals']`
- `createdAt -> chartDate(YYYYMMDD)` 매핑
- Recharts `ReferenceDot` 오버레이 렌더링
  - 매수 시그널: 녹색
  - 관찰 시그널: 주황색
- 차트 설명 문구 보강

## C. 운영/안정성 기준
- 동기화 API는 **읽기 실패 시 전체 서버 중단 금지**
- 동기화는 **1회 조회 후 저장**, 이후 재호출 시 **업데이트 가능**
- 차트 오버레이는 데이터가 없으면 기본 차트만 표시

## D. 검증 체크리스트
1. `npm run check`
2. `npm run build`
3. watchlist sync API 수동 호출 확인
4. trading 차트 화면에서 오버레이 마커 표시 확인
