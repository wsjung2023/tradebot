import { TradeExecutorService } from "../server/services/trade-executor.service";
import { BalanceRefreshService } from "../server/services/balance-refresh.service";
import { storage } from "../server/storage";

type TestResult = { name: string; ok: boolean; detail?: string };

function pass(name: string): TestResult {
  return { name, ok: true };
}

function fail(name: string, detail: string): TestResult {
  return { name, ok: false, detail };
}

function assert(name: string, condition: boolean, detail: string): TestResult {
  return condition ? pass(name) : fail(name, detail);
}

async function testSellCooldownSkip(): Promise<TestResult> {
  const svc = new TradeExecutorService() as any;
  const model = { id: 1, userId: "u1", config: { accountId: 100 } };
  const settings = { aiEntryPolicy: { sellRetryCooldownSec: 300 } };
  const stock = { code: "402490", name: "그린리소스", price: 16670 };
  const rainbow = { currentLine: 80, action: "sell", weight: 100, confidence: 90 };

  const original = {
    getKiwoomAccounts: (storage as any).getKiwoomAccounts,
    getHoldings: (storage as any).getHoldings,
    getOrders: (storage as any).getOrders,
    createOrder: (storage as any).createOrder,
  };

  let createOrderCount = 0;
  let snapshotCalled = false;
  try {
    (storage as any).getKiwoomAccounts = async () => [{ id: 100, accountNumber: "123", accountType: "mock" }];
    (storage as any).getHoldings = async () => [{ stockCode: "402490", quantity: 10, averagePrice: "10000" }];
    (storage as any).getOrders = async () => [
      {
        stockCode: "402490",
        orderType: "sell",
        orderStatus: "failed",
        createdAt: new Date(),
      },
    ];
    (storage as any).createOrder = async () => {
      createOrderCount += 1;
      return { id: 1 };
    };
    svc.getBrokerPositionSnapshot = async () => {
      snapshotCalled = true;
      return { holdingQty: 10, sellableQty: 10 };
    };

    await svc.executeSell(model as any, settings as any, stock as any, rainbow as any, {} as any);
    return assert(
      "sell cooldown blocks retry before order placement",
      createOrderCount === 0 && snapshotCalled === false,
      `createOrderCount=${createOrderCount}, snapshotCalled=${snapshotCalled}`,
    );
  } finally {
    (storage as any).getKiwoomAccounts = original.getKiwoomAccounts;
    (storage as any).getHoldings = original.getHoldings;
    (storage as any).getOrders = original.getOrders;
    (storage as any).createOrder = original.createOrder;
  }
}

async function testSellableClamp(): Promise<TestResult> {
  const svc = new TradeExecutorService() as any;
  const model = { id: 1, userId: "u1", config: { accountId: 100 } };
  const settings = { aiEntryPolicy: { sellRetryCooldownSec: 0 } };
  const stock = { code: "402490", name: "그린리소스", price: 16670 };
  const rainbow = { currentLine: 80, action: "sell", weight: 100, confidence: 90 };

  const original = {
    getKiwoomAccounts: (storage as any).getKiwoomAccounts,
    getHoldings: (storage as any).getHoldings,
    getOrders: (storage as any).getOrders,
    createOrder: (storage as any).createOrder,
    updateOrder: (storage as any).updateOrder,
    getTradingPerformanceByStock: (storage as any).getTradingPerformanceByStock,
    updateTradingPerformance: (storage as any).updateTradingPerformance,
    createTradeJournal: (storage as any).createTradeJournal,
    createEngineNotification: (storage as any).createEngineNotification,
  };

  let createdQty = -1;
  let placedQty = -1;
  let completedQty = -1;
  try {
    (storage as any).getKiwoomAccounts = async () => [{ id: 100, accountNumber: "123", accountType: "mock" }];
    (storage as any).getHoldings = async () => [{ stockCode: "402490", quantity: 10, averagePrice: "10000" }];
    (storage as any).getOrders = async () => [];
    (storage as any).createOrder = async (payload: any) => {
      createdQty = payload.orderQuantity;
      return { id: 99 };
    };
    (storage as any).updateOrder = async (_id: number, patch: any) => {
      if (patch?.orderStatus === "completed") completedQty = patch.executedQuantity;
      return {};
    };
    (storage as any).getTradingPerformanceByStock = async () => undefined;
    (storage as any).updateTradingPerformance = async () => ({});
    (storage as any).createTradeJournal = async () => ({});
    (storage as any).createEngineNotification = async () => ({});

    svc.getBrokerPositionSnapshot = async () => ({ holdingQty: 10, sellableQty: 3 });

    const kiwoom = {
      placeOrder: async (payload: any) => {
        placedQty = payload.orderQuantity;
        return { output: { ord_no: "A123" } };
      },
    };

    await svc.executeSell(model as any, settings as any, stock as any, rainbow as any, kiwoom as any);
    return assert(
      "sell quantity is clamped to broker sellable quantity",
      createdQty === 3 && placedQty === 3 && completedQty === 3,
      `createdQty=${createdQty}, placedQty=${placedQty}, completedQty=${completedQty}`,
    );
  } finally {
    (storage as any).getKiwoomAccounts = original.getKiwoomAccounts;
    (storage as any).getHoldings = original.getHoldings;
    (storage as any).getOrders = original.getOrders;
    (storage as any).createOrder = original.createOrder;
    (storage as any).updateOrder = original.updateOrder;
    (storage as any).getTradingPerformanceByStock = original.getTradingPerformanceByStock;
    (storage as any).updateTradingPerformance = original.updateTradingPerformance;
    (storage as any).createTradeJournal = original.createTradeJournal;
    (storage as any).createEngineNotification = original.createEngineNotification;
  }
}

