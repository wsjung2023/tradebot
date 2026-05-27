// trade-executor.service.ts — 레인보우 차트 + GPT 분석 기반 개별 종목 평가 및 매수/매도 주문 실행 서비스
import { storage } from '../storage';
import { KiwoomService } from './kiwoom';
import { AIService, AiBudgetExceededError } from './ai.service';
import { AiModel, AutoTradingSettings, CandidateStock } from '@shared/schema';
import { RainbowChartAnalyzer } from '../formula/rainbow-chart';
import { normalizeChartDataAsc } from '../utils/chart-normalization';
import { parseHoldingItem } from '../utils/balance-parser';
import { extractErrorDiagnostics } from '../utils/error-diagnostics';
import { getNewsService } from './news.service';
import { getDartService } from './dart.service';
import { getUserKiwoomService } from './user-kiwoom.service';

// 위험 공시 키워드 → 매수 자동 차단
const DART_DANGER_KEYWORDS = [
  '유상증자', '전환사채', '신주인수권부사채', '횡령', '배임', '관리종목', '상장폐지',
  '영업정지', '파산', '회생절차', '불성실공시', '투자경고', '투자위험',
];

export type RainbowEval = {
  currentLine: number;
  action: 'buy' | 'sell' | 'hold';
  weight: number;
  confidence: number;
};

export type AiAnalysisResult = {
  confidence: number;
  hasGoodFinancials: boolean;
  hasHighLiquidity: boolean;
  dartDangerKeyword: string | null;
  themeScore: number;
  newsScore: number;
  financialsScore: number;
  liquidityScore: number;
  institutionalScore: number;
  _skippedReason?: string;
};

type CandidateDecisionCooldownMode =
  | 'interval_120m'
  | 'interval_60m'
  | 'interval_30m'
  | 'daily_three_slots'
  | 'daily_once';

// CL선 색 기준: 파랑(blue)=10~20, 초록(green)=30~50, 노랑(yellow)=60~70, 빨강(red)=80~100
function getRainbowColor(line: number): 'blue' | 'green' | 'yellow' | 'red' {
  if (line <= 20) return 'blue';
  if (line <= 50) return 'green';
  if (line <= 70) return 'yellow';
  return 'red';
}
export class TradeExecutorService {
  private normalizeStockCode(code: string | null | undefined): string {
    return String(code ?? "").trim().replace(/^A/i, "");
  }

  private parsePositiveInt(value: unknown, fallback: number): number {
    const n = Number(String(value ?? '').trim());
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  }

