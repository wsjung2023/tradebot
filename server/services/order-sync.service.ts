// order-sync.service.ts — 주문 상태 동기화 및 오래된 대기중 주문 정리
// 1. expireOldPendingOrders(): 전일 이전 pending → cancelled, 오늘 orderNumber 없이 1시간 이상 → failed
// 2. syncTodayOrders(): kt00007로 오늘 주문 상태를 실제 체결/취소 상태로 업데이트

import { storage } from '../storage';
import type { KiwoomService } from './kiwoom';

function todayKST(): string {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function kstMidnightUtcMs(): number {
  return Math.floor((Date.now() + 9 * 3600_000) / 86_400_000) * 86_400_000 - 9 * 3600_000;
}

export class OrderSyncService {

  // ── 1. 오래된 pending 주문 자동 만료 ──────────────────────────────────
  // 키움은 장 마감(15:30) 후 미체결 주문을 자동으로 취소한다.
  // 전일 pending → cancelled, 오늘 orderNumber 없이 1시간 이상 pending → failed (API 실패 고스트)
  async expireOldPendingOrders(accountId: number): Promise<number> {
    const cutoff = kstMidnightUtcMs();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const orders = await storage.getOrders(accountId, 500);
    let count = 0;

    for (const o of orders) {
      if (o.orderStatus !== 'pending' || !o.createdAt) continue;
      const ts = new Date(o.createdAt).getTime();

      if (ts < cutoff) {
        // 전일 이전 → cancelled
        await storage.updateOrder(o.id, { orderStatus: 'cancelled' });
        count++;
      } else if (!o.orderNumber && ts < oneHourAgo) {
        // 오늘이지만 orderNumber 없이 1시간 이상 → 키움 API 실패 고스트 → failed
        await storage.updateOrder(o.id, { orderStatus: 'failed' });
        console.log(`[OrderSync] 계좌 ${accountId}: 고스트 주문 failed 처리 — ${o.stockName}(${o.stockCode}) id=${o.id}`);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[OrderSync] 계좌 ${accountId}: 만료/고스트 주문 ${count}건 처리 완료`);
    }
    return count;
  }

  // ── 2. 오늘 주문 상태 키움 동기화 (kt00007) ──────────────────────────
  // orderNumber(ord_no)로 매칭 → 체결수량/취소여부에 따라 상태 갱신
  async syncTodayOrders(
    accountId: number,
    accountNumber: string,
    kiwoomService: KiwoomService
  ): Promise<void> {
    try {
      const todayStr = todayKST();
      const res = await kiwoomService.getOrderHistory(accountNumber, todayStr, todayStr);
      const list: any[] = Array.isArray(res?.output) ? res.output : [];
      if (!list.length) return;

      const dbOrders = await storage.getOrders(accountId, 300);
      const todayMidnightUtc = kstMidnightUtcMs();
      const pendingToday = dbOrders.filter(o =>
        o.orderStatus === 'pending' &&
        o.orderNumber &&
        o.createdAt &&
        new Date(o.createdAt).getTime() >= todayMidnightUtc
      );
      if (!pendingToday.length) return;

      for (const dbOrder of pendingToday) {
        // ord_no 필드명은 키움 버전마다 다를 수 있어 다중 시도
        const kRow = list.find((r: any) =>
          String(r.ord_no ?? r.ordNo ?? r.order_no ?? '').trim() ===
          String(dbOrder.orderNumber ?? '').trim()
        );
        if (!kRow) continue;

        const isCancelled = ['1', 'Y', 'y'].includes(
          String(kRow.cncl_yn ?? kRow.cncl_tp ?? kRow.cancel_yn ?? '')
        );
        // 다양한 체결수량 필드명 시도
        const filledQty = parseInt(
          kRow.cnfm_qty ?? kRow.exec_qty ?? kRow.trde_cnfm_qty ??
          kRow.cncl_qty ?? kRow.filled_qty ?? '0',
          10
        ) || 0;
        const orderQty = parseInt(kRow.ord_qty ?? kRow.order_qty ?? '0', 10) || dbOrder.orderQuantity;

        let newStatus: string = dbOrder.orderStatus;
        if (isCancelled && filledQty === 0) {
          newStatus = 'cancelled';
        } else if (filledQty >= orderQty) {
          newStatus = 'completed';
        } else if (filledQty > 0) {
          newStatus = 'partial';
        }

        if (newStatus !== dbOrder.orderStatus) {
          await storage.updateOrder(dbOrder.id, {
            orderStatus: newStatus as any,
            executedQuantity: filledQty || dbOrder.executedQuantity,
          });
          console.log(`[OrderSync] 주문 ${dbOrder.orderNumber} ${dbOrder.orderStatus} → ${newStatus} (체결 ${filledQty}주)`);
        }
      }
    } catch (err: any) {
      // API 실패 시 로그만 남기고 무시 (동기화 실패가 매매를 막으면 안 됨)
      console.warn(`[OrderSync] kt00007 동기화 실패 (계좌 ${accountNumber}):`, err?.message);
    }
  }
}

let instance: OrderSyncService | null = null;
export function getOrderSyncService(): OrderSyncService {
  if (!instance) instance = new OrderSyncService();
  return instance;
}