async function testFailureLogPriceField(): Promise<TestResult> {
  const svc = new TradeExecutorService() as any;
  const model = { id: 1, userId: "u1", config: { accountId: 100 } };
  const settings = { aiEntryPolicy: { sellRetryCooldownSec: 0 } };
  const stock = { code: "402490", name: "그린리소스", price: 12345 };
  const rainbow = { currentLine: 80, action: "sell", weight: 100, confidence: 90 };

  const original = {
    getKiwoomAccounts: (storage as any).getKiwoomAccounts,
    getHoldings: (storage as any).getHoldings,
    getOrders: (storage as any).getOrders,
    createOrder: (storage as any).createOrder,
    updateOrder: (storage as any).updateOrder,
    createTradingLog: (storage as any).createTradingLog,
    createEngineNotification: (storage as any).createEngineNotification,
  };

  let loggedPrice: number | undefined;
  try {
    (storage as any).getKiwoomAccounts = async () => [{ id: 100, accountNumber: "123", accountType: "mock" }];
    (storage as any).getHoldings = async () => [{ stockCode: "402490", quantity: 10, averagePrice: "10000" }];
    (storage as any).getOrders = async () => [];
    (storage as any).createOrder = async () => ({ id: 77 });
    (storage as any).updateOrder = async () => ({});
    (storage as any).createTradingLog = async (payload: any) => {
      loggedPrice = payload?.details?.price;
      return {};
    };
    (storage as any).createEngineNotification = async () => ({});

    svc.getBrokerPositionSnapshot = async () => ({ holdingQty: 10, sellableQty: 10 });

    const kiwoom = {
      placeOrder: async () => {
        throw new Error("mock sell failure");
      },
    };

    await svc.executeSell(model as any, settings as any, stock as any, rainbow as any, kiwoom as any);
    return assert(
      "sell failure log writes stock.price into details.price",
      loggedPrice === 12345,
      `loggedPrice=${String(loggedPrice)}`,
    );
  } finally {
    (storage as any).getKiwoomAccounts = original.getKiwoomAccounts;
    (storage as any).getHoldings = original.getHoldings;
    (storage as any).getOrders = original.getOrders;
    (storage as any).createOrder = original.createOrder;
    (storage as any).updateOrder = original.updateOrder;
    (storage as any).createTradingLog = original.createTradingLog;
    (storage as any).createEngineNotification = original.createEngineNotification;
  }
}

async function testBalanceRefreshUsesActiveAccountSelector(): Promise<TestResult> {
  const svc = new BalanceRefreshService() as any;
  const source = String(svc.refreshAllActiveAccounts);
  const ok = source.includes("getAllActiveKiwoomAccounts") && !source.includes("getAllRealKiwoomAccounts");
  return assert(
    "balance refresh selector switched to active accounts",
    ok,
    "refreshAllActiveAccounts does not reference getAllActiveKiwoomAccounts as expected",
  );
}

async function testBalanceRefreshLegacyAlias(): Promise<TestResult> {
  const svc = new BalanceRefreshService() as any;
  let called = 0;
  const original = svc.refreshAllActiveAccounts;
  try {
    svc.refreshAllActiveAccounts = async () => {
      called += 1;
    };
    await svc.refreshAllRealAccounts();
    return assert(
      "refreshAllRealAccounts delegates to refreshAllActiveAccounts",
      called === 1,
      `called=${called}`,
    );
  } finally {
    svc.refreshAllActiveAccounts = original;
  }
}

async function run() {
  const tests = [
    testSellCooldownSkip,
    testSellableClamp,
    testFailureLogPriceField,
    testBalanceRefreshUsesActiveAccountSelector,
    testBalanceRefreshLegacyAlias,
  ];
  const results: TestResult[] = [];
  for (const t of tests) {
    results.push(await t());
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} - ${r.name}${r.detail ? ` | ${r.detail}` : ""}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`SUMMARY total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length > 0) process.exit(1);
}

run().catch((e) => {
  console.error("test-sell-guard-regression failed:", e);
  process.exit(1);
});

