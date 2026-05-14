# 🤖 Replit Agent 작업 지시서 — TradeBot 버그 수정 (TASK-01~07)

> **기준 코드**: tradebot-main  
> **작성일**: 2026-03-11  
> **목적**: 키움 REST/WebSocket API를 올바르게 연동하여 7가지 핵심 버그 수정  
> **주의**: 각 TASK는 순서대로 실행할 것. 의존성 있음.

---

## ⚙️ 사전 준비 (가장 먼저 실행)

```bash
cd /home/runner/tradebot-main
npm install ws
npm install --save-dev @types/ws
```

---

## TASK-01: kiwoom.condition.ts 전면 재작성 (WebSocket 기반)

**파일**: `server/services/kiwoom/kiwoom.condition.ts`  
**이유**: 조건검색(ka10171~ka10174)은 WebSocket 전용. 현재 코드는 "미지원"으로 throw만 함.

### 수정 전 (현재 코드 전체)
```typescript
// kiwoom.condition.ts — 키움증권 조건검색 (REST API 미지원 안내)
import { KiwoomBase, type ConditionListResponse, type ConditionSearchResultsResponse } from "./kiwoom.base";

const NOT_SUPPORTED = "키움 REST API는 HTS 조건검색을 지원하지 않습니다. " +
  "커스텀 조건식(조건검색 메뉴)을 사용하세요.";

export class KiwoomCondition extends KiwoomBase {
  async getConditionList(): Promise<ConditionListResponse> {
    throw new Error(NOT_SUPPORTED);
  }
  async getConditionSearchResults(
    _conditionName: string,
    _conditionIndex: number
  ): Promise<ConditionSearchResultsResponse> {
    throw new Error(NOT_SUPPORTED);
  }
  async startConditionMonitoring(
    _conditionName: string,
    _conditionIndex: number
  ): Promise<any> {
    throw new Error(NOT_SUPPORTED);
  }
}
```

