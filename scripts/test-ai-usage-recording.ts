import OpenAI from "openai";
import { AIService } from "../server/services/ai.service";
import { storage } from "../server/storage";

async function run() {
  const svc = new AIService() as any;
  const originalCreate = svc.openai?.chat?.completions?.create;
  const originalRecord = (storage as any).recordAiUsageDaily;

  const calls: any[] = [];
  (storage as any).recordAiUsageDaily = async (data: any) => {
    calls.push(data);
  };

  svc.openai.chat.completions.create = async () =>
    ({
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 300,
        total_tokens: 1500,
      },
      choices: [{ message: { content: JSON.stringify({ action: "hold", confidence: 70, themeScore: 60, newsScore: 55 }) } }],
    }) as unknown as OpenAI.Chat.Completions.ChatCompletion;

  try {
    await svc.analyzeStock(
      {
        stockCode: "005930",
        stockName: "삼성전자",
        currentPrice: 70000,
      },
      "gpt-5-mini",
      { userId: "u-test", accountId: 123, source: "test" },
    );

    const c1 = calls.length === 1;
    const row = calls[0] ?? {};
    const c2 = row.userId === "u-test";
    const c3 = row.accountId === 123;
    const c4 = Number(row.requestCount) === 1;
    const c5 = Number(row.promptTokens) === 1200 && Number(row.completionTokens) === 300 && Number(row.totalTokens) === 1500;

    const results = [
      { name: "record_called_once", ok: c1 },
      { name: "record_user_scope", ok: c2 && c3 },
      { name: "record_request_count", ok: c4 },
      { name: "record_token_fields", ok: c5 },
    ];

    for (const r of results) {
      console.log(`${r.ok ? "PASS" : "FAIL"} - ${r.name}`);
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`SUMMARY total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`);
    if (failed.length > 0) process.exit(1);
  } finally {
    if (originalCreate) svc.openai.chat.completions.create = originalCreate;
    (storage as any).recordAiUsageDaily = originalRecord;
  }
}

run().catch((err) => {
  console.error("test-ai-usage-recording failed:", err);
  process.exit(1);
});

