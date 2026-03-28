// balance-refresh.service.ts — 장중(KST 08:30~18:00, 월~금) 자동 잔고 갱신 서비스
// 5분 간격으로 모든 실계좌의 balance.get 잡을 생성하고 결과로 holdings를 갱신한다.
import * as cron from 'node-cron';
import { storage } from '../storage';
import { callViaAgent } from './agent-proxy.service';

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

const cleanS = (v: any): string => {
  const s = String(v ?? '').trim();
  return s && s !== '0' ? s : '';
};

export class BalanceRefreshService {
  private task: cron.ScheduledTask | null = null;

  start() {
    if (this.task) {
      console.log('[BalanceRefresh] 이미 실행 중 — 중복 등록 방지');
      return;
    }
    console.log('[BalanceRefresh] 서비스 시작 — 5분마다 실계좌 잔고 자동 갱신 (KST 08:30~18:00 월~금)');
    this.task = cron.schedule('*/5 * * * *', async () => {
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

  async refreshAllRealAccounts(): Promise<void> {
    if (!isKstMarketHours()) return;

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
  }

  private async refreshAccount(
    userId: string,
    accountId: number,
    accountNumber: string,
    accountType: string,
  ): Promise<void> {
    const payload = { accountNumber, accountType };
    const dedupeKey = `balance.get:auto:${accountId}`;

    let result: any;
    try {
      result = await callViaAgent(userId, 'balance.get', payload, 15000, dedupeKey);
    } catch (firstErr: any) {
      const msg = String(firstErr?.message ?? '');
      if (msg.includes('Expecting value') || msg.includes('빈 응답') || msg.includes('token') || msg.includes('401')) {
        console.warn(`[BalanceRefresh] 계좌 ${accountId} 첫 시도 실패 → 토큰 갱신 후 재시도`);
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

    if (!Array.isArray(output2) || output2.length === 0) {
      console.warn(`[BalanceRefresh] 계좌 ${accountId}: output2 비어있음`);
      return;
    }

    const parseNum = (...fields: (string | undefined | null)[]): number => {
      for (const v of fields) { if (v && v !== '0') return parseFloat(v); }
      return 0;
    };

    const output1: any = Object.keys(result?.output1 || {}).length > 0 ? result.output1 : raw;
    const totalAssets = parseNum(
      raw.tot_evlt_amt, raw.tot_evlu_amt, raw.acnt_tot_evlu_amt,
      output1.tot_evlt_amt, output1.tot_evlu_amt,
      result?.totalEvaluationAmount,
    );
    const depositAmount = parseNum(
      raw.prsm_dpst_aset_amt, raw.dnca_tot_amt,
      output1.prsm_dpst_aset_amt, output1.dnca_tot_amt,
      result?.depositAmount,
    );

    for (const item of output2) {
      const stockCode = item.acnt_pdno || item.pdno || item.stk_cd || item.stockCode;
      if (!stockCode) continue;
      const updates = {
        stockName: item.prdt_name || item.stk_nm || item.stockName || '',
        quantity: parseInt(item.hldg_qty || item.rmnd_qty || String(item.quantity ?? '0'), 10),
        averagePrice: cleanS(item.pchs_avg_pric) || cleanS(item.avg_pric) || cleanS(item.pur_pric) || cleanS(item.averagePrice) || '0',
        currentPrice: cleanS(item.prpr) || cleanS(item.cur_prc) || cleanS(item.currentPrice) || '0',
        profitLoss: cleanS(item.evlu_pfls_amt) || cleanS(item.evlu_pfls) || cleanS(item.evltv_prft) || '0',
        profitLossRate: cleanS(item.evlu_pfls_rt) || cleanS(item.pfls_rt) || cleanS(item.prft_rt) || '0',
      };
      const existing = await storage.getHoldingByStock(accountId, stockCode);
      if (existing) await storage.updateHolding(existing.id, updates);
      else await storage.createHolding({ accountId, stockCode, ...updates });
    }

    console.log(`[BalanceRefresh] 계좌 ${accountId} 갱신 완료 — 보유종목 ${output2.length}개, 총자산 ${(totalAssets + depositAmount).toLocaleString()}원`);
  }
}

export const balanceRefreshService = new BalanceRefreshService();
