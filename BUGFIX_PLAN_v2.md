# 🔧 TradeBot 버그 수정 계획서 v2 (키움 REST API 문서 기반)

> **작성일**: 2026-03-11  
> **기준 문서**: 키움 REST API 문서 (526페이지) + 소스코드 전체 분석  
> **핵심 수정**: 이전 계획서에서 "지원 불가"로 오분류된 3개 기능이 실제 REST/WebSocket으로 모두 지원됨을 확인

---

## ✅ 실제 지원 API 현황 (이전 오분류 수정)

| 기능 | API ID | 프로토콜 | 엔드포인트 | 이전 판단 → 정정 |
|------|--------|----------|-----------|-----------------|
| 관심종목 시세 조회 | ka10095 | REST (HTTPS) | `POST /api/dostk/stkinfo` | ❌오류→✅지원 |
| 조건검색 목록 조회 | ka10171 | **WebSocket** | `wss://api.kiwoom.com:10000` | ❌오류→✅지원 |
| 조건검색 일반 실행 | ka10172 | **WebSocket** | `wss://api.kiwoom.com:10000` | ❌오류→✅지원 |
| 조건검색 실시간 | ka10173 | **WebSocket** | `wss://api.kiwoom.com:10000` | ❌오류→✅지원 |
| 조건검색 실시간 해제 | ka10174 | **WebSocket** | `wss://api.kiwoom.com:10000` | ❌오류→✅지원 |
| 종목정보 리스트 | ka10099 | REST (HTTPS) | `POST /api/dostk/stkinfo` | ❌미구현→✅지원 |
| 종목정보 조회(코드→명) | ka10100 | REST (HTTPS) | `POST /api/dostk/stkinfo` | ❌미구현→✅지원 |
| 주식기본정보 | ka10001 | REST (HTTPS) | `POST /api/dostk/stkinfo` | 부분구현→완성 |

> ⚠️ **핵심 차이**: 조건검색(ka10171~74)은 REST가 아닌 **WebSocket** 기반.  
> 기존 `kiwoom.condition.ts`의 오류 메시지는 "HTTP REST가 지원 안 된다"는 뜻이었으나,  
> **WebSocket으로 구현하면 완전히 동작 가능**하다.  
> `ka10095 관심종목`도 종목코드를 입력하면 시세를 반환—단, **그룹/리스트 관리는 앱에서 별도 관리**해야 함.

---

## 🔴 BUG-01: kiwoom.condition.ts — 조건검색 전체 미동작

### 문제
```typescript
// server/services/kiwoom/kiwoom.condition.ts
const NOT_SUPPORTED = "키움 REST API는 HTS 조건검색을 지원하지 않습니다.";

async getConditionList(): Promise<ConditionListItem[]> {
  throw new Error(NOT_SUPPORTED); // ❌ 항상 오류
}
async getConditionSearchResults(seq: string, searchType: string): Promise<ConditionSearchResult[]> {
  throw new Error(NOT_SUPPORTED); // ❌ 항상 오류
}
```

### 원인
REST가 아닌 **WebSocket** 채널로 구현해야 하는데, HTTP axios를 사용하려다 막힌 것.

### 수정: `server/services/kiwoom/kiwoom.condition.ts` 전면 재작성

