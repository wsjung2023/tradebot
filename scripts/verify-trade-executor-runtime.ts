import { TradeExecutorService } from "../server/services/trade-executor.service";

type TestResult = { name: string; ok: boolean; detail?: string };

function assertEqual(name: string, actual: unknown, expected: unknown): TestResult {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  return { name, ok, detail: ok ? undefined : `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}` };
}

function assert(name: string, condition: boolean, detail?: string): TestResult {
  return { name, ok: condition, detail: condition ? undefined : detail };
}

async function run() {
  const svc = new TradeExecutorService() as any;
  const results: TestResult[] = [];

  const settingsBase = {
    defaultPositionSize: "1000000",
    baseUnitSize: "500000",
    maxUnitsPerStock: 5,
    hardMaxCapitalPerStock: "2500000",
    entryLadderSettings: [
      { line: 50, units: 1 },
      { line: 40, units: 1 },
      { line: 30, units: 1 },
      { line: 20, units: 1 },
      { line: 10, units: 1 },
    ],
    aiEntryPolicy: { candidateDecisionCooldownMode: "daily_three_slots" },
  };

  results.push(
    assertEqual(
      "unit-size priority: baseUnitSize first",
      svc.getConfiguredUnitSize(settingsBase, { unitSize: "700000" }),
      500000,
    ),
  );
  results.push(
    assertEqual(
      "unit-size fallback: legacy config.unitSize",
      svc.getConfiguredUnitSize({ ...settingsBase, baseUnitSize: null }, { unitSize: "700000" }),
      700000,
    ),
  );
  results.push(
    assertEqual(
      "unit-size fallback: defaultPositionSize",
      svc.getConfiguredUnitSize({ ...settingsBase, baseUnitSize: null, defaultPositionSize: "900000" }, {}),
      900000,
    ),
  );

  const mapFromLadder = svc.getLineUnitMap(settingsBase, { lineUnits: { 10: 2, 20: 2, 30: 2, 40: 2, 50: 2 } });
  results.push(assertEqual("ladder map uses entryLadderSettings first", mapFromLadder, { 10: 1, 20: 1, 30: 1, 40: 1, 50: 1 }));

  const mapFromLegacy = svc.getLineUnitMap({ ...settingsBase, entryLadderSettings: null }, { lineUnits: { 10: 2, 20: 3, 30: 1, 40: 0, 50: 4 } });
  results.push(assertEqual("ladder map fallback uses legacy lineUnits", mapFromLegacy, { 10: 2, 20: 3, 30: 1, 40: 0, 50: 4 }));

  results.push(assertEqual("unit count by line", svc.getUnitCountForLine(30, settingsBase, {}), 1));
  results.push(assertEqual("unit count missing line -> 0 when map exists", svc.getUnitCountForLine(60, settingsBase, {}), 0));
  results.push(assertEqual("unit count fallback -> 1 when no map", svc.getUnitCountForLine(30, { ...settingsBase, entryLadderSettings: null }, {}), 1));

  // quantity cap: by maxUnitsPerStock and hardMaxCapitalPerStock
  // raw qty=100, price=10000, unitSize=500000, maxUnits=3 => max capital by units=1,500,000 => max qty 150
  // hard cap 1,000,000 => max qty 100 (hard cap tighter)
  const capped = svc.clampQuantityByCapital(
    300,
    10000,
    { ...settingsBase, maxUnitsPerStock: 3, hardMaxCapitalPerStock: "1000000" },
    500000,
    0,
  );
  results.push(assertEqual("hard cap clamp applies", capped, 100));

  const cappedWithExisting = svc.clampQuantityByCapital(
    100,
    10000,
    { ...settingsBase, maxUnitsPerStock: 5, hardMaxCapitalPerStock: "2500000" },
    500000,
    2200000,
  );
  results.push(assertEqual("existing holding capital respected", cappedWithExisting, 30));

  // cooldown window checks
  const now = new Date("2026-05-08T05:20:00.000Z"); // KST 14:20
  const cool3 = svc.getDecisionCooldownWindow({ ...settingsBase, aiEntryPolicy: { candidateDecisionCooldownMode: "daily_three_slots" } }, now);
  results.push(assert("cooldown daily_three_slots label", cool3.label === "daily_three_slots:13:30", `label=${cool3.label}`));

  const coolDaily = svc.getDecisionCooldownWindow({ ...settingsBase, aiEntryPolicy: { candidateDecisionCooldownMode: "daily_once" } }, now);
  results.push(assert("cooldown daily_once label", coolDaily.label === "daily_once", `label=${coolDaily.label}`));

  const cool120 = svc.getDecisionCooldownWindow({ ...settingsBase, aiEntryPolicy: { candidateDecisionCooldownMode: "interval_120m" } }, now);
  const minutes = Math.round((now.getTime() - cool120.since.getTime()) / 60000);
  results.push(assert("cooldown 120m window", minutes === 120, `minutes=${minutes}`));

  const cool60 = svc.getDecisionCooldownWindow({ ...settingsBase, aiEntryPolicy: { candidateDecisionCooldownMode: "interval_60m" } }, now);
  const minutes60 = Math.round((now.getTime() - cool60.since.getTime()) / 60000);
  results.push(assert("cooldown 60m window", minutes60 === 60, `minutes=${minutes60}`));

  const cool30 = svc.getDecisionCooldownWindow({ ...settingsBase, aiEntryPolicy: { candidateDecisionCooldownMode: "interval_30m" } }, now);
  const minutes30 = Math.round((now.getTime() - cool30.since.getTime()) / 60000);
  results.push(assert("cooldown 30m window", minutes30 === 30, `minutes=${minutes30}`));

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} - ${r.name}${r.detail ? ` | ${r.detail}` : ""}`);
  }
  console.log(`SUMMARY: total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error("verify-trade-executor-runtime failed:", err);
  process.exit(1);
});