### 수정 후 (파일 전체 교체)
```typescript
// kiwoom.condition.ts — 키움증권 조건검색 (WebSocket: ka10171~ka10174)
// 키움 REST API 공식 문서 기준: 조건검색은 WebSocket 전용
// wss://api.kiwoom.com:10000/api/dostk/websocket (실전)
// wss://mockapi.kiwoom.com:10000/api/dostk/websocket (모의)
import WebSocket from 'ws';
import { KiwoomBase, KIWOOM_REAL_BASE, KIWOOM_MOCK_BASE } from './kiwoom.base';

// ──────────── 타입 정의 ────────────
export interface ConditionListItem {
  seq: string;   // 조건식 번호
  name: string;  // 조건식 이름
}

export interface ConditionSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  changeSign: string;   // 2=상승, 5=하락, 3=보합
  change: string;
  changeRate: string;
  volume: string;
  open: string;
  high: string;
  low: string;
}

// ──────────── 클래스 ────────────
export class KiwoomCondition extends KiwoomBase {

  private get wsBaseUrl(): string {
    return this.baseURL === KIWOOM_REAL_BASE
      ? 'wss://api.kiwoom.com:10000'
      : 'wss://mockapi.kiwoom.com:10000';
  }

  /** WebSocket 1회성 요청 헬퍼 */
  private wsRequest(apiId: string, payload: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.accessToken) {
        reject(new Error('Kiwoom 토큰이 없습니다. ensureValidToken()을 먼저 호출하세요.'));
        return;
      }

      const ws = new WebSocket(
        `${this.wsBaseUrl}/api/dostk/websocket`,
        {
          headers: {
            'api-id': apiId,
            'authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('조건검색 WebSocket 타임아웃 (15초)'));
      }, 15_000);

      ws.on('open', () => {
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          // 실시간 push(REAL)가 아닌 조회 응답이 오면 반환
          if (msg.trnm !== 'REAL') {
            clearTimeout(timer);
            ws.close();
            if (msg.return_code !== 0 && msg.return_code !== '0') {
              reject(new Error(`조건검색 오류 ${msg.return_code}: ${msg.return_msg}`));
            } else {
              resolve(msg);
            }
          }
        } catch (e) {
          clearTimeout(timer);
          ws.close();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // ──────────── ka10171: 조건검색 목록 조회 ────────────
  async getConditionList(): Promise<ConditionListItem[]> {
    if (this.stubMode) {
      // stub 모드: 더미 조건식 반환
      return [
        { seq: '0', name: '[테스트] 골든크로스' },
        { seq: '1', name: '[테스트] RSI 과매도' },
      ];
    }
    await this.ensureValidToken();
    const res = await this.wsRequest('ka10171', { trnm: 'CNSRLST' });
    const rows: any[] = res.data || res.output || [];
    return rows.map((row) => ({
      seq:  String(Array.isArray(row) ? row[0] : (row.seq  ?? row[0] ?? '')),
      name: String(Array.isArray(row) ? row[1] : (row.name ?? row[1] ?? '')),
    }));
  }

  // ──────────── ka10172: 조건검색 일반 실행 ────────────
  async getConditionSearchResults(
    seq: string,
    _unused?: number   // formula.routes.ts 호환용 (conditionIndex 무시)
  ): Promise<ConditionSearchResult[]> {
    if (this.stubMode) {
      return [
        {
          stockCode: '005930', stockName: '삼성전자',
          currentPrice: '75000', changeSign: '2', change: '500',
          changeRate: '0.67', volume: '12345678',
          open: '74500', high: '75500', low: '74200',
        },
      ];
    }
    await this.ensureValidToken();
    const res = await this.wsRequest('ka10172', {
      trnm: 'CNSRREQ',
      seq: String(seq),
      search_type: '0',  // 0=기본
      stex_tp: 'K',       // K=KRX
      cont_yn: 'N',
      next_key: '',
    });

    const rows: any[] = res.data || res.output1 || res.output || [];
    return rows.map((item: any) => ({
      stockCode:   String(item['9001'] ?? item.stck_cd ?? '').replace(/^A/, ''),
      stockName:   String(item['302']  ?? item.stck_nm ?? ''),
      currentPrice: String(item['10']  ?? item.stck_prpr ?? '0'),
      changeSign:  String(item['25']   ?? '3'),
      change:      String(item['11']   ?? '0'),
      changeRate:  String(item['12']   ?? '0'),
      volume:      String(item['13']   ?? '0'),
      open:        String(item['16']   ?? '0'),
      high:        String(item['17']   ?? '0'),
      low:         String(item['18']   ?? '0'),
    }));
  }

  // ──────────── ka10174: 실시간 조건검색 해제 ────────────
  async stopConditionMonitoring(seq: string, _unused?: number): Promise<void> {
    if (this.stubMode) return;
    await this.ensureValidToken();
    await this.wsRequest('ka10174', { trnm: 'CNSRCLR', seq: String(seq) });
  }

  /** formula.routes.ts 호환 alias */
  async startConditionMonitoring(
    conditionName: string,
    conditionIndex: number
  ): Promise<ConditionSearchResult[]> {
    return this.getConditionSearchResults(String(conditionIndex));
  }
}
```

---

## TASK-02: kiwoom.market.ts — 3개 메서드 추가 + searchStock 개선

**파일**: `server/services/kiwoom/kiwoom.market.ts`  
**이유**: 관심종목 일괄 시세(ka10095), 종목코드→명(ka10100), 전종목목록(ka10099), 이름 검색 미구현

### 수정 사항: 파일 맨 아래 `}` (클래스 닫기) 바로 앞에 추가

#### 추가 타입 정의 (파일 상단 import 아래에 삽입)
```typescript
// ──── watchlist / search 타입 ────
export interface WatchlistStockInfo {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  change: string;
  changeSign: string;
  changeRate: string;
  volume: string;
  high: string;
  low: string;
  open: string;
  sellBid: string;
  buyBid: string;
}

export interface StockInfoResult {
  name: string;
  marketName: string;
  state: string;
}

export interface StockSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  marketName: string;
}
```