  private parseNonNegativeInt(value: unknown, fallback: number): number {
    const n = Number(String(value ?? '').trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  }

  private getSellRetryCooldownMs(settings: AutoTradingSettings): number {
    const policy = (settings.aiEntryPolicy as any) ?? {};
    const secFromPolicy = this.parseNonNegativeInt(policy.sellRetryCooldownSec, -1);
    if (secFromPolicy >= 0) return secFromPolicy * 1000;
    const secFromEnv = this.parseNonNegativeInt(process.env.AUTO_TRADING_SELL_RETRY_COOLDOWN_SEC, -1);
    return secFromEnv >= 0 ? secFromEnv * 1000 : 0;
  }

  private parseQty(value: unknown): number {
    const s = String(value ?? '').replace(/,/g, '').trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  private pickSellableQty(raw: Record<string, unknown>): number | null {
    const candidates = [
      raw.ord_psbl_qty,
      raw.sell_psbl_qty,
      raw.mdpos_qty,
      raw.poss_qty,
      raw.sellable_qty,
      raw.ordable_qty,
      raw.orderable_qty,
    ];
    for (const v of candidates) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      return Math.max(0, this.parseQty(v));
    }
    return null;
  }

  private async getBrokerPositionSnapshot(
    kiwoomService: KiwoomService,
    accountNumber: string,
    accountType: 'real' | 'mock',
    stockCode: string,
  ): Promise<{ holdingQty: number; sellableQty: number | null } | null> {
    try {
      const bal = await kiwoomService.getAccountBalance(accountNumber, accountType);
      const rows = Array.isArray((bal as any)?.output2) ? (bal as any).output2 as Array<Record<string, unknown>> : [];
      const target = this.normalizeStockCode(stockCode);
      for (const row of rows) {
        const parsed = parseHoldingItem(row);
        if (this.normalizeStockCode(parsed.stockCode) !== target) continue;
        return {
          holdingQty: Math.max(0, this.parseQty(parsed.quantity)),
          sellableQty: this.pickSellableQty(row),
        };
      }
      return { holdingQty: 0, sellableQty: 0 };
    } catch (e: any) {
      console.warn(`[SellGuard] broker snapshot failed ${stockCode}: ${e?.message || e}`);
      return null;
    }
  }

  // ── 오늘 KST 기준 신규 진입 종목 수 조회 (completed만, 고유 종목 기준) ──
  private async countTodayAutoTrades(accountId: number): Promise<number> {
    const orders = await storage.getOrders(accountId, 200);
    const nowUtc = Date.now();
    const kstMidnightUtc = Math.floor((nowUtc + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
    const todayBuys = orders.filter(o => {
      if (!o.isAutoTrading || o.orderType !== 'buy' || o.orderStatus !== 'completed') return false;
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return ts >= kstMidnightUtc;
    });
    return new Set(todayBuys.map(o => o.stockCode)).size;
  }

  // ── 오늘 날짜 YYYYMMDD (KST) ──
  private todayKST(): string {
    const d = new Date(Date.now() + 9 * 3600000);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private getAiWeights(settings: AutoTradingSettings) {
    return {
      theme: parseFloat(settings.themeWeight?.toString() ?? '20'),
      news: parseFloat(settings.newsWeight?.toString() ?? '15'),
      financials: parseFloat(settings.financialsWeight?.toString() ?? '25'),
      liquidity: parseFloat(settings.liquidityWeight?.toString() ?? '20'),
      institutional: parseFloat(settings.institutionalWeight?.toString() ?? '20'),
    };
  }

  private buildConfidenceBreakdown(settings: AutoTradingSettings, analysis: AiAnalysisResult) {
    const weights = this.getAiWeights(settings);
    const weighted = {
      theme: analysis.themeScore * weights.theme,
      news: analysis.newsScore * weights.news,
      financials: analysis.financialsScore * weights.financials,
      liquidity: analysis.liquidityScore * weights.liquidity,
      institutional: analysis.institutionalScore * weights.institutional,
    };
    const denominator = weights.theme + weights.news + weights.financials + weights.liquidity + weights.institutional || 100;
    const weightedSum = weighted.theme + weighted.news + weighted.financials + weighted.liquidity + weighted.institutional;
    const calculatedConfidence = Math.min(100, Math.max(0, weightedSum / denominator));

    return {
      weights,
      scores: {
        theme: analysis.themeScore,
        news: analysis.newsScore,
        financials: analysis.financialsScore,
        liquidity: analysis.liquidityScore,
        institutional: analysis.institutionalScore,
      },
      weighted,
      denominator,
      weightedSum: Number(weightedSum.toFixed(2)),
      calculatedConfidence: Number(calculatedConfidence.toFixed(2)),
      minAiConfidence: parseFloat(settings.minAiConfidence?.toString() ?? '0'),
    };
  }

  private getDecisionCooldownMode(settings: AutoTradingSettings): CandidateDecisionCooldownMode {
    const mode = (settings.aiEntryPolicy as any)?.candidateDecisionCooldownMode;
    if (
      mode === 'daily_three_slots'
      || mode === 'daily_once'
      || mode === 'interval_120m'
      || mode === 'interval_60m'
      || mode === 'interval_30m'
    ) {
      return mode;
    }
    return 'interval_120m';
  }

  private getIntervalCooldownMinutes(mode: CandidateDecisionCooldownMode): number {
    if (mode === 'interval_30m') return 30;
    if (mode === 'interval_60m') return 60;
    return 120;
  }

  private getKstDayStart(base: Date): Date {
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth();
    const day = kst.getUTCDate();
    return new Date(Date.UTC(year, month, day, -9, 0, 0, 0));
  }

  private getKstDate(base: Date, hour: number, minute: number): Date {
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth();
    const day = kst.getUTCDate();
    return new Date(Date.UTC(year, month, day, hour - 9, minute, 0, 0));
  }

  private getDecisionCooldownWindow(settings: AutoTradingSettings, now: Date): {
    mode: CandidateDecisionCooldownMode;
    since: Date;
    label: string;
  } {
    const mode = this.getDecisionCooldownMode(settings);
    if (mode === 'daily_once') {
      return {
        mode,
        since: this.getKstDayStart(now),
        label: 'daily_once',
      };
    }

    if (mode === 'daily_three_slots') {
      const slots = [
        { hour: 9, minute: 10, label: '09:10' },
        { hour: 13, minute: 30, label: '13:30' },
        { hour: 15, minute: 10, label: '15:10' },
      ];
      const slotDates = slots.map((slot) => ({ ...slot, at: this.getKstDate(now, slot.hour, slot.minute) }));
      const currentTs = now.getTime();
      const currentSlot = slotDates
        .filter((slot) => slot.at.getTime() <= currentTs)
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];

      if (currentSlot) {
        return {
          mode,
          since: currentSlot.at,
          label: `daily_three_slots:${currentSlot.label}`,
        };
      }

      return {
        mode,
        since: this.getKstDayStart(now),
        label: 'daily_three_slots:before_09:10',
      };
    }

    const intervalMinutes = this.getIntervalCooldownMinutes(mode);
    return {
      mode,
      since: new Date(now.getTime() - intervalMinutes * 60 * 1000),
      label: `interval_${intervalMinutes}m`,
    };
  }

  private getKstDayKey(base: Date): string {
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }

  private getDecisionCooldownKey(mode: CandidateDecisionCooldownMode, now: Date): string {
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayKey = this.getKstDayKey(now);
    const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

    if (mode === 'daily_once') {
      return `daily_once:${dayKey}`;
    }

    if (mode === 'daily_three_slots') {
      if (minutes >= (15 * 60 + 10)) return `daily_three_slots:${dayKey}:15:10`;
      if (minutes >= (13 * 60 + 30)) return `daily_three_slots:${dayKey}:13:30`;
      if (minutes >= (9 * 60 + 10)) return `daily_three_slots:${dayKey}:09:10`;
      return `daily_three_slots:${dayKey}:before_09:10`;
    }

    const intervalMinutes = this.getIntervalCooldownMinutes(mode);
    const intervalKeyPrefix = `interval_${intervalMinutes}m`;
    const marketOpenMinutes = 9 * 60;
    if (minutes < marketOpenMinutes) {
      return `${intervalKeyPrefix}:${dayKey}:pre_market`;
    }
    const bucket = Math.floor((minutes - marketOpenMinutes) / intervalMinutes);
    return `${intervalKeyPrefix}:${dayKey}:market_b${bucket}`;
  }

  // ── 신규 진입: 최대 보유 종목 체크 + AI/레인보우 평가 ──
  async evaluateStock(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number; volume: number },
    kiwoomService: KiwoomService,
    aiService: AIService,
    aiModel: string = 'gpt-5-mini',
  ): Promise<void> {
    console.log(`    📈 Evaluating: ${stock.name} (${stock.code})`);
    try {
      // ── [Phase 2] 종목 상태 필터링 (ka10075) ──
      if (stock.code) {
        try {
          const rawStatus = await kiwoomService.getStockStatus(stock.code);
          if (rawStatus) {
            const orderWarning = parseInt(rawStatus.ord_wrrn_tp || "0");
            const state = String(rawStatus.stk_stat_nm || "");
            const auditInfo = String(rawStatus.adt_inf_nm || "");
            
            const isWarning = orderWarning >= 4; 
            const isDanger = orderWarning === 5;  
            const isAuditAlert = auditInfo.includes("환기") || state.includes("환기");
            const creditAvailable = state.includes("신용");

            await storage.upsertStockStatus({
              stockCode: stock.code,
              orderWarning,
              state,
              auditInfo,
              isWarning,
              isDanger,
              isAuditAlert,
              creditAvailable,
            });
            
            if (settings.filterInvestmentWarnings && (isWarning || isDanger || isAuditAlert)) {
              const reason = isDanger ? "투자위험" : isWarning ? "투자경고" : "투자환기/관리";
              console.log(`    ⚠️  [Phase 2 필터] ${stock.name} (${stock.code}) — ${reason} 종목으로 판단되어 스킵`);
              storage.createEngineNotification({ 
                userId: model.userId, 
                severity: 'warn', 
                type: 'SKIP', 
                message: `[스킵] ${stock.name} — ${reason} 종목 (위험 관리)`,
                payload: { stockCode: stock.code, stockName: stock.name, skipReason: reason, orderWarning, auditInfo } 
              }).catch(e => console.error('[Notification]', e));
              return;
            } else if (!settings.filterInvestmentWarnings && (isWarning || isDanger || isAuditAlert)) {
              console.log(`    ℹ️  [Phase 2 필터 비활성] ${stock.name} (${stock.code}) — 위험 종목이지만 설정에 따라 통과`);
            }
          }
        } catch (statusErr: any) {
          console.warn(`    ⚠️  종목 상태 조회 실패 (${stock.code}):`, statusErr?.message);
        }
      }

      // ── 시장 이슈 관련 종목 필터 ──
      if (settings.requireMarketIssue) {
        const today = this.todayKST();
        const issues = await storage.getMarketIssuesByStock(stock.code);
        const hasTodayIssue = issues.some(i => i.issueDate === today);
        if (!hasTodayIssue) {
          console.log(`    ⚠️  시장 이슈 관련 종목 아님 (${stock.code}, ${today}) - 스킵`);
          storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 시장이슈 미등록`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '시장이슈 미등록' } }).catch(e => console.error('[Notification]', e));
          return;
        }
        console.log(`    ✅ 시장 이슈 확인됨: ${stock.code}`);
      }

      const aiAnalysis = await this.comprehensiveAiAnalysis(
        stock,
        settings,
        kiwoomService,
        aiService,
        aiModel,
        {
          userId: model.userId,
          accountId: Number((model.config as any)?.accountId ?? 0) || null,
          source: 'auto-trading:evaluate-stock',
        },
      );
      if (aiAnalysis.confidence < parseFloat(settings.minAiConfidence.toString())) {
        const confidenceBreakdown = this.buildConfidenceBreakdown(settings, aiAnalysis);
        console.log(`    ⚠️  AI confidence ${aiAnalysis.confidence}% < threshold ${settings.minAiConfidence}% - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — AI신뢰도 미달 (${aiAnalysis.confidence.toFixed(1)}% < ${settings.minAiConfidence}%)`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: 'minAiConf미달', confidence: aiAnalysis.confidence, themeScore: aiAnalysis.themeScore, newsScore: aiAnalysis.newsScore, financialsScore: aiAnalysis.financialsScore, liquidityScore: aiAnalysis.liquidityScore, institutionalScore: aiAnalysis.institutionalScore, confidenceBreakdown } }).catch(e => console.error('[Notification]', e));
        return;
      }
      if (settings.requireGoodFinancials && !aiAnalysis.hasGoodFinancials) {
        console.log(`    ⚠️  Failed financials check (score < 60) - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 재무건전성 미충족 (${aiAnalysis.financialsScore})`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '재무필터', financialsScore: aiAnalysis.financialsScore } }).catch(e => console.error('[Notification]', e));
        return;
      }
      if (settings.requireHighLiquidity && !aiAnalysis.hasHighLiquidity) {
        console.log(`    ⚠️  Failed liquidity check (score < 40) - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 유동성 미충족 (${aiAnalysis.liquidityScore})`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '유동성필터', liquidityScore: aiAnalysis.liquidityScore } }).catch(e => console.error('[Notification]', e));
        return;
      }
      // DART 위험 공시 감지 → 무조건 매수 차단 (설정 무관)
      if (aiAnalysis.dartDangerKeyword) {
        console.log(`    🚫 DART 위험공시 감지 [${aiAnalysis.dartDangerKeyword}] - 매수 차단`);
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'SKIP', message: `[차단] ${stock.name} — DART 위험공시 [${aiAnalysis.dartDangerKeyword}]`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: 'DART위험', dartDangerKeyword: aiAnalysis.dartDangerKeyword } }).catch(e => console.error('[Notification]', e));
        return;
      }
      const rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService, model.userId);
      console.log(`    🌈 Rainbow eval: ${rainbowEval.action} at ${rainbowEval.currentLine}% line (weight: ${rainbowEval.weight})`);
      if (rainbowEval.action === 'buy' && rainbowEval.weight > 0) {
        await this.executeBuy(model, settings, stock, rainbowEval, aiAnalysis, kiwoomService);
      } else if (rainbowEval.action === 'sell' && rainbowEval.weight > 0) {
        await this.executeSell(model, settings, stock, rainbowEval, kiwoomService);
      }
    } catch (error) {
      console.error(`    ❌ Error evaluating ${stock.code}:`, error);
    }
  }

  // ── 보유 종목 독립 추가매수 사이클 (스캔 결과 무관, 매 1분 사이클 호출) ──────────────────
  // 뒷차기 전략의 핵심: 보유 종목이 조건검색에서 탈락해도 라인 하락 시 추가매수 판단
  //
  // 중복매수 방지 3단계:
  //  [1] filledEntrySteps: 영구 추적 — 이미 매수한 라인이면 절대 재매수 금지
  //  [2] 새 하단 라인 판별 — 기존 최저 라인보다 더 아래일 때만 검토
  //  [3] 24시간 per-line 쿨다운 — 당일 같은 라인 오락가락 방지
  async checkHoldingsForScaleIn(
    model: AiModel,
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService: AIService,
    aiModel: string = 'gpt-5-mini',
  ): Promise<void> {
    const config = (model.config as any) || {};
    if (!config.accountId) return;

    const accounts = await storage.getKiwoomAccounts(model.userId);
    const activeAccount = accounts.find((a: any) => a.id === config.accountId);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    if (holdings.length === 0) return;

    // entryLadderSettings에서 라인별 유닛 맵 조회
    const lineUnits = this.getLineUnitMap(settings, config);
    const hasLadderConfig = Object.keys(lineUnits).length > 0;

    console.log(`  🔍 [ScaleIn] 보유 ${holdings.length}종목 추가매수 사이클 시작 (model: ${model.modelName})`);

    for (const holding of holdings) {
      holding.stockCode = this.normalizeStockCode(holding.stockCode);
      try {
        await this._evaluateHoldingForScaleIn({
          model, settings, config, activeAccount,
          holding, kiwoomService, aiService, aiModel,
          lineUnits, hasLadderConfig,
        });
      } catch (err) {
        console.warn(`  ⚠️  [ScaleIn] ${holding.stockCode} 평가 오류(건너뜀):`, err);
      }
    }

    console.log(`  ✅ [ScaleIn] 보유 종목 추가매수 사이클 완료`);
  }

  private async _evaluateHoldingForScaleIn(ctx: {
    model: AiModel;
    settings: AutoTradingSettings;
    config: any;
    activeAccount: any;
    holding: any;
    kiwoomService: KiwoomService;
    aiService: AIService;
    aiModel: string;
    lineUnits: Record<number, number>;
    hasLadderConfig: boolean;
  }): Promise<void> {
    const { model, settings, config, activeAccount, holding, kiwoomService, aiService, aiModel, lineUnits, hasLadderConfig } = ctx;
    const stockCode = holding.stockCode;
    const stockName = holding.stockName || stockCode;

    // ── [사전체크] 현재가 확보 ────────────────────────────────────────────
    const priceData = await kiwoomService.getStockPrice(stockCode);
    const currentPrice = parseFloat(priceData.output?.stck_prpr ?? '0');
    if (!currentPrice) {
      console.log(`    [ScaleIn] ⛔ ${stockCode} 현재가 확보 실패 — 스킵`);
      return;
    }

    // ── [사전체크] trading_performance 조회 → filledEntrySteps 읽기 ──────
    const perfEntry = await storage.getTradingPerformanceByStock(model.id, stockCode);
    const filledLines: number[] = Array.isArray(perfEntry?.filledEntrySteps)
      ? (perfEntry!.filledEntrySteps as number[]).filter(n => Number.isFinite(n))
      : perfEntry?.entryRainbowLine
        ? [perfEntry.entryRainbowLine]   // 최초 진입 라인을 시드로 사용
        : [];

    // ── [현재 레인보우 라인 계산] ─────────────────────────────────────────
    const stock = { code: stockCode, name: stockName, price: currentPrice };
    let rainbowEval: RainbowEval;
    try {
      rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService, model.userId);
    } catch (err: any) {
      const isInsufficient = err?.message?.includes('Insufficient') || err?.message?.includes('got 0');
      if (isInsufficient) {
        console.log(`    [ScaleIn] ⏭️  ${stockCode} 차트 데이터 부족 — 스킵`);
      } else {
        console.warn(`    [ScaleIn] ⚠️  ${stockCode} 레인보우 계산 오류:`, err?.message);
      }
      return;
    }
    const { currentLine } = rainbowEval;

    // ── [가드 1] 라더 설정에서 해당 라인 유닛 확인 ──────────────────────
    if (hasLadderConfig) {
      const unitsForLine = lineUnits[currentLine] ?? 0;
      if (unitsForLine <= 0) {
        console.log(`    [ScaleIn] ⏭️  ${stockCode} 현재 ${currentLine}% 라인 — 라더 유닛=0, 스킵`);
        return;
      }
    }

    // ── [가드 2] filledLines 기반 중복 방지 ─────────────────────────────
    // 최초 매수 기록이 아예 없으면(filledLines=[]) scale-in 불필요 (최초 매수는 evaluateCandidateStock 담당)
    if (filledLines.length === 0) {
      console.log(`    [ScaleIn] ⏭️  ${stockCode} 진입 기록 없음 — 스킵 (최초 매수는 스캔 잡 담당)`);
      return;
    }

    // 이미 해당 라인에서 매수한 이력 있음 → 절대 재매수 금지
    if (filledLines.includes(currentLine)) {
      console.log(`    [ScaleIn] ⏭️  ${stockCode} ${currentLine}% 라인 — 이미 매수 완료, 스킵 (filledLines: [${filledLines}])`);
      return;
    }

    // 현재 라인이 기존 최저 진입 라인보다 더 아래가 아니면 → 새 하단 라인 아님
    const minFilledLine = Math.min(...filledLines);
    if (currentLine >= minFilledLine) {
      console.log(`    [ScaleIn] ⏭️  ${stockCode} ${currentLine}% >= 최저기록 ${minFilledLine}% — 아직 새 하단 미도달, 스킵`);
      return;
    }

    // 최저 라인(10%) 도달 시 더 이상 추가매수 없음
    if (currentLine < 10) {
      console.log(`    [ScaleIn] ⏭️  ${stockCode} ${currentLine}% — 최저 라인 이하, 스킵`);
      return;
    }

    // ── [가드 3] per-line 쿨다운 (기본 24h, RC4007/RC4010 에러 시 7일) ──────────────────────────────────
    const now = new Date();
    const scaleInCooldownKey = `scaleIn:${model.id}:${stockCode}:line${currentLine}`;
    const recentScaleIn = await storage.getLatestCandidateDecisionByCooldownKey(
      model.id, stockCode, scaleInCooldownKey
    );
    if (recentScaleIn?.decidedAt) {
      const elapsedMs = now.getTime() - new Date(recentScaleIn.decidedAt).getTime();
      // RC4007/RC4010 영구제한 에러로 기록된 경우 더 긴 쿨다운 사용
      const cooldownMs = (recentScaleIn.aiDecision as any)?.cooldownDurationMs ?? (24 * 60 * 60 * 1000);
      if (elapsedMs < cooldownMs) {
        const remainHr = ((cooldownMs - elapsedMs) / 3600000).toFixed(1);
        console.log(`    [ScaleIn] ⏭️  ${stockCode} ${currentLine}% 라인 — 쿨다운 중 (잔여 ${remainHr}h), 스킵`);
        return;
      }
    }

    // ── 여기까지 통과: 실제로 새 하단 라인에 처음 도달한 경우 ────────────
    console.log(`    [ScaleIn] 📊 ${stockCode} ${currentLine}% 라인 도달! (기존최저: ${minFilledLine}%) — AI 판단 요청`);

    // ── [AI 판단] 추가매수 여부 결정 ────────────────────────────────────
    let aiAction: 'scale_in' | 'hold' | 'full_exit' | 'partial_exit' | 'stop_loss' = 'hold';
    let aiReasoning = '';
    try {
      const holdingDays = perfEntry?.createdAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(perfEntry.createdAt).getTime()) / 86400000))
        : 0;
      const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      const profitRate = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

      const aiDecision = await Promise.race([
        aiService.decidePositionManagement({
          stock: { code: stockCode, name: stockName, price: currentPrice },
          currentLine,
          holdingDays,
          modelType: model.modelType,
          performance: {
            entryPrice: avgPrice,
            quantity: holding.quantity,
            filledUnits: perfEntry?.filledUnits ?? null,
            maxUnitsReached: perfEntry?.maxUnitsReached ?? null,
            entryLadderPlan: perfEntry?.entryLadderPlan ?? null,
            filledEntrySteps: filledLines,
            holdDecisionSnapshots: perfEntry?.holdDecisionSnapshots ?? null,
            plannedExitPolicy: perfEntry?.plannedExitPolicy ?? null,
          },
          settings: {
            maxUnitsPerStock: settings.maxUnitsPerStock ?? null,
            stopLossPolicy: settings.stopLossPolicy ?? null,
            aiExitPolicy: settings.aiExitPolicy ?? null,
            allowAiPartialTakeProfit: settings.allowAiPartialTakeProfit ?? null,
            allowAiHoldBeyondTarget: settings.allowAiHoldBeyondTarget ?? null,
          },
        }, aiModel, {
          userId: model.userId,
          accountId: activeAccount.id,
          source: 'auto-trading:scale-in-check',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI 판단 타임아웃 (60초)')), 60000)
        ),
      ]);

      aiAction = aiDecision.action as any;
      aiReasoning = aiDecision.reasoning || '';
      console.log(`    [ScaleIn] 🤖 AI 결정: ${aiAction} — ${aiReasoning}`);
    } catch (aiErr: any) {
      if (aiErr instanceof AiBudgetExceededError) {
        console.warn(`    [ScaleIn] [예산차단] ${stockCode}: ${aiErr.message}`);
      } else {
        // 타임아웃/일시적 오류 — 쿨다운 없이 스킵, 다음 사이클 재시도
        console.warn(`    [ScaleIn] ⚠️  AI 판단 실패 — 쿨다운 미적용, 다음 사이클 재시도: ${aiErr?.message}`);
      }
      return;
    }

    // ── 쿨다운 키 기록 (AI가 실제로 판단한 경우에만 24h 재평가 방지) ─────────
    await storage.createCandidateDecisionLog({
      modelId: model.id,
      stockCode,
      stockName,
      scorecard: null,
      aiDecision: {
        accepted: aiAction === 'scale_in',
        decisionType: `scaleIn_${aiAction}`,
        qualitativeReason: aiReasoning,
        quantitativeReason: { currentLine, minFilledLine, filledLines, profitRate: (() => {
          const avg = parseFloat(holding.averagePrice?.toString() || '0');
          return avg > 0 ? (((currentPrice - avg) / avg) * 100).toFixed(2) : '0';
        })() },
        cooldownKey: scaleInCooldownKey,
        cooldownMode: 'scaleIn_24h' as any,
        cooldownWindowLabel: 'scaleIn_24h',
        cooldownSince: now.toISOString(),
        decidedAt: now.toISOString(),
        dailyKey: this.todayKST(),
        modelSnapshot: { id: model.id, modelName: model.modelName, modelType: model.modelType, aiModelId: aiModel, accountId: config.accountId, config },
        settingsSnapshot: null,
        currentLine,
        unitCount: null,
        marketAnalysis: null,
        candidateContext: { candidateId: null, source: 'scale-in-independent-cycle', scannedLine: null },
      },
      accepted: aiAction === 'scale_in',
      rejectReason: aiAction !== 'scale_in' ? `ai_decision_${aiAction}` : null,
      strategyVersion: 'v2',
      ladderPlan: null,
    });

    // ── AI가 scale_in 결정 시 추가매수 실행 ─────────────────────────────
    if (aiAction === 'scale_in') {
      await this.executeAdditionalBuy(model, settings, stock, holding, rainbowEval, kiwoomService);
      // filledEntrySteps 업데이트는 executeAdditionalBuy() 내부에서 처리됨
    } else {
      console.log(`    [ScaleIn] ⏸️  ${stockCode} — AI 판단: ${aiAction}(보류/매도), 추가매수 없음`);
    }
  }

  // ── 보유 포지션 손절/익절/동적청산 체크 (매 사이클 초입에 호출) ──
  async checkPositionsForExits(

    model: AiModel,
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService?: AIService,
    aiModel: string = 'gpt-5-mini',
  ): Promise<void> {
    const config = (model.config as any) || {};
    const stopLossConfig = config.stopLossConfig as { color: 'green' | 'blue'; percent: number } | null | undefined;
    const takeProfitPercent = config.takeProfitPercent != null ? parseFloat(String(config.takeProfitPercent)) : null;
    const stopLossPolicy = (settings.stopLossPolicy as any) ?? {};
    const stopLossMode = String(stopLossPolicy.mode ?? 'soft_ai_first');
    const hardCutLossPctRaw = parseFloat(String(stopLossPolicy.hardCutLossPct ?? '0'));
    const hardCutLossPct = Number.isFinite(hardCutLossPctRaw) && hardCutLossPctRaw > 0 ? hardCutLossPctRaw : null;
    const allowAiPartialTakeProfit = settings.allowAiPartialTakeProfit === true;
    const allowAiHoldBeyondTarget = settings.allowAiHoldBeyondTarget === true;

    // 물타기(scale-in) 진행 중인 종목은 takeProfitPercent 미설정이라도 반드시 체크해야 함
    // → early return은 일반 설정이 모두 없고 scale-in 종목도 없을 때만
    const hasAnyExitCondition =
      !!stopLossConfig ||
      !!takeProfitPercent ||
      !!settings.enableDynamicExit ||
      stopLossMode === 'hard' ||
      stopLossMode === 'conditional';

    // 물타기 종목 여부는 holding 루프 진입 전까지 알 수 없으므로 일단 진행
    // (early return을 완전히 제거하고 holding별로 skip 조건 판단)
    if (!hasAnyExitCondition) {
      // 일반 exit 조건은 없지만, scale-in 익절 체크를 위해 holdings는 조회해야 함
      // → 아래 루프에서 scale-in 조건만 체크하고 나머지는 skip
    }

    const accounts = await storage.getKiwoomAccounts(model.userId);
    const targetAccountId = config.accountId;
    if (!targetAccountId) {
      console.log(`  ⛔ accountId 미설정 — checkPositionsForExits 중단`);
      return;
    }
    const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    if (holdings.length === 0) return;

    console.log(`  🔍 Checking ${holdings.length} holding(s) for exits (model: ${model.modelName})`);

    for (const holding of holdings) {
      // DB에 'A005930' / '005930' 혼재 → 일관성 보장
      holding.stockCode = this.normalizeStockCode(holding.stockCode);
      try {
        const priceData = await kiwoomService.getStockPrice(holding.stockCode);
        const currentPrice = parseFloat(priceData.output?.stck_prpr || '0');
        const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
        if (!avgPrice || !currentPrice) continue;

        const profitRate = ((currentPrice - avgPrice) / avgPrice) * 100;

        let shouldSell = false;
        let sellRatio = 1;
        let exitReason = '';
        let currentLineForDecision: number | null = null;

        // ── 기본 익절 체크 (takeProfitPercent 설정 시) ──────────────────────────────────
        if (hasAnyExitCondition && takeProfitPercent && profitRate >= takeProfitPercent) {
          if (allowAiHoldBeyondTarget) {
            console.log(`    ℹ️  ${holding.stockCode} 목표 도달(+${takeProfitPercent}%) 했지만 '목표초과 보유 허용' 설정으로 보유 유지`);
          } else if (allowAiPartialTakeProfit && holding.quantity >= 2) {
            shouldSell = true;
            sellRatio = 0.5;
            exitReason = `부분익절: +${profitRate.toFixed(1)}% (기준: +${takeProfitPercent}%, 50% 청산)`;
          } else {
            shouldSell = true;
            exitReason = `익절: +${profitRate.toFixed(1)}% (기준: +${takeProfitPercent}%)`;
          }
        }

        // ── 물타기(scale-in) 평단가 기반 익절 체크 ──────────────────────────────────────
        // CL선 위/아래 무관하게 평단가 대비 수익률만으로 판단한다.
        // 뒷차기 전략: 연보라까지 5유닛 물타기 시 보라선 회복만으로도 큰 수익 가능
        if (!shouldSell && profitRate > 0) {
          const scaleInPerf = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
          const filledSteps = Array.isArray(scaleInPerf?.filledEntrySteps)
            ? (scaleInPerf!.filledEntrySteps as number[]).filter((n: number) => Number.isFinite(n))
            : [];
          const scaleInUnitCount = filledSteps.length; // 0이면 일반 진입, 1+ 이면 물타기 진행

          if (scaleInUnitCount >= 2) {
            // 설정값 우선, 없으면 유닛 수 기반 기본값 사용 (유닛이 많을수록 낮은 목표)
            const cfgScaleInTp = parseFloat(String((settings as any).scaleInTakeProfitPct ?? ''));
            const defaultScaleInTp = Math.max(3, 10 - (scaleInUnitCount - 2) * 2); // 2유닛→8%, 3→6%, 4→4%, 5→3%
            const effectiveScaleInTp = Number.isFinite(cfgScaleInTp) && cfgScaleInTp > 0
              ? cfgScaleInTp
              : defaultScaleInTp;

            if (profitRate >= effectiveScaleInTp) {
              console.log(`    💰 [물타기익절] ${holding.stockCode} 평단가 기준 +${profitRate.toFixed(1)}% ≥ ${effectiveScaleInTp}% (${scaleInUnitCount}유닛, filledLines:[${filledSteps}])`);
              if (allowAiPartialTakeProfit && holding.quantity >= 2) {
                shouldSell = true;
                sellRatio = 0.5;
                exitReason = `물타기 부분익절: +${profitRate.toFixed(1)}% ≥ ${effectiveScaleInTp}% (${scaleInUnitCount}유닛 평단가 기준, 50% 청산)`;
              } else {
                shouldSell = true;
                exitReason = `물타기 익절: +${profitRate.toFixed(1)}% ≥ ${effectiveScaleInTp}% (${scaleInUnitCount}유닛 평단가 기준)`;
              }
            } else {
              console.log(`    ⏸️  [물타기중] ${holding.stockCode} +${profitRate.toFixed(1)}% < 목표 ${effectiveScaleInTp}% (${scaleInUnitCount}유닛, 평단가: ${avgPrice.toLocaleString()}원)`);
            }
          }
        }

        // 손절 체크 (일반 exit 설정이 있을 때만)
        if (!shouldSell && hasAnyExitCondition && profitRate < 0) {
          const lossAbs = Math.abs(profitRate);

          // 신규 손절 정책: hard 우선
          // hardCutLossPct 미설정 시 안전 기본값 10% 적용 (설정 누락으로 손절 무력화 방지)
          const effectiveHardCut = hardCutLossPct ?? ((stopLossMode === 'hard' || stopLossMode === 'conditional') ? 10 : null);
          if ((stopLossMode === 'hard' || stopLossMode === 'conditional') && effectiveHardCut && lossAbs >= effectiveHardCut) {
            shouldSell = true;
            exitReason = `강제손절: ${profitRate.toFixed(1)}% (기준: -${effectiveHardCut}%${hardCutLossPct ? '' : ', 기본값'})`;
          }

          // 레거시 CL 손절: disabled가 아닐 때만 적용
          if (!shouldSell && stopLossMode !== 'disabled' && stopLossConfig && lossAbs >= stopLossConfig.percent) {
            const currentLine = await this.getCurrentRainbowLine(holding.stockCode, currentPrice, kiwoomService);
            currentLineForDecision = currentLine;
            const currentColor = getRainbowColor(currentLine);
            if (currentColor === stopLossConfig.color || stopLossMode === 'conditional') {
              shouldSell = true;
              exitReason = `손절: ${profitRate.toFixed(1)}% (기준: -${stopLossConfig.percent}%, CL=${stopLossConfig.color}, mode=${stopLossMode})`;
            } else {
              console.log(`    ℹ️  ${holding.stockCode} 손절 조건 미충족 (현재 CL색: ${currentColor}, 설정: ${stopLossConfig.color})`);
            }
          }
        }

        // ── 동적 청산 체크 (일반 exit 설정이 있을 때만) ──
        if (!shouldSell && hasAnyExitCondition && settings.enableDynamicExit) {
          const surgeThreshold = parseFloat(settings.surgeThreshold?.toString() || '0');
          const stalePeriodDays = parseInt(settings.stalePeriodDays?.toString() || '0');
          const volMultiplier = parseFloat(settings.volumeSpikeMultiplier?.toString() || '0');

          // 1) 급등 청산: profitRate >= surgeThreshold → 익절 유사 청산
          if (!shouldSell && surgeThreshold > 0 && profitRate >= surgeThreshold) {
            shouldSell = true;
            exitReason = `급등 청산: +${profitRate.toFixed(1)}% (기준: +${surgeThreshold}%)`;
          }

          // 2) 장기 보유 청산: stalePeriodDays 초과 + 손실 → 청산
          if (!shouldSell && stalePeriodDays > 0) {
            try {
              const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
              if (perfEntry?.createdAt) {
                const entryMs = new Date(perfEntry.createdAt).getTime();
                const daysSince = (Date.now() - entryMs) / 86400000;
                if (daysSince >= stalePeriodDays && profitRate < 0) {
                  shouldSell = true;
                  exitReason = `장기보유 청산: ${daysSince.toFixed(0)}일 보유, ${profitRate.toFixed(1)}% (기준: ${stalePeriodDays}일)`;
                }
              }
            } catch { /* 무시 */ }
          }

          // 3) 거래량 급증 청산: 당일 거래량 > 평균 × multiplier
          // [수정] 손실 중일 때는 작동하지 않도록 가드 (profitRate > 0)
          // [수정] 최소 10거래일 이상의 데이터가 있을 때만 신뢰 (데이터 부족으로 인한 오판 방지)
          if (!shouldSell && volMultiplier > 0 && profitRate > 0) {
            try {
              const chartData = await kiwoomService.getStockChart(holding.stockCode, 'D', 30);
              const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
              
              // 최소 10개 이상의 캔들이 있어야 평균의 신뢰도가 있음
              if (ohlcv.length >= 10) {
                const prevDays = ohlcv.slice(0, -1);
                // 0 거래량인 날은 평균에서 제외 (휴장일 등 데이터 오류 방어)
                const validPrevDays = prevDays.filter(d => (Number(d.volume) || 0) > 0);
                
                if (validPrevDays.length >= 5) {
                  const avgVol = validPrevDays.reduce((s: number, c: any) => s + (Number(c.volume) || 0), 0) / validPrevDays.length;
                  const todayVol = Number(ohlcv[ohlcv.length - 1]?.volume || 0);
                  
                  if (avgVol > 0 && todayVol > avgVol * volMultiplier) {
                    const ratio = todayVol / avgVol;
                    shouldSell = true;
                    exitReason = `거래량급증 청산: ${ratio.toFixed(1)}배 (오늘:${todayVol.toLocaleString()}, 평균:${Math.round(avgVol).toLocaleString()}, 기준:${volMultiplier}배, 익절구간)`;
                    
                    // 상세 로그 기록
                    console.log(`    🚀 [동적청산] ${holding.stockCode} 거래량 급증 감지! Ratio: ${ratio.toFixed(2)}x (Today: ${todayVol}, Avg: ${Math.round(avgVol)}, Samples: ${validPrevDays.length})`);
                    await storage.createTradingLog({
                      accountId: activeAccount.id,
                      action: 'dynamic_exit_detected',
                      success: true,
                      details: {
                        stockCode: holding.stockCode,
                        ratio,
                        todayVol,
                        avgVol,
                        samples: validPrevDays.length,
                        reason: exitReason
                      }
                    });
                  } else {
                    // 디버그용 로그 (필요 시 주석 해제)
                    // console.log(`    ℹ️  [동적청산] ${holding.stockCode} 거래량 정상. Ratio: ${(todayVol / avgVol).toFixed(2)}x (Today: ${todayVol}, Avg: ${Math.round(avgVol)})`);
                  }
                }
              }
            } catch (err: any) {
              console.error(`    ❌ [동적청산] ${holding.stockCode} 차트 분석 중 오류:`, err.message);
            }
          }
        }



        if (shouldSell && stopLossMode === 'soft_ai_first' && aiService) {
          try {
            if (currentLineForDecision === null) {
              currentLineForDecision = await this.getCurrentRainbowLine(holding.stockCode, currentPrice, kiwoomService);
            }
            const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
            const holdingDays = perfEntry?.createdAt
              ? Math.max(0, Math.floor((Date.now() - new Date(perfEntry.createdAt).getTime()) / 86400000))
              : 0;
            const aiDecision = await Promise.race([
              aiService.decidePositionManagement({
                stock: { code: holding.stockCode, name: holding.stockName || holding.stockCode, price: currentPrice },
                currentLine: currentLineForDecision ?? 50,
                holdingDays,
                modelType: model.modelType,
                performance: {
                  entryPrice: avgPrice,
                  quantity: holding.quantity,
                  filledUnits: perfEntry?.filledUnits ?? null,
                  maxUnitsReached: perfEntry?.maxUnitsReached ?? null,
                  entryLadderPlan: perfEntry?.entryLadderPlan ?? null,
                  filledEntrySteps: perfEntry?.filledEntrySteps ?? null,
                  holdDecisionSnapshots: perfEntry?.holdDecisionSnapshots ?? null,
                  plannedExitPolicy: perfEntry?.plannedExitPolicy ?? null,
                },
                settings: {
                  maxUnitsPerStock: settings.maxUnitsPerStock ?? null,
                  stopLossPolicy: settings.stopLossPolicy ?? null,
                  aiExitPolicy: settings.aiExitPolicy ?? null,
                  allowAiPartialTakeProfit: settings.allowAiPartialTakeProfit ?? null,
                  allowAiHoldBeyondTarget: settings.allowAiHoldBeyondTarget ?? null,
                },
              }, aiModel, {
                userId: model.userId,
                accountId: activeAccount.id,
                source: 'auto-trading:position-management',
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('AI 판단 타임아웃 (60초)')), 60000)
              ),
            ]);

            if (aiDecision.action === 'hold' || aiDecision.action === 'scale_in') {
              shouldSell = false;
              exitReason = `AI 보유판단(soft_ai_first): ${aiDecision.reasoning || 'hold'}`;
            } else if (aiDecision.action === 'partial_exit' && holding.quantity >= 2) {
              shouldSell = true;
              sellRatio = 0.5;
              exitReason = `AI 부분청산(soft_ai_first): ${aiDecision.reasoning || 'partial_exit'}`;
            } else if (aiDecision.action === 'full_exit' || aiDecision.action === 'stop_loss') {
              shouldSell = true;
              sellRatio = 1;
              exitReason = `AI 청산(soft_ai_first): ${aiDecision.reasoning || aiDecision.action}`;
            }
          } catch (aiErr) {
            console.warn(`    ⚠️ soft_ai_first 판단 실패 - 기존 청산 로직 유지`, aiErr);
          }
        }

        if (shouldSell) {
          console.log(`    🚨 Exit triggered for ${holding.stockCode}: ${exitReason}`);
          await this.executeExitSell(model, settings, activeAccount, holding, currentPrice, exitReason, kiwoomService, sellRatio);
        }
      } catch (err) {
        console.error(`    ❌ Error checking exit for ${holding.stockCode}:`, err);
      }
    }
  }

  private async getCurrentRainbowLine(
    stockCode: string,
    currentPrice: number,
    kiwoomService: KiwoomService
  ): Promise<number> {
    try {
      const chartData = await kiwoomService.getStockChart(stockCode, 'D', 250);
      const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
      const result = RainbowChartAnalyzer.analyze(stockCode, ohlcv, 240);
      const range = result.highest - result.lowest;
      const currentPercent = range > 0 ? ((currentPrice - result.lowest) / range) * 100 : 50;
      return Math.min(100, Math.max(10, Math.round(currentPercent / 10) * 10));
    } catch {
      return 50;
    }
  }

  private async executeExitSell(
    model: AiModel,
    settings: AutoTradingSettings,
    activeAccount: any,
    holding: any,
    currentPrice: number,
    exitReason: string,
    kiwoomService: KiwoomService,
    sellRatio: number = 1
  ): Promise<void> {
    let quantity = Math.floor(holding.quantity * Math.max(0, Math.min(1, sellRatio)));
    if (!quantity || quantity <= 0) return;

    // ── 스마트 중복 매도 방지 (분할 매도 지원) ──
    const holdingUpdatedAt = holding.updatedAt ? new Date(holding.updatedAt) : new Date(0);

    // 당일의 매도 관련 주문들 (대기 중 + 잔고 반영 전 체결된 건)
    const existingOrders = await storage.getOrders(activeAccount.id, 200);
    const sellRetryCooldownMs = this.getSellRetryCooldownMs(settings);
    const targetHoldingCode = this.normalizeStockCode(holding.stockCode);
    const recentFailedSell = existingOrders.find((o: any) => {
      if (this.normalizeStockCode(o.stockCode) !== targetHoldingCode || o.orderType !== 'sell' || o.orderStatus !== 'failed') return false;
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return ts >= Date.now() - sellRetryCooldownMs;
    });
    if (recentFailedSell) {
      console.log(`    [SellCooldown] recent failed sell exists for ${holding.stockCode} - skip retry`);
      return;
    }
    const unsyncedSells = existingOrders.filter((o: any) =>
      this.normalizeStockCode(o.stockCode) === targetHoldingCode &&
      o.orderType === 'sell' &&
      (
        o.orderStatus === 'pending' || 
        (o.orderStatus === 'completed' && o.executedAt && new Date(o.executedAt) > holdingUpdatedAt)
      )
    );

    const unsyncedQuantity = unsyncedSells.reduce((sum, o) => sum + (o.orderQuantity || 0), 0);
    const virtualRemainingQty = holding.quantity - unsyncedQuantity;

    if (virtualRemainingQty <= 0) {
      console.log(`    ⚠️ ${holding.stockCode} 가상 잔고 부족 (${holding.quantity}주 보유 - ${unsyncedQuantity}주 주문 중) — 중복 매도 차단`);
      return;
    }

    if (quantity > virtualRemainingQty) {
      console.log(`    ⚠️ ${holding.stockCode} 요청 수량(${quantity}주)이 가상 잔고(${virtualRemainingQty}주) 초과 — 수량 조정 혹은 차단`);
      // 수량을 가상 잔고에 맞춰 조정하거나 차단 (여기서는 일단 안전하게 차단)
      return;
    }

    const exitSnapshot = await this.getBrokerPositionSnapshot(
      kiwoomService,
      activeAccount.accountNumber,
      activeAccount.accountType === 'real' ? 'real' : 'mock',
      holding.stockCode,
    );
    if (exitSnapshot) {
      if (exitSnapshot.holdingQty <= 0) {
        console.log(`    [SellGuard] broker holding is 0 for ${holding.stockCode} - skip`);
        return;
      }
      if (exitSnapshot.sellableQty !== null) {
        quantity = Math.min(quantity, exitSnapshot.sellableQty);
      } else {
        quantity = Math.min(quantity, exitSnapshot.holdingQty);
      }
      if (!quantity || quantity <= 0) {
        console.log(`    [SellGuard] broker sellable is 0 for ${holding.stockCode} - skip`);
        return;
      }
    }




    try {
      const exitSellOrder = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: holding.stockCode,
        stockName: holding.stockName || holding.stockCode,
        orderType: 'sell',
        orderMethod: 'market',
        orderPrice: currentPrice.toFixed(2),
        orderQuantity: quantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      let exitSellResp: any;
      try {
        exitSellResp = await kiwoomService.placeOrder({
          accountNumber: activeAccount.accountNumber,
          stockCode: holding.stockCode,
          orderType: 'sell',
          orderQuantity: quantity,
          orderPrice: currentPrice,
          orderMethod: 'market',
        });
      } catch (apiErr: any) {
        const errMsg = apiErr.message || String(apiErr);
        const diagnostics = extractErrorDiagnostics(apiErr);
        await storage.updateOrder(exitSellOrder.id, {
          orderStatus: 'failed',
          errorMessage: errMsg,
          details: {
            lastFailure: diagnostics,
          },
        });
        console.error(`    ❌ 키움 매도 API 실패 (${holding.stockName}): ${errMsg}`);
        // 800033: 잔고 없음 → 로컬 holding 제거해서 재시도 차단
        if (/800033|매도가능수량/.test(errMsg)) {
          console.warn(`    [SellGuard] 800033 잔고 없음 — holding 제거 (재시도 차단): ${holding.stockCode}`);
          await storage.deleteHolding(holding.id);
        }
        await storage.createTradingLog({
          accountId: activeAccount.id,
          action: 'place_exit_sell_order',
          success: false,
          errorMessage: `[${holding.stockName || holding.stockCode}] 청산 매도 실패: ${errMsg}`,
          details: {
            stockCode: holding.stockCode,
            stockName: holding.stockName || holding.stockCode,
            quantity,
            price: currentPrice,
            errorDiagnostics: diagnostics,
          }
        });
        return;
      }
      const exitOrdNo = exitSellResp?.output?.ord_no || exitSellResp?.ord_no || null;
      if (exitOrdNo) await storage.updateOrder(exitSellOrder.id, { orderNumber: exitOrdNo });

      const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      const profitLoss = (currentPrice - avgPrice) * quantity;
      const profitLossRate = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;

      const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
      if (perfEntry) {
        await storage.updateTradingPerformance(perfEntry.id, {
          exitPrice: currentPrice.toFixed(2),
          exitRainbowLine: 0,
          exitReason,
          profitLoss: profitLoss.toFixed(2),
          profitLossRate: profitLossRate.toFixed(4),
          isWin: profitLoss > 0,
        });
      }
      console.log(`    ✅ Exit sell placed: ${quantity}주 @ ${currentPrice} (${exitReason})`);
      const kstDate1 = new Date(Date.now() + 9 * 3600000);
      await storage.createTradeJournal({ userId: model.userId, accountId: activeAccount.id, modelId: model.id, stockCode: holding.stockCode, stockName: holding.stockName || holding.stockCode, tradeDate: kstDate1.toISOString().slice(0, 10).replace(/-/g, ''), tradeTime: kstDate1.toISOString().slice(11, 19), tradeType: 'exit_sell', price: currentPrice.toFixed(2), quantity, totalAmount: (currentPrice * quantity).toFixed(2), avgPrice: avgPrice.toFixed(2), rainbowLine: 0, profitRate: profitLossRate.toFixed(4), profitLoss: profitLoss.toFixed(2), exitReason, isAutoTrading: true, memo: `청산 매도: ${exitReason}` });
      await storage.updateOrder(exitSellOrder.id, { orderStatus: 'completed', executedQuantity: quantity, executedPrice: currentPrice.toFixed(2), executedAt: new Date() });
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SELL', message: `[청산] ${holding.stockName || holding.stockCode} ${quantity}주 @ ${currentPrice.toLocaleString()}원 (${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(0)}원)`, payload: { stockCode: holding.stockCode, stockName: holding.stockName || holding.stockCode, price: currentPrice, quantity, profitLoss, profitLossRate, sellReason: exitReason } }).catch(e => console.error('[Notification]', e));
    } catch (error) {
      console.error(`    ❌ Error executing exit sell for ${holding.stockCode}:`, error);
    }
  }

  // ── GPT + 가중치 기반 종합 분석 (레인보우+모멘텀+뉴스+DART+재무) ──────
  async comprehensiveAiAnalysis(
    stock: { code: string; name: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService: AIService,
    aiModel: string = 'gpt-5-mini',
    usageContext?: { userId: string; accountId?: number | null; source?: string },
  ): Promise<AiAnalysisResult> {
    // ── 1단계: 5개 데이터 병렬 수집 ─────────────────────────────────────
    const [priceResult, chartResult, ratiosResult, newsResult, dartResult] = await Promise.allSettled([
      kiwoomService.getStockPrice(stock.code),
      kiwoomService.getStockChart(stock.code, 'D'),
      kiwoomService.getFinancialRatios(stock.code),
      getNewsService().getStockNews(stock.code, stock.name, 10),
      getDartService().getFilingsByStockCode(stock.code, 30),
    ]);

    // ── 2단계: 가격/거래량 추출 ──────────────────────────────────────────
    const priceOutput = priceResult.status === 'fulfilled' ? priceResult.value.output : null;
    const volume = parseFloat(priceOutput?.acml_vol ?? '0') || 0;

    // ── 2-1단계: 사전 거래량 필터 (GPT 호출 전) ──────────────────────────
    if (settings.requireHighLiquidity && volume < 50_000) {
      return {
        confidence: 0,
        hasGoodFinancials: false,
        hasHighLiquidity: false,
        dartDangerKeyword: null,
        themeScore: 0,
        newsScore: 0,
        financialsScore: 0,
        liquidityScore: 25,
        institutionalScore: 35,
        _skippedReason: '거래량 미달 (사전필터)',
      };
    }

    // ── 3단계: 레인보우 차트 계산 ────────────────────────────────────────
    const chartRaw = chartResult.status === 'fulfilled' ? (chartResult.value.output || chartResult.value) : [];
    const ohlcv = normalizeChartDataAsc(chartRaw);
    const rainbowChart = RainbowChartAnalyzer.analyze(stock.code, ohlcv);

    // ── 4단계: PER/PBR/ROE/EPS/BPS 추출 → GPT 재무 분석 인풋 ───────────
    const ratiosRaw = ratiosResult.status === 'fulfilled' ? ratiosResult.value.output : null;
    const financialRatios = ratiosRaw ? {
      per: ratiosRaw.per || '0',
      pbr: ratiosRaw.pbr || '0',
      eps: ratiosRaw.eps || '0',
      bps: ratiosRaw.bps || '0',
      roe: ratiosRaw.roe || '0',
      debt_ratio: ratiosRaw.debt_ratio || '0',
      reserve_ratio: ratiosRaw.reserve_ratio || '0',
    } : undefined;

    // ── 5단계: 뉴스 감성 데이터 ──────────────────────────────────────────
    const news = newsResult.status === 'fulfilled' ? newsResult.value : undefined;

    // ── 5-2단계: DART 공시 추출 ──────────────────────────────────────────
    const dartFilings = dartResult.status === 'fulfilled'
      ? dartResult.value.map(f => ({ reportNm: f.reportNm, rceptDt: f.rceptDt }))
      : [];

    // ── 6단계: 가격 이력 (최근 20일) ────────────────────────────────────
    const priceHistory = ohlcv.slice(-20).map(d => ({
      date: d.date,
      price: d.close,
      volume: d.volume,
    }));

    // ── 7단계: GPT 단일 호출 (레인보우 + 뉴스 + DART + PER/PBR/ROE + 가격이력) ─
    const integrated = await aiService.integratedAnalysis({
      stockCode: stock.code,
      stockName: stock.name,
      currentPrice: stock.price,
      financialRatios,
      priceHistory,
      news,
      dartFilings,
      rainbowChart,
      model: aiModel,
      usageContext,
    });

    // ── 8단계: 거래량 기반 점수 (규칙, GPT 불필요) ──────────────────────
    const liquidityScore =
      volume >= 500_000 ? 80 :
      volume >= 100_000 ? 65 :
      volume >= 50_000  ? 45 : 25;

    const institutionalScore =
      volume >= 1_000_000 ? 75 :
      volume >= 500_000   ? 65 :
      volume >= 100_000   ? 55 :
      volume >= 50_000    ? 45 : 35;

    // ── 9단계: 가중치 곱하기 → 최종 confidence ──────────────────────────
    const weights = {
      theme:         parseFloat(settings.themeWeight?.toString() ?? '20'),
      news:          parseFloat(settings.newsWeight?.toString() ?? '15'),
      financials:    parseFloat(settings.financialsWeight?.toString() ?? '25'),
      liquidity:     parseFloat(settings.liquidityWeight?.toString() ?? '20'),
      institutional: parseFloat(settings.institutionalWeight?.toString() ?? '20'),
    };
    const totalWeight = weights.theme + weights.news + weights.financials + weights.liquidity + weights.institutional;
    const denominator = totalWeight > 0 ? totalWeight : 100;
    const confidence = Math.min(100, Math.max(0, (
      integrated.themeScore      * weights.theme +
      integrated.newsScore       * weights.news +
      integrated.financialScore  * weights.financials +
      liquidityScore             * weights.liquidity +
      institutionalScore         * weights.institutional
    ) / denominator));

    // ── DART 위험공시 감지 ────────────────────────────────────────────────
    const dartDangerFiling = dartFilings.find(f =>
      DART_DANGER_KEYWORDS.some(kw => f.reportNm.includes(kw))
    );
    const dartDangerKeyword = dartDangerFiling?.reportNm ?? null;

    const financialsThreshold = parseFloat(settings.financialsScoreThreshold?.toString() ?? '60');
    const liquidityThreshold  = parseFloat(settings.liquidityScoreThreshold?.toString()  ?? '40');
    const hasGoodFinancials = integrated.financialScore >= financialsThreshold;
    const hasHighLiquidity  = liquidityScore >= liquidityThreshold;

    return {
      confidence,
      hasGoodFinancials,
      hasHighLiquidity,
      dartDangerKeyword,
      themeScore:        integrated.themeScore,
      newsScore:         integrated.newsScore,
      financialsScore:   integrated.financialScore,
      liquidityScore,
      institutionalScore,
    };
  }

  async evaluate10LineRainbow(
    stock: { code: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    userId?: string
  ): Promise<RainbowEval> {
    const chartRaw = userId
      ? await getUserKiwoomService().getChart(userId, stock.code, 'D', 250)
      : await kiwoomService.getStockChart(stock.code, 'D', 250);
    const ohlcv = normalizeChartDataAsc(Array.isArray(chartRaw) ? chartRaw : (chartRaw?.output || chartRaw));
    const result = RainbowChartAnalyzer.analyze(stock.code, ohlcv, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);

    const range = result.highest - result.lowest;
    const currentPercent = range > 0 ? ((stock.price - result.lowest) / range) * 100 : 50;
    const currentLine = Math.min(100, Math.max(10, Math.round(currentPercent / 10) * 10));

    const rainbowSettings = (settings.rainbowLineSettings as { line: number; buyWeight: number; sellWeight: number }[] | null | undefined);
    let buyWeight = 0;
    let sellWeight = 0;

    if (rainbowSettings && Array.isArray(rainbowSettings) && rainbowSettings.length > 0) {
      const matched = rainbowSettings.reduce((prev, curr) =>
        Math.abs(curr.line - currentLine) < Math.abs(prev.line - currentLine) ? curr : prev
      );
      buyWeight = matched.buyWeight ?? 0;
      sellWeight = matched.sellWeight ?? 0;
    } else {
      if (result.recommendation === 'strong-buy') buyWeight = 100;
      else if (result.recommendation === 'buy') buyWeight = 70;
      else if (result.recommendation === 'sell') sellWeight = 70;
      else if (result.recommendation === 'strong-sell') sellWeight = 100;
    }

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let weight = 0;
    if (buyWeight > 0 && buyWeight >= sellWeight) {
      action = 'buy';
      weight = buyWeight;
    } else if (sellWeight > 0 && sellWeight > buyWeight) {
      action = 'sell';
      weight = sellWeight;
    }

    return { currentLine, action, weight, confidence: signalStrength };
  }

  async executeBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowEval,
    aiAnalysis: AiAnalysisResult | null,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    💰 BUY SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);
    try {
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const config = (model.config as any) || {};
      const targetAccountId = config.accountId;
      if (!targetAccountId) { console.log(`    ⛔ accountId 미설정 — 매수 중단`); return; }
      const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
      if (!activeAccount) { console.log(`    ⚠️  No active account found - skipping`); return; }

      const holdings = await storage.getHoldings(activeAccount.id);
      const targetCode = this.normalizeStockCode(stock.code);
      const alreadyHolding = holdings.find(h => this.normalizeStockCode(h.stockCode) === targetCode);
      if (alreadyHolding) {
        console.log(`    ⏭️  ${stock.code} 이미 보유 중 (${alreadyHolding.quantity}주) — 신규 매수 건너뜀`);
        return;
      }
      const existingBuyOrders = await storage.getOrders(activeAccount.id, 200);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1) 대기 중인 매수 주문 확인
      const hasPendingBuy = existingBuyOrders.some((o: any) =>
        o.stockCode === stock.code && o.orderType === 'buy' && o.orderStatus === 'pending'
      );
      if (hasPendingBuy) {
        console.log(`    ⏭️ 대기중 매수 주문 이미 존재 (${stock.code}) — 중복 매수 스킵`);
        return;
      }

      // 2) 당일 이미 체결된 매수 주문 확인 (잔고 미동기 상태 대비)
      // 신규 진입(New Position)은 하루에 한 번만 수행하도록 제한
      const hasCompletedBuyToday = existingBuyOrders.some((o: any) =>
        o.stockCode === stock.code && 
        o.orderType === 'buy' && 
        o.orderStatus === 'completed' &&
        o.executedAt && new Date(o.executedAt) >= todayStart
      );
      if (hasCompletedBuyToday) {
        console.log(`    ⏭️ 당일 매수 체결 기록 존재 (${stock.code}) — 신규 진입 중복 방어 (추가 매수는 scale-in 로직에서 처리됨)`);
        return;
      }

      const maxPositions = config.maxPositions != null ? parseInt(String(config.maxPositions)) : null;
      if (maxPositions && maxPositions > 0 && holdings.length >= maxPositions) {
        console.log(`    ⚠️  최대 보유 종목 초과 (${holdings.length}/${maxPositions}) - 매수 건너뜀`);
        return;
      }

      // ── 일일 최대 거래 횟수 체크 ──
      const maxDailyTrades = parseInt(settings.maxDailyTrades?.toString() || '0');
      if (maxDailyTrades > 0) {
        const todayCount = await this.countTodayAutoTrades(activeAccount.id);
        if (todayCount >= maxDailyTrades) {
          console.log(`    ⚠️  일일 최대 거래 횟수 초과 (${todayCount}/${maxDailyTrades}) - 매수 건너뜀`);
          return;
        }
        console.log(`    ℹ️  오늘 자동매매 횟수: ${todayCount}/${maxDailyTrades}`);
      }

      let quantity: number;
      const cfgUnitSizeVal = this.parsePositiveNumber(config?.unitSize, 0);
      if (cfgUnitSizeVal > 0) {
        // 1유닛 금액 설정 시: 유닛금액 × 유닛수
        const unitSize = this.getConfiguredUnitSize(settings, config);
        const unitCount = this.getUnitCountForLine(rainbow.currentLine, settings, config);
        quantity = Math.floor((unitSize * unitCount) / stock.price);
        quantity = this.clampQuantityByCapital(quantity, stock.price, settings, unitSize, 0);
        console.log(`    📐 유닛 매수: unitSize=${unitSize}, unitCount=${unitCount}, qty=${quantity}`);
      } else {
        // 1유닛 금액 미설정: 기본유닛금액 × 라인 buyWeight%
        const baseSize = this.parsePositiveNumber(settings.baseUnitSize, this.parsePositiveNumber(settings.defaultPositionSize, 1_000_000));
        const positionSize = Math.min(baseSize * (rainbow.weight / 100), parseFloat(settings.maxPositionSize.toString()));
        quantity = Math.floor(positionSize / stock.price);
        quantity = this.clampQuantityByCapital(quantity, stock.price, settings, baseSize, 0);
        console.log(`    📐 비중 매수: baseSize=${baseSize}, weight=${rainbow.weight}%, positionSize=${positionSize}, qty=${quantity}`);
      }
      if (quantity === 0) { console.log(`    ⚠️  Calculated quantity is 0 - skipping`); return; }

      const order = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: stock.code,
        stockName: stock.name,
        orderType: 'buy',
        orderMethod: 'market',
        orderPrice: stock.price.toFixed(2),
        orderQuantity: quantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      let orderResp: any;
      try {
        orderResp = await kiwoomService.placeOrder({
          accountNumber: activeAccount.accountNumber,
          stockCode: stock.code,
          orderType: 'buy',
          orderQuantity: quantity,
          orderPrice: stock.price,
          orderMethod: 'market',
        });
      } catch (apiErr: any) {
        const errMsg = apiErr.message || String(apiErr);
        const diagnostics = extractErrorDiagnostics(apiErr);
        await storage.updateOrder(order.id, {
          orderStatus: 'failed',
          errorMessage: errMsg,
          details: {
            lastFailure: diagnostics,
          },
        });
        console.error(`    ❌ 키움 매수 API 실패 (${stock.name}): ${errMsg}`);
        await storage.createTradingLog({
          accountId: activeAccount.id,
          action: 'place_buy_order',
          success: false,
          errorMessage: `[${stock.name}] 매수 실패: ${errMsg}`,
          details: { stockCode: stock.code, quantity, price: stock.price, errorDiagnostics: diagnostics }
        });
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'ERROR', message: `[주문실패] ${stock.name} 매수 실패: ${errMsg}`, payload: { stockCode: stock.code } }).catch(e => console.error('[Notification]', e));
        return;
      }
      const ordNo = orderResp?.output?.ord_no || orderResp?.ord_no || null;
      if (ordNo) await storage.updateOrder(order.id, { orderNumber: ordNo });

      await storage.createTradingPerformance({
        modelId: model.id,
        orderId: order.id,
        stockCode: stock.code,
        stockName: stock.name,
        entryPrice: stock.price.toFixed(2),
        quantity,
        entryRainbowLine: rainbow.currentLine,
        entryAiConfidence: aiAnalysis ? aiAnalysis.confidence.toFixed(2) : '0',
        entryConditions: { rainbow, ...(aiAnalysis ? { aiAnalysis } : {}) },
        themeScore: aiAnalysis ? aiAnalysis.themeScore.toFixed(2) : '0',
        newsScore: aiAnalysis ? aiAnalysis.newsScore.toFixed(2) : '0',
        financialsScore: aiAnalysis ? aiAnalysis.financialsScore.toFixed(2) : '0',
        liquidityScore: aiAnalysis ? aiAnalysis.liquidityScore.toFixed(2) : '0',
        institutionalScore: aiAnalysis ? aiAnalysis.institutionalScore.toFixed(2) : '0',
        filledUnits: 1,
        avgEntryLine: rainbow.currentLine,
      });

      console.log(`    ✅ BUY order placed: ${quantity} shares @ ${stock.price}`);
      const kstDate2 = new Date(Date.now() + 9 * 3600000);
      await storage.createTradeJournal({ userId: model.userId, accountId: activeAccount.id, modelId: model.id, stockCode: stock.code, stockName: stock.name, tradeDate: kstDate2.toISOString().slice(0, 10).replace(/-/g, ''), tradeTime: kstDate2.toISOString().slice(11, 19), tradeType: 'buy', price: stock.price.toFixed(2), quantity, totalAmount: (stock.price * quantity).toFixed(2), avgPrice: '0', rainbowLine: rainbow.currentLine, profitRate: '0', profitLoss: '0', aiConfidence: aiAnalysis ? aiAnalysis.confidence.toFixed(2) : '0', isAutoTrading: true, memo: `AI 매수 (${rainbow.currentLine}% 선)` });
      await storage.updateOrder(order.id, { orderStatus: 'completed', executedQuantity: quantity, executedPrice: stock.price.toFixed(2), executedAt: new Date() });

      // holdings 즉시 upsert — BalanceRefresh 전에도 maxPositions 체크가 정확하게 동작하도록
      const existingHolding = (await storage.getHoldings(activeAccount.id))
        .find(h => this.normalizeStockCode(h.stockCode) === this.normalizeStockCode(stock.code));
      if (existingHolding) {
        await storage.updateHolding(existingHolding.id, {
          quantity: existingHolding.quantity + quantity,
          averagePrice: ((Number(existingHolding.averagePrice) * existingHolding.quantity + stock.price * quantity) / (existingHolding.quantity + quantity)).toFixed(2),
          currentPrice: stock.price.toFixed(2),
        });
      } else {
        await storage.createHolding({
          accountId: activeAccount.id, stockCode: stock.code, stockName: stock.name,
          quantity, averagePrice: stock.price.toFixed(2), currentPrice: stock.price.toFixed(2),
        });
      }

      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'BUY', message: `[매수] ${stock.name} ${quantity}주 @ ${stock.price.toLocaleString()}원`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity, rainbowLine: rainbow.currentLine, confidence: aiAnalysis?.confidence ?? 0, themeScore: aiAnalysis?.themeScore ?? 0, newsScore: aiAnalysis?.newsScore ?? 0, financialsScore: aiAnalysis?.financialsScore ?? 0, liquidityScore: aiAnalysis?.liquidityScore ?? 0, institutionalScore: aiAnalysis?.institutionalScore ?? 0 } }).catch(e => console.error('[Notification]', e));
    } catch (error) {
      console.error(`    ❌ Error executing buy:`, error);
    }
  }

  async executeSell(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowEval,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    💵 SELL SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);
    const accounts = await storage.getKiwoomAccounts(model.userId);
    const targetAccountId = (model.config as any)?.accountId;
    if (!targetAccountId) { console.log(`    ⛔ accountId 미설정 — 매도 중단`); return; }
    const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    const targetCode = this.normalizeStockCode(stock.code);
    const holding = holdings.find((h: any) => this.normalizeStockCode(h.stockCode) === targetCode);
    if (!holding) { console.log(`    ⚠️  No holdings found for ${stock.code} - skipping`); return; }

    // 중복 매도 주문 방지
    const existingOrders = await storage.getOrders(activeAccount.id, 200);
    const hasPendingSell = existingOrders.some((o: any) =>
      this.normalizeStockCode(o.stockCode) === targetCode && o.orderType === 'sell' && o.orderStatus === 'pending'
    );
    if (hasPendingSell) {
      console.log(`    ⏭️ 대기중 매도 주문 이미 존재 (${stock.code}) — 중복 주문 스킵`);
      return;
    }
    const sellRetryCooldownMs = this.getSellRetryCooldownMs(settings);
    const recentFailedSell = existingOrders.find((o: any) => {
      if (this.normalizeStockCode(o.stockCode) !== targetCode || o.orderType !== 'sell' || o.orderStatus !== 'failed') return false;
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return ts >= Date.now() - sellRetryCooldownMs;
    });
    if (recentFailedSell) {
      console.log(`    [SellCooldown] recent failed sell exists for ${stock.code} - skip retry`);
      return;
    }

    try {
      let sellQuantity = Math.floor(holding.quantity * (rainbow.weight / 100));
      if (sellQuantity === 0) { console.log(`    ⚠️  Calculated sell quantity is 0 - skipping`); return; }

      const sellSnapshot = await this.getBrokerPositionSnapshot(
        kiwoomService,
        activeAccount.accountNumber,
        activeAccount.accountType === 'real' ? 'real' : 'mock',
        stock.code,
      );
      if (sellSnapshot) {
        if (sellSnapshot.holdingQty <= 0) {
          console.log(`    [SellGuard] broker holding is 0 for ${stock.code} - skip`);
          return;
        }
        if (sellSnapshot.sellableQty !== null) {
          sellQuantity = Math.min(sellQuantity, sellSnapshot.sellableQty);
        } else {
          sellQuantity = Math.min(sellQuantity, sellSnapshot.holdingQty);
        }
        if (!sellQuantity || sellQuantity <= 0) {
          console.log(`    [SellGuard] broker sellable is 0 for ${stock.code} - skip`);
          return;
        }
      }

      const sellOrder = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: stock.code,
        stockName: stock.name,
        orderType: 'sell',
        orderMethod: 'market',
        orderPrice: stock.price.toFixed(2),
        orderQuantity: sellQuantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      let sellResp: any;
      try {
        sellResp = await kiwoomService.placeOrder({
          accountNumber: activeAccount.accountNumber,
          stockCode: stock.code,
          orderType: 'sell',
          orderQuantity: sellQuantity,
          orderPrice: stock.price,
          orderMethod: 'market',
        });
      } catch (apiErr: any) {
        const errMsg = apiErr.message || String(apiErr);
        const diagnostics = extractErrorDiagnostics(apiErr);
        await storage.updateOrder(sellOrder.id, {
          orderStatus: 'failed',
          errorMessage: errMsg,
          details: {
            lastFailure: diagnostics,
          },
        });
        console.error(`    ❌ 키움 매도 API 실패 (${stock.name}): ${errMsg}`);
        await storage.createTradingLog({
          accountId: activeAccount.id,
          action: 'place_sell_order',
          success: false,
          errorMessage: `[${stock.name}] 매도 실패: ${errMsg}`,
          details: { stockCode: stock.code, quantity: sellQuantity, price: stock.price, errorDiagnostics: diagnostics }
        });
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'ERROR', message: `[주문실패] ${stock.name} 매도 실패: ${errMsg}`, payload: { stockCode: stock.code } }).catch(e => console.error('[Notification]', e));
        return;
      }
      const sellOrdNo = sellResp?.output?.ord_no || sellResp?.ord_no || null;
      if (sellOrdNo) await storage.updateOrder(sellOrder.id, { orderNumber: sellOrdNo });

      const holdingAvgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      let profitLoss = holdingAvgPrice > 0 ? (stock.price - holdingAvgPrice) * sellQuantity : 0;
      let profitLossRate = holdingAvgPrice > 0 ? ((stock.price / holdingAvgPrice) - 1) * 100 : 0;
      const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
      if (perfEntry) {
        profitLoss = (stock.price - parseFloat(perfEntry.entryPrice.toString())) * sellQuantity;
        profitLossRate = ((stock.price / parseFloat(perfEntry.entryPrice.toString())) - 1) * 100;
        await storage.updateTradingPerformance(perfEntry.id, {
          exitPrice: stock.price.toFixed(2),
          exitRainbowLine: rainbow.currentLine,
          exitReason: 'target',
          profitLoss: profitLoss.toFixed(2),
          profitLossRate: profitLossRate.toFixed(4),
          isWin: profitLoss > 0,
        });
      }
      console.log(`    ✅ SELL order placed: ${sellQuantity} shares @ ${stock.price} (P/L: ${profitLoss.toFixed(0)})`);
      const kstDate3 = new Date(Date.now() + 9 * 3600000);
      await storage.createTradeJournal({ userId: model.userId, accountId: activeAccount.id, modelId: model.id, stockCode: stock.code, stockName: stock.name, tradeDate: kstDate3.toISOString().slice(0, 10).replace(/-/g, ''), tradeTime: kstDate3.toISOString().slice(11, 19), tradeType: 'sell', price: stock.price.toFixed(2), quantity: sellQuantity, totalAmount: (stock.price * sellQuantity).toFixed(2), avgPrice: holdingAvgPrice.toFixed(2), rainbowLine: rainbow.currentLine, profitRate: profitLossRate.toFixed(4), profitLoss: profitLoss.toFixed(2), exitReason: 'target', isAutoTrading: true, memo: `AI 매도 (${rainbow.currentLine}% 선)` });
      await storage.updateOrder(sellOrder.id, { orderStatus: 'completed', executedQuantity: sellQuantity, executedPrice: stock.price.toFixed(2), executedAt: new Date() });
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SELL', message: `[매도] ${stock.name} ${sellQuantity}주 @ ${stock.price.toLocaleString()}원 (${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(0)}원)`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity: sellQuantity, profitLoss, profitLossRate, sellReason: 'target', exitRainbowLine: rainbow.currentLine } }).catch(e => console.error('[Notification]', e));
    } catch (error) {
      console.error(`    ❌ Error executing sell:`, error);
    }
  }

  async evaluateCandidateStock(
    model: AiModel,
    settings: AutoTradingSettings,
    candidate: CandidateStock,
    kiwoomService: KiwoomService,
    aiService: AIService,
    aiModel: string = 'gpt-5-mini',
  ): Promise<void> {
    const decidedAt = new Date();
    const dailyKey = this.todayKST();
    const cooldown = this.getDecisionCooldownWindow(settings, decidedAt);
    const cooldownKey = this.getDecisionCooldownKey(cooldown.mode, decidedAt);

    // Cooldown guard: skip re-evaluating the same stock too frequently.
    const recentDecision = await storage.getLatestCandidateDecisionByCooldownKey(
      model.id,
      candidate.stockCode,
      cooldownKey,
    );
    if (recentDecision) {
      console.log(`  ⏭  ${candidate.stockCode} ${candidate.stockName} — 쿨다운 활성 (AI 미호출, 버킷: ${cooldown.label})`);
      if (candidate.id) {
        await storage.updateCandidateEvaluation(candidate.id, {
          evaluationResult: {
            accepted: false,
            skipReason: 'decision_cooldown_active',
            decidedAt: decidedAt.toISOString(),
            dailyKey,
            cooldownMode: cooldown.mode,
            cooldownWindowLabel: cooldown.label,
            cooldownKey,
            cooldownSince: cooldown.since.toISOString(),
            lastDecisionAt: recentDecision.decidedAt?.toISOString?.() ?? recentDecision.decidedAt ?? null,
            lastDecisionAccepted: recentDecision.accepted,
            lastRejectReason: recentDecision.rejectReason ?? null,
          },
          skipReason: 'decision_cooldown_active',
          evaluatedAt: decidedAt,
        });
      }
      return;
    }

    const modelConfig = (model.config as any) || {};
    const modelSnapshot = {
      id: model.id,
      modelName: model.modelName,
      modelType: model.modelType,
      aiModelId: aiModel,
      accountId: modelConfig.accountId ?? null,
      config: modelConfig,
    };
    const settingsSnapshot = {
      minAiConfidence: settings.minAiConfidence,
      requireGoodFinancials: settings.requireGoodFinancials,
      requireHighLiquidity: settings.requireHighLiquidity,
      requireMarketIssue: settings.requireMarketIssue,
      aiEntryPolicy: settings.aiEntryPolicy ?? null,
      maxDailyTrades: settings.maxDailyTrades,
      defaultPositionSize: settings.defaultPositionSize,
      rainbowLineSettings: settings.rainbowLineSettings,
    };

    const persistCandidateEvaluation = async (
      accepted: boolean,
      skipReason: string | null,
      details: Record<string, unknown>,
    ) => {
      if (!candidate.id) return;
      await storage.updateCandidateEvaluation(candidate.id, {
        evaluationResult: {
          accepted,
          skipReason,
          decidedAt: decidedAt.toISOString(),
          dailyKey,
          modelSnapshot,
          settingsSnapshot,
          ...details,
        },
        skipReason,
        evaluatedAt: decidedAt,
      });
    };

    const logDecision = async (params: {
      accepted: boolean;
      rejectReason: string | null;
      decisionType: string;
      qualitativeReason: string;
      quantitativeReason?: Record<string, unknown>;
      marketAnalysis?: AiAnalysisResult;
      currentLine?: number;
      unitCount?: number;
    }) => {
      await storage.createCandidateDecisionLog({
        modelId: model.id,
        stockCode: candidate.stockCode,
        stockName: candidate.stockName || candidate.stockCode,
        scorecard: params.marketAnalysis
          ? this.buildCandidateScorecard(params.marketAnalysis)
          : null,
        aiDecision: {
          accepted: params.accepted,
          decisionType: params.decisionType,
          qualitativeReason: params.qualitativeReason,
          quantitativeReason: params.quantitativeReason ?? null,
          dailyKey,
          decidedAt: decidedAt.toISOString(),
          cooldownMode: cooldown.mode,
          cooldownWindowLabel: cooldown.label,
          cooldownKey,
          cooldownSince: cooldown.since.toISOString(),
          modelSnapshot,
          settingsSnapshot,
          currentLine: params.currentLine ?? null,
          unitCount: params.unitCount ?? null,
          marketAnalysis: params.marketAnalysis ?? null,
          candidateContext: {
            candidateId: candidate.id,
            source: candidate.source,
            scannedLine: candidate.scannedLine,
          },
        },
        ladderPlan: null,
        accepted: params.accepted,
        rejectReason: params.rejectReason ?? null,
        strategyVersion: 'v2',
      });

      await persistCandidateEvaluation(params.accepted, params.rejectReason, {
        decisionType: params.decisionType,
        qualitativeReason: params.qualitativeReason,
        quantitativeReason: params.quantitativeReason ?? null,
      });
    };

    try {
      const priceData = await kiwoomService.getStockPrice(candidate.stockCode);
      const price = parseFloat(priceData.output?.stck_prpr ?? '0');
      if (!price) {
        await logDecision({
          accepted: false,
          rejectReason: 'price_unavailable',
          decisionType: 'precheck_price_unavailable',
          qualitativeReason: '현재가를 확보하지 못해 평가를 중단했습니다.',
        });
        return;
      }
      const stock = { code: candidate.stockCode, name: candidate.stockName, price };

      const config = modelConfig;
      if (!config.accountId) {
        await logDecision({
          accepted: false,
          rejectReason: 'account_not_configured',
          decisionType: 'precheck_account_not_configured',
          qualitativeReason: '모델에 연결된 계좌가 없어 평가를 중단했습니다.',
        });
        return;
      }
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const activeAccount = accounts.find((a: any) => a.id === config.accountId);
      if (!activeAccount) {
        await logDecision({
          accepted: false,
          rejectReason: 'account_not_found',
          decisionType: 'precheck_account_not_found',
          qualitativeReason: '설정된 계좌를 찾을 수 없어 평가를 중단했습니다.',
        });
        return;
      }

      const holdings = await storage.getHoldings(activeAccount.id);
      const targetCode = this.normalizeStockCode(stock.code);
      const existingHolding = holdings.find(h => this.normalizeStockCode(h.stockCode) === targetCode);

      const rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService, model.userId);
      const { currentLine } = rainbowEval;
      console.log(`    🌈 ${stock.name}(${stock.code}): currentLine=${currentLine}`);

      type PrecheckResult =
        | {
          eligible: false;
          reason: string;
          decisionType: string;
          qualitativeReason: string;
          quantitativeReason: Record<string, unknown>;
        }
        | {
          eligible: true;
          isAdditionalBuy: false;
          unitCount: number;
        }
        | {
          eligible: true;
          isAdditionalBuy: true;
          entryLine: number;
          nextLowerLine: number;
        };

      let resolvedPrecheck: PrecheckResult;
      if (!existingHolding) {
        const unitCount = this.getUnitCountForLine(currentLine, settings, config);
        if (unitCount <= 0 || currentLine > 50) {
          resolvedPrecheck = {
            eligible: false,
            reason: 'line_or_unit_not_met',
            decisionType: 'filter_entry_line_or_unit',
            qualitativeReason: '진입 라인/유닛 조건을 충족하지 못했습니다.',
            quantitativeReason: { currentLine, unitCount },
          };
        } else {
          resolvedPrecheck = {
            eligible: true,
            isAdditionalBuy: false,
            unitCount,
          };
        }
      } else {
        const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
        const entryLine = perfEntry?.entryRainbowLine ?? candidate.scannedLine ?? 50;
        if (entryLine <= 10) {
          resolvedPrecheck = {
            eligible: false,
            reason: 'already_holding_lowest_line',
            decisionType: 'holding_no_additional_buy',
            qualitativeReason: '이미 보유 중이며 최하위 라인이라 추가매수 대상이 아닙니다.',
            quantitativeReason: { entryLine, currentLine },
          };
        } else {
          const nextLowerLine = entryLine - 10;
          if (!(currentLine <= nextLowerLine && currentLine >= 10)) {
            resolvedPrecheck = {
              eligible: false,
              reason: 'already_holding_waiting_line',
              decisionType: 'holding_waiting_for_next_line',
              qualitativeReason: '보유 종목이며 다음 하단 라인 도달 전이라 추가매수를 보류합니다.',
              quantitativeReason: { entryLine, nextLowerLine, currentLine },
            };
          } else {
            resolvedPrecheck = {
              eligible: true,
              isAdditionalBuy: true,
              entryLine,
              nextLowerLine,
            };
          }
        }
      }

      if (!resolvedPrecheck.eligible) {
        await logDecision({
          accepted: false,
          rejectReason: resolvedPrecheck.reason,
          decisionType: resolvedPrecheck.decisionType,
          qualitativeReason: resolvedPrecheck.qualitativeReason,
          quantitativeReason: resolvedPrecheck.quantitativeReason,
          currentLine,
        });
        return;
      }

      const maxDailyTrades = parseInt(settings.maxDailyTrades?.toString() || '0');
      if (maxDailyTrades > 0) {
        const todayCount = await this.countTodayAutoTrades(activeAccount.id);
        if (todayCount >= maxDailyTrades) {
          await logDecision({
            accepted: false,
            rejectReason: 'daily_trade_limit_reached',
            decisionType: 'filter_daily_trade_limit',
            qualitativeReason: '일일 최대 거래 횟수에 도달하여 신규/추가 매수를 중단합니다.',
            quantitativeReason: { todayCount, maxDailyTrades },
            currentLine,
          });
          return;
        }
      }

      const disableReevaluationForBoughtToday = (settings.aiEntryPolicy as any)?.disableReevaluationForBoughtToday === true;
      if (disableReevaluationForBoughtToday) {
        const nowUtc = Date.now();
        const kstMidnightUtc = Math.floor((nowUtc + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
        const todayOrders = await storage.getOrders(activeAccount.id, 300);
        const targetCodeNorm = this.normalizeStockCode(stock.code);
        const todayAutoBuys = todayOrders.filter((o) => {
          if (!o.isAutoTrading || o.orderType !== 'buy') return false;
          const orderCodeNorm = this.normalizeStockCode(o.stockCode);
          if (orderCodeNorm !== targetCodeNorm) return false;
          const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
          return ts >= kstMidnightUtc;
        });
        if (todayAutoBuys.length > 0) {
          await logDecision({
            accepted: false,
            rejectReason: 'bought_today_recheck_disabled',
            decisionType: 'filter_bought_today_recheck_disabled',
            qualitativeReason: '당일 매수된 종목은 재평가 금지 설정으로 후보 재평가를 건너뜁니다.',
            quantitativeReason: { todayAutoBuyCount: todayAutoBuys.length },
            currentLine,
          });
          return;
        }
      }

      // ── 시장 이슈 종목 필터 ──────────────────────────────────────────────
      if (settings.requireMarketIssue) {
        const today = this.todayKST();
        const issues = await storage.getMarketIssuesByStock(stock.code);
        const hasTodayIssue = issues.some(i => i.issueDate === today);
        if (!hasTodayIssue) {
          console.log(`    ⚠️  시장 이슈 관련 종목 아님 (${stock.code}, ${today}) - 스킵`);
          storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 시장이슈 미등록`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '시장이슈 미등록' } }).catch(e => console.error('[Notification]', e));
          await logDecision({
            accepted: false,
            rejectReason: 'market_issue_required',
            decisionType: 'filter_market_issue',
            qualitativeReason: '당일 장 이슈 종목 조건을 충족하지 못했습니다.',
            quantitativeReason: { issueDate: today, issueCount: issues.length },
          });
          return;
        }
        console.log(`    ✅ 시장 이슈 확인됨: ${stock.code}`);
      }

      // ── GPT + 가중치 기반 종합 분석 ──────────────────────────────────────
      const marketAnalysis = await this.comprehensiveAiAnalysis(
        stock,
        settings,
        kiwoomService,
        aiService,
        aiModel,
        {
          userId: model.userId,
          accountId: Number((model.config as any)?.accountId ?? 0) || null,
          source: 'auto-trading:evaluate-candidate',
        },
      );
      if (marketAnalysis._skippedReason) {
        console.log(`    ⚡ 사전필터 스킵: ${marketAnalysis._skippedReason} (거래량 미달, GPT 호출 생략)`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — ${marketAnalysis._skippedReason}`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: marketAnalysis._skippedReason, liquidityScore: marketAnalysis.liquidityScore } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'pre_filter_liquidity',
          decisionType: 'filter_pre_liquidity',
          qualitativeReason: marketAnalysis._skippedReason,
          quantitativeReason: { liquidityScore: marketAnalysis.liquidityScore },
          marketAnalysis,
          currentLine,
        });
        return;
      }
      console.log(`    📊 AI분석 신뢰도: ${marketAnalysis.confidence.toFixed(1)}% (테마:${marketAnalysis.themeScore} 뉴스:${marketAnalysis.newsScore} 재무:${marketAnalysis.financialsScore} 유동성:${marketAnalysis.liquidityScore})`);

      // ── 최소 신뢰도 필터 ─────────────────────────────────────────────────
      const minConf = parseFloat(settings.minAiConfidence?.toString() ?? '0');
      if (minConf > 0 && marketAnalysis.confidence < minConf) {
        const confidenceBreakdown = this.buildConfidenceBreakdown(settings, marketAnalysis);
        console.log(`    ⚠️  종합 점수 ${marketAnalysis.confidence.toFixed(1)}% < 최솟값 ${minConf}% - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — AI신뢰도 미달 (${marketAnalysis.confidence.toFixed(1)}% < ${minConf}%)`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: 'minAiConf미달', confidence: marketAnalysis.confidence, themeScore: marketAnalysis.themeScore, newsScore: marketAnalysis.newsScore, financialsScore: marketAnalysis.financialsScore, liquidityScore: marketAnalysis.liquidityScore, institutionalScore: marketAnalysis.institutionalScore, confidenceBreakdown } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'min_ai_confidence_not_met',
          decisionType: 'filter_min_ai_confidence',
          qualitativeReason: 'AI 종합 점수가 최소 신뢰도 기준을 충족하지 못했습니다.',
          quantitativeReason: { confidence: marketAnalysis.confidence, minConfidence: minConf },
          marketAnalysis,
          currentLine,
        });
        return;
      }

      const allowSpeculativeLeaderTrades = settings.allowSpeculativeLeaderTrades === true;
      const speculativeMinConfidence = Math.max(minConf + 10, 85);
      const canUseSpeculativeOverride =
        allowSpeculativeLeaderTrades && marketAnalysis.confidence >= speculativeMinConfidence;

      // ── 재무건전성 필터 ──────────────────────────────────────────────────
      if (settings.requireGoodFinancials && !marketAnalysis.hasGoodFinancials) {
        if (canUseSpeculativeOverride) {
          console.log(`    ⚠️  재무건전성 미충족이지만 '세력/급등주 투자 허용' + 고신뢰(${marketAnalysis.confidence.toFixed(1)}%)로 진입 평가 계속`);
        } else {
        console.log(`    ⚠️  재무건전성 미충족 (financialsScore=${marketAnalysis.financialsScore} < 60) - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 재무건전성 미충족 (${marketAnalysis.financialsScore})`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '재무필터', financialsScore: marketAnalysis.financialsScore } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'financials_not_met',
          decisionType: 'filter_financials',
          qualitativeReason: '재무건전성 조건을 충족하지 못했습니다.',
          quantitativeReason: { financialsScore: marketAnalysis.financialsScore, threshold: 60 },
          marketAnalysis,
          currentLine,
        });
        return;
        }
      }
      // ── 유동성 필터 ─────────────────────────────────────────────────────
      if (settings.requireHighLiquidity && !marketAnalysis.hasHighLiquidity) {
        if (canUseSpeculativeOverride) {
          console.log(`    ⚠️  유동성 미충족이지만 '세력/급등주 투자 허용' + 고신뢰(${marketAnalysis.confidence.toFixed(1)}%)로 진입 평가 계속`);
        } else {
        console.log(`    ⚠️  유동성 미충족 (liquidityScore=${marketAnalysis.liquidityScore} < 40) - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 유동성 미충족 (${marketAnalysis.liquidityScore})`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '유동성필터', liquidityScore: marketAnalysis.liquidityScore } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'liquidity_not_met',
          decisionType: 'filter_liquidity',
          qualitativeReason: '유동성 조건을 충족하지 못했습니다.',
          quantitativeReason: { liquidityScore: marketAnalysis.liquidityScore, threshold: 40 },
          marketAnalysis,
          currentLine,
        });
        return;
        }
      }
      // ── DART 위험공시 — 설정 무관하게 무조건 차단 ────────────────────────
      if (marketAnalysis.dartDangerKeyword) {
        console.log(`    🚫 DART 위험공시 감지 [${marketAnalysis.dartDangerKeyword}] - 매수 차단`);
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'SKIP', message: `[차단] ${candidate.stockName} — DART 위험공시 [${marketAnalysis.dartDangerKeyword}]`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: 'DART위험', dartDangerKeyword: marketAnalysis.dartDangerKeyword } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'dart_danger_disclosure',
          decisionType: 'filter_dart_danger',
          qualitativeReason: 'DART 위험 공시가 감지되어 매수를 차단했습니다.',
          quantitativeReason: { dartDangerKeyword: marketAnalysis.dartDangerKeyword },
          marketAnalysis,
        });
        return;
      }
      if (!resolvedPrecheck.isAdditionalBuy) {
        await logDecision({
          accepted: true,
          rejectReason: null,
          decisionType: 'entry_selected',
          qualitativeReason: '진입 조건을 충족해 매수 대상으로 선정되었습니다.',
          quantitativeReason: { currentLine, unitCount: resolvedPrecheck.unitCount, confidence: marketAnalysis.confidence },
          marketAnalysis,
          currentLine,
          unitCount: resolvedPrecheck.unitCount,
        });
        await this.executeBuy(model, settings, stock, rainbowEval, marketAnalysis, kiwoomService);
      } else {
        await logDecision({
          accepted: true,
          rejectReason: null,
          decisionType: 'holding_additional_buy',
          qualitativeReason: '보유 종목 추가매수 조건을 충족했습니다.',
          quantitativeReason: {
            entryLine: resolvedPrecheck.entryLine,
            nextLowerLine: resolvedPrecheck.nextLowerLine,
            currentLine,
          },
          marketAnalysis,
          currentLine,
        });
        await this.executeAdditionalBuy(model, settings, stock, existingHolding!, rainbowEval, kiwoomService);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (err instanceof AiBudgetExceededError) {
        console.warn(`    [예산차단] ${candidate.stockCode}: ${errMsg}`);
        await logDecision({
          accepted: false,
          rejectReason: 'ai_budget_exceeded',
          decisionType: 'ai_budget_exceeded',
          qualitativeReason: errMsg,
        });
        return;
      }
      // 일시적 오류(차트 데이터 없음, 네트워크 429 등)는 쿨다운 없이 스킵 — 다음 사이클에 재시도
      const isTransient =
        errMsg.includes('Insufficient data') ||
        errMsg.includes('got 0') ||
        errMsg.includes('429') ||
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('socket hang up');
      if (isTransient) {
        console.warn(`    ⚠️  일시적 오류(쿨다운 없이 스킵) ${candidate.stockCode}: ${errMsg}`);
        return;
      }
      console.error(`    ❌ evaluateCandidateStock ${candidate.stockCode}:`, err);
      await logDecision({
        accepted: false,
        rejectReason: 'evaluation_exception',
        decisionType: 'evaluation_exception',
        qualitativeReason: '평가 중 예외가 발생했습니다.',
        quantitativeReason: { error: errMsg },
      });
    }
  }

  async manageOpenPositions(
    model: AiModel,
    settings: AutoTradingSettings,
    _activeAccount: any,
    kiwoomService: KiwoomService,
    aiService: AIService,
    aiModel: string = 'gpt-5-mini',
  ): Promise<void> {
    // Keep a single exit-management path for now.
    await this.checkPositionsForExits(model, settings, kiwoomService, aiService, aiModel);
  }

  private buildCandidateScorecard(analysis: AiAnalysisResult): Record<string, number> {
    return {
      themeScore: analysis.themeScore,
      newsScore: analysis.newsScore,
      financialsScore: analysis.financialsScore,
      liquidityScore: analysis.liquidityScore,
      institutionalScore: analysis.institutionalScore,
      totalScore: analysis.confidence,
    };
  }

  private parsePositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private getConfiguredUnitSize(settings: AutoTradingSettings, config: any): number {
    const fallbackUnit = this.parsePositiveNumber(settings.defaultPositionSize, 1_000_000);
    const baseUnitSize = this.parsePositiveNumber(settings.baseUnitSize, 0);
    const legacyUnitSize = this.parsePositiveNumber(config?.unitSize, 0);
    return baseUnitSize > 0 ? baseUnitSize : legacyUnitSize > 0 ? legacyUnitSize : fallbackUnit;
  }

  private getLineUnitMap(settings: AutoTradingSettings, config: any): Record<number, number> {
    const map: Record<number, number> = {};
    const ladder = settings.entryLadderSettings as Array<{ line?: number; units?: number }> | null | undefined;
    if (Array.isArray(ladder)) {
      for (const step of ladder) {
        const line = Number.parseInt(String(step?.line ?? ""), 10);
        const units = Number.parseInt(String(step?.units ?? ""), 10);
        if (!Number.isFinite(line) || !Number.isFinite(units)) continue;
        map[line] = Math.max(0, Math.min(5, units));
      }
    }

    if (Object.keys(map).length > 0) return map;

    const legacyMap = (config?.lineUnits ?? {}) as Record<number, number>;
    for (const [lineRaw, unitsRaw] of Object.entries(legacyMap)) {
      const line = Number.parseInt(String(lineRaw), 10);
      const units = Number.parseInt(String(unitsRaw), 10);
      if (!Number.isFinite(line) || !Number.isFinite(units)) continue;
      map[line] = Math.max(0, Math.min(5, units));
    }
    return map;
  }

  private getUnitCountForLine(currentLine: number, settings: AutoTradingSettings, config: any): number {
    const lineUnits = this.getLineUnitMap(settings, config);
    if (Object.keys(lineUnits).length === 0) return 1;
    return lineUnits[currentLine] ?? 0;
  }

  private clampQuantityByCapital(
    quantity: number,
    price: number,
    settings: AutoTradingSettings,
    unitSize: number,
    existingHoldingCapital: number = 0
  ): number {
    let capped = quantity;

    const maxUnits = Number.parseInt(String(settings.maxUnitsPerStock ?? ""), 10);
    if (Number.isFinite(maxUnits) && maxUnits > 0) {
      const maxCapitalByUnits = unitSize * maxUnits;
      const remainingByUnits = Math.max(0, maxCapitalByUnits - existingHoldingCapital);
      capped = Math.min(capped, Math.floor(remainingByUnits / price));
    }

    const hardMaxCapital = this.parsePositiveNumber(settings.hardMaxCapitalPerStock, 0);
    if (hardMaxCapital > 0) {
      const remainingByHardCap = Math.max(0, hardMaxCapital - existingHoldingCapital);
      capped = Math.min(capped, Math.floor(remainingByHardCap / price));
    }

    return Math.max(0, capped);
  }

  async executeAdditionalBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    holding: any,
    rainbow: RainbowEval,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    ➕ 추가매수 검토: ${stock.name}(${stock.code}) @ ${rainbow.currentLine}% 라인`);
    try {
      const config = (model.config as any) || {};
      if (!config.accountId) return;
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const activeAccount = accounts.find((a: any) => a.id === config.accountId);
      if (!activeAccount) return;

      const addBuyExistingOrders = await storage.getOrders(activeAccount.id, 200);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1) 대기 중인 추가매수 주문 확인
      const hasPendingAddBuy = addBuyExistingOrders.some((o: any) =>
        o.stockCode === stock.code && o.orderType === 'buy' && o.orderStatus === 'pending'
      );
      if (hasPendingAddBuy) {
        console.log(`    ⏭️ 대기중 추가매수 주문 이미 존재 (${stock.code}) — 중복 추가매수 스킵`);
        return;
      }

      // 2) 당일 동일 라인 매수 체결 확인 (잔고 미동기 상태 대비)
      // 이미 perfEntry.filledEntrySteps에 기록되었겠지만, DB 동기화 전 찰나의 순간을 대비하여 주문 내역도 교차 검증
      const recentSameLineBuy = addBuyExistingOrders.find((o: any) =>
        o.stockCode === stock.code && 
        o.orderType === 'buy' && 
        o.orderStatus === 'completed' &&
        o.executedAt && new Date(o.executedAt) >= todayStart &&
        (o.details as any)?.rainbowLine === rainbow.currentLine
      );
      
      if (recentSameLineBuy) {
        console.log(`    ⏭️ 당일 동일 라인(${rainbow.currentLine}%) 매수 기록 존재 — 추가매수 중복 차단`);
        return;
      }


      const unitSize = this.getConfiguredUnitSize(settings, config);
      const baseUnitCount = this.getUnitCountForLine(rainbow.currentLine, settings, config);
      const allowAiDoubleDown = settings.allowAiDoubleDown === true;
      const adjustedUnitCount =
        allowAiDoubleDown && rainbow.currentLine <= 30
          ? Math.min(baseUnitCount + 1, 2)
          : baseUnitCount;
      const currentCapital = (holding.quantity || 0) * stock.price;
      let quantity = Math.floor((unitSize * adjustedUnitCount) / stock.price);
      quantity = this.clampQuantityByCapital(quantity, stock.price, settings, unitSize, currentCapital);
      if (quantity === 0) {
        console.log(`    ⚠️  추가매수 수량 0 — 건너뜀`);
        return;
      }
      if (adjustedUnitCount !== baseUnitCount) {
        console.log(`    🤖 AI 추가매수 허용 적용: baseUnit=${baseUnitCount} → adjustedUnit=${adjustedUnitCount}`);
      }

      const addBuyOrder = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: stock.code,
        stockName: stock.name,
        orderType: 'buy',
        orderMethod: 'market',
        orderPrice: stock.price.toFixed(2),
        orderQuantity: quantity,
        isAutoTrading: true,
        aiModelId: model.id,
        details: { rainbowLine: rainbow.currentLine, tradeType: 'additional_buy' } // 라인 정보 기록
      });

