// balance-refresh.service.ts — 장중(KST 08:30~18:00, 월~금) 자동 잔고 갱신 서비스
// Agent-less: KiwoomService를 통해 서버가 직접 키움 REST API 호출
import * as cron from 'node-cron';
import { storage } from '../storage';
import { parseHoldingItem } from '../utils/balance-parser';
import { evaluateHoldingSyncGuard } from '../utils/holding-sync-guard';
import { getUserKiwoomService } from './user-kiwoom.service';
import { refreshUserAumTier } from './tier-limits.service';

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
        await this.refreshAllActiveAccounts();
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

  async refreshAllActiveAccounts(): Promise<void> {
    if (!isKstMarketHours()) return;

    let accounts: Awaited<ReturnType<typeof storage.getAllActiveKiwoomAccounts>>;
    try {
      accounts = await storage.getAllActiveKiwoomAccounts();
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

    // 처리된 유저들의 aumTier 업데이트 (구독 페이지 조회 시마다 재계산하지 않기 위해 여기서 처리)
    const userIds = Array.from(new Set(accounts.map(a => a.userId)));
    await Promise.all(userIds.map(uid => refreshUserAumTier(uid).catch(() => {})));

    this.onRun?.();
  }

  // Backward compatibility: keep old method name for existing callers.
  async refreshAllRealAccounts(): Promise<void> {
    await this.refreshAllActiveAccounts();
  }

  private async refreshAccount(
    userId: string,
    accountId: number,
    accountNumber: string,
    accountType: string,
  ): Promise<void> {
    const userKiwoom = getUserKiwoomService();
    const result = await userKiwoom.getBalance(userId, accountNumber, accountType as "mock" | "real", accountId);

    const output1: any = result.output1 || {};
    const output2: any[] = result.output2 || [];

    const parseNum = (...fields: (string | undefined | null)[]): number => {
      for (const v of fields) { if (v && v !== '0') return parseFloat(v); }
      return 0;
    };

    const stockEvalAmount = parseNum(output1.tot_evlu_amt, output1.evlu_amt_smtl_amt);
    const estimatedTotalAssets = parseNum(output1.prsm_dpst_aset_amt);
    const depositAmount = parseNum(output1.dnca_tot_amt);

    // Full replace sync: remove stale holdings first, then insert current snapshot.
    const parsedHoldings: Array<{ stockCode: string; updates: ReturnType<typeof parseHoldingItem> }> = [];
    for (const item of (Array.isArray(output2) ? output2 : [])) {
      const parsed = parseHoldingItem(item);
      if (!parsed.stockCode) continue;
      parsedHoldings.push({ stockCode: parsed.stockCode, updates: parsed });
    }

    const existingHoldings = await storage.getHoldings(accountId);
    const guard = evaluateHoldingSyncGuard({
      parsedHoldings: parsedHoldings.map((h) => h.updates),
      existingHoldingsCount: existingHoldings.length,
      expectedStockEvalAmount: stockEvalAmount,
    });
    if (guard.preserveExisting) {
      console.error(
        `[BalanceRefresh] suspicious holdings snapshot for account ${accountId} (${accountNumber}) ` +
        `reason=${guard.reason} parsed=${guard.parsedCount} existing=${guard.existingCount} coverage=${guard.evalCoverage.toFixed(3)}`
      );
      storage.createEngineNotification({
        userId,
        severity: 'warn',
        type: 'SYNC',
        message: `[BalanceRefreshGuard] account ${accountNumber} holdings snapshot flagged (${guard.reason}) - preserving existing ${existingHoldings.length}`,
        payload: {
          accountId,
          accountNumber,
          accountType,
          existingHoldingsCount: existingHoldings.length,
          parsedHoldingsCount: guard.parsedCount,
          evalCoverage: guard.evalCoverage,
          parsedEvalAmount: guard.parsedEvalAmount,
          expectedStockEvalAmount: guard.expectedStockEvalAmount,
        },
      }).catch(() => {});
    } else {
      await storage.deleteHoldingsByAccount(accountId);
      for (const { stockCode, updates } of parsedHoldings) {
        const { stockCode: _ignored, ...holdingUpdates } = updates;
        await storage.createHolding({ accountId, stockCode, ...holdingUpdates });
      }
    }

    const totalAssetsWithDeposit = estimatedTotalAssets || (stockEvalAmount + depositAmount);
    const todayProfit = parseNum(output1.evlu_pfls_smtl_amt, output1.tot_evlu_pfls);
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