#### 기존 `searchStock` 메서드 전체를 아래로 교체

**수정 전** (현재 searchStock):
```typescript
  // ───────────── 종목 기본정보 (검색) ─────────────
  async searchStock(keyword: string): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const resp = await this.api.post<any>(
        STKINFO,
        { stk_cd: keyword, dt: "", qry_tp: "1" },
        { headers: { "api-id": "ka10001" } }
      );
      return resp.data;
    } catch (error) {
      console.error("종목검색 실패:", error);
      throw error;
    }
  }
```

**수정 후** (searchStock + 3개 신규 메서드 — getHighVolumeStocks 바로 위에 삽입):
```typescript
  // ───────────── 전종목 캐시 (ka10099 기반 이름 검색용) ─────────────
  private stockCache: Array<{ code: string; name: string }> = [];
  private cacheBuiltAt: Date | null = null;

  private async ensureStockCache(): Promise<void> {
    const now = new Date();
    if (
      this.stockCache.length > 0 &&
      this.cacheBuiltAt &&
      now.getTime() - this.cacheBuiltAt.getTime() < 24 * 60 * 60 * 1000
    ) return; // 24시간 캐시 유효

    const [kospi, kosdaq] = await Promise.all([
      this.getStockList('0'),
      this.getStockList('10'),
    ]);
    this.stockCache = [...kospi, ...kosdaq];
    this.cacheBuiltAt = now;
    console.log(`[KiwoomMarket] 종목 캐시 완성: ${this.stockCache.length}개`);
  }

  // ───────────── ka10095: 관심종목 일괄 시세 조회 ─────────────
  async getWatchlistInfo(stockCodes: string[]): Promise<WatchlistStockInfo[]> {
    if (this.stubMode || stockCodes.length === 0) return [];
    await this.ensureValidToken();

    const resp = await this.api.post<any>(
      STKINFO,
      { stk_cd: stockCodes.join('|') },
      { headers: { 'api-id': 'ka10095' } }
    );
    const list: any[] = resp.data?.atn_stk_infr ?? resp.data?.list ?? [];
    return list.map((item: any) => ({
      stockCode:    String(item.stk_cd  ?? ''),
      stockName:    String(item.stk_nm  ?? ''),
      currentPrice: String(item.cur_prc ?? '0'),
      change:       String(item.pred_pre ?? '0'),
      changeSign:   String(item.pred_pre_sig ?? '3'),
      changeRate:   String(item.flu_rt  ?? '0'),
      volume:       String(item.trde_qty ?? '0'),
      high:         String(item.high_pric ?? '0'),
      low:          String(item.low_pric  ?? '0'),
      open:         String(item.open_pric ?? '0'),
      sellBid:      String(item.sel_bid   ?? '0'),
      buyBid:       String(item.buy_bid   ?? '0'),
    }));
  }

  // ───────────── ka10100: 종목코드 → 종목명·시장·상태 조회 ─────────────
  async getStockInfo(stockCode: string): Promise<StockInfoResult> {
    if (this.stubMode) {
      return { name: stockCode, marketName: 'KOSPI', state: '정상' };
    }
    await this.ensureValidToken();

    const resp = await this.api.post<any>(
      STKINFO,
      { stk_cd: stockCode },
      { headers: { 'api-id': 'ka10100' } }
    );
    const d = resp.data ?? {};
    return {
      name:       String(d.name       ?? d.stk_nm ?? stockCode),
      marketName: String(d.marketName ?? d.mrkt_nm ?? ''),
      state:      String(d.state      ?? d.stk_stat ?? ''),
    };
  }

  // ───────────── ka10099: 시장별 전종목 리스트 ─────────────
  async getStockList(marketType: string = '0'): Promise<Array<{ code: string; name: string }>> {
    if (this.stubMode) return [];
    await this.ensureValidToken();

    const resp = await this.api.post<any>(
      STKINFO,
      { mrkt_tp: marketType },
      { headers: { 'api-id': 'ka10099' } }
    );
    const list: any[] = resp.data?.list ?? resp.data?.output ?? [];
    return list.map((item: any) => ({
      code: String(item.stk_cd ?? item.code ?? ''),
      name: String(item.stk_nm ?? item.name ?? ''),
    }));
  }

  // ───────────── 종목 검색 (코드 or 이름 LIKE) ─────────────
  async searchStock(query: string): Promise<StockSearchResult[]> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    const q = (query ?? '').trim();
    if (!q) return [];

    await this.ensureValidToken();

    // 6자리 숫자 → ka10001 정확 조회
    if (/^\d{6}$/.test(q)) {
      const resp = await this.api.post<any>(
        STKINFO,
        { stk_cd: q },
        { headers: { 'api-id': 'ka10001' } }
      );
      const d = resp.data ?? {};
      if (!d.stk_nm && !d.name) return [];
      return [{
        stockCode:    String(d.stk_cd   ?? q),
        stockName:    String(d.stk_nm   ?? d.name ?? q),
        currentPrice: String(d.cur_prc  ?? '0'),
        marketName:   String(d.mrkt_nm  ?? ''),
      }];
    }

    // 이름 LIKE → 캐시 검색
    try {
      await this.ensureStockCache();
    } catch (err) {
      console.warn('[KiwoomMarket] 캐시 빌드 실패, 빈 배열 반환:', err);
      return [];
    }
    return this.stockCache
      .filter(s => s.name.includes(q) || s.code.includes(q))
      .slice(0, 20)
      .map(s => ({
        stockCode: s.code, stockName: s.name,
        currentPrice: '0', marketName: '',
      }));
  }
```

