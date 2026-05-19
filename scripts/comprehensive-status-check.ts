
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';

function nowKst() {
  return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function getTodayKstRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return { start: today, end: tomorrow };
}

async function main() {
  console.log(`\n🔍 [${nowKst()}] Comprehensive System Status Check\n`);
  const { start, end } = getTodayKstRange();

  // 1. Auto Trading Runs
  console.log('--- [1] Auto Trading Runs ---');
  try {
    const runs = await db.select().from(schema.autoTradingRuns);
    if (runs.length === 0) {
      console.log('No auto trading runs found.');
    } else {
      for (const run of runs) {
        console.log(`User: ${run.userId} | State: ${run.state} | Reason: ${run.reason || '-'} | Last Cycle: ${run.lastCycleAt?.toISOString() || '-'}`);
        if (run.lastError) console.log(`  ERROR: ${run.lastError}`);
      }
    }
  } catch (e: any) {
    console.log(`  Error querying runs: ${e.message}`);
  }
  console.log('');

  // 2. Active Models
  console.log('--- [2] Active AI Models ---');
  try {
    const activeModels = await db.select().from(schema.aiModels).where(eq(schema.aiModels.isActive, true));
    if (activeModels.length === 0) {
      console.log('No active AI models found.');
    } else {
      for (const m of activeModels) {
        console.log(`ID: ${m.id} | Name: ${m.modelName} | Type: ${m.modelType} | User: ${m.userId}`);
      }
    }
  } catch (e: any) {
    console.log(`  Error querying models: ${e.message}`);
  }
  console.log('');

  // 3. Engine Notifications (Today)
  console.log('--- [3] Engine Notifications (Today) ---');
  try {
    const notifications = await db.select()
      .from(schema.engineNotifications)
      .where(gte(schema.engineNotifications.createdAt, start))
      .orderBy(desc(schema.engineNotifications.createdAt))
      .limit(10);
    if (notifications.length === 0) {
      console.log('No notifications today.');
    } else {
      for (const n of notifications) {
        console.log(`[${n.severity.toUpperCase()}] ${n.type}: ${n.message} (${n.createdAt.toISOString()})`);
      }
    }
  } catch (e: any) {
    console.log(`  Error querying notifications: ${e.message}`);
  }
  console.log('');

  // 4. Kiwoom Jobs (Recent 1 hour)
  console.log('--- [4] Recent Kiwoom Jobs (Last 1 hour) ---');
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobs = await db.select()
      .from(schema.kiwoomJobs)
      .where(gte(schema.kiwoomJobs.createdAt, oneHourAgo))
      .orderBy(desc(schema.kiwoomJobs.createdAt));
    
    const jobStats = {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      done: jobs.filter(j => j.status === 'done').length,
      error: jobs.filter(j => j.status === 'error').length,
    };
    console.log(`Total: ${jobStats.total} | Pending: ${jobStats.pending} | Done: ${jobStats.done} | Error: ${jobStats.error}`);
    if (jobStats.error > 0) {
      console.log('Recent Errors (Sample):');
      jobs.filter(j => j.status === 'error').slice(0, 5).forEach(j => {
        console.log(`  ${j.jobType}: ${j.errorMessage} (${j.createdAt.toISOString()})`);
      });
    }
  } catch (e: any) {
    console.log(`  Error querying jobs: ${e.message}`);
  }
  console.log('');

  // 5. Candidates & Decisions (Today)
  console.log('--- [5] Candidates & Decisions Today ---');
  try {
    const candidates = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateStocks)
      .where(gte(schema.candidateStocks.scannedAt, start));
    
    const decisions = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisionLogs)
      .where(gte(schema.candidateDecisionLogs.decidedAt, start));
    
    const acceptedDecisions = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisionLogs)
      .where(and(gte(schema.candidateDecisionLogs.decidedAt, start), eq(schema.candidateDecisionLogs.accepted, true)));

    console.log(`Candidate Stocks Scanned: ${candidates[0].count}`);
    console.log(`AI Decisions Made: ${decisions[0].count}`);
    console.log(`Accepted (Buy Signals): ${acceptedDecisions[0].count}`);
    
    if (decisions[0].count > 0) {
      const recentDecisions = await db.select()
        .from(schema.candidateDecisionLogs)
        .where(gte(schema.candidateDecisionLogs.decidedAt, start))
        .orderBy(desc(schema.candidateDecisionLogs.decidedAt))
        .limit(5);
      console.log('Recent Decisions:');
      for (const d of recentDecisions) {
        console.log(`  ${d.stockName}(${d.stockCode}) | Accepted: ${d.accepted} | Reason: ${d.rejectReason || 'N/A'} (${d.decidedAt.toISOString()})`);
      }
    }
  } catch (e: any) {
    console.log(`  Error querying candidates/decisions: ${e.message}`);
  }
  console.log('');

  // 6. Orders (Today)
  console.log('--- [6] Orders Today ---');
  try {
    const todayOrders = await db.select()
      .from(schema.orders)
      .where(gte(schema.orders.createdAt, start))
      .orderBy(desc(schema.orders.createdAt));
    console.log(`Total Orders: ${todayOrders.length}`);
    if (todayOrders.length > 0) {
      todayOrders.slice(0, 10).forEach(o => {
        console.log(`  ${o.orderType.toUpperCase()} ${o.stockName}(${o.stockCode}) | Qty: ${o.orderQuantity} | Status: ${o.orderStatus} (${o.createdAt.toISOString()})`);
      });
    }
  } catch (e: any) {
    // If it fails again, try selecting without the details column
    try {
      console.log('  Retrying without details column...');
      const todayOrders = await db.select({
        id: schema.orders.id,
        stockCode: schema.orders.stockCode,
        stockName: schema.orders.stockName,
        orderType: schema.orders.orderType,
        orderStatus: schema.orders.orderStatus,
        createdAt: schema.orders.createdAt
      })
      .from(schema.orders)
      .where(gte(schema.orders.createdAt, start))
      .orderBy(desc(schema.orders.createdAt));
      console.log(`Total Orders (Partial): ${todayOrders.length}`);
    } catch (e2: any) {
      console.log(`  Final error querying orders: ${e2.message}`);
    }
  }
  console.log('');
}

main().catch(console.error).finally(() => process.exit(0));