```typescript
import WebSocket from 'ws';
import { KiwoomBase } from './kiwoom.base';

export interface ConditionListItem {
  seq: string;
  name: string;
}

export interface ConditionSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  changeSign: string;
  change: string;
  changeRate: string;
  volume: string;
  open: string;
  high: string;
  low: string;
}

export class KiwoomCondition extends KiwoomBase {
  private wsBaseUrl: string;

  constructor(config: any) {
    super(config);
    this.wsBaseUrl = config.isReal
      ? 'wss://api.kiwoom.com:10000'
      : 'wss://mockapi.kiwoom.com:10000';
  }

  private async wsRequest(payload: object): Promise<any> {
    const token = await this.ensureToken();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.wsBaseUrl}/api/dostk/websocket`, {
        headers: {
          authorization: `Bearer ${token}`,
          'api-id': (payload as any).trnm === 'CNSRLST' ? 'ka10171'
                  : (payload as any).trnm === 'CNSRREQ' ? 'ka10172'
                  : (payload as any).trnm === 'CNSRCLR' ? 'ka10174' : 'ka10172',
        }
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket timeout'));
      }, 15000);

      ws.on('open', () => ws.send(JSON.stringify(payload)));

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          // 조회 데이터(CNSRLST/CNSRREQ)가 오면 반환
          if (msg.trnm !== 'REAL') {
            clearTimeout(timeout);
            ws.close();
            if (msg.return_code !== 0) {
              reject(new Error(msg.return_msg || 'Kiwoom WS error'));
            } else {
              resolve(msg);
            }
          }
        } catch (e) { reject(e); }
      });

      ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  }

  // ka10171: 조건검색 목록 조회
  async getConditionList(): Promise<ConditionListItem[]> {
    const res = await this.wsRequest({ trnm: 'CNSRLST' });
    return (res.data || []).map((item: any) => ({
      seq: Array.isArray(item) ? item[0] : item.seq,
      name: Array.isArray(item) ? item[1] : item.name,
    }));
  }

  // ka10172: 조건검색 일반 실행
  async getConditionSearchResults(seq: string): Promise<ConditionSearchResult[]> {
    const res = await this.wsRequest({
      trnm: 'CNSRREQ',
      seq,
      search_type: '0',
      stex_tp: 'K',
      cont_yn: 'N',
      next_key: '',
    });
    return (res.data || []).map((item: any) => ({
      stockCode: (item['9001'] || '').replace(/^A/, ''),
      stockName: item['302'] || '',
      currentPrice: item['10'] || '0',
      changeSign: item['25'] || '3',
      change: item['11'] || '0',
      changeRate: item['12'] || '0',
      volume: item['13'] || '0',
      open: item['16'] || '0',
      high: item['17'] || '0',
      low: item['18'] || '0',
    }));
  }

  // ka10174: 실시간 해제
  async stopConditionMonitoring(seq: string): Promise<void> {
    await this.wsRequest({ trnm: 'CNSRCLR', seq });
  }
}
```

### 추가 패키지 설치
```bash
npm install ws @types/ws
```

---

## 🔴 BUG-02: kiwoom.market.ts — 관심종목 시세 조회 미구현 + searchStock 완성

### 문제 (슬라이드 12)
관심종목 기능이 내부 DB에만 저장되고, 키움 서버에 저장된 조건검색 결과를 활용하지 않음.  
**`ka10095` REST API**로 종목 코드 목록을 보내면 시세+호가+기본정보를 한번에 받아올 수 있음.

### 수정: `server/services/kiwoom/kiwoom.market.ts`에 메서드 추가

```typescript
// 기존 파일 하단에 추가

// ka10095: 관심종목 정보 요청 (최대 여러 종목 | 구분자)
async getWatchlistInfo(stockCodes: string[]): Promise<WatchlistStockInfo[]> {
  const stk_cd = stockCodes.join('|');
  const res = await this.axiosInstance.post(
    '/api/dostk/stkinfo',
    { stk_cd },
    { headers: { 'api-id': 'ka10095' } }
  );
  return (res.data.atn_stk_infr || []).map((item: any) => ({
    stockCode: item.stk_cd,
    stockName: item.stk_nm,
    currentPrice: item.cur_prc,
    change: item.pred_pre,
    changeSign: item.pred_pre_sig,
    changeRate: item.flu_rt,
    volume: item.trde_qty,
    high: item.high_pric,
    low: item.low_pric,
    open: item.open_pric,
    sellBid: item.sel_bid,
    buyBid: item.buy_bid,
  }));
}

// ka10100: 종목코드 → 종목명/정보 조회
async getStockInfo(stockCode: string): Promise<{ name: string; marketName: string; state: string }> {
  const res = await this.axiosInstance.post(
    '/api/dostk/stkinfo',
    { stk_cd: stockCode },
    { headers: { 'api-id': 'ka10100' } }
  );
  return {
    name: res.data.name || '',
    marketName: res.data.marketName || '',
    state: res.data.state || '',
  };
}