---

## TASK-03: kiwoom/index.ts — 신규 메서드 외부 노출

**파일**: `server/services/kiwoom/index.ts`  
**이유**: KiwoomService가 KiwoomMarket을 감싸는데, 신규 3개 메서드가 외부에 노출되지 않음

### 수정 사항: KiwoomService 클래스 내부에 3개 메서드 추가

KiwoomService 내부에서 `market`을 사용하는 위치 찾아 아래 메서드 추가:

```typescript
  // ── 관심종목 일괄 시세 (ka10095) ──
  async getWatchlistInfo(stockCodes: string[]) {
    return this.market.getWatchlistInfo(stockCodes);
  }

  // ── 종목코드→종목명 (ka10100) ──
  async getStockInfo(stockCode: string) {
    return this.market.getStockInfo(stockCode);
  }

  // ── 전종목 리스트 (ka10099) ──
  async getStockList(marketType?: string) {
    return this.market.getStockList(marketType);
  }
```

---

## TASK-04: trading.routes.ts — 검색 파라미터 통일 + /info 엔드포인트 추가

**파일**: `server/routes/trading.routes.ts`  
**이유**: 프론트가 `?query=` 파라미터를 쓰는데 서버는 `?q=` 만 처리

### 수정 전
```typescript
  // 종목 검색
  app.get("/api/stocks/search", isAuthenticated, async (req, res) => {
    try {
      const keyword = req.query.q as string;
      const results = await kiwoomService.searchStock(keyword);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

### 수정 후
```typescript
  // 종목 검색 (?query= 또는 ?q= 모두 지원)
  app.get("/api/stocks/search", isAuthenticated, async (req, res) => {
    try {
      const keyword = (req.query.query ?? req.query.q ?? "") as string;
      if (!keyword.trim()) return res.json([]);
      const results = await kiwoomService.searchStock(keyword);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 종목 기본정보 조회 (코드→이름, watchlist 자동완성용)
  app.get("/api/stocks/:stockCode/info", isAuthenticated, async (req, res) => {
    try {
      const info = await kiwoomService.getStockInfo(req.params.stockCode);
      res.json(info);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });
```

> ⚠️ **주의**: `/api/stocks/search` 라우트는 반드시 `/api/stocks/:stockCode/...` 라우트들보다 **앞에** 위치해야 합니다. 현재 코드에서 순서를 확인하세요.

---

## TASK-05: watchlist.routes.ts — Kiwoom 실시간 시세 연동 + 자동 종목명

**파일**: `server/routes/watchlist.routes.ts`  
**이유**: 관심종목 조회 시 DB 정보만 반환, Kiwoom 실시간 시세 미반영

### 수정 전: 파일 상단 import 블록
```typescript
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertWatchlistSchema, insertAlertSchema, insertWatchlistSignalSchema } from "@shared/schema";
import { encrypt } from "../utils/crypto";
import { z } from "zod";
```

### 수정 후: import에 getKiwoomService 추가
```typescript
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertWatchlistSchema, insertAlertSchema, insertWatchlistSignalSchema } from "@shared/schema";
import { encrypt } from "../utils/crypto";
import { z } from "zod";
import { getKiwoomService } from "../services/kiwoom";
```

---

### 수정 전: GET /api/watchlist 핸들러
```typescript
  // 관심종목 목록
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.getWatchlist(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

### 수정 후: Kiwoom 시세 병합
```typescript
  // 관심종목 목록 (Kiwoom 실시간 시세 병합)
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const list = await storage.getWatchlist(user!.id);
      if (list.length === 0) return res.json([]);

      // Kiwoom 시세 병합 시도 (실패 시 DB 데이터만 반환)
      try {
        const kiwoom = getKiwoomService();
        const codes = list.map((w) => w.stockCode);
        const priceList = await kiwoom.getWatchlistInfo(codes);
        const priceMap: Record<string, any> = {};
        for (const p of priceList) priceMap[p.stockCode] = p;

        return res.json(list.map((w) => ({
          ...w,
          kiwoomData: priceMap[w.stockCode] ?? null,
        })));
      } catch (kiwoomErr) {
        console.warn("[Watchlist] Kiwoom 시세 조회 실패, DB 데이터만 반환:", kiwoomErr);
        return res.json(list);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

---

### 수정 전: POST /api/watchlist 핸들러
```typescript
  // 관심종목 추가
  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const data = insertWatchlistSchema.parse({ ...req.body, userId: user!.id });
      res.json(await storage.createWatchlistItem(data));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
```

### 수정 후: 종목명 자동 조회 추가
```typescript
  // 관심종목 추가 (종목명 없으면 ka10100으로 자동 조회)
  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      let { stockCode, stockName, ...rest } = req.body;

      // 종목명이 없거나 코드와 동일한 경우 Kiwoom에서 자동 조회
      if (stockCode && (!stockName || stockName === stockCode)) {
        try {
          const kiwoom = getKiwoomService();
          const info = await kiwoom.getStockInfo(stockCode);
          if (info.name) stockName = info.name;
        } catch {
          stockName = stockName || stockCode;
        }
      }

      const data = insertWatchlistSchema.parse({
        ...rest,
        stockCode,
        stockName: stockName || stockCode,
        userId: user!.id,
      });
      res.json(await storage.createWatchlistItem(data));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
```

---

## TASK-06: formula.routes.ts — 조건검색 실행 수정

**파일**: `server/routes/formula.routes.ts`  
**이유**: `POST /api/conditions/:id/run`이 조건식 이름을 seq로 전달 — 실제로는 seq 번호가 필요

### 수정 전
```typescript
      const searchResponse = await kiwoomService.getConditionSearchResults(condition.conditionName, 0);
      const results = searchResponse?.output1 || searchResponse?.output || [];
```

### 수정 후
```typescript
      // conditionFormula의 seq 필드 또는 id를 조건검색 번호로 사용
      const conditionSeq = (condition as any).kiwoomSeq ?? String(condition.id);
      const rawResults = await kiwoomService.getConditionSearchResults(conditionSeq, 0);
      // getConditionSearchResults는 이제 ConditionSearchResult[] 직접 반환
      const results = Array.isArray(rawResults) ? rawResults : [];
```

> **추가 안내**: `condition.conditionName` 기반으로 Kiwoom 조건식을 매핑하려면  
> `GET /api/kiwoom/conditions` 엔드포인트를 호출해 seq를 먼저 확인해야 합니다.  
> 아래 신규 엔드포인트를 `formula.routes.ts` 또는 `autotrading.routes.ts`에 추가하세요:

```typescript
  // GET /api/kiwoom/conditions — 키움 HTS 조건식 목록 (ka10171)
  app.get("/api/kiwoom/conditions", isAuthenticated, async (req, res) => {
    try {
      const conditions = await kiwoomService.getConditionList();
      res.json(conditions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/kiwoom/conditions/:seq/run — 키움 조건검색 실행 (ka10172)
  app.post("/api/kiwoom/conditions/:seq/run", isAuthenticated, async (req, res) => {
    try {
      const results = await kiwoomService.getConditionSearchResults(req.params.seq, 0);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

---

## TASK-07: ai.routes.ts — 사용자 설정 AI 모델 적용

**파일**: `server/routes/ai.routes.ts`  
**이유**: `analyzeStock()` 호출 시 사용자가 설정한 AI 모델(`settings.aiModel`)을 전달하지 않음

### 수정 전
```typescript
  // 종목 AI 분석
  app.post("/api/ai/analyze-stock", isAuthenticated, async (req, res) => {
    try {
      const { stockCode, stockName, currentPrice } = req.body;
      const analysis = await aiService.analyzeStock({ stockCode, stockName, currentPrice });
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

### 수정 후
```typescript
  // 종목 AI 분석 (사용자 설정 모델 적용)
  app.post("/api/ai/analyze-stock", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { stockCode, stockName, currentPrice } = req.body;
      // 사용자 설정 모델 조회 (없으면 gpt-5.1 기본값)
      const settings = await storage.getUserSettings(user!.id);
      const model = settings?.aiModel || "gpt-5.1";
      const analysis = await aiService.analyzeStock({ stockCode, stockName, currentPrice }, model);
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
```

> **참고**: `aiService.analyzeStock(request, model)` 두 번째 파라미터는 이미 `ai.service.ts`에 정의되어 있습니다 (`model: string = 'gpt-5.1'`). 추가 수정 불필요.

---

## TASK-08: storage interface + 구현 — getAllActiveAlerts 추가

**파일 1**: `server/storage/interface.ts`  
**파일 2**: `server/storage/postgres-core.storage.ts`  
**이유**: 가격 알림 worker에서 모든 활성 알림을 조회해야 하는데 해당 메서드 없음

### 파일 1 수정: interface.ts

**수정 전** (alerts 섹션):
```typescript
  // 알림
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
```

**수정 후**:
```typescript
  // 알림
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
  getAllActiveAlerts(): Promise<Alert[]>;  // 전체 사용자 미발동 활성 알림
```

### 파일 2 수정: postgres-core.storage.ts

**`deleteAlert` 메서드 바로 뒤에 추가**:
```typescript
  async getAllActiveAlerts(): Promise<Alert[]> {
    return db
      .select()
      .from(schema.alerts)
      .where(
        and(
          eq(schema.alerts.isActive, true),
          eq(schema.alerts.isTriggered, false)
        )
      );
  }
```

> **주의**: `and`, `eq` 가 이미 상단에 import되어 있는지 확인. 없으면 `import { and, eq } from 'drizzle-orm';` 추가.

---

## TASK-09: auto-trading-worker.ts — 가격 알림 체크 로직 추가

**파일**: `server/auto-trading-worker.ts`  
**이유**: 알림 레코드가 있어도 주기적 가격 비교 로직이 없어서 알림이 절대 발동되지 않음

### 수정 사항: `executeTradingCycle()` 메서드 내부 마지막 줄 앞에 추가

**`executeTradingCycle` 찾아서 끝부분에 삽입**:
```typescript
    // 가격 알림 체크 (매 사이클마다 실행)
    try {
      await this.checkPriceAlerts();
    } catch (alertErr) {
      console.error("[AutoTrading] 가격 알림 체크 오류:", alertErr);
    }
```

**클래스 내부에 신규 메서드 추가 (checkPriceAlerts)**:
```typescript
  private async checkPriceAlerts(): Promise<void> {
    const alerts = await storage.getAllActiveAlerts();
    if (alerts.length === 0) return;

    // 중복 제거된 종목코드로 일괄 시세 조회 (ka10095)
    const codes = [...new Set(alerts.map((a) => a.stockCode))];
    
    let priceMap: Record<string, number> = {};
    try {
      const kiwoom = getKiwoomService();
      const prices = await kiwoom.getWatchlistInfo(codes);
      for (const p of prices) {
        const num = parseFloat(p.currentPrice.replace(/[^0-9.-]/g, ""));
        if (!isNaN(num)) priceMap[p.stockCode] = num;
      }
    } catch (err) {
      console.warn("[Alert] 시세 조회 실패, 알림 체크 스킵:", err);
      return;
    }

    for (const alert of alerts) {
      const price = priceMap[alert.stockCode];
      if (price === undefined) continue;

      const target = parseFloat(String(alert.targetValue ?? "0"));
      let triggered = false;

      if (alert.alertType === "price_above" && price >= target) triggered = true;
      if (alert.alertType === "price_below" && price <= target) triggered = true;

      if (triggered) {
        await storage.updateAlert(alert.id, {
          isTriggered: true,
          triggeredAt: new Date(),
        });
        console.log(
          `[Alert] 🔔 발동! ${alert.stockCode} | 현재가: ${price} | ` +
          `조건: ${alert.alertType} ${target} | 사용자: ${alert.userId}`
        );
      }
    }
  }
```

> **import 확인**: `getKiwoomService`가 이미 auto-trading-worker.ts에 import되어 있는지 확인. 없으면 상단에 추가:
> ```typescript
> import { getKiwoomService } from "./services/kiwoom";
> ```

---

## 🧪 수정 완료 후 검증 체크리스트

```bash
# 1. TypeScript 빌드 오류 확인
npx tsc --noEmit

# 2. 서버 시작 확인
npm run dev
```

API 테스트 (서버 실행 후):
```
GET  /api/kiwoom/conditions            → 조건식 목록 반환
POST /api/kiwoom/conditions/0/run      → 종목 목록 반환
GET  /api/stocks/search?query=삼성      → 종목명 검색 결과
GET  /api/stocks/search?query=005930   → 코드 검색
GET  /api/stocks/005930/info           → 종목 기본정보
GET  /api/watchlist                    → kiwoomData 필드 포함 반환
POST /api/watchlist (stockName 없이)   → 자동 종목명 채워짐
POST /api/ai/analyze-stock             → settings.aiModel 모델 사용
```

---

## 📋 수정 파일 요약

| 순서 | 파일 | 작업 | 난이도 |
|------|------|------|--------|
| 1 | `server/services/kiwoom/kiwoom.condition.ts` | 전체 재작성 (WebSocket) | ⭐⭐⭐ |
| 2 | `server/services/kiwoom/kiwoom.market.ts` | 메서드 4개 추가/수정 | ⭐⭐ |
| 3 | `server/services/kiwoom/index.ts` | 위임 메서드 3개 추가 | ⭐ |
| 4 | `server/routes/trading.routes.ts` | 파라미터 수정 + 엔드포인트 추가 | ⭐ |
| 5 | `server/routes/watchlist.routes.ts` | import 추가 + 핸들러 2개 수정 | ⭐⭐ |
| 6 | `server/routes/formula.routes.ts` | 조건검색 실행 수정 + 2개 엔드포인트 추가 | ⭐⭐ |
| 7 | `server/routes/ai.routes.ts` | analyzeStock 모델 전달 | ⭐ |
| 8 | `server/storage/interface.ts` | getAllActiveAlerts 시그니처 추가 | ⭐ |
| 9 | `server/storage/postgres-core.storage.ts` | getAllActiveAlerts 구현 추가 | ⭐ |
| 10 | `server/auto-trading-worker.ts` | checkPriceAlerts 메서드 추가 | ⭐⭐ |
