import { Client } from "pg";
import { storage } from "../server/storage";
import { createKiwoomService } from "../server/services/kiwoom";
import { decrypt, isEncrypted } from "../server/utils/crypto";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function plain(value: string | null | undefined): string {
  if (!value) return "";
  return isEncrypted(value) ? decrypt(value) : value;
}

function parseIntSafe(value: unknown): number {
  const n = parseInt(String(value ?? "").replace(/,/g, "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseNumSafe(value: unknown): number {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeCode(code: unknown): string {
  return String(code ?? "").trim().replace(/^A/i, "");
}

function detectSide(ioTypeName: unknown): "buy" | "sell" | null {
  const text = String(ioTypeName ?? "");
  if (text.includes("매수")) return "buy";
  if (text.includes("매도")) return "sell";
  return null;
}

function dateRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const s = new Date(`${startYmd.slice(0, 4)}-${startYmd.slice(4, 6)}-${startYmd.slice(6, 8)}T00:00:00+09:00`);
  const e = new Date(`${endYmd.slice(0, 4)}-${endYmd.slice(4, 6)}-${endYmd.slice(6, 8)}T00:00:00+09:00`);
  for (let t = s.getTime(); t <= e.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}${m}${day}`);
  }
  return out;
}

function kstToUtcDate(ymd: string, hms: string): Date {
  const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms}+09:00`;
  return new Date(iso);
}

async function main() {
  const accountId = Number(process.env.CHECK_ACCOUNT_ID || "20");
  const startDate = process.env.CHECK_START_DATE || "20260507";
  const endDate = process.env.CHECK_END_DATE || "20260521";

  const databaseUrl = mustEnv("DATABASE_URL");
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();

  const account = await storage.getKiwoomAccount(accountId);
  if (!account) throw new Error(`account not found: ${accountId}`);
  if (!account.kiwoomAppKey || !account.kiwoomAppSecret) {
    throw new Error(`account ${accountId} has no API credentials`);
  }

  const service = createKiwoomService({
    appKey: plain(account.kiwoomAppKey),
    appSecret: plain(account.kiwoomAppSecret),
    accountType: (account.accountType as "mock" | "real") || "mock",
  });

  let scanned = 0;
  let brokerCompleted = 0;
  let insertedOrders = 0;
  let updatedOrderNumbers = 0;
  let insertedJournals = 0;

  for (const ymd of dateRange(startDate, endDate)) {
    scanned += 1;
    const res: any = await service.getOrderHistory(account.accountNumber, ymd);
    const rows: any[] = Array.isArray(res?.acnt_ord_cntr_prps_dtl) ? res.acnt_ord_cntr_prps_dtl : [];

    for (const row of rows) {
      const acceptType = String(row.acpt_tp || "");
      if (!acceptType.includes("완료")) continue;

      const side = detectSide(row.io_tp_nm);
      if (!side) continue;

      const qty = parseIntSafe(row.cntr_qty || row.cnfm_qty || row.ord_qty);
      const price = parseNumSafe(row.cntr_uv || row.ord_uv);
      if (qty <= 0) continue;

      const stockCode = normalizeCode(row.stk_cd);
      const stockName = String(row.stk_nm || stockCode);
      const orderNo = String(row.ord_no || "").trim() || null;
      const time = String(row.cnfm_tm || row.ord_tm || "00:00:00").trim();
      const ts = kstToUtcDate(ymd, time);
      const method = String(row.trde_tp || "").includes("시장") ? "market" : "limit";
      const commOrderType = String(row.comm_ord_tp || "");
      brokerCompleted += 1;

      let existingOrderId: number | null = null;
      if (orderNo) {
        const byOrderNo = await client.query(
          `select id, order_number from orders where account_id=$1 and order_number=$2 limit 1`,
          [accountId, orderNo],
        );
        if (byOrderNo.rows[0]) {
          existingOrderId = Number(byOrderNo.rows[0].id);
        }
      }

      if (!existingOrderId) {
        const fuzzy = await client.query(
          `select id, order_number
             from orders
            where account_id=$1
              and order_status='completed'
              and stock_code=$2
              and order_type=$3
              and executed_quantity=$4
              and abs(extract(epoch from (coalesce(executed_at, created_at) - $5::timestamptz))) <= 120
            order by abs(extract(epoch from (coalesce(executed_at, created_at) - $5::timestamptz)))
            limit 1`,
          [accountId, stockCode, side, qty, ts.toISOString()],
        );
        if (fuzzy.rows[0]) {
          existingOrderId = Number(fuzzy.rows[0].id);
          if (!fuzzy.rows[0].order_number && orderNo) {
            await client.query(`update orders set order_number=$2 where id=$1`, [existingOrderId, orderNo]);
            updatedOrderNumbers += 1;
          }
        }
      }

      if (!existingOrderId) {
        const inserted = await client.query(
          `insert into orders (
             account_id, stock_code, stock_name, order_type, order_method,
             order_price, order_quantity, executed_quantity, executed_price,
             order_status, order_number, is_auto_trading, created_at, executed_at, details
           )
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed',$10,false,$11,$12,$13::jsonb)
           returning id`,
          [
            accountId,
            stockCode,
            stockName,
            side,
            method,
            method === "market" ? null : price,
            qty,
            qty,
            price > 0 ? price : null,
            orderNo,
            ts.toISOString(),
            ts.toISOString(),
            JSON.stringify({
              source: "kiwoom_order_history_reconcile",
              commOrderType,
              rawOrderNo: row.ord_no,
              rawOrderTime: row.ord_tm,
              rawConfirmTime: row.cnfm_tm,
              reconciledAt: new Date().toISOString(),
            }),
          ],
        );
        existingOrderId = Number(inserted.rows[0].id);
        insertedOrders += 1;
      }

      const tradeType =
        side === "buy"
          ? "buy"
          : commOrderType.includes("반대매매")
            ? "exit_sell"
            : "sell";
      const amount = price * qty;
      const journalExists = await client.query(
        `select id from trade_journal where user_id=$1 and stock_code=$2 and trade_date=$3 and trade_time=$4 limit 1`,
        [account.userId, stockCode, ymd, time],
      );
      if (!journalExists.rows[0]) {
        await client.query(
          `insert into trade_journal (
             user_id, account_id, model_id, stock_code, stock_name,
             trade_date, trade_time, trade_type, price, quantity, total_amount,
             avg_price, rainbow_line, profit_rate, profit_loss, ai_confidence,
             exit_reason, is_auto_trading, memo
           ) values (
             $1,$2,null,$3,$4,$5,$6,$7,$8,$9,$10,
             null,null,null,null,null,
             $11,false,$12
           )`,
          [
            account.userId,
            accountId,
            stockCode,
            stockName,
            ymd,
            time,
            tradeType,
            price > 0 ? price : null,
            qty,
            amount > 0 ? amount : null,
            commOrderType.includes("반대매매") ? "forced_liquidation" : null,
            `[복구] 증권사 주문내역 동기화 (${commOrderType || "unknown"})`,
          ],
        );
        insertedJournals += 1;
      }
    }
  }

  const summary = {
    accountId,
    accountNumber: account.accountNumber,
    scannedDates: scanned,
    brokerCompleted,
    insertedOrders,
    updatedOrderNumbers,
    insertedJournals,
  };
  console.log(JSON.stringify(summary, null, 2));

  await client.end();
  process.exit(0);
}

main().catch(async (error: any) => {
  console.error("[reconcile-broker-orders] failed", error?.message || error);
  process.exit(1);
});