// ka10099: 시장별 전종목 리스트 (종목명 검색용 로컬 캐시 빌드)
async getStockList(marketType: string = '0'): Promise<Array<{ code: string; name: string }>> {
  const res = await this.axiosInstance.post(
    '/api/dostk/stkinfo',
    { mrkt_tp: marketType },
    { headers: { 'api-id': 'ka10099' } }
  );
  return (res.data.list || []).map((item: any) => ({
    code: item.code,
    name: item.name,
  }));
}
```

---

## 🔴 BUG-03: kiwoom.market.ts — searchStock 종목명 검색 미구현

### 문제 (슬라이드 5, 12)
```typescript
// 현재 searchStock은 stk_cd(코드) 입력만 받고 종목명 LIKE 검색 불가
async searchStock(query: string): Promise<...> {
  // ka10001으로 코드→기본정보만 조회, 이름 검색 없음
}
```

### 수정: `server/services/kiwoom/kiwoom.market.ts` `searchStock` 재작성

```typescript
// 서버 시작 시 전종목 캐시 (KOSPI+KOSDAQ)
private stockCache: Array<{ code: string; name: string }> = [];
private cacheBuiltAt: Date | null = null;

private async ensureStockCache(): Promise<void> {
  const now = new Date();
  if (this.stockCache.length > 0 && this.cacheBuiltAt &&
      (now.getTime() - this.cacheBuiltAt.getTime()) < 24 * 60 * 60 * 1000) {
    return; // 캐시 유효 (24시간)
  }
  // KOSPI(0) + KOSDAQ(10) 동시 조회
  const [kospi, kosdaq] = await Promise.all([
    this.getStockList('0'),
    this.getStockList('10'),
  ]);
  this.stockCache = [...kospi, ...kosdaq];
  this.cacheBuiltAt = now;
  console.log(`[KiwoomMarket] 종목 캐시 완성: ${this.stockCache.length}개`);
}

// 종목 검색 (코드 또는 이름 LIKE)
async searchStock(query: string): Promise<StockSearchResult[]> {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  // 6자리 숫자코드면 ka10001로 정확 조회
  if (/^\d{6}$/.test(q)) {
    const res = await this.axiosInstance.post(
      '/api/dostk/stkinfo',
      { stk_cd: q },
      { headers: { 'api-id': 'ka10001' } }
    );
    return res.data.stk_nm
      ? [{ stockCode: res.data.stk_cd, stockName: res.data.stk_nm,
           currentPrice: res.data.cur_prc || '0', marketName: '' }]
      : [];
  }

  // 이름 검색: 캐시 LIKE
  await this.ensureStockCache();
  return this.stockCache
    .filter(s => s.name.includes(query) || s.code.includes(q))
    .slice(0, 20)
    .map(s => ({ stockCode: s.code, stockName: s.name, currentPrice: '0', marketName: '' }));
}
```

---

## 🔴 BUG-04: server/routes/trading.routes.ts — 종목 검색 엔드포인트 + 자동완성 API 추가

### 문제
`GET /api/stocks/search?query=삼성` 호출 시 코드만 검색, 이름 검색 불가.

### 수정: `server/routes/trading.routes.ts`

```typescript
// 기존 GET /api/stocks/search 라우트 수정
router.get('/api/stocks/search', isAuthenticated, async (req, res) => {
  const query = req.query.query as string;
  if (!query || query.length < 1) return res.json([]);
  
  const kiwoom = getKiwoomService();
  const results = await kiwoom.searchStock(query); // 이제 이름 검색 가능
  res.json(results);
});