      let addBuyResp: any;
      try {
        addBuyResp = await kiwoomService.placeOrder({
          accountNumber: activeAccount.accountNumber,
          stockCode: stock.code,
          orderType: 'buy',
          orderQuantity: quantity,
          orderPrice: stock.price,
          orderMethod: 'market',
        });
      } catch (apiErr: any) {
        const errMsg = apiErr.message || String(apiErr);
        const diagnostics = extractErrorDiagnostics(apiErr);
        await storage.updateOrder(addBuyOrder.id, {
          orderStatus: 'failed',
          errorMessage: errMsg,
          details: {
            rainbowLine: rainbow.currentLine,
            tradeType: 'additional_buy',
            lastFailure: diagnostics,
          },
        });
        console.error(`    ❌ 키움 추가매수 API 실패 (${stock.name}): ${errMsg}`);
        await storage.createTradingLog({
          accountId: activeAccount.id,
          action: 'place_add_buy_order',
          success: false,
          errorMessage: `[${stock.name}] 추가매수 실패: ${errMsg}`,
          details: { stockCode: stock.code, quantity, price: stock.price, errorDiagnostics: diagnostics }
        });
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'ERROR', message: `[주문실패] ${stock.name} 추가매수 실패: ${errMsg}`, payload: { stockCode: stock.code } }).catch(e => console.error('[Notification]', e));
        // RC4007(모의투자 매매제한) / RC4010(영업일 아님) → 재시도해도 항상 실패하는 에러이므로 7일 쿨다운
        const isKiwoomPermanentBlock = /RC4007|RC4010|매매제한/.test(errMsg);
        if (isKiwoomPermanentBlock) {
          const blockNow = new Date();
          const blockCooldownKey = `scaleIn:${model.id}:${stock.code}:line${rainbow.currentLine}`;
          storage.createCandidateDecisionLog({
            modelId: model.id,
            stockCode: stock.code,
            stockName: stock.name,
            scorecard: null,
            aiDecision: {
              accepted: false,
              decisionType: 'scaleIn_blocked_kiwoom',
              qualitativeReason: `키움 영구 거부(${errMsg}) — 7일 차단`,
              cooldownKey: blockCooldownKey,
              cooldownMode: 'scaleIn_7d',
              cooldownDurationMs: 7 * 24 * 60 * 60 * 1000,
              cooldownWindowLabel: 'scaleIn_7d',
              cooldownSince: blockNow.toISOString(),
              decidedAt: blockNow.toISOString(),
              dailyKey: this.todayKST(),
            },
            accepted: false,
            rejectReason: 'execution_blocked_kiwoom_restriction',
            strategyVersion: 'v2',
            ladderPlan: null,
          }).catch(e => console.error('[ScaleIn] 7일 차단 기록 실패:', e));
          console.warn(`    🚫 [ScaleIn] ${stock.name} ${rainbow.currentLine}% 라인 — RC4007/RC4010 에러, 7일 차단 기록`);
        }
        return;
      }
      const addOrdNo = addBuyResp?.output?.ord_no || addBuyResp?.ord_no || null;
      if (addOrdNo) await storage.updateOrder(addBuyOrder.id, { orderNumber: addOrdNo });

      const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
      if (perfEntry) {
        // filledEntrySteps: 추가매수한 라인을 영구 기록 → 중복매수 방지의 핵심
        const prevFilled: number[] = Array.isArray(perfEntry.filledEntrySteps)
          ? (perfEntry.filledEntrySteps as number[]).filter(n => Number.isFinite(n))
          : perfEntry.entryRainbowLine ? [perfEntry.entryRainbowLine] : [];
        const newFilled = prevFilled.includes(rainbow.currentLine)
          ? prevFilled
          : [...prevFilled, rainbow.currentLine];

        await storage.updateTradingPerformance(perfEntry.id, {
          entryRainbowLine: rainbow.currentLine,
          quantity: (perfEntry.quantity || 0) + quantity,
          filledEntrySteps: newFilled,
        });
        console.log(`    [ScaleIn] 📝 filledEntrySteps 업데이트: [${newFilled}]`);
      }


      console.log(`    ✅ 추가매수 완료: ${stock.name} ${quantity}주 @ ${stock.price}원 (${rainbow.currentLine}% 라인, ${adjustedUnitCount}유닛)`);
      const kstDate4 = new Date(Date.now() + 9 * 3600000);
      await storage.createTradeJournal({ userId: model.userId, accountId: activeAccount.id, modelId: model.id, stockCode: stock.code, stockName: stock.name, tradeDate: kstDate4.toISOString().slice(0, 10).replace(/-/g, ''), tradeTime: kstDate4.toISOString().slice(11, 19), tradeType: 'additional_buy', price: stock.price.toFixed(2), quantity, totalAmount: (stock.price * quantity).toFixed(2), avgPrice: '0', rainbowLine: rainbow.currentLine, profitRate: '0', profitLoss: '0', isAutoTrading: true, memo: `AI 추가매수 (${rainbow.currentLine}% 선)` });
      await storage.updateOrder(addBuyOrder.id, { orderStatus: 'completed', executedQuantity: quantity, executedPrice: stock.price.toFixed(2), executedAt: new Date() });
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'BUY', message: `[추가매수] ${stock.name} ${quantity}주 @ ${stock.price.toLocaleString()}원 (${rainbow.currentLine}% 라인, ${adjustedUnitCount}유닛)`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity, rainbowLine: rainbow.currentLine, unitCount: adjustedUnitCount } }).catch(e => console.error('[Notification]', e));
    } catch (err) {
      console.error(`    ❌ 추가매수 실패 ${stock.code}:`, err);
    }
  }

  async createDefaultSettings(modelId: number, _modelType?: string): Promise<void> {
    const defaultRainbowSettings = [
      { line: 10, buyWeight: 100, sellWeight: 0 },
      { line: 20, buyWeight: 90,  sellWeight: 0 },
      { line: 30, buyWeight: 80,  sellWeight: 0 },
      { line: 40, buyWeight: 70,  sellWeight: 0 },
      { line: 50, buyWeight: 100, sellWeight: 0 },
      { line: 60, buyWeight: 0,   sellWeight: 30 },
      { line: 70, buyWeight: 0,   sellWeight: 50 },
      { line: 80, buyWeight: 0,   sellWeight: 70 },
      { line: 90, buyWeight: 0,   sellWeight: 90 },
      { line: 100, buyWeight: 0,  sellWeight: 100 },
    ];
    await storage.createAutoTradingSettings({
      modelId,
      rainbowLineSettings: defaultRainbowSettings,
      aiEntryPolicy: {
        candidateDecisionCooldownMode: 'interval_120m',
        disableReevaluationForBoughtToday: false,
        sellRetryCooldownSec: this.parseNonNegativeInt(process.env.AUTO_TRADING_SELL_RETRY_COOLDOWN_SEC, 0),
      },
    });
  }
}
