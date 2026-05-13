// balance-refresh.service.ts — 장중(KST 08:30~18:00, 월~금) 자동 잔고 갱신 서비스
// 5분 간격으로 모든 실계좌의 balance.get 잡을 생성하고 결과로 holdings를 갱신한다.
import * as cron from 'node-cron';
import { storage } from '../storage';
import { callViaAgent } from './agent-proxy.service';
import { parseHoldingItem } from '../utils/balance-parser';
import { isAgentConnected, getAgentLastSeenSecondsAgo } from '../routes/kiwoom-agent.routes';

/**
 * KST 현재 시각 기준으로 장중(08:30~18:00, 월~금)인지 확인.
 * 한국 표준시 = UTC+9
 */
function isKstMarketHours(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return false;
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  const minutes = h * 60 + m;
  return minutes >= 8 * 60 + 30 && minutes < 18 * 60; // 08:30 ~ 18:00
}


export class BalanceRefreshService {
  private task: cron.ScheduledTask | null = null;
  private intervalMinutes = 5;
  onRun?: () => void;

  private buildCron(): string {
    const m = this.intervalMinutes;
    if (m < 60) return `*/${m} * * * *`;
    const h = Math.floor(m / 60);
    return `0 */${h} * * *`;
  }

  start(intervalMinutes?: number) {
    if (intervalMinutes !== undefined) this.intervalMinutes = intervalMinutes;
    if (this.task) {
      console.log('[BalanceRefresh] 이미 실행 중 — 중복 등록 방지');
      return;
    }
    const cronExpr = this.buildCron();
    console.log(`[BalanceRefresh] 서비스 시작 — ${this.intervalMinutes}분마다 실계좌 잔고 자동 갱신 (KST 08:30~18:00 월~금)`);
    this.task = cron.schedule(cronExpr, async () => {
      try {
        await this.refreshAllRealAccounts();
      } catch (err: any) {
        console.error('[BalanceRefresh] 스케줄 오류:', err.message);
      }
    });
    console.log('[BalanceRefresh] 서비스 등록 완료 (KST 08:30~18:00, 월~금 활성)');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[BalanceRefresh] 서비스 중지');
    }
  }

  /** 실행 중이면 즉시 새 주기로 재시작. 중지 중이면 값만 저장. */
  setIntervalMinutes(minutes: number) {
    this.intervalMinutes = minutes;
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.start();
    }
  }

  getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  async refreshAllRealAccounts(): Promise<void> {
    if (!isKstMarketHours()) return;

    // 에이전트 미연결 시 사이클 자체를 skip — DB/리소스/로그 낭비 방지
    if (!isAgentConnected(60)) {
      const ago = getAgentLastSeenSecondsAgo();
      const agoLabel = ago === null ? '한 번도 폴링 없음' : `마지막 폴링 ${ago}초 전`;
      console.log(`[BalanceRefresh] ⏭️  에이전트 미연결 — 사이클 스킵 (${agoLabel})`);
      return;
    }

    let accounts: Awaited<ReturnType<typeof storage.getAllRealKiwoomAccounts>>;
    try {
      accounts = await storage.getAllRealKiwoomAccounts();
    } catch (err: any) {
      console.error('[BalanceRefresh] 실계좌 목록 조회 실패:', err.message);
      return;
    }

    if (accounts.length === 0) return;

    console.log(`[BalanceRefresh] 자동 잔고 갱신 시작 — ${accounts.length}개 실계좌`);

    for (const acc of accounts) {
      try {
        await this.refreshAccount(acc.userId, acc.id, acc.accountNumber, acc.accountType);
      } catch (err: any) {
        console.error(`[BalanceRefresh] 계좌 ${acc.id}(${acc.accountNumber}) 갱신 실패:`, err.message);
      }
    }

    console.log('[BalanceRefresh] 자동 잔고 갱신 완료');
    this.onRun?.();
  }

  private async refreshAccount(
    userId: string,
    accountId: number,
    accountNumber: string,
    accountType: string,
  ): Promise<void> {
    const hasPending = await storage.hasPendingJobForAccount(userId, 'balance.get', accountNumber);
    if (hasPending) {
      console.log(`[BalanceRefresh] account ${accountId}(${accountNumber}): pending balance.get exists - skip`);
      return;
    }

    const payload = { accountNumber, accountType };
    const dedupeKey = `balance.get:auto:${accountId}`;

    let result: any;
    try {
      result = await callViaAgent(userId, 'balance.get', payload, 15000, dedupeKey);
    } catch (firstErr: any) {
      const msg = String(firstErr?.message ?? '');
      if (msg.includes('Expecting value') || msg.includes('token') || msg.includes('401')) {
        console.warn(`[BalanceRefresh] account ${accountId}: first try failed, retry after token refresh`);
        try { await callViaAgent(userId, 'token.refresh', { accountType }, 8000); } catch (_) {}
        result = await callViaAgent(userId, 'balance.get', payload, 15000, dedupeKey);
      } else {
        throw firstErr;
      }
    }

    const raw: any = result?.raw || {};
    const output2: any[] = (result?.output2 && result.output2.length > 0)
      ? result.output2
      : (result?.holdings || raw.acnt_evlt_remn_indv_tot || []);

    const parseNum = (...fields: (string | undefined | null)[]): number => {
      for (const v of fields) { if (v && v !== '0') return parseFloat(v); }
      return 0;
    };

    const output1: any = Object.keys(result?.output1 || {}).length > 0 ? result.output1 : raw;
    const stockEvalAmount = parseNum(
      raw.tot_evlt_amt, raw.tot_evlu_amt, raw.acnt_tot_evlu_amt,
      output1.tot_evlt_amt, output1.tot_evlu_amt,
      result?.totalEvaluationAmount,
    );
    const depositRaw = parseNum(
      raw.prsm_dpst_aset_amt, raw.dnca_tot_amt,
      output1.prsm_dpst_aset_amt, output1.dnca_tot_amt,
      result?.depositAmount,
    );

    // Full replace sync: remove stale holdings first, then insert current snapshot.
    const parsedHoldings: Array<{ stockCode: string; updates: ReturnType<typeof parseHoldingItem> }> = [];
    for (const item of (Array.isArray(output2) ? output2 : [])) {
      const parsed = parseHoldingItem(item);
      if (!parsed.stockCode) continue;
      parsedHoldings.push({ stockCode: parsed.stockCode, updates: parsed });
    }

    await storage.deleteHoldingsByAccount(accountId);
    for (const { stockCode, updates } of parsedHoldings) {
      const { stockCode: _ignored, ...holdingUpdates } = updates;
      await storage.createHolding({ accountId, stockCode, ...holdingUpdates });
    }

    let totalAssetsWithDeposit = stockEvalAmount + depositRaw;
    let depositAmount = depositRaw;
    if (stockEvalAmount > 0 && depositRaw > 0 && depositRaw >= stockEvalAmount) {
      totalAssetsWithDeposit = depositRaw;
      depositAmount = Math.max(0, depositRaw - stockEvalAmount);
    }
    const todayProfit = parseNum(
      raw.tot_evlt_pl, raw.tot_evlu_pfls,
      output1.tot_evlt_pl, output1.evlu_pfls_smtl_amt, output1.tot_evlu_pfls,
      result?.todayProfit,
    );
    const todayProfitRate = totalAssetsWithDeposit > 0 ? (todayProfit / totalAssetsWithDeposit) * 100 : 0;

    await storage.updateKiwoomAccount(accountId, {
      lastTotalAssets: String(totalAssetsWithDeposit),
      lastDepositAmount: String(depositAmount),
      lastTodayProfit: String(todayProfit),
      lastTodayProfitRate: String(todayProfitRate),
      lastBalanceFetchedAt: new Date(),
    });

    try {
      await storage.createAssetSnapshot({
        accountId,
        totalAssets: String(totalAssetsWithDeposit),
        totalProfitLoss: String(todayProfit),
        totalProfitRate: String(todayProfitRate),
      });
    } catch (e) {
      console.error('[BalanceRefresh] failed to create asset snapshot (non-fatal):', e);
    }

    console.log(`[BalanceRefresh] account ${accountId} refreshed - holdings ${parsedHoldings.length}, total assets ${totalAssetsWithDeposit.toLocaleString()} KRW`);
  }
}
export const balanceRefreshService = new BalanceRefreshService();