// 신규: GET /api/stocks/:code/info  (watchlist 추가 시 자동 종목명 조회)
router.get('/api/stocks/:stockCode/info', isAuthenticated, async (req, res) => {
  try {
    const kiwoom = getKiwoomService();
    const info = await kiwoom.getStockInfo(req.params.stockCode);
    res.json(info);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});
```

---

## 🔴 BUG-05: server/routes/watchlist.routes.ts — 관심종목 Kiwoom 시세 연동

### 문제 (슬라이드 12)
현재 관심종목 조회 시 DB에 저장된 정보만 반환, 실시간 시세 미반영.

### 수정: `server/routes/watchlist.routes.ts`

```typescript
// GET /api/watchlist - 관심종목 목록 + Kiwoom 시세 병합
router.get('/api/watchlist', isAuthenticated, async (req, res) => {
  const user = await getCurrentUser(req);
  const list = await storage.getWatchlist(user.id);
  
  if (list.length === 0) return res.json([]);
  
  try {
    const kiwoom = getKiwoomService();
    const codes = list.map(w => w.stockCode);
    const priceMap = await kiwoom.getWatchlistInfo(codes); // ka10095
    const priceByCode = Object.fromEntries(priceMap.map(p => [p.stockCode, p]));
    
    return res.json(list.map(w => ({
      ...w,
      kiwoomData: priceByCode[w.stockCode] || null,
    })));
  } catch {
    return res.json(list); // Kiwoom 오류 시 DB 데이터만
  }
});

// POST /api/watchlist - 종목 추가 시 자동 종목명 조회
router.post('/api/watchlist', isAuthenticated, async (req, res) => {
  const user = await getCurrentUser(req);
  let { stockCode, stockName } = req.body;
  
  // 종목명 없으면 ka10100으로 자동 조회
  if (!stockName && stockCode) {
    try {
      const kiwoom = getKiwoomService();
      const info = await kiwoom.getStockInfo(stockCode);
      stockName = info.name || stockCode;
    } catch { stockName = stockCode; }
  }
  
  const item = await storage.addWatchlist(user.id, { stockCode, stockName });
  res.json(item);
});
```

---

## 🔴 BUG-06: server/routes/autotrading.routes.ts — 조건검색 목록·실행 라우트 수정

### 문제 (슬라이드 13~16)
`POST /api/conditions/:id/run` 이 `kiwoom.getConditionSearchResults()`를 호출하는데 항상 오류.

### 수정: `server/routes/autotrading.routes.ts` (또는 `formula.routes.ts`)

```typescript
// GET /api/kiwoom/conditions - 키움 HTS 조건식 목록 조회 (ka10171 WebSocket)
router.get('/api/kiwoom/conditions', isAuthenticated, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const settings = await storage.getUserSettings(user.id);
    if (!settings?.kiwoomAppKey) {
      return res.status(400).json({ error: 'Kiwoom API 키가 설정되지 않았습니다.' });
    }
    const kiwoom = createKiwoomService({
      appKey: decrypt(settings.kiwoomAppKey),
      appSecret: decrypt(settings.kiwoomAppSecret),
      isReal: settings.tradingMode === 'real',
    });
    const conditions = await kiwoom.getConditionList(); // ka10171 WebSocket
    res.json(conditions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/kiwoom/conditions/:seq/run - 조건검색 실행 (ka10172 WebSocket)
router.post('/api/kiwoom/conditions/:seq/run', isAuthenticated, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const settings = await storage.getUserSettings(user.id);
    const kiwoom = createKiwoomService({
      appKey: decrypt(settings.kiwoomAppKey),
      appSecret: decrypt(settings.kiwoomAppSecret),
      isReal: settings.tradingMode === 'real',
    });
    const results = await kiwoom.getConditionSearchResults(req.params.seq); // ka10172
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

---

## 🔴 BUG-07: server/services/ai.service.ts — AI 모델 설정값 미반영

### 문제 (슬라이드 3, 9)
```typescript
// ai.service.ts - 항상 기본값 gpt-5.1 사용
private createJsonCompletion(systemPrompt: string, userPrompt: string) {
  return this.openai.chat.completions.create({
    model: 'gpt-5.1', // ❌ 사용자 설정 무시
    ...
  });
}
```

### 수정: `server/services/ai.service.ts`

```typescript
export class AIService {
  private openai: OpenAI;
  private model: string; // 추가

  constructor(apiKey: string, model: string = 'gpt-5.1') {
    this.openai = new OpenAI({ apiKey });
    this.model = model; // 추가
  }

  private createJsonCompletion(systemPrompt: string, userPrompt: string) {
    return this.openai.chat.completions.create({
      model: this.model, // ✅ 생성자에서 받은 모델 사용
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
  }
}

// 싱글톤 팩토리도 수정
export function getAIService(model?: string): AIService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new AIService(apiKey, model || 'gpt-5.1');
}
```

### `server/routes/ai.routes.ts`에서 사용자 설정 모델 전달

```typescript
// POST /api/ai/analyze-stock
router.post('/api/ai/analyze-stock', isAuthenticated, async (req, res) => {
  const user = await getCurrentUser(req);
  const settings = await storage.getUserSettings(user.id);
  const aiModel = settings?.aiModel || 'gpt-5.1'; // ✅ 사용자 설정 모델
  const aiService = getAIService(aiModel);
  // ...
});

// POST /api/ai/integrated-analysis
router.post('/api/ai/integrated-analysis', isAuthenticated, async (req, res) => {
  const user = await getCurrentUser(req);
  const settings = await storage.getUserSettings(user.id);
  const aiModel = settings?.aiModel || 'gpt-5.1';
  const aiService = getAIService(aiModel);
  // ...
});
```

---

## 🔴 BUG-08: 가격 알림 트리거 로직 부재

### 문제 (슬라이드 전반)
`alerts` 테이블에 알림 레코드가 있어도 주기적 비교 로직이 없어 발동하지 않음.

### 수정: `server/auto-trading-worker.ts`에 알림 체크 추가

```typescript
// executeTradingCycle() 내부에 추가
private async checkAlerts(): Promise<void> {
  const alerts = await storage.getAllActiveAlerts(); // is_triggered = false
  if (alerts.length === 0) return;
  
  // 종목코드 중복 제거 후 ka10095로 일괄 시세 조회
  const codes = [...new Set(alerts.map(a => a.stockCode))];
  const kiwoom = getKiwoomService();
  const prices = await kiwoom.getWatchlistInfo(codes);
  const priceMap = Object.fromEntries(prices.map(p => [p.stockCode, parseFloat(p.currentPrice.replace(/[^0-9.-]/g, ''))]));
  
  for (const alert of alerts) {
    const price = priceMap[alert.stockCode];
    if (price === undefined) continue;
    
    let triggered = false;
    if (alert.alertType === 'price_above' && price >= alert.targetPrice) triggered = true;
    if (alert.alertType === 'price_below' && price <= alert.targetPrice) triggered = true;
    
    if (triggered) {
      await storage.markAlertTriggered(alert.id);
      // 웹소켓 또는 SSE로 클라이언트에 알림 전송
      console.log(`[Alert] ${alert.stockCode} 알림 발동: ${price}`);
    }
  }
}
```

---

## 🔴 BUG-09: client/src/pages/watchlist.tsx — 관심종목 추가 시 자동 종목명 조회

### 문제 (슬라이드 12)
종목 추가 시 코드와 이름을 수동으로 모두 입력해야 함.

### 수정: `client/src/pages/watchlist.tsx`

```typescript
// 종목코드 입력 후 blur 시 자동 종목명 조회
const handleStockCodeBlur = async () => {
  if (!newStockCode || newStockName) return;
  try {
    const res = await apiRequest('GET', `/api/stocks/${newStockCode}/info`);
    if (res.name) setNewStockName(res.name);
  } catch {}
};

// 검색 자동완성 추가 (종목명 입력 시 ka10099 캐시 기반)
const [suggestions, setSuggestions] = useState<Array<{code:string,name:string}>>([]);
const handleSearchInput = async (val: string) => {
  setNewStockName(val);
  if (val.length >= 2) {
    const res = await apiRequest('GET', `/api/stocks/search?query=${encodeURIComponent(val)}`);
    setSuggestions(res.slice(0, 8));
  } else {
    setSuggestions([]);
  }
};
```

---

## 🔴 BUG-10: client/src/pages/condition-screening.tsx — Kiwoom 조건식 연동

### 문제 (슬라이드 13~16)
현재 자체 수식 엔진만 호출 가능, HTS에서 만든 조건식 불러오기 불가.

### 수정: 페이지에 "Kiwoom HTS 조건식" 탭 추가

```typescript
// condition-screening.tsx 상단에 탭 추가
const [activeTab, setActiveTab] = useState<'custom' | 'kiwoom'>('custom');

// Kiwoom 탭: 조건식 목록 로드
const { data: kiwoomConditions } = useQuery({
  queryKey: ['/api/kiwoom/conditions'],
  enabled: activeTab === 'kiwoom',
  retry: 1,
});

// 조건검색 실행
const runKiwoomCondition = useMutation({
  mutationFn: (seq: string) =>
    apiRequest('POST', `/api/kiwoom/conditions/${seq}/run`),
  onSuccess: (data) => setResults(data),
});
```

---

## 🟡 BUG-11: client/src/components/settings/SettingsAI.tsx — 모델 명칭 표기 수정

### 문제
UI에 "GPT-4" 표기가 있지만 실제로는 gpt-5.1 계열 사용. 혼동 유발.

### 수정: 모델 옵션 레이블 정렬

```typescript
const modelOptions = [
  { value: 'gpt-5.1',       label: 'GPT-5.1',        badge: '추천',     desc: '최고 성능, 수익률 최적화' },
  { value: 'gpt-5.1-mini',  label: 'GPT-5.1 Instant', badge: '빠름',     desc: '빠른 대화형 분석' },
  { value: 'gpt-5-mini',    label: 'GPT-5 Mini',      badge: '절약',     desc: '비용 효율적 대량 분석' },
  { value: 'gpt-4.1',       label: 'GPT-4.1',         badge: '멀티모달', desc: 'PDF/이미지 분석 지원' },
  { value: 'gpt-4o',        label: 'GPT-4o',          badge: '범용',     desc: '범용 레거시 채널' },
];
```

---

## 📋 수정 작업 우선순위 및 순서

| 순서 | BUG | 파일 | 예상 시간 | 중요도 |
|------|-----|------|----------|--------|
| 1 | BUG-01 | kiwoom.condition.ts | 3h | 🔴 Critical |
| 2 | BUG-02/03 | kiwoom.market.ts | 2h | 🔴 Critical |
| 3 | BUG-04 | trading.routes.ts | 1h | 🔴 Critical |
| 4 | BUG-07 | ai.service.ts + ai.routes.ts | 1h | 🔴 Critical |
| 5 | BUG-05 | watchlist.routes.ts | 1h | 🟠 High |
| 6 | BUG-06 | autotrading.routes.ts | 1.5h | 🟠 High |
| 7 | BUG-08 | auto-trading-worker.ts | 1h | 🟠 High |
| 8 | BUG-09 | watchlist.tsx (client) | 1h | 🟡 Medium |
| 9 | BUG-10 | condition-screening.tsx | 1.5h | 🟡 Medium |
| 10 | BUG-11 | SettingsAI.tsx | 0.5h | 🟢 Low |

---

## ⚙️ 의존성 설치 (Replit Shell)

```bash
# WebSocket 클라이언트 (서버용)
npm install ws
npm install --save-dev @types/ws

# 기존 패키지 확인
grep -E '"ws"|"websocket"' package.json
```

---

## 🧪 테스트 체크리스트

- [ ] `GET /api/kiwoom/conditions` → 조건식 목록 반환 확인
- [ ] `POST /api/kiwoom/conditions/0/run` → 종목 목록 반환 확인
- [ ] `GET /api/stocks/search?query=삼성` → 종목명 검색 결과 확인
- [ ] `GET /api/stocks/005930/info` → 종목 기본정보 반환 확인
- [ ] `GET /api/watchlist` → Kiwoom 실시간 시세 포함 반환 확인
- [ ] `POST /api/watchlist` (종목명 없이 코드만) → 자동 종목명 채워짐 확인
- [ ] AI 모델 설정 변경 후 분석 → 설정 모델 실제 사용 확인
- [ ] 가격 알림 설정 후 가격 도달 → 알림 발동 확인

